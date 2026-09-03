"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type CellEditRequestEvent,
  type CellFocusedEvent,
  type CellKeyDownEvent,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
  type ValueGetterParams,
} from "ag-grid-community";
import { temaNordelta } from "./tema";
import { calcularImpacto, validarPartida } from "@/lib/domain/fx";
import {
  MONEDAS, MEDIOS_PAGO, CATEGORIAS, MEDIOS_CON_COMISION, CATEGORIAS_QUE_IMPACTAN,
} from "@/lib/domain/types";
import type { Categoria, Contraparte, MedioPago, Moneda, Oficina } from "@/lib/domain/types";
import {
  ETIQUETA_CATEGORIA, ETIQUETA_MEDIO,
  interpretarCategoria, interpretarMedioPago, interpretarMoneda, separarBloquePegado,
} from "@/lib/domain/parseo";
import { fmtMonto, parseMonto } from "@/lib/format";
import { guardarFilas, type FilaParaGuardar } from "@/app/(app)/carga/acciones";
import { Button, Card, CardBar, CardFoot, Monto, cx } from "@/components/ui";
import { IcoMas } from "@/components/ui/icons";
import { usarAvisos } from "@/components/ui/Toast";
import { FiltrosCarga } from "@/app/(app)/carga/Filtros";
import { medir, medirAsync } from "@/lib/observabilidad/medicion";

ModuleRegistry.registerModules([AllCommunityModule]);

/**
 * Grilla de carga diaria.
 *
 * Una fila es una partida: un solo monto con su moneda y su medio de pago.
 * Reemplaza las dieciséis columnas de la planilla legacy, donde el medio de
 * pago estaba codificado en cuál columna llenabas.
 *
 * Las columnas están dimensionadas para entrar completas en una notebook de
 * 1280 px. Que la columna de impacto quede cortada por scroll horizontal es
 * inaceptable: es el dato que le dice al operador si cargó bien.
 */

export interface FilaCarga {
  key: string;
  contraparte: string;
  concepto: string;
  categoria: Categoria;
  medio_pago: MedioPago;
  moneda: Moneda;
  monto: string;
  tipo_cambio: string;
  comision: string;
}

const ORDEN_COLUMNAS = [
  "contraparte", "concepto", "categoria", "medio_pago",
  "moneda", "monto", "tipo_cambio", "comision",
] as const satisfies readonly (keyof FilaCarga)[];

type CampoPegable = (typeof ORDEN_COLUMNAS)[number];

export function filaVacia(): FilaCarga {
  return {
    key: globalThis.crypto?.randomUUID?.() ?? `f${Math.random().toString(36).slice(2)}`,
    contraparte: "", concepto: "", categoria: "ingreso", medio_pago: "efectivo",
    moneda: "ARS", monto: "", tipo_cambio: "", comision: "",
  };
}

const esNumerico = (v: string) => parseMonto(v) !== null;
const estaVacia = (f: FilaCarga) =>
  f.contraparte.trim() === "" && f.concepto.trim() === "" && f.monto.trim() === "";

function impactoDeFila(f: FilaCarga) {
  const monto = parseMonto(f.monto);
  const tc = parseMonto(f.tipo_cambio);
  const com = parseMonto(f.comision);
  if (monto === null || tc === null || com === null || monto === 0) return null;
  try {
    return calcularImpacto({
      medio_pago: f.medio_pago,
      moneda_nominal: f.moneda,
      monto_nominal: monto,
      tipo_cambio: tc === 0 ? null : tc,
      comision_pct: com === 0 ? null : com / 100,
    });
  } catch {
    return null;
  }
}

/** Errores de la fila por campo, con el mensaje que ve el operador. */
function erroresDeFila(f: FilaCarga): Partial<Record<keyof FilaCarga, string>> {
  const out: Partial<Record<keyof FilaCarga, string>> = {};
  if (!esNumerico(f.monto)) out.monto = "Escribí un número";
  if (!esNumerico(f.tipo_cambio)) out.tipo_cambio = "Escribí un número";
  if (!esNumerico(f.comision)) out.comision = "Escribí un número";
  if (estaVacia(f)) return out;

  if (f.contraparte.trim() === "") out.contraparte = "Elegí una contraparte";

  const monto = parseMonto(f.monto);
  const tc = parseMonto(f.tipo_cambio);
  const com = parseMonto(f.comision);
  if (monto !== null && tc !== null && com !== null) {
    for (const e of validarPartida({
      medio_pago: f.medio_pago, moneda_nominal: f.moneda, monto_nominal: monto,
      tipo_cambio: tc === 0 ? null : tc, comision_pct: com === 0 ? null : com / 100,
    })) {
      const campo = e.campo === "monto_nominal" ? "monto"
        : e.campo === "comision_pct" ? "comision"
        : (e.campo as keyof FilaCarga | undefined);
      if (campo && !out[campo]) out[campo] = e.message;
    }
  }
  return out;
}

