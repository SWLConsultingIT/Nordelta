import type { Categoria, MedioPago, Moneda } from "./types";
import { CATEGORIAS, MEDIOS_PAGO, MONEDAS } from "./types";
import { normalizarNombre } from "./contrapartes";

/**
 * Interpretación de texto escrito por una persona hacia valores del dominio.
 *
 * Lo usan dos caminos distintos con el mismo problema: el pegado desde Excel
 * en la grilla de carga, y el importador de datos legacy. En los dos casos
 * llega texto que un humano escribió y hay que decidir qué enum es —o
 * rechazarlo, nunca adivinar.
 */

/** Etiquetas que se muestran en la interfaz. */
export const ETIQUETA_CATEGORIA: Record<Categoria, string> = {
  ingreso: "Ingreso",
  pago_proveedor: "Pago proveedor",
  full_pago: "Full pago",
  compra: "Compra",
  venta: "Venta",
  impuesto: "Impuesto",
  ajuste_cierre: "Ajuste de cuenta",
};

export const ETIQUETA_MEDIO: Record<MedioPago, string> = {
  efectivo: "Efectivo",
  pago_facil: "Pago fácil",
  transferencia: "Transferencia",
  cheque: "Cheque",
  transf_movil: "Transf. móvil",
};

/** Sinónimos aceptados, incluidos los encabezados de sección del legacy. */
const SINONIMOS_CATEGORIA: Record<string, Categoria> = {
  ingreso: "ingreso", ingresos: "ingreso",
  "pago proveedor": "pago_proveedor", "pagos a proveedores": "pago_proveedor",
  "pago a proveedor": "pago_proveedor", "pago proveedores": "pago_proveedor",
  proveedor: "pago_proveedor", proveedores: "pago_proveedor",
  // El script legacy fusiona egresos y gastos con pagos a proveedores.
  // Se mantiene el mapeo por compatibilidad, pero está anotado como
  // decisión abierta (D3): pueden ser categorías distintas del negocio.
  egreso: "pago_proveedor", egresos: "pago_proveedor",
  gasto: "pago_proveedor", gastos: "pago_proveedor",
  "full pago": "full_pago", "full pagos": "full_pago", fullpago: "full_pago",
  compra: "compra", compras: "compra",
  venta: "venta", ventas: "venta",
  impuesto: "impuesto", impuestos: "impuesto",
  ajuste: "ajuste_cierre", "ajuste de cuenta": "ajuste_cierre",
  "cierre de cuenta": "ajuste_cierre", cierre: "ajuste_cierre",
};

const SINONIMOS_MEDIO: Record<string, MedioPago> = {
  efectivo: "efectivo", caja: "efectivo", contado: "efectivo",
  "pago facil": "pago_facil", pagofacil: "pago_facil", "pago fácil": "pago_facil",
  transferencia: "transferencia", transf: "transferencia", transferencias: "transferencia",
  cheque: "cheque", cheques: "cheque",
  "transf movil": "transf_movil", "transferencia a movil": "transf_movil",
  "transferencias a movil": "transf_movil", movil: "transf_movil",
};

const SINONIMOS_MONEDA: Record<string, Moneda> = {
  ars: "ARS", peso: "ARS", pesos: "ARS", "$": "ARS", arg: "ARS",
  usd: "USD", dolar: "USD", dolares: "USD", "u$s": "USD", "us$": "USD", "dólares": "USD",
  eur: "EUR", euro: "EUR", euros: "EUR", "€": "EUR",
  brl: "BRL", real: "BRL", reales: "BRL", "r$": "BRL",
};

/**
 * Clave de búsqueda: minúsculas, sin acentos, sin puntos y con espacios
 * colapsados. Los puntos se van porque las abreviaturas los usan
 * («Transf. móvil») y no aportan nada a la identificación.
 */
function clave(texto: string): string {
  return normalizarNombre(texto)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function interpretar<T extends string>(
  texto: string,
  validos: readonly T[],
  sinonimos: Record<string, T>,
): T | null {
  const t = texto.trim();
  if (t === "") return null;
  // Primero el valor exacto del enum, que es lo que manda la propia interfaz.
  if ((validos as readonly string[]).includes(t)) return t as T;
  const k = clave(t);
  if (sinonimos[k]) return sinonimos[k];
  const sinEspacios = k.replace(/\s+/g, "");
  return sinonimos[sinEspacios] ?? null;
}

export const interpretarCategoria = (t: string) =>
  interpretar(t, CATEGORIAS, SINONIMOS_CATEGORIA);
export const interpretarMedioPago = (t: string) =>
  interpretar(t, MEDIOS_PAGO, SINONIMOS_MEDIO);
export const interpretarMoneda = (t: string) =>
  interpretar(t, MONEDAS, SINONIMOS_MONEDA);

/**
 * Interpreta una fecha escrita por una persona y devuelve ISO, o null.
 * Acepta dd/mm/aaaa y dd-mm-aa, que es lo que sale de las planillas, además
 * del ISO que ya viene bien.
 */
export function interpretarFecha(texto: string): string | null {
  const t = texto.trim();
  if (t === "") return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return esFechaReal(t) ? t : null;

  const m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2}|\d{4})$/.exec(t);
  if (!m) return null;
  const [, d, mes, a] = m;
  const anio = a.length === 2 ? `20${a}` : a;
  const iso = `${anio}-${mes.padStart(2, "0")}-${d.padStart(2, "0")}`;
  return esFechaReal(iso) ? iso : null;
}

function esFechaReal(iso: string): boolean {
  const d = new Date(iso + "T12:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

/** Separa un bloque pegado en filas y celdas. Excel usa TSV. */
export function separarBloquePegado(texto: string): string[][] {
  return texto
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n+$/, "")
    .split("\n")
    .map((linea) => linea.split("\t"));
}
