import { ErrorDominio } from "./errors";

/**
 * Primitivas de dinero.
 *
 * El sistema guarda importes en `numeric(18,4)` de Postgres y la base es la
 * autoridad. Este módulo existe para que el cálculo del navegador dé
 * exactamente el mismo número, no uno parecido.
 *
 * Dos cosas que hay que respetar sí o sí:
 *
 *   1. Postgres `round()` sobre numeric redondea **la mitad alejándose del
 *      cero**: round(-1.005, 2) = -1.01. `Math.round` de JavaScript redondea
 *      hacia +∞, así que da -1.00. En un libro donde los egresos van en
 *      negativo, esa diferencia es plata.
 *
 *   2. Nunca redondear parcialmente al acumular. Postgres hace
 *      `round(sum(x), 2)`: suma con precisión completa y redondea una sola
 *      vez al final. Redondear en cada paso arrastra el error.
 */

/** Precisión con la que la base guarda `monto_impacto`. */
export const DECIMALES_IMPACTO = 4;

/**
 * Monto máximo admitido para un importe individual.
 *
 * Un `number` de JavaScript representa enteros exactos hasta 2^53
 * (≈9,007·10^15). Con cuatro decimales eso deja un techo de ≈9·10^11.
 * El límite se fija en 10^11 —cien mil millones— que queda holgadamente
 * abajo y muy por encima de cualquier importe real de la operación.
 *
 * Pasado ese punto Postgres sigue siendo exacto (`numeric` no tiene este
 * problema) pero el cálculo del navegador empieza a desviarse, y un número
 * en pantalla distinto al del libro es peor que un error. Así que se
 * rechaza en lugar de tolerarse.
 */
export const MONTO_MAXIMO = 1e11;

/** Techo donde el redondeo escalado deja de ser exacto en un double. */
const LIMITE_EXACTITUD = Number.MAX_SAFE_INTEGER;
/** Precisión con la que se compara y se muestra un saldo. */
export const DECIMALES_SALDO = 2;

/**
 * Redondeo con la misma semántica que `round(numeric, n)` de Postgres:
 * mitad alejándose del cero.
 *
 * La corrección de error de representación es **relativa** al valor. Sumar
 * `Number.EPSILON` en términos absolutos no hace nada sobre 4.455.000, donde
 * el epsilon del float ya es del orden de 1e-9.
 */
export function redondear(n: number, decimales: number = DECIMALES_SALDO): number {
  if (!Number.isFinite(n)) {
    throw new ErrorDominio("Se intentó redondear un valor no finito", { valor: n });
  }
  const f = 10 ** decimales;
  const escalado = n * f;
  const magnitud = Math.abs(escalado);
  if (magnitud > LIMITE_EXACTITUD) {
    throw new ErrorDominio(
      "El valor excede la precisión que un double puede representar sin desviarse",
      { valor: n, decimales },
    );
  }
  // 4 ULP de margen para absorber el error de representación de la
  // multiplicación, pero ACOTADO. Sin el tope, a magnitud 1e15 cuatro ULP
  // son casi una unidad entera y la corrección misma mueve el resultado:
  // 99.999.999.999,9999 terminaba redondeando a 100.000.000.000.
  const correccion = Math.min(magnitud * Number.EPSILON * 4, 1e-8);
  const corregido = magnitud + correccion;
  const redondeado = Math.round(corregido) / f;
  return escalado < 0 ? -redondeado : redondeado;
}

/** Suma con precisión completa y redondea una sola vez, como hace Postgres. */
export function sumarYRedondear(
  valores: readonly number[],
  decimales = DECIMALES_SALDO,
): number {
  let acum = 0;
  for (const v of valores) {
    if (!Number.isFinite(v)) {
      throw new ErrorDominio("Se intentó sumar un valor no finito", { valor: v });
    }
    acum += v;
  }
  return redondear(acum, decimales);
}

/** ¿Es cero a la precisión con la que se compara un saldo? */
export function esCero(n: number, decimales = DECIMALES_SALDO): boolean {
  return redondear(n, decimales) === 0;
}

