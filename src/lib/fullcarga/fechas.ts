/**
 * Fechas calendario.
 *
 * Internamente el POC habla ISO (`2026-09-08`); Fullcarga espera
 * `DD-MM-YYYY`. La conversión es **puramente léxica**: no se construye
 * ningún `Date` en todo el archivo.
 *
 * El motivo importa. `new Date("2026-09-08")` se interpreta en UTC y
 * `new Date("2026-09-08T00:00:00")` en hora local; cualquiera de las dos,
 * combinada con `toISOString()`, puede correr la fecha un día según el huso
 * y el horario de verano. Para una fecha de calendario —que no es un
 * instante, es una etiqueta— eso es un error latente: pedirle a Fullcarga el
 * informe del día equivocado no falla, devuelve otros datos.
 *
 * Por la misma razón este módulo **no reutiliza** `esFechaISOValida()` de
 * `src/lib/format.ts`, que sí usa `Date`.
 */

import { FullcargaConfigurationError } from "./errores";

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

function bisiesto(anio: number): boolean {
  return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
}

function diasDelMes(anio: number, mes: number): number {
  const dias = [31, bisiesto(anio) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return dias[mes - 1];
}

/** ¿Es una fecha ISO real? Validación léxica, sin `Date`. */
export function esFechaCalendario(texto: string): boolean {
  const m = ISO.exec(texto);
  if (!m) return false;
  const anio = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  if (anio < 2000 || anio > 2100) return false;
  if (mes < 1 || mes > 12) return false;
  return dia >= 1 && dia <= diasDelMes(anio, mes);
}

/**
 * `2026-09-08` → `08-09-2026`, que es lo que espera el formulario.
 * Lanza si la fecha no es válida: mejor fallar acá que pedir otro día.
 */
export function aFormatoFullcarga(iso: string): string {
  if (!esFechaCalendario(iso)) {
    throw new FullcargaConfigurationError(
      `La fecha "${iso}" no es una fecha válida en formato YYYY-MM-DD`,
      { fecha: iso },
    );
  }
  const [anio, mes, dia] = iso.split("-");
  return `${dia}-${mes}-${anio}`;
}

/** Orden entre dos fechas ISO. Comparación de texto: ISO ya ordena bien. */
export function noEsPosterior(desde: string, hasta: string): boolean {
  return desde <= hasta;
}

/** Valida un rango completo y lo devuelve en el formato de Fullcarga. */
export function rangoFullcarga(desde: string, hasta: string): { desde: string; hasta: string } {
  const d = aFormatoFullcarga(desde);
  const h = aFormatoFullcarga(hasta);
  if (!noEsPosterior(desde, hasta)) {
    throw new FullcargaConfigurationError(
      `El rango está invertido: "${desde}" es posterior a "${hasta}"`,
      { desde, hasta },
    );
  }
  return { desde: d, hasta: h };
}
