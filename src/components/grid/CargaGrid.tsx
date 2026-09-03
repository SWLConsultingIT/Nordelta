"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type CellEditRequestEvent,
  type CellKeyDownEvent,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
  type ValueGetterParams,
} from "ag-grid-community";
import { temaNordelta } from "./tema";
import { calcularImpacto, validarPartida } from "@/lib/domain/fx";
import { MONEDAS, MEDIOS_PAGO, CATEGORIAS, MEDIOS_CON_COMISION } from "@/lib/domain/types";
import type { Categoria, Contraparte, MedioPago, Moneda } from "@/lib/domain/types";
import {
  ETIQUETA_CATEGORIA, ETIQUETA_MEDIO,
  interpretarCategoria, interpretarMedioPago, interpretarMoneda, separarBloquePegado,
} from "@/lib/domain/parseo";
import { fmtMonto, parseMonto } from "@/lib/format";
import { guardarFilas, type FilaParaGuardar } from "@/app/(app)/carga/acciones";
import { Button, cx } from "@/components/ui";
import { medir, medirAsync } from "@/lib/observabilidad/medicion";

ModuleRegistry.registerModules([AllCommunityModule]);

/**
 * Grilla de carga diaria.
 *
 * Una fila es una partida: un solo monto con su moneda y su medio de pago.
 * Reemplaza las dieciséis columnas de la planilla legacy, donde el medio de
 * pago estaba codificado en cuál columna llenabas.
 *
 * Decisión pendiente de validar con quien carga, cronómetro en mano contra
 * el Sheet actual (docs/OPEN_BUSINESS_DECISIONS.md · D12). El modelo de la
 * base no depende de esto: `movimiento + partidas` soporta las dos formas.
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

/** Columnas en el orden en que se pegan desde Excel. */
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

/** El impacto de la fila, o null si algún número es inválido. */
function impactoDeFila(f: FilaCarga) {
  const monto = parseMonto(f.monto);
  const tc = parseMonto(f.tipo_cambio);
  const com = parseMonto(f.comision);
  if (monto === null || tc === null || com === null) return null;
  if (monto === 0) return null;
  try {
    return calcularImpacto({
      medio_pago: f.medio_pago,
      moneda_nominal: f.moneda,
      monto_nominal: monto,
      tipo_cambio: tc === 0 ? null : tc,
      comision_pct: com === 0 ? null : com / 100,
    });
  } catch {
    // Fuera del rango representable. La celda ya se marca por validación.
    return null;
  }
}

