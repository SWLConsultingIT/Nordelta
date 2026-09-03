import type { Moneda, Partida, Impacto, MedioPago } from "./types";
import { MEDIOS_CON_COMISION } from "./types";

/**
 * Regla de conversión — espejo exacto de las columnas generadas de la base.
 *
 * Verificada contra el consolidado de BigQuery:
 *   efectivo pesos        →  (PESOS + Pago_Facil) / TC
 *   transferencia pesos   →  (Transferencia_Pesos * (1 + Comision)) / TC_Transferencia
 *   transferencia dólares →  Transferencias_en_Dolares * (1 + Comision)
 *   efectivo euros/reales →  sin conversión ni comisión
 *
 * La comisión se aplica ANTES de dividir, y solo a las patas de transferencia.
 *
 * Esta función existe para dar respuesta inmediata en la grilla. La
 * autoridad es la base: `partidas.moneda_impacto` y `partidas.monto_impacto`
 * son columnas generadas con esta misma fórmula. Si las dos discrepan,
 * la base tiene razón.
 */
export function calcularImpacto(p: {
  medio_pago: MedioPago;
  moneda_nominal: Moneda;
  monto_nominal: number;
  tipo_cambio: number | null;
  comision_pct: number | null;
}): Impacto {
  const comision = MEDIOS_CON_COMISION.has(p.medio_pago) ? (p.comision_pct ?? 0) : 0;
  const conComision = p.monto_nominal * (1 + comision);

  const convierte =
    p.tipo_cambio !== null && p.tipo_cambio > 0 && p.moneda_nominal !== "USD";

  if (convierte) {
    return { moneda: "USD", monto: redondear(conComision / p.tipo_cambio!, 4) };
  }
  return { moneda: p.moneda_nominal, monto: redondear(conComision, 4) };
}

/** Suma los impactos de un movimiento agrupados por moneda. */
export function impactoPorMoneda(partidas: Partida[]): Partial<Record<Moneda, number>> {
  const out: Partial<Record<Moneda, number>> = {};
  for (const p of partidas) {
    if (!p.monto_nominal) continue;
    const { moneda, monto } = calcularImpacto(p);
    out[moneda] = redondear((out[moneda] ?? 0) + monto, 2);
  }
  return out;
}

/** Redondeo con corrección de coma flotante, para que 1.005 no caiga a 1.00. */
export function redondear(n: number, decimales = 2): number {
  const f = 10 ** decimales;
  return Math.round((n + Number.EPSILON) * f) / f;
}