export function CargaGrid({
  filasIniciales,
  contrapartes,
  fecha,
  oficinaId,
  oficinas,
}: {
  filasIniciales: FilaCarga[];
  contrapartes: Contraparte[];
  fecha: string;
  oficinaId: number;
  oficinas: Oficina[];
}) {
  const inicial = useMemo(
    () => (filasIniciales.length ? [...filasIniciales, filaVacia()] : [filaVacia()]),
    [filasIniciales],
  );
  const [filas, setFilas] = useState<FilaCarga[]>(inicial);
  const [historial, setHistorial] = useState<FilaCarga[][]>([]);
  const [guardando, guardar] = useTransition();
  const { avisar } = usarAvisos();

  const apiRef = useRef<GridApi<FilaCarga> | null>(null);
  const nombres = useMemo(() => contrapartes.map((c) => c.nombre), [contrapartes]);

  const aplicar = useCallback(
    (siguiente: FilaCarga[], recordar = true) => {
      if (recordar) setHistorial((h) => [...h.slice(-49), filas]);
      setFilas(siguiente);
      apiRef.current?.refreshCells({ force: true });
    },
    [filas],
  );

  const deshacer = useCallback(() => {
    setHistorial((h) => {
      if (h.length === 0) return h;
      setFilas(h[h.length - 1]);
      apiRef.current?.refreshCells({ force: true });
      return h.slice(0, -1);
    });
  }, []);

  /* ── Pegado desde Excel ──────────────────────────────────────
     El módulo de portapapeles de AG Grid es Enterprise, así que se
     intercepta el evento y se escribe el bloque acá.

     Todo valor se interpreta contra el dominio: «Ingresos» pasa a `ingreso`,
     «Dólares» a USD, «2.400.000,00» a 2400000. Lo que no se puede
     interpretar queda sin aplicar y se avisa — nunca se adivina un valor
     financiero.                                                            */
  const alPegar = useCallback(
    (e: React.ClipboardEvent) => {
      const texto = e.clipboardData.getData("text/plain");
      if (!texto) return;
      const bloque = medir("pegado", () => separarBloquePegado(texto), {
        filas: texto.split("\n").length,
      });
      if (bloque.length === 1 && bloque[0].length === 1) return; // una celda: nativo
      e.preventDefault();

      const api = apiRef.current;
      const foco = api?.getFocusedCell();
      if (!api || !foco) {
        avisar("Hacé clic en una celda antes de pegar", { tono: "info" });
        return;
      }

      const colInicio = (ORDEN_COLUMNAS as readonly string[]).indexOf(foco.column.getColId());
      if (colInicio < 0) return;

      const siguiente = filas.slice();
      let sinInterpretar = 0;

      bloque.forEach((celdas, i) => {
        const idx = (foco.rowIndex ?? 0) + i;
        while (siguiente.length <= idx) siguiente.push(filaVacia());
        const fila: FilaCarga = { ...siguiente[idx] };

        celdas.forEach((crudo, j) => {
          const campo = ORDEN_COLUMNAS[colInicio + j] as CampoPegable | undefined;
          if (!campo) return;
          const valor = crudo.trim();

          switch (campo) {
            case "categoria": {
              const v = interpretarCategoria(valor);
              if (v) fila.categoria = v;
              else if (valor !== "") sinInterpretar++;
              break;
            }
            case "medio_pago": {
              const v = interpretarMedioPago(valor);
              if (v) fila.medio_pago = v;
              else if (valor !== "") sinInterpretar++;
              break;
            }
            case "moneda": {
              const v = interpretarMoneda(valor);
              if (v) fila.moneda = v;
              else if (valor !== "") sinInterpretar++;
              break;
            }
            default:
              fila[campo] = valor;
          }
        });

        // La comisión solo existe en transferencias: sin esto un pegado
        // podría dejarla sobre efectivo y la base rechazaría la fila.
        if (!MEDIOS_CON_COMISION.has(fila.medio_pago)) fila.comision = "";
        siguiente[idx] = fila;
      });

      if (!estaVacia(siguiente[siguiente.length - 1])) siguiente.push(filaVacia());
      aplicar(siguiente);

      const nuevas = bloque.length;
      const etiqueta = `${nuevas} ${nuevas === 1 ? "fila pegada" : "filas pegadas"}`;
      if (sinInterpretar > 0) {
        avisar(etiqueta, {
          tono: "info",
          detalle:
            sinInterpretar === 1
              ? "Un valor no se pudo interpretar y quedó sin aplicar."
              : `${sinInterpretar} valores no se pudieron interpretar y quedaron sin aplicar.`,
        });
      } else {
        avisar(etiqueta);
      }
    },
    [filas, aplicar, avisar],
  );

  /* ── Teclado ─────────────────────────────────────────────── */
  const alTeclear = useCallback(
    (e: CellKeyDownEvent<FilaCarga>) => {
      const ev = e.event as KeyboardEvent | null;
      if (!ev) return;

      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "z") {
        ev.preventDefault();
        deshacer();
        return;
      }

      if ((ev.key === "Delete" || ev.key === "Backspace") && !e.api.getEditingCells().length) {
        const campo = e.column?.getColId() as keyof FilaCarga | undefined;
        // Los desplegables no se vacían: siempre tienen que tener un valor.
        if (!campo || !e.data || ["categoria", "medio_pago", "moneda"].includes(campo)) return;
        ev.preventDefault();
        aplicar(filas.map((f) => (f.key === e.data!.key ? { ...f, [campo]: "" } : f)));
      }
    },
    [filas, aplicar, deshacer],
  );

  /** La fila con el foco se marca en su número, no pintando toda la fila:
   *  pintar la fila entera compite con la celda seleccionada. */
  const alEnfocar = useCallback((e: CellFocusedEvent) => {
    document.querySelectorAll(".ag-nordelta .fila-activa").forEach((el) => {
      el.classList.remove("fila-activa");
    });
    if (e.rowIndex === null || e.rowIndex === undefined) return;
    document
      .querySelector(`.ag-nordelta [row-index="${e.rowIndex}"]`)
      ?.classList.add("fila-activa");
  }, []);

  const columnas = useMemo<ColDef<FilaCarga>[]>(() => {
    const errorDe = (f: FilaCarga | undefined, campo: keyof FilaCarga) =>
      f ? erroresDeFila(f)[campo] : undefined;

    const numerica = (
      campo: ColDef<FilaCarga>["field"],
      header: string,
      ancho: number,
      sufijo?: string,
    ): ColDef<FilaCarga> => ({
      field: campo,
      headerName: header,
      width: ancho,
      type: "rightAligned",
      cellClass: (p) => cx("t-num", errorDe(p.data, campo as keyof FilaCarga) && "celda-mala"),
      tooltipValueGetter: (p) => errorDe(p.data, campo as keyof FilaCarga) ?? null,
      valueFormatter: (p) => {
        const v = String(p.value ?? "");
        if (v === "") return "";
        const n = parseMonto(v);
        return n === null ? v : fmtMonto(n) + (sufijo ?? "");
      },
    });

    return [
      {
        headerName: "",
        colId: "orden",
        width: 34,
        pinned: "left",
        sortable: false,
        editable: false,
        cellClass: "celda-orden font-mono text-[10px] text-ink-4 !bg-raised",
        type: "rightAligned",
        valueGetter: (p: ValueGetterParams<FilaCarga>) => (p.node?.rowIndex ?? 0) + 1,
      },
      {
        field: "contraparte",
        headerName: "Contraparte",
        flex: 1,
        minWidth: 144,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: ["", ...nombres] },
        cellClass: (p) => cx("text-ink font-medium", errorDe(p.data, "contraparte") && "celda-mala"),
        tooltipValueGetter: (p) => errorDe(p.data, "contraparte") ?? null,
      },
      { field: "concepto", headerName: "Detalle", flex: 1.15, minWidth: 116 },
      {
        field: "categoria",
        headerName: "Categoría",
        width: 118,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: CATEGORIAS },
        valueFormatter: (p) => ETIQUETA_CATEGORIA[p.value as Categoria] ?? String(p.value),
      },
      {
        field: "medio_pago",
        headerName: "Medio",
        width: 108,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: MEDIOS_PAGO },
        valueFormatter: (p) => ETIQUETA_MEDIO[p.value as MedioPago] ?? String(p.value),
      },
      {
        field: "moneda",
        headerName: "Moneda",
        width: 70,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: MONEDAS },
        cellClass: "font-mono text-[12px]",
      },
      numerica("monto", "Monto", 110),
      numerica("tipo_cambio", "T. cambio", 88),
      {
        ...numerica("comision", "Comisión", 90, " %"),
        editable: (p) => !!p.data && MEDIOS_CON_COMISION.has(p.data.medio_pago),
        cellClass: (p) =>
          cx(
            "t-num",
            errorDe(p.data, "comision") && "celda-mala",
            p.data && !MEDIOS_CON_COMISION.has(p.data.medio_pago) && "!text-ink-4 celda-calculada",
          ),
      },
      {
        headerName: "Impacto",
        colId: "impacta",
        width: 122,
        pinned: "right",
        editable: false,
        sortable: false,
        type: "rightAligned",
        // Fondo hundido: se distingue de una celda editable sin parecer
        // deshabilitada.
        cellClass: "celda-calculada",
        cellRenderer: (p: { data?: FilaCarga }) => {
          if (!p.data) return null;
          if (Object.keys(erroresDeFila(p.data)).length > 0) {
            return <span className="t-num text-[12px] text-neg">revisar</span>;
          }
          // Compras, ventas e impuestos no van a la cuenta corriente: mostrar
          // un importe acá haría creer que sí.
          if (!CATEGORIAS_QUE_IMPACTAN.has(p.data.categoria)) {
            return <span className="t-num text-[11px] text-ink-4">no impacta</span>;
          }
          const r = impactoDeFila(p.data);
          if (!r) return <span className="t-num text-[12px] text-ink-4">—</span>;
          const convirtio = r.moneda !== p.data.moneda;
          return (
            <Monto
              valor={r.monto}
              moneda={r.moneda}
              tamano="sm"
              className={cx(
                "text-[12px]",
                r.monto < 0 ? "text-neg" : convirtio ? "text-brand font-semibold" : "text-ink-2",
              )}
            />
          );
        },
      },
    ];
  }, [nombres]);

  const totales = useMemo(() => {
    const acum: Partial<Record<Moneda, number>> = {};
    for (const f of filas) {
      if (Object.keys(erroresDeFila(f)).length > 0) continue;
      if (!CATEGORIAS_QUE_IMPACTAN.has(f.categoria)) continue;
      const r = impactoDeFila(f);
      if (!r) continue;
      acum[r.moneda] = (acum[r.moneda] ?? 0) + r.monto;
    }
    return acum;
  }, [filas]);

  const conError = useMemo(
    () => filas.filter((f) => Object.keys(erroresDeFila(f)).length > 0).length,
    [filas],
  );
  const cargables = useMemo(() => filas.filter((f) => !estaVacia(f)), [filas]);

  const onCellEditRequest = useCallback(
    (e: CellEditRequestEvent<FilaCarga>) => {
      const campo = e.colDef.field as keyof FilaCarga | undefined;
      if (!campo || !e.data) return;

      const siguiente = filas.map((f) => {
        if (f.key !== e.data.key) return f;
        const nueva = { ...f, [campo]: String(e.newValue ?? "") } as FilaCarga;
        if (campo === "medio_pago" && !MEDIOS_CON_COMISION.has(nueva.medio_pago)) nueva.comision = "";
        return nueva;
      });

      // Escribir en la última fila crea la siguiente, como en la planilla.
      if (e.node.rowIndex === filas.length - 1 && String(e.newValue ?? "") !== "") {
        siguiente.push(filaVacia());
      }
      aplicar(siguiente);
    },
    [filas, aplicar],
  );

  const onGridReady = useCallback((e: GridReadyEvent<FilaCarga>) => {
    apiRef.current = e.api;
  }, []);

  function agregarFila() {
    const siguiente = [...filas, filaVacia()];
    aplicar(siguiente);
    // El foco va directo a la contraparte: es el primer campo que se llena.
    requestAnimationFrame(() => {
      apiRef.current?.setFocusedCell(siguiente.length - 1, "contraparte");
    });
  }

  function enviar() {
    if (conError > 0 || cargables.length === 0) return;
    guardar(async () => {
      const carga: FilaParaGuardar[] = cargables.map((f) => ({
        contraparte: f.contraparte.trim(),
        concepto: f.concepto.trim(),
        categoria: f.categoria,
        medio_pago: f.medio_pago,
        moneda: f.moneda,
        monto: parseMonto(f.monto)!,
        tipo_cambio: parseMonto(f.tipo_cambio) || null,
        comision_pct: (parseMonto(f.comision) || 0) / 100 || null,
      }));

      const r = await medirAsync("guardado", () => guardarFilas(fecha, oficinaId, carga), {
        filas: carga.length,
      });

      if (!r.ok) {
        avisar("No se pudo guardar", { tono: "error", detalle: r.mensaje });
        return;
      }
      setHistorial([]);
      setFilas([filaVacia()]);
      avisar(
        r.datos.creados === 1 ? "Movimiento guardado" : `${r.datos.creados} movimientos guardados`,
        { detalle: "Ya impactaron en las cuentas y en el balance." },
      );
    });
  }

  return (
    <Card>
      <CardBar>
        <FiltrosCarga oficinas={oficinas} fecha={fecha} oficinaId={oficinaId} />

        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" onClick={deshacer} disabled={historial.length === 0}>
            Deshacer
          </Button>
          <Button size="sm" onClick={agregarFila}>
            <IcoMas className="w-[13px] h-[13px]" />
            Nueva fila
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={enviar}
            disabled={guardando || conError > 0 || cargables.length === 0}
          >
            {guardando ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </CardBar>

      <div onPaste={alPegar} className="ag-nordelta">
        <AgGridReact<FilaCarga>
          theme={temaNordelta}
          rowData={filas}
          columnDefs={columnas}
          getRowId={(p) => p.data.key}
          defaultColDef={{ editable: true, sortable: false, resizable: true, suppressMovable: true }}
          readOnlyEdit
          onCellEditRequest={onCellEditRequest}
          onCellKeyDown={alTeclear}
          onCellFocused={alEnfocar}
          onGridReady={onGridReady}
          domLayout="autoHeight"
          enterNavigatesVertically
          enterNavigatesVerticallyAfterEdit
          stopEditingWhenCellsLoseFocus
          enableCellTextSelection
          tooltipShowDelay={250}
          animateRows={false}
        />
      </div>

      {/* Barra de estado, como una herramienta profesional. */}
      <CardFoot className="!py-2.5">
        <span className="flex items-center gap-3">
          <span className="t-num text-[12px] text-ink-2">
            {cargables.length} {cargables.length === 1 ? "fila" : "filas"}
          </span>
          {conError > 0 ? (
            <span className="flex items-center gap-1.5 text-[12px] text-neg font-medium">
              <span className="w-[5px] h-[5px] rounded-full bg-neg" />
              {conError} con {conError === 1 ? "error" : "errores"}
            </span>
          ) : cargables.length > 0 ? (
            <span className="flex items-center gap-1.5 text-[12px] text-pos">
              <span className="w-[5px] h-[5px] rounded-full bg-pos" />
              {cargables.length === 1 ? "lista para guardar" : "listas para guardar"}
            </span>
          ) : null}
        </span>

        {/* Totales del día, por moneda. Nunca sumados entre sí. */}
        <span className="flex items-center gap-3 ml-auto">
          {MONEDAS.filter((m) => totales[m]).map((m) => (
            <span key={m} className="flex items-baseline gap-1.5">
              <span className="t-label">{m}</span>
              <Monto
                valor={totales[m]!}
                moneda={m}
                tamano="sm"
                className={cx("text-[12.5px] font-semibold", totales[m]! < 0 ? "text-neg" : "text-ink")}
              />
            </span>
          ))}
        </span>
      </CardFoot>

      <CardFoot className="!py-2 !border-t-0 !bg-surface">
        <Kbd>Tab</Kbd> celda
        <Kbd>Enter</Kbd> fila
        <Kbd>Supr</Kbd> vaciar
        <Kbd>⌘Z</Kbd> deshacer
        <span className="ml-auto text-brand font-medium">
          Podés pegar filas directamente desde Excel
        </span>
      </CardFoot>
    </Card>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="font-mono text-[10px] bg-raised border border-line border-b-2 rounded px-1.5 py-px text-ink-2">
      {children}
    </kbd>
  );
}
