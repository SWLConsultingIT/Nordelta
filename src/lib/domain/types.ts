/**
 * Modelo de dominio de Nordelta.
 *
 * Reconstruido de las 4 queries de BigQuery del workflow
 * "Nordel - Big Query - Querys" y de los 6 Apps Script en producción.
 * Cada regla codificada acá está verificada contra ese código.
 */

export const MONEDAS = ["ARS", "USD", "EUR", "BRL"] as const;
export type Moneda = (typeof MONEDAS)[number];

/** Las 6 secciones de la hoja diaria. El sistema actual deriva esto del
 *  encabezado de texto en la columna A, no de un campo cargado. */
export const CATEGORIAS = [
  "ingreso",
  "pago_proveedor",
  "full_pago",
  "compra",
  "venta",
  "impuesto",
  "ajuste_cierre",
] as const;
export type Categoria = (typeof CATEGORIAS)[number];

/** ALLOWED_SECTIONS del Apps Script de consolidado. Compras, ventas e
 *  impuestos NO llegan a la cuenta corriente. */
export const CATEGORIAS_QUE_IMPACTAN: ReadonlySet<Categoria> = new Set([
  "ingreso",
  "pago_proveedor",
  "full_pago",
  "ajuste_cierre",
]);

export const MEDIOS_PAGO = [
  "efectivo",
  "pago_facil",
  "transferencia",
  "cheque",
  "transf_movil",
] as const;
export type MedioPago = (typeof MEDIOS_PAGO)[number];

/** La comisión es un markup que en el sistema actual se aplica únicamente
 *  a las patas de transferencia — nunca al efectivo ni al pago fácil. */
export const MEDIOS_CON_COMISION: ReadonlySet<MedioPago> = new Set([
  "transferencia",
  "transf_movil",
]);

export interface Oficina {
  id: number;
  nombre: string;
}

export interface Contraparte {
  id: number;
  nombre: string;
  activo: boolean;
}

/** Una pata monetaria del movimiento. Una fila de la planilla actual
 *  lleva hasta nueve de estas. */
export interface Partida {
  id: string;
  medio_pago: MedioPago;
  moneda_nominal: Moneda;
  monto_nominal: number;
  /** Null cuando la pata no convierte. */
  tipo_cambio: number | null;
  /** Fracción, no porcentaje: 0.02 es 2 %. */
  comision_pct: number | null;
}

export interface Movimiento {
  id: string;
  fecha: string; // ISO yyyy-mm-dd
  oficina_id: number;
  contraparte_id: number | null;
  concepto: string;
  categoria: Categoria;
  /** Espejo de la columna homónima de la base. La regla de
   *  `ALLOWED_SECTIONS` se guarda explícita, no se deduce de la posición
   *  de la fila dentro de una grilla. */
  afecta_cta_cte?: boolean;
  /** Desempate estable del saldo corrido. Resuelve el bug 4 del
   *  sistema actual, donde el orden entre movimientos del mismo día
   *  era arbitrario y el cierre de cuenta podía variar entre corridas. */
  orden: number;
  partidas: Partida[];
}

/** Lo que una pata efectivamente impacta en la cuenta corriente,
 *  después de comisión y conversión. */
export interface Impacto {
  moneda: Moneda;
  monto: number;
}

export type EstadoGuardado = "guardado" | "sin_guardar" | "guardando" | "error";

/** Entrada del registro de auditoría. En el sistema actual esto no
 *  existe: nada registra quién cargó, editó o borró. */
export interface EntradaAuditoria {
  id: string;
  ocurrido_en: string; // ISO
  actor: string;
  operacion: "INSERT" | "UPDATE" | "DELETE";
  entidad: string;
  referencia: string;
  campo: string | null;
  valor_anterior: string | null;
  valor_nuevo: string | null;
  motivo: string | null;
  /** Texto legible de qué pasó, para no mostrarle JSON al usuario. */
  descripcion?: string;
}