/* ────────────────────────────────────────────────────────────────
   Parseo de lo que el operador tipea o pega desde Excel.

   Excel con configuración regional argentina exporta «2.400.000,00»:
   punto como separador de miles y coma como decimal. Un parser que solo
   acepte «2400000.00» rompe el pegado, que es la función central de la
   pantalla de carga.
   ──────────────────────────────────────────────────────────────── */

/** Dígitos, separadores, signos, paréntesis, espacios y símbolos de moneda. */
const CARACTERES_ACEPTADOS = /^[\s    $€R()., +\-\d%]*$/;
const SIMBOLOS_A_QUITAR = /[$€R%\s    ]/g;

/**
 * Un punto solo es ambiguo: «1.485» puede ser mil cuatrocientos ochenta y
 * cinco (miles, formato argentino) o uno coma cuatrocientos ochenta y cinco.
 *
 * Se resuelve como separador de miles cuando la forma es la de un grupo de
 * miles: exactamente tres dígitos después, y una parte entera de uno a tres
 * dígitos que no arranca en cero. Así «1.485» y «12.345» son miles, mientras
 * que «1.5», «1234.56» y «0.500» quedan como decimales.
 */
function puntoEsSeparadorDeMiles(s: string): boolean {
  const m = /^(\d{1,3})\.(\d{3})$/.exec(s);
  return m !== null && !m[1].startsWith("0");
}

/**
 * Interpreta un número escrito por una persona. Devuelve `null` si el texto
 * no es un número — la celda lo marca y la base nunca lo va a ver.
 *
 * Acepta: 1234,56 · 1.234,56 · 1,234.56 · 2.400.000 · -1.200.000,50 ·
 *         (1.500) como negativo contable · $ 1.500 · 12% · vacío como 0
 */
export function parsearNumero(texto: string): number | null {
  let s = texto.trim();
  if (s === "") return 0;
  if (!CARACTERES_ACEPTADOS.test(s)) return null;

  // Paréntesis: notación contable de negativo.
  let negativo = false;
  const conParentesis = /^\((.*)\)$/.exec(s);
  if (conParentesis) {
    negativo = true;
    s = conParentesis[1].trim();
  }
  if (s.includes("(") || s.includes(")")) return null;

  s = s.replace(SIMBOLOS_A_QUITAR, "");
  if (s.startsWith("-")) {
    negativo = !negativo;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }
  if (s === "" || s.includes("-") || s.includes("+")) return null;

  const puntos = (s.match(/\./g) ?? []).length;
  const comas = (s.match(/,/g) ?? []).length;

  if (puntos > 0 && comas > 0) {
    // El último separador que aparece es el decimal.
    const decimal = s.lastIndexOf(",") > s.lastIndexOf(".") ? "," : ".";
    const miles = decimal === "," ? "." : ",";
    if ((s.match(new RegExp(`\\${decimal}`, "g")) ?? []).length > 1) return null;
    s = s.split(miles).join("").replace(decimal, ".");
  } else if (comas > 0) {
    // Una sola coma es decimal (formato argentino); varias son miles.
    s = comas === 1 ? s.replace(",", ".") : s.split(",").join("");
  } else if (puntos > 1) {
    s = s.split(".").join("");
  } else if (puntos === 1 && puntoEsSeparadorDeMiles(s)) {
    s = s.replace(".", "");
  }

  if (!/^\d*\.?\d*$/.test(s) || s === "." || s === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negativo ? -n : n;
}

/** Formatea para mostrar, en formato argentino. */
export function formatear(n: number, decimales = DECIMALES_SALDO): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

/** Parte entera y decimal por separado, para poder atenuar los centavos. */
export function partir(
  n: number,
  decimales = DECIMALES_SALDO,
): { entero: string; decimal: string } {
  const s = formatear(n, decimales);
  const i = s.lastIndexOf(",");
  return i < 0 ? { entero: s, decimal: "" } : { entero: s.slice(0, i), decimal: s.slice(i) };
}
