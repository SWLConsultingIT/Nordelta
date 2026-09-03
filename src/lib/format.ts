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

export function fmtMonto(n: number, moneda?: Moneda): string {
  return formatear(n, moneda ? DECIMALES[moneda] : DECIMALES_SALDO);
}

export function partirMonto(n: number, moneda?: Moneda): { entero: string; decimal: string } {
  return partir(n, moneda ? DECIMALES[moneda] : DECIMALES_SALDO);
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
