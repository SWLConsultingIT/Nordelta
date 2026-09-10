/**
 * Formato de presentación.
 *
 * Las primitivas numéricas viven en `domain/dinero.ts` y se reexportan desde
 * acá para que exista **una sola** implementación de redondeo y de parseo.
 * Dos implementaciones del mismo cálculo es exactamente cómo el front y la
 * base terminan mostrando números distintos.
 */
import type { Moneda } from "./domain/types";
import { formatear, partir, DECIMALES_SALDO } from "./domain/dinero";

export { parsearNumero as parseMonto, redondear, esCero } from "./domain/dinero";

/** Decimales con los que se muestra cada moneda. */
const DECIMALES: Record<Moneda, number> = { ARS: 2, USD: 2, EUR: 2, BRL: 2 };

/** Símbolo de cada moneda, como se escribe en Argentina. */
export const SIMBOLO: Record<Moneda, string> = {
  ARS: "$", USD: "US$", EUR: "\u20ac", BRL: "R$",
};

export function fmtMonto(n: number, moneda?: Moneda): string {
  return formatear(n, moneda ? DECIMALES[moneda] : DECIMALES_SALDO);
}

export function partirMonto(n: number, moneda?: Moneda): { entero: string; decimal: string } {
  return partir(n, moneda ? DECIMALES[moneda] : DECIMALES_SALDO);
}

/**
 * Monto con su símbolo, como se escribe en Argentina: `$ 2.450.000,00`.
 * El negativo lleva el signo antes del símbolo: `-$ 1.200.000,00`.
 */
export function fmtMoneda(n: number, moneda: Moneda): string {
  const signo = n < 0 ? "-" : "";
  return `${signo}${SIMBOLO[moneda]}\u00a0${formatear(Math.abs(n), DECIMALES[moneda])}`;
}

/** Recibe la fracción (0,02) y muestra el porcentaje (2,00 %). */
export function fmtPct(fraccion: number): string {
  return formatear(fraccion * 100, 2) + " %";
}

export function fmtFecha(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

export function fmtFechaLarga(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("es-AR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

export function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** ¿Es una fecha ISO válida y real? Rechaza 2026-02-31. */
export function esFechaISOValida(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T12:00:00");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/**
 * «hace 12 min», «hace 3 h», «ayer».
 *
 * Para una herramienta operativa, saber que la conciliación corrió hace
 * doce minutos dice más que un reloj: la pregunta es si el número que se
 * está mirando sigue siendo cierto.
 */
export function desdeHace(momentoISO: string, ahora = new Date()): string {
  const t = Date.parse(momentoISO.length <= 19 ? `${momentoISO}Z` : momentoISO);
  if (Number.isNaN(t)) return "hace un rato";
  const min = Math.floor((ahora.getTime() - t) / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "ayer" : `hace ${d} días`;
}
