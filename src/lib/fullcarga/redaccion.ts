/**
 * Redacción y registro.
 *
 * Dos capas, a propósito:
 *
 *   1. `Registrador.paso()` solo acepta mensajes de una **lista cerrada**. No
 *      se puede registrar texto arbitrario, así que no hay forma de filtrar un
 *      secreto por descuido al agregar una línea de log.
 *   2. `redactar()` limpia cualquier texto que sí haya que interpolar —el
 *      nombre de un archivo, un tipo de contenido, el mensaje de un error—
 *      por si algo se cuela igual.
 *
 * La segunda capa existe porque la primera se puede eludir sin querer. Un
 * secreto en un log es un secreto publicado.
 */

/** Los únicos mensajes que el POC puede registrar. */
export const PASOS = [
  "authentication started",
  "authentication successful",
  "session established",
  "report form loaded",
  "token extracted",
  "report requested",
  "report downloaded",
  "XLS validated",
  "saved",
] as const;
export type Paso = (typeof PASOS)[number];

/** Prefijo de toda línea de registro del módulo. */
export const PREFIJO = "[fullcarga]";

/** Los checkpoints de la prueba controlada, en orden. */
export const CHECKPOINTS: readonly { n: number; titulo: string }[] = [
  { n: 1, titulo: "Authentication" },
  { n: 2, titulo: "Session established" },
  { n: 3, titulo: "Report form loaded" },
  { n: 4, titulo: "Struts token extracted" },
  { n: 5, titulo: "Report generated" },
  { n: 6, titulo: "XLS downloaded" },
  { n: 7, titulo: "XLS validated" },
  { n: 8, titulo: "XLS saved locally" },
];

const OMITIDO = "[omitido]";

/** Caracteres de control, incluido el DEL. Nunca llegan a un log. */
const CONTROL = /[\u0000-\u001f\u007f]/g;

/**
 * Patrones de secreto conocidos. Cada uno conserva la etiqueta y borra el
 * valor: saber que *había* una cookie es útil; su valor, nunca.
 */
const PATRONES: readonly RegExp[] = [
  /(JSESSIONID\s*=\s*)[^;\s,]+/gi,
  /(\bset-cookie\s*:\s*)[^\n]+/gi,
  /(\bcookie\s*:\s*)[^\n]+/gi,
  /(\bpassword\s*[=:]\s*)[^&;\s,]+/gi,
  /(\bcontrase(?:ñ|n)a\s*[=:]\s*)[^&;\s,]+/gi,
  /(\bstruts\.token[a-z.]*\s*[=:]\s*)[^&;\s,]+/gi,
  /(\btoken\s*[=:]\s*)[^&;\s,]+/gi,
  /(\bauthorization\s*:\s*)[^\n]+/gi,
];

/** Limpia secretos conocidos de un texto cualquiera. */
export function redactar(texto: string): string {
  let salida = texto;
  for (const p of PATRONES) salida = salida.replace(p, `$1${OMITIDO}`);
  return salida;
}

/**
 * ¿El texto parece HTML? Se usa para no registrar jamás una página
 * autenticada, que puede traer datos de la cuenta.
 */
export function pareceHTML(texto: string): boolean {
  const inicio = texto.slice(0, 512).trimStart().toLowerCase();
  return inicio.startsWith("<!doctype") || inicio.startsWith("<html") || inicio.startsWith("<");
}

/** Recorta y redacta cualquier valor que vaya a un mensaje de error. */
export function seguro(valor: string, largoMaximo = 120): string {
  const limpio = redactar(valor).replace(CONTROL, " ").replace(/\s+/g, " ").trim();
  return limpio.length > largoMaximo ? `${limpio.slice(0, largoMaximo)}…` : limpio;
}

export interface Registrador {
  paso(p: Paso): void;
  checkpoint(n: number, detalle?: string): void;
}

/** Registrador de consola. Es el único que el POC usa fuera de los tests. */
export function registradorConsola(silencioso = false): Registrador {
  return {
    paso(p) {
      if (!silencioso) console.log(`${PREFIJO} ${p}`);
    },
    checkpoint(n, detalle) {
      const c = CHECKPOINTS.find((x) => x.n === n);
      if (!c || silencioso) return;
      const extra = detalle ? ` — ${seguro(detalle)}` : "";
      console.log(`\nCHECKPOINT ${c.n}\n${c.titulo}${extra}`);
    },
  };
}

/** Registrador mudo, para los tests. */
export const registradorMudo: Registrador = { paso() {}, checkpoint() {} };
