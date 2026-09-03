import type { Moneda } from "../domain/types";
import { normalizarNombre } from "../domain/contrapartes";
import { redondear } from "../domain/dinero";
import { calcularImpacto } from "../domain/fx";
import {
  conciliarFila, filaDesdeCeldas, filaVaciaLegacy, transformarFila,
  type Diferencia, type FilaLegacy, type OrigenLegacy,
} from "./legacy";
import {
  ESTADOS, type Cuantificacion, type DanoPorMoneda, type Estado,
  type FilaClasificada, type Resumen,
} from "./estados";

/**
 * Importador legacy.
 *
 * Canal: parse → validate → transform → reconcile → classify.
 *
 * En modo dry-run **no escribe nada**: solo produce la clasificación y los
 * reportes. Es el paso que hay que correr antes de tocar producción.
 */

export interface OpcionesImportacion {
  sourceSystem: string;
  sourceFile: string;
  sourceSheet: string;
  /** Filas de encabezado a saltear. */
  encabezados?: number;
  /** Contrapartes que ya existen, para distinguir nuevas de conocidas. */
  contrapartesExistentes?: readonly string[];
}

export interface ResultadoImportacion {
  filas: FilaClasificada[];
  resumen: Resumen;
}

/** Separa un archivo delimitado. Acepta TSV, punto y coma, o coma. */
export function separarDelimitado(texto: string): string[][] {
  const lineas = texto.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const muestra = lineas.find((l) => l.trim() !== "") ?? "";
  const delim = muestra.includes("\t") ? "\t" : muestra.includes(";") ? ";" : ",";

  return lineas.map((linea) => {
    // Respeta el entrecomillado, que es cómo un CSV escapa el delimitador.
    const celdas: string[] = [];
    let actual = "";
    let dentro = false;
    for (let i = 0; i < linea.length; i++) {
      const ch = linea[i];
      if (ch === '"') {
        if (dentro && linea[i + 1] === '"') { actual += '"'; i++; }
        else dentro = !dentro;
      } else if (ch === delim && !dentro) {
        celdas.push(actual); actual = "";
      } else actual += ch;
    }
    celdas.push(actual);
    return celdas;
  });
}

/** Categorías cuyo destino contable depende de una decisión abierta. */
const CATEGORIAS_BLOQUEADAS: Record<string, string> = {
  // El script legacy fusiona egresos y gastos con pagos a proveedores, pero
  // pueden ser categorías distintas del negocio (D3).
  egreso: "D3", egresos: "D3", gasto: "D3", gastos: "D3",
};

function decisionQueBloquea(f: FilaLegacy): string | undefined {
  const clave = normalizarNombre(f.tipoMovimiento);
  if (CATEGORIAS_BLOQUEADAS[clave]) return CATEGORIAS_BLOQUEADAS[clave];
  // Un proveedor de transferencia cargado significa que la fila usaba el
  // asiento espejo de 2025, cuyo destino no está confirmado (D1).
  return undefined;
}

export function importar(
  celdasPorFila: readonly (readonly string[])[],
  opciones: OpcionesImportacion,
): ResultadoImportacion {
  const encabezados = opciones.encabezados ?? 0;
  const conocidas = new Set(
    (opciones.contrapartesExistentes ?? []).map(normalizarNombre),
  );

  const filas: FilaClasificada[] = [];
  let filasVacias = 0;
  let partidas = 0;

  const nuevas = new Set<string>();
  const normalizadas = new Set<string>();
  const nombresPorNorm = new Map<string, Set<string>>();

  for (let i = 0; i < celdasPorFila.length; i++) {
    const numeroDeFila = i + 1;
    if (i < encabezados) continue;

    const celdas = celdasPorFila[i];
    // Una línea sin ninguna celda con contenido es relleno de plantilla.
    if (celdas.every((c) => (c ?? "").trim() === "")) { filasVacias++; continue; }

    const legacy = filaDesdeCeldas(celdas);
    if (filaVaciaLegacy(legacy)) { filasVacias++; continue; }

    const origen: Omit<OrigenLegacy, "legacy_id"> = {
      source_system: opciones.sourceSystem,
      source_file: opciones.sourceFile,
      source_sheet: opciones.sourceSheet,
      source_row: numeroDeFila,
    };

    const { movimiento, errores } = transformarFila(legacy, origen);

    if (!movimiento) {
      filas.push({
        fila: numeroDeFila, estado: "INVALID_SOURCE",
        contraparte: legacy.contraparte, fecha: null,
        movimiento: null, errores, diferencias: [],
      });
      continue;
    }

    // Contrapartes: nuevas contra conocidas, y variantes que colapsan.
    const norm = normalizarNombre(movimiento.contraparte);
    if (!conocidas.has(norm)) nuevas.add(norm);
    const variantes = nombresPorNorm.get(norm) ?? new Set<string>();
    variantes.add(movimiento.contraparte.trim());
    nombresPorNorm.set(norm, variantes);

    partidas += movimiento.partidas.length;

    const bloqueo = decisionQueBloquea(legacy);
    const diferencias = conciliarFila(legacy, movimiento);
    const sinExplicar = diferencias.filter((d) => d.motivo === "sin_explicar");

    const estado: Estado =
      bloqueo ? "BLOCKED_BUSINESS_RULE"
      : sinExplicar.length > 0 ? "UNEXPLAINED_DIFFERENCE"
      : diferencias.length > 0 ? "EXPECTED_DIFFERENCE"
      : "IMPORTED";

    filas.push({
      fila: numeroDeFila, estado,
      contraparte: movimiento.contraparte, fecha: movimiento.fecha,
      movimiento, errores, diferencias,
      ...(bloqueo ? { decision: bloqueo } : {}),
    });
  }

  for (const [norm, variantes] of nombresPorNorm) {
    if (variantes.size > 1) normalizadas.add(norm);
  }

  const porEstado = Object.fromEntries(ESTADOS.map((e) => [e, 0])) as Record<Estado, number>;
  for (const f of filas) porEstado[f.estado]++;

  return {
    filas,
    resumen: {
      totalFilas: celdasPorFila.length - encabezados,
      filasVacias,
      filasAnalizadas: filas.length,
      porEstado,
      movimientos: filas.filter((f) => f.movimiento !== null).length,
      partidas,
      contrapartesNuevas: nuevas.size,
      contrapartesNormalizadas: normalizadas.size,
      cuantificacion: cuantificar(filas),
      filasConAmbosBugs: contarFilasConAmbosBugs(filas),
    },
  };
}

