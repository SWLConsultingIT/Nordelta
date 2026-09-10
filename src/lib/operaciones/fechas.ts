/**
 * Aritmética de fechas calendario para el módulo operativo.
 *
 * Sin `Date`: todo se calcula sobre el número de día juliano, con enteros.
 * Es la misma decisión que tomó `conciliacion/index.ts` y existe por una
 * razón concreta: una operación depositada el 1 de septiembre lo fue el 1 de
 * septiembre en Buenos Aires, y ningún huso horario del servidor puede
 * moverla al 31 de agosto.
 */

/** Número de día juliano de una fecha ISO. Presupone formato válido. */
function jd(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const a = Math.floor((14 - m) / 12);
  const y2 = y + 4800 - a;
  const m2 = m + 12 * a - 3;
  return (
    d + Math.floor((153 * m2 + 2) / 5) + 365 * y2 +
    Math.floor(y2 / 4) - Math.floor(y2 / 100) + Math.floor(y2 / 400) - 32045
  );
}

/** La inversa: de día juliano a `YYYY-MM-DD`. */
function desdeJd(n: number): string {
  const a = n + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d2 = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d2) / 4);
  const m2 = Math.floor((5 * e + 2) / 153);
  const dia = e - Math.floor((153 * m2 + 2) / 5) + 1;
  const mes = m2 + 3 - 12 * Math.floor(m2 / 10);
  const anio = 100 * b + d2 - 4800 + Math.floor(m2 / 10);
  return `${String(anio).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** Suma días (o los resta, con `n` negativo) a una fecha ISO. */
export function sumarDias(iso: string, n: number): string {
  return desdeJd(jd(iso) + n);
}

/** Días entre dos fechas ISO. Positivo si `b` es posterior a `a`. */
export function diasEntreFechas(a: string, b: string): number {
  return jd(b) - jd(a);
}

/**
 * Días que lleva pendiente una operación.
 *
 * **Es derivado, nunca se persiste.** Guardar el número obliga a recalcularlo
 * todos los días para todas las filas y garantiza que en algún momento quede
 * viejo. Se calcula al leer, que es cuando importa.
 *
 * Nunca devuelve negativo: una fecha de envío futura es un dato raro, no una
 * antigüedad negativa.
 */
export function diasPendiente(fechaEnvio: string, hoy: string): number {
  return Math.max(0, diasEntreFechas(fechaEnvio, hoy));
}

/** `2026-09-10` → `10/09`. Para columnas densas donde el año es ruido. */
export function fechaCorta(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}
