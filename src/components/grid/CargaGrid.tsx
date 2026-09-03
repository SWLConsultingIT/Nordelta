"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
  type CellEditRequestEvent,
  type ValueGetterParams,
} from "ag-grid-community";
import { temaNordelta } from "./tema";
import { calcularImpacto } from "@/lib/domain/fx";
import { MONEDAS, MEDIOS_PAGO, CATEGORIAS, MEDIOS_CON_COMISION } from "@/lib/domain/types";
import type { Categoria, Contraparte, Moneda, MedioPago, EstadoGuardado } from "@/lib/domain/types";
import { fmtMonto, parseMonto } from "@/lib/format";
import { Button, cx } from "@/components/ui";

ModuleRegistry.registerModules([AllCommunityModule]);

/** Una fila de la grilla es una partida: un solo monto, con su moneda y su
 *  medio de pago. Reemplaza las dieciséis columnas de la planilla, donde el
 *  medio de pago estaba codificado en cuál columna llenabas. */
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

const ETIQUETA_CATEGORIA: Record<Categoria, string> = {
  ingreso: "Ingreso",
  pago_proveedor: "Pago proveedor",
  full_pago: "Full pago",
  compra: "Compra",
  venta: "Venta",
  impuesto: "Impuesto",
  ajuste_cierre: "Ajuste de cuenta",
};

const ETIQUETA_MEDIO: Record<MedioPago, string> = {
  efectivo: "Efectivo",
  pago_facil: "Pago fácil",
  transferencia: "Transferencia",
  cheque: "Cheque",
  transf_movil: "Transf. móvil",
};

export function filaVacia(): FilaCarga {
  return {
    key: crypto.randomUUID(),
    contraparte: "",
    concepto: "",
    categoria: "ingreso",
    medio_pago: "efectivo",
    moneda: "ARS",
    monto: "",
    tipo_cambio: "",
    comision: "",
  };
}

/** El impacto de la fila, o null si algún número es inválido. */
function impactoDeFila(f: FilaCarga) {
  const monto = parseMonto(f.monto);
  const tc = parseMonto(f.tipo_cambio);
  const com = parseMonto(f.comision);
  if (monto === null || tc === null || com === null) return null;
  if (monto === 0) return { moneda: f.moneda, monto: 0, vacio: true as const };
  const r = calcularImpacto({
    medio_pago: f.medio_pago,
    moneda_nominal: f.moneda,
    monto_nominal: monto,
    tipo_cambio: tc === 0 ? null : tc,
    comision_pct: com === 0 ? null : com / 100,
  });
  return { ...r, vacio: false as const };
}

const esNum = (v: string) => parseMonto(v) !== null;

