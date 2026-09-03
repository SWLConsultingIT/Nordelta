import type { Moneda } from "./domain/types";

const DECIMALES: Record<Moneda, number> = { ARS: 2, USD: 2, EUR: 2, BRL: 2 };

export function fmtMonto(n: number, moneda?: Moneda): string {
  const d = moneda ? DECIMALES[moneda] : 2;
  return n.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

/** Separa la parte entera de los decimales para poder atenuarlos.
 *  Es el detalle que hace que los números se lean como de banco. */
export function partirMonto(n: number, moneda?: Moneda): { entero: string; decimal: string } {
  const s = fmtMonto(n, moneda);
  const i = s.lastIndexOf(",");
  return i < 0 ? { entero: s, decimal: "" } : { entero: s.slice(0, i), decimal: s.slice(i) };
}

export function fmtPct(n: number): string {
  return (n * 100).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " %";
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

/** Acepta lo que el operador tipea: coma o punto decimal, negativos.
 *  Devuelve null si no es un número — la celda lo marca en rojo. */
export function parseMonto(v: string): number | null {
  const s = v.trim();
  if (s === "") return 0;
  if (!/^-?\d+(?:[.,]\d+)?$/.test(s)) return null;
  return parseFloat(s.replace(",", "."));
}
