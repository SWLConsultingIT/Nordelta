import type { Contraparte, Movimiento, Oficina, Partida } from "../domain/types";

export const OFICINAS: Oficina[] = [
  { id: 1, nombre: "Nordelta" },
  { id: 2, nombre: "Oficina Corrientes" },
  { id: 3, nombre: "Puertos" },
  { id: 4, nombre: "Remeros" },
];

/** Nombres inventados a propósito: ningún cliente real del sistema. */
export const CONTRAPARTES: Contraparte[] = [
  { id: 1, nombre: "Alvarez, J.", activo: true },
  { id: 2, nombre: "Beltrán, R.", activo: true },
  { id: 3, nombre: "Cabrera, M.", activo: true },
  { id: 4, nombre: "Duarte, S.", activo: true },
  { id: 5, nombre: "Espinosa, L.", activo: true },
  { id: 6, nombre: "Ferrari, A.", activo: true },
  { id: 7, nombre: "Gutiérrez, P.", activo: true },
  { id: 8, nombre: "Herrera, N.", activo: true },
  { id: 9, nombre: "Ibarra, C.", activo: true },
  { id: 10, nombre: "Gastos Oficina", activo: true },
];

let seq = 0;
const pid = () => `p${++seq}`;

function ef(moneda: Partida["moneda_nominal"], monto: number, tc: number | null = null): Partida {
  return { id: pid(), medio_pago: "efectivo", moneda_nominal: moneda, monto_nominal: monto, tipo_cambio: tc, comision_pct: null };
}
function tr(moneda: Partida["moneda_nominal"], monto: number, tc: number | null, com: number | null): Partida {
  return { id: pid(), medio_pago: "transferencia", moneda_nominal: moneda, monto_nominal: monto, tipo_cambio: tc, comision_pct: com };
}
function ch(moneda: Partida["moneda_nominal"], monto: number, tc: number | null = null): Partida {
  return { id: pid(), medio_pago: "cheque", moneda_nominal: moneda, monto_nominal: monto, tipo_cambio: tc, comision_pct: null };
}

export const MOVIMIENTOS: Movimiento[] = [
  { id: "m1", fecha: "2026-01-12", oficina_id: 1, contraparte_id: 3, concepto: "Préstamo en pesos", categoria: "ingreso", orden: 1, partidas: [ef("ARS", 4455000, 1485)] },
  { id: "m2", fecha: "2026-01-28", oficina_id: 1, contraparte_id: 3, concepto: "Pago parcial", categoria: "pago_proveedor", orden: 1, partidas: [ef("USD", -1200)] },
  { id: "m3", fecha: "2026-02-14", oficina_id: 2, contraparte_id: 3, concepto: "Saldo cancelado", categoria: "pago_proveedor", orden: 1, partidas: [ef("USD", -1800)] },
  { id: "m4", fecha: "2026-03-03", oficina_id: 1, contraparte_id: 3, concepto: "Préstamo en pesos", categoria: "ingreso", orden: 1, partidas: [ef("ARS", 7425000, 1485)] },
  { id: "m5", fecha: "2026-03-21", oficina_id: 3, contraparte_id: 3, concepto: "Pago parcial", categoria: "pago_proveedor", orden: 1, partidas: [ef("USD", -2000)] },
  { id: "m6", fecha: "2026-04-09", oficina_id: 1, contraparte_id: 3, concepto: "Pago parcial", categoria: "pago_proveedor", orden: 1, partidas: [ef("USD", -1500)] },

  { id: "m10", fecha: "2026-09-03", oficina_id: 1, contraparte_id: 1, concepto: "Ingreso en efectivo", categoria: "ingreso", orden: 1, partidas: [ef("ARS", 2400000)] },
  { id: "m11", fecha: "2026-09-03", oficina_id: 1, contraparte_id: 2, concepto: "Transferencia recibida", categoria: "ingreso", orden: 2, partidas: [tr("USD", 3500, null, 0.02)] },
  { id: "m12", fecha: "2026-09-03", oficina_id: 1, contraparte_id: 4, concepto: "Cobro pago fácil", categoria: "ingreso", orden: 3,
    partidas: [{ id: pid(), medio_pago: "pago_facil", moneda_nominal: "ARS", monto_nominal: 890000, tipo_cambio: null, comision_pct: null }] },
  { id: "m13", fecha: "2026-09-03", oficina_id: 1, contraparte_id: 10, concepto: "Alquiler septiembre", categoria: "pago_proveedor", orden: 4, partidas: [tr("ARS", -1200000, null, 0)] },
  { id: "m14", fecha: "2026-09-03", oficina_id: 1, contraparte_id: 5, concepto: "Pago a proveedor", categoria: "pago_proveedor", orden: 5, partidas: [ef("USD", -1800)] },
  { id: "m15", fecha: "2026-09-03", oficina_id: 1, contraparte_id: 6, concepto: "Cheque 0042-1187", categoria: "ingreso", orden: 6, partidas: [ch("ARS", 1750000)] },
  { id: "m16", fecha: "2026-09-03", oficina_id: 1, contraparte_id: 8, concepto: "Liquidación full pago", categoria: "full_pago", orden: 7, partidas: [tr("EUR", 2200, null, 0.015)] },
  /* Movimiento mixto: efectivo en pesos sin conversión + transferencia en
     pesos convertida. Es exactamente la fila donde el sistema actual
     pierde plata (bug 5). Acá cada partida resuelve por separado. */
  { id: "m17", fecha: "2026-09-03", oficina_id: 1, contraparte_id: 9, concepto: "Operación mixta", categoria: "ingreso", orden: 8,
    partidas: [ef("ARS", 100000), tr("ARS", 50000, 1485, 0.02)] },

  { id: "m20", fecha: "2026-09-02", oficina_id: 1, contraparte_id: 7, concepto: "Ingreso en efectivo", categoria: "ingreso", orden: 1, partidas: [ef("ARS", 640000)] },
  { id: "m21", fecha: "2026-09-02", oficina_id: 3, contraparte_id: 9, concepto: "Transferencia recibida", categoria: "ingreso", orden: 1, partidas: [tr("ARS", 3000000, 1482, 0.02)] },
  { id: "m22", fecha: "2026-09-01", oficina_id: 4, contraparte_id: 2, concepto: "Cobro cheque", categoria: "ingreso", orden: 1, partidas: [ch("ARS", 980000)] },
  { id: "m23", fecha: "2026-09-01", oficina_id: 1, contraparte_id: 7, concepto: "Compra de divisa", categoria: "compra", orden: 2, partidas: [ef("ARS", 1480000, 1480)] },
];