/* ── Cuantificación del daño ──────────────────────────────────
   Se desglosa siempre por moneda: sumar ARS con USD para armar un único
   número de daño no significa nada. Y una fila afectada por los dos bugs
   se cuenta una vez en cada uno, pero el dinero se atribuye por pata, así
   que no se cuenta dos veces.
   ──────────────────────────────────────────────────────────── */

const MOTIVO_DE_BUG = {
  bug5: "bug5_columna_anulada",
  bug6: "bug6_pata_descartada",
} as const;

export function cuantificar(filas: readonly FilaClasificada[]): Cuantificacion[] {
  return (["bug5", "bug6"] as const).map((bug) => {
    const motivo = MOTIVO_DE_BUG[bug];
    const relevantes = filas.filter((f) =>
      f.diferencias.some((d) => d.motivo === motivo),
    );

    const porMoneda = new Map<Moneda, DanoPorMoneda>();
    const patas: Record<string, number> = {};
    const contrapartes = new Set<string>();
    let minima: string | null = null;
    let maxima: string | null = null;

    for (const f of relevantes) {
      contrapartes.add(f.contraparte);
      if (f.fecha) {
        if (minima === null || f.fecha < minima) minima = f.fecha;
        if (maxima === null || f.fecha > maxima) maxima = f.fecha;
      }

      for (const d of f.diferencias) {
        if (d.motivo !== motivo) continue;
        // El daño es lo que el legacy no contabilizó. Cuando anuló la
        // columna, `legacy` es null y el daño es el valor entero.
        const perdido = redondear((d.nuevo ?? 0) - (d.legacy ?? 0), 2);
        const acum = porMoneda.get(d.moneda) ?? { moneda: d.moneda, filas: 0, monto: 0 };
        acum.filas++;
        acum.monto = redondear(acum.monto + perdido, 2);
        porMoneda.set(d.moneda, acum);

        for (const p of d.patasDescartadas ?? []) patas[p] = (patas[p] ?? 0) + 1;
      }
    }

    return {
      bug,
      filasAfectadas: relevantes.length,
      fechaMinima: minima,
      fechaMaxima: maxima,
      contrapartes: [...contrapartes].sort(),
      patasDescartadas: patas,
      porMoneda: [...porMoneda.values()].sort((a, b) => a.moneda.localeCompare(b.moneda)),
    };
  });
}

function contarFilasConAmbosBugs(filas: readonly FilaClasificada[]): number {
  return filas.filter(
    (f) =>
      f.diferencias.some((d) => d.motivo === "bug5_columna_anulada") &&
      f.diferencias.some((d) => d.motivo === "bug6_pata_descartada"),
  ).length;
}

/** Saldo por contraparte y moneda según el modelo nuevo, para conciliar. */
export function saldosImportados(
  filas: readonly FilaClasificada[],
): Map<string, Partial<Record<Moneda, number>>> {
  const out = new Map<string, Partial<Record<Moneda, number>>>();
  for (const f of filas) {
    if (!f.movimiento) continue;
    const clave = normalizarNombre(f.movimiento.contraparte);
    const acum = out.get(clave) ?? {};
    for (const p of f.movimiento.partidas) {
      const i = calcularImpacto(p);
      acum[i.moneda] = redondear((acum[i.moneda] ?? 0) + i.monto, 2);
    }
    out.set(clave, acum);
  }
  return out;
}

/** Diferencias sin explicar, que son las únicas que hay que investigar. */
export function sinExplicar(filas: readonly FilaClasificada[]): Diferencia[] {
  return filas.flatMap((f) => f.diferencias.filter((d) => d.motivo === "sin_explicar"));
}