export function CargaGrid({
  filasIniciales,
  contrapartes,
}: {
  filasIniciales: FilaCarga[];
  contrapartes: Contraparte[];
}) {
  const [filas, setFilas] = useState<FilaCarga[]>(() =>
    filasIniciales.length ? [...filasIniciales, filaVacia()] : [filaVacia()],
  );
  const [estado, setEstado] = useState<EstadoGuardado>("guardado");
  const apiRef = useRef<GridApi<FilaCarga> | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const nombres = useMemo(() => contrapartes.map((c) => c.nombre), [contrapartes]);

  /** Simula la escritura optimista: el tecleo nunca espera a la red. */
  const marcarSucio = useCallback((filasAhora: FilaCarga[]) => {
    timers.current.forEach(clearTimeout);
    timers.current = [];

    const invalidas = filasAhora.filter(
      (f) => !esNum(f.monto) || !esNum(f.tipo_cambio) || !esNum(f.comision),
    ).length;

    if (invalidas > 0) {
      setEstado("error");
      return;
    }
    setEstado("sin_guardar");
    timers.current.push(
      setTimeout(() => {
        setEstado("guardando");
        timers.current.push(setTimeout(() => setEstado("guardado"), 400));
      }, 600),
    );
  }, []);

  const actualizar = useCallback(
    (siguiente: FilaCarga[]) => {
      setFilas(siguiente);
      marcarSucio(siguiente);
    },
    [marcarSucio],
  );

  /* ── Pegado desde Excel ──────────────────────────────────────
     El módulo de portapapeles de AG Grid es Enterprise, así que
     interceptamos el evento de pegado y escribimos el bloque TSV
     nosotros, empezando en la celda que tiene el foco.            */
  const alPegar = useCallback(
    (e: React.ClipboardEvent) => {
      const texto = e.clipboardData.getData("text/plain");
      if (!texto || !texto.includes("\t")) return; // una sola celda: comportamiento nativo
      e.preventDefault();

      const api = apiRef.current;
      const foco = api?.getFocusedCell();
      if (!api || !foco) return;

      const orden: (keyof FilaCarga)[] = [
        "contraparte", "concepto", "categoria", "medio_pago",
        "moneda", "monto", "tipo_cambio", "comision",
      ];
      const colInicio = orden.indexOf(foco.column.getColId() as keyof FilaCarga);
      if (colInicio < 0) return;

      const bloque = texto.replace(/\r/g, "").replace(/\n$/, "").split("\n").map((l) => l.split("\t"));
      const siguiente = [...filas];

      bloque.forEach((celdas, i) => {
        const idx = foco.rowIndex + i;
        while (siguiente.length <= idx) siguiente.push(filaVacia());
        const fila = { ...siguiente[idx] };
        celdas.forEach((valor, j) => {
          const campo = orden[colInicio + j];
          if (!campo) return;
          (fila as Record<string, string>)[campo] = valor.trim();
        });
        siguiente[idx] = fila;
      });

      if (siguiente.at(-1)?.monto !== "") siguiente.push(filaVacia());
      actualizar(siguiente);
      api.refreshCells({ force: true });
    },
    [filas, actualizar],
  );

  const columnas = useMemo<ColDef<FilaCarga>[]>(() => {
    const num = (
      campo: ColDef<FilaCarga>["field"],
      header: string,
      ancho: number,
      sufijo?: string,
    ): ColDef<FilaCarga> => ({
      field: campo,
      headerName: header,
      width: ancho,
      type: "rightAligned",
      cellClass: (p) => cx("font-mono tnum", !esNum(String(p.value ?? "")) && "celda-mala"),
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
        valueGetter: (p: ValueGetterParams<FilaCarga>) =>
          p.node?.rowPinned ? "Σ" : (p.node?.rowIndex ?? 0) + 1,
      },
      {
        field: "contraparte",
        headerName: "Contraparte",
        width: 168,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: ["", ...nombres] },
        cellClass: "text-ink font-medium",
      },
      { field: "concepto", headerName: "Concepto", flex: 1, minWidth: 170 },
      {
        field: "categoria",
        headerName: "Categoría",
        width: 148,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: CATEGORIAS },
        valueFormatter: (p) => ETIQUETA_CATEGORIA[p.value as Categoria] ?? p.value,
      },
      {
        field: "medio_pago",
        headerName: "Medio de pago",
        width: 142,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: MEDIOS_PAGO },
        valueFormatter: (p) => ETIQUETA_MEDIO[p.value as MedioPago] ?? p.value,
      },
      {
        field: "moneda",
        headerName: "Moneda",
        width: 96,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: MONEDAS },
        cellClass: "font-mono",
      },
      num("monto", "Monto", 128),
      num("tipo_cambio", "T. cambio", 110),
      {
        ...num("comision", "Comisión", 104, " %"),
        editable: (p) => !!p.data && MEDIOS_CON_COMISION.has(p.data.medio_pago),
        cellClass: (p) =>
          cx(
            "font-mono tnum",
            !esNum(String(p.value ?? "")) && "celda-mala",
            p.data && !MEDIOS_CON_COMISION.has(p.data.medio_pago) && "!text-ink-4 !bg-raised",
          ),
      },
      {
        headerName: "Impacta cta. cte.",
        colId: "impacta",
        width: 150,
        editable: false,
        sortable: false,
        type: "rightAligned",
        cellClass: "!bg-raised",
        cellRenderer: (p: { data?: FilaCarga; node: { rowPinned?: string | null } }) => {
          if (p.node.rowPinned || !p.data) return null;
          const r = impactoDeFila(p.data);
          if (r === null) return <span className="font-mono text-[12px] text-neg">revisar</span>;
          if (r.vacio) return <span className="font-mono text-[12px] text-ink-4">—</span>;
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

  /** Fila fijada al pie con el total del día por moneda. */
  const totales = useMemo(() => {
    const acum: Partial<Record<Moneda, number>> = {};
    for (const f of filas) {
      const r = impactoDeFila(f);
      if (!r || r.vacio) continue;
      acum[r.moneda] = (acum[r.moneda] ?? 0) + r.monto;
    }
    return acum;
  }, [filas]);

  const onCellEditRequest = useCallback(
    (e: CellEditRequestEvent<FilaCarga>) => {
      const campo = e.colDef.field as keyof FilaCarga | undefined;
      if (!campo || !e.data) return;
      const siguiente = filas.map((f) =>
        f.key === e.data.key ? { ...f, [campo]: String(e.newValue ?? "") } : f,
      );
      // Escribir en la última fila crea la siguiente, como en la planilla.
      if (e.node.rowIndex === filas.length - 1 && String(e.newValue ?? "") !== "") {
        siguiente.push(filaVacia());
      }
      actualizar(siguiente);
      e.api.refreshCells({ force: true });
    },
    [filas, actualizar],
  );

  const onGridReady = useCallback((e: GridReadyEvent<FilaCarga>) => {
    apiRef.current = e.api;
  }, []);

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
          onGridReady={onGridReady}
          domLayout="autoHeight"
          enterNavigatesVertically
          enterNavigatesVerticallyAfterEdit
          stopEditingWhenCellsLoseFocus
          enableCellTextSelection
          suppressCellFocus={false}
          animateRows={false}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-4">
        <span className="label-mono mr-1">Total del día</span>
        {MONEDAS.filter((m) => totales[m]).map((m) => (
          <span
            key={m}
            className="flex items-baseline gap-2 bg-surface border border-line rounded-lg px-3 py-1.5 shadow-e1"
          >
            <span className="font-mono text-[9.5px] tracking-wider text-ink-3">{m}</span>
            <span className={cx("font-mono tnum text-sm font-semibold", totales[m]! < 0 ? "text-neg" : "text-ink")}>
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
          <EstadoPill estado={estado} filas={filas} />
          <Button variant="primary" size="sm" onClick={() => actualizar([...filas, filaVacia()])}>
            Agregar fila
          </Button>
        </div>
      </div>
    </>
  );
}

function EstadoPill({ estado, filas }: { estado: EstadoGuardado; filas: FilaCarga[] }) {
  const malas = filas.filter((f) => !esNum(f.monto) || !esNum(f.tipo_cambio) || !esNum(f.comision)).length;

  const texto =
    estado === "error"
      ? malas === 1
        ? "1 celda no es un número — no se guarda"
        : `${malas} celdas no son números — no se guarda`
      : estado === "sin_guardar"
        ? "Sin guardar"
        : estado === "guardando"
          ? "Guardando…"
          : "Guardado";

  const tono =
    estado === "error" ? "text-neg" : estado === "guardando" ? "text-brand" : estado === "sin_guardar" ? "text-warn" : "text-pos";
  const punto =
    estado === "error" ? "bg-neg" : estado === "guardando" ? "bg-brand animate-pulse" : estado === "sin_guardar" ? "bg-warn" : "bg-pos";

  return (
    <span className={cx("flex items-center gap-2 text-xs font-medium", tono)}>
      <span className={cx("w-[7px] h-[7px] rounded-full flex-none", punto)} />
      {texto}
    </span>
  );
}