export const AUDITORIA: import("../domain/types").EntradaAuditoria[] = [
  { id: "a1", ocurrido_en: "2026-09-03T14:42:11", actor: "santi@swlconsulting.com", operacion: "UPDATE", entidad: "movimiento", referencia: "m17", campo: "tipo_cambio", valor_anterior: "1480", valor_nuevo: "1485", motivo: "Corrección de cotización del día" },
  { id: "a2", ocurrido_en: "2026-09-03T14:38:02", actor: "operaciones@nordelta.com", operacion: "INSERT", entidad: "movimiento", referencia: "m17", campo: null, valor_anterior: null, valor_nuevo: null, motivo: null },
  { id: "a3", ocurrido_en: "2026-09-03T11:20:47", actor: "operaciones@nordelta.com", operacion: "UPDATE", entidad: "movimiento", referencia: "m13", campo: "monto_nominal", valor_anterior: "-1150000", valor_nuevo: "-1200000", motivo: "Ajuste por diferencia de alquiler" },
  { id: "a4", ocurrido_en: "2026-09-03T09:15:33", actor: "operaciones@nordelta.com", operacion: "INSERT", entidad: "movimiento", referencia: "m10", campo: null, valor_anterior: null, valor_nuevo: null, motivo: null },
  { id: "a5", ocurrido_en: "2026-09-02T18:04:19", actor: "santi@swlconsulting.com", operacion: "DELETE", entidad: "movimiento", referencia: "m19", campo: null, valor_anterior: "Ingreso duplicado por error de carga", valor_nuevo: null, motivo: "Cargado dos veces" },
  { id: "a6", ocurrido_en: "2026-09-02T16:51:08", actor: "operaciones@nordelta.com", operacion: "UPDATE", entidad: "contraparte", referencia: "9", campo: "nombre", valor_anterior: "ibarra, c.", valor_nuevo: "Ibarra, C.", motivo: "Normalización de mayúsculas" },
  { id: "a7", ocurrido_en: "2026-09-02T10:12:55", actor: "operaciones@nordelta.com", operacion: "INSERT", entidad: "movimiento", referencia: "m21", campo: null, valor_anterior: null, valor_nuevo: null, motivo: null },
  { id: "a8", ocurrido_en: "2026-09-01T17:30:41", actor: "admin@nordelta.com", operacion: "UPDATE", entidad: "movimiento", referencia: "m22", campo: "categoria", valor_anterior: "compra", valor_nuevo: "ingreso", motivo: "Estaba mal clasificado; no impactaba la cuenta" },
  { id: "a9", ocurrido_en: "2026-09-01T09:48:12", actor: "operaciones@nordelta.com", operacion: "INSERT", entidad: "movimiento", referencia: "m22", campo: null, valor_anterior: null, valor_nuevo: null, motivo: null },
];