/** Errores de dominio de una fila, por campo. */
function erroresDeFila(f: FilaCarga): Partial<Record<keyof FilaCarga, string>> {
  const out: Partial<Record<keyof FilaCarga, string>> = {};
  if (!esNumerico(f.monto)) out.monto = "No es un número";
  if (!esNumerico(f.tipo_cambio)) out.tipo_cambio = "No es un número";
  if (!esNumerico(f.comision)) out.comision = "No es un número";
  if (estaVacia(f)) return out;

  if (f.contraparte.trim() === "") out.contraparte = "Falta la contraparte";

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
}: {
  filasIniciales: FilaCarga[];
  contrapartes: Contraparte[];
  fecha: string;
  oficinaId: number;
}) {
  const inicial = useMemo(
    () => (filasIniciales.length ? [...filasIniciales, filaVacia()] : [filaVacia()]),
    [filasIniciales],
  );
  const [filas, setFilas] = useState<FilaCarga[]>(inicial);
  const [aviso, setAviso] = useState<{ tono: "ok" | "mal"; texto: string } | null>(null);
  const [guardando, guardar] = useTransition();

  const apiRef = useRef<GridApi<FilaCarga> | null>(null);
  // Pila de deshacer. Sin esto, un pegado equivocado sobre veinte filas
  // obliga a rehacerlas a mano. Va en estado y no en un ref porque el botón
  // necesita saber si está vacía durante el render.
  const [historial, setHistorial] = useState<FilaCarga[][]>([]);

  const nombres = useMemo(() => contrapartes.map((c) => c.nombre), [contrapartes]);

  const aplicar = useCallback((siguiente: FilaCarga[], recordar = true) => {
    if (recordar) setHistorial((h) => [...h.slice(-49), filas]);
    setFilas(siguiente);
    setAviso(null);
    apiRef.current?.refreshCells({ force: true });
  }, [filas]);

  const deshacer = useCallback(() => {
    setHistorial((h) => {
      if (h.length === 0) return h;
      setFilas(h[h.length - 1]);
      setAviso(null);
      apiRef.current?.refreshCells({ force: true });
      return h.slice(0, -1);
    });
  }, []);

  /* ── Pegado desde Excel ──────────────────────────────────────
     El módulo de portapapeles de AG Grid es Enterprise, así que se
     intercepta el evento y se escribe el bloque acá.

     Todo valor pegado se interpreta contra el dominio: «Ingresos» pasa a
     `ingreso`, «Dólares» a `USD`, «2.400.000,00» a 2400000. Lo que no se
     puede interpretar se deja como vino y la celda queda marcada — nunca se
     adivina un valor financiero.                                          */
  const alPegar = useCallback(
    (e: React.ClipboardEvent) => {
      const texto = e.clipboardData.getData("text/plain");
      if (!texto) return;
      const bloque = medir("pegado", () => separarBloquePegado(texto), {
        filas: texto.split("\n").length,
      });
      // Una celda sola: comportamiento nativo del editor.
      if (bloque.length === 1 && bloque[0].length === 1) return;
      e.preventDefault();

      const api = apiRef.current;
      const foco = api?.getFocusedCell();
      if (!api || !foco) return;

      const colInicio = (ORDEN_COLUMNAS as readonly string[]).indexOf(
        foco.column.getColId(),
      );
      if (colInicio < 0) return;

      const siguiente = filas.slice();
      let sinInterpretar = 0;

      bloque.forEach((celdas, i) => {
        const idx = (foco.rowIndex ?? 0) + i;
        while (siguiente.length <= idx) siguiente.push(filaVacia());
        const fila: FilaCarga = { ...siguiente[idx] };

        celdas.forEach((crudo, j) => {
          const campo = ORDEN_COLUMNAS[colInicio + j] as CampoPegable | undefined;
          if (!campo) return; // columnas de más: se descartan en silencio
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

        // La comisión solo existe en transferencias. Sin esto, un pegado
        // podría dejarla sobre efectivo y la base rechazaría la fila.
        if (!MEDIOS_CON_COMISION.has(fila.medio_pago)) fila.comision = "";
        siguiente[idx] = fila;
      });

      if (!estaVacia(siguiente[siguiente.length - 1])) siguiente.push(filaVacia());
      aplicar(siguiente);

      if (sinInterpretar > 0) {
        setAviso({
          tono: "mal",
          texto:
            sinInterpretar === 1
              ? "Un valor pegado no se pudo interpretar y quedó sin aplicar."
              : `${sinInterpretar} valores pegados no se pudieron interpretar y quedaron sin aplicar.`,
        });
      }
    },
    [filas, aplicar],
  );

  /* ── Teclado ─────────────────────────────────────────────── */
  const alTeclear = useCallback(
    (e: CellKeyDownEvent<FilaCarga>) => {
      const ev = e.event as KeyboardEvent | null;
      if (!ev) return;

      // Deshacer.
      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "z") {
        ev.preventDefault();
        deshacer();
        return;
      }

      // Borrar el contenido de la celda enfocada, como en una planilla.
      if ((ev.key === "Delete" || ev.key === "Backspace") && !e.api.getEditingCells().length) {
        const campo = e.column?.getColId() as keyof FilaCarga | undefined;
        if (!campo || !e.data || campo === "categoria" || campo === "medio_pago" || campo === "moneda") {
          return; // los desplegables no se vacían: siempre tienen un valor
        }
        ev.preventDefault();
        aplicar(filas.map((f) => (f.key === e.data!.key ? { ...f, [campo]: "" } : f)));
      }
    },
    [filas, aplicar, deshacer],
  );

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
      cellClass: (p) =>
        cx("font-mono tnum", errorDe(p.data, campo as keyof FilaCarga) && "celda-mala"),
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
        width: 44,
        pinned: "left",
        sortable: false,
        editable: false,
        cellClass: "font-mono text-[10px] text-ink-4 !bg-raised",
        type: "rightAligned",
        valueGetter: (p: ValueGetterParams<FilaCarga>) => (p.node?.rowIndex ?? 0) + 1,
      },
      {
        field: "contraparte",
        headerName: "Contraparte",
        width: 168,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: ["", ...nombres] },
        cellClass: (p) => cx("text-ink font-medium", errorDe(p.data, "contraparte") && "celda-mala"),
        tooltipValueGetter: (p) => errorDe(p.data, "contraparte") ?? null,
      },
      { field: "concepto", headerName: "Concepto", flex: 1, minWidth: 170 },
      {
        field: "categoria",
        headerName: "Categoría",
        width: 150,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: CATEGORIAS },
        valueFormatter: (p) => ETIQUETA_CATEGORIA[p.value as Categoria] ?? String(p.value),
      },
      {
        field: "medio_pago",
        headerName: "Medio de pago",
        width: 144,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: MEDIOS_PAGO },
        valueFormatter: (p) => ETIQUETA_MEDIO[p.value as MedioPago] ?? String(p.value),
      },
      {
        field: "moneda",
        headerName: "Moneda",
        width: 96,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: MONEDAS },
        cellClass: "font-mono",
      },
      numerica("monto", "Monto", 128),
      numerica("tipo_cambio", "T. cambio", 110),
      {
        ...numerica("comision", "Comisión", 108, " %"),
        editable: (p) => !!p.data && MEDIOS_CON_COMISION.has(p.data.medio_pago),
        cellClass: (p) =>
          cx(
            "font-mono tnum",
            errorDe(p.data, "comision") && "celda-mala",
            p.data && !MEDIOS_CON_COMISION.has(p.data.medio_pago) && "!text-ink-4 !bg-raised",
          ),
      },
      {
        headerName: "Impacta cta. cte.",
        colId: "impacta",
        width: 152,
        editable: false,
        sortable: false,
        type: "rightAligned",
        cellClass: "!bg-raised",
        cellRenderer: (p: { data?: FilaCarga }) => {
          if (!p.data) return null;
          const errs = erroresDeFila(p.data);
          if (Object.keys(errs).length > 0) {
            return <span className="font-mono text-[12px] text-neg">revisar</span>;
          }
          const r = impactoDeFila(p.data);
          if (!r) return <span className="font-mono text-[12px] text-ink-4">—</span>;
          const convirtio = r.moneda !== p.data.moneda;
          return (
            <span
              className={cx(
                "font-mono tnum text-[12px]",
                r.monto < 0 ? "text-neg" : convirtio ? "text-brand font-semibold" : "text-ink-3",
              )}
            >
              <span className="text-[9.5px] tracking-wider opacity-70 mr-1">{r.moneda}</span>
              {fmtMonto(r.monto)}
            </span>
          );
        },
      },
    ];
  }, [nombres]);

  const totales = useMemo(() => {
    const acum: Partial<Record<Moneda, number>> = {};
    for (const f of filas) {
      if (Object.keys(erroresDeFila(f)).length > 0) continue;
      const r = impactoDeFila(f);
      if (!r) continue;
      acum[r.moneda] = (acum[r.moneda] ?? 0) + r.monto;
    }
    return acum;
  }, [filas]);

  const problemas = useMemo(
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
        const actualizada = { ...f, [campo]: String(e.newValue ?? "") } as FilaCarga;
        // Cambiar el medio de pago a uno sin comisión limpia la comisión.
        if (campo === "medio_pago" && !MEDIOS_CON_COMISION.has(actualizada.medio_pago)) {
          actualizada.comision = "";
        }
        return actualizada;
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

  function enviar() {
    if (problemas > 0 || cargables.length === 0) return;
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

      const r = await medirAsync(
        "guardado",
        () => guardarFilas(fecha, oficinaId, carga),
        { filas: carga.length },
      );
      if (!r.ok) {
        setAviso({ tono: "mal", texto: r.mensaje });
        return;
      }
      setHistorial([]);
      setFilas([filaVacia()]);
      setAviso({
        tono: "ok",
        texto:
          r.datos.creados === 1
            ? "Se guardó 1 movimiento."
            : `Se guardaron ${r.datos.creados} movimientos.`,
      });
    });
  }

  return (
    <>
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
          onGridReady={onGridReady}
          domLayout="autoHeight"
          enterNavigatesVertically
          enterNavigatesVerticallyAfterEdit
          stopEditingWhenCellsLoseFocus
          enableCellTextSelection
          tooltipShowDelay={200}
          animateRows={false}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-4">
        <span className="label-mono mr-1">Total del día</span>
        {MONEDAS.filter((m) => totales[m]).map((m) => (
          <span key={m}
                className="flex items-baseline gap-2 bg-surface border border-line rounded-lg px-3 py-1.5 shadow-e1">
            <span className="font-mono text-[9.5px] tracking-wider text-ink-3">{m}</span>
            <span className={cx("font-mono tnum text-sm font-semibold",
                                totales[m]! < 0 ? "text-neg" : "text-ink")}>
              {fmtMonto(totales[m]!)}
            </span>
          </span>
        ))}
        {!MONEDAS.some((m) => totales[m]) && (
          <span className="bg-surface border border-line rounded-lg px-3 py-1.5 font-mono text-[10px] text-ink-3">
            Sin movimientos
          </span>
        )}

        <div className="ml-auto flex items-center gap-3">
          {problemas > 0 ? (
            <span role="alert" className="flex items-center gap-2 text-xs font-medium text-neg">
              <span className="w-[7px] h-[7px] rounded-full bg-neg" />
              {problemas === 1
                ? "1 fila con errores — pasá el cursor por la celda roja"
                : `${problemas} filas con errores — pasá el cursor por las celdas rojas`}
            </span>
          ) : aviso ? (
            <span role="status" aria-live="polite"
                  className={cx("flex items-center gap-2 text-xs font-medium",
                                aviso.tono === "ok" ? "text-pos" : "text-warn")}>
              <span className={cx("w-[7px] h-[7px] rounded-full",
                                  aviso.tono === "ok" ? "bg-pos" : "bg-warn")} />
              {aviso.texto}
            </span>
          ) : (
            <span className="text-xs text-ink-3">
              {cargables.length === 0
                ? "Sin filas para guardar"
                : cargables.length === 1
                  ? "1 fila lista"
                  : `${cargables.length} filas listas`}
            </span>
          )}

          <Button size="sm" onClick={deshacer} disabled={historial.length === 0}>
            Deshacer
          </Button>
          <Button size="sm" onClick={() => aplicar([...filas, filaVacia()])}>
            Agregar fila
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={enviar}
            disabled={guardando || problemas > 0 || cargables.length === 0}
          >
            {guardando ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>
    </>
  );
}
