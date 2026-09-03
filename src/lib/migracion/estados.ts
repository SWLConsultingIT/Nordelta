import type { Moneda } from "../domain/types";
import type { Diferencia, ErrorFila, MovimientoImportado } from "./legacy";

/**
 * Estados de una fila legacy.
 *
 * Principio obligatorio: **ninguna fila puede desaparecer en silencio**.
 * Toda fila del origen termina en exactamente uno de estos estados, y la
 * suma de los cinco tiene que dar el total de filas analizadas.
 */
export const ESTADOS = [
  /** Se transformó y no difiere del legacy. */
  "IMPORTED",
  /** Se transformó y difiere, pero toda diferencia es un bug legacy conocido. */
  "EXPECTED_DIFFERENCE",
  /** No se puede avanzar hasta que el negocio resuelva una decisión abierta. */
  "BLOCKED_BUSINESS_RULE",
  /** El origen no se puede interpretar: fecha, monto o categoría inválidos. */
  "INVALID_SOURCE",
  /** Difiere por algo que NO es un bug conocido. Hay que investigarlo. */
  "UNEXPLAINED_DIFFERENCE",
] as const;
export type Estado = (typeof ESTADOS)[number];

export interface FilaClasificada {
  fila: number;
  estado: Estado;
  contraparte: string;
  fecha: string | null;
  movimiento: MovimientoImportado | null;
  errores: ErrorFila[];
  diferencias: Diferencia[];
  /** Qué decisión abierta la bloquea, si está bloqueada. */
  decision?: string;
}

/** Daño de un bug, siempre desglosado por moneda: no se mezclan monedas. */
export interface DanoPorMoneda {
  moneda: Moneda;
  /** Cantidad de filas donde ese bug afectó esa moneda. */
  filas: number;
  /** Monto que el legacy no contabilizó, en la moneda de impacto. */
  monto: number;
}

export interface Cuantificacion {
  bug: "bug5" | "bug6";
  /** Filas donde el bug se manifestó al menos en una moneda. */
  filasAfectadas: number;
  fechaMinima: string | null;
  fechaMaxima: string | null;
  contrapartes: string[];
  /** Patas que el legacy descartó, con cuántas veces cada una. */
  patasDescartadas: Record<string, number>;
  porMoneda: DanoPorMoneda[];
}

export interface Resumen {
  totalFilas: number;
  filasVacias: number;
  filasAnalizadas: number;
  porEstado: Record<Estado, number>;
  movimientos: number;
  partidas: number;
  contrapartesNuevas: number;
  contrapartesNormalizadas: number;
  cuantificacion: Cuantificacion[];
  /** Filas afectadas por los dos bugs a la vez. No se cuentan dos veces. */
  filasConAmbosBugs: number;
}

/** ¿La clasificación cierra? La suma de estados debe dar las filas analizadas. */
export function resumenEsConsistente(r: Resumen): boolean {
  const suma = ESTADOS.reduce((a, e) => a + r.porEstado[e], 0);
  return suma === r.filasAnalizadas && r.totalFilas === r.filasAnalizadas + r.filasVacias;
}
