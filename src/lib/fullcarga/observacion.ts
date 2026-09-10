/**
 * Lectura del campo OBSERVACIÓN del informe de Fullcarga.
 *
 * Es el campo del que depende la conciliación entera: **el informe no tiene
 * columna de CUIT**, y el CUIT del depositante solo aparece acá, dentro de
 * texto libre.
 *
 * Forma observada sobre el archivo real (84 filas, 82 con transferencia):
 *
 *     DD/MM/YYYY - <operación bancaria> - <nombre del depositante> / <concepto> / <CUIT>
 *
 * Con dos hechos que se midieron y no se supusieron:
 *
 *   · el CUIT es **siempre el último token** de la cadena — 82 de 82;
 *   · la fecha del principio **siempre coincide** con la columna
 *     FECHA INGRESO — 82 de 82.
 *
 * En vez de una expresión regular gigante que intente capturar todo de una,
 * hay parsers chicos e independientes: fecha, operación, CUIT, nombre. Cada
 * uno puede fallar por su cuenta sin arrastrar a los demás, y cada uno tiene
 * sus propios casos de prueba.
 */

import { analizarCuit, type Cuit } from "./cuit";

/**
 * Operaciones bancarias vistas en el segundo segmento del campo.
 *
 * Se listan las literales observadas para poder distinguir lo conocido de lo
 * nuevo: una operación que no esté acá se marca como patrón desconocido en
 * lugar de interpretarse a la fuerza.
 */
export const OPERACIONES_CONOCIDAS = [
  "Transferencia Recibida",
  "Transf Recibida Cvu Dif Titular",
  "Transferencia Ctas Mobile Banking",
  "Credito Transf Online Banking Emp",
  "Credito Transf Por Online Banking",
] as const;

/** Texto de las filas que no son una transferencia. */
export const OPERACION_MANTENIMIENTO = "Mantenimiento de plataforma";

export type PatronObservacion =
  /** Fecha, operación conocida, nombre, concepto y CUIT al final. */
  | "TRANSFERENCIA_COMPLETA"
  /** Tiene la forma general pero la operación no es una de las conocidas. */
  | "TRANSFERENCIA_OPERACION_NUEVA"
  /** Empieza con fecha pero no termina en un CUIT. */
  | "SIN_CUIT"
  /** El texto de mantenimiento de plataforma. */
  | "MANTENIMIENTO"
  /** Campo vacío. */
  | "VACIA"
  /** No se parece a nada conocido. */
  | "DESCONOCIDO";

export interface ObservacionLeida {
  original: string;
  patron: PatronObservacion;
  /** `YYYY-MM-DD`, tomada del principio del texto. */
  fecha: string | null;
  /** El literal del segundo segmento, tal cual vino. */
  operacion: string | null;
  /** Texto entre la operación y el CUIT. Puede traer nombre y concepto. */
  descripcion: string | null;
  cuit: Cuit | null;
  /** Cuántas secuencias de once dígitos hay. Más de una pide revisión. */
  candidatosCuit: number;
}

/** `DD/MM/YYYY` al principio del texto. */
const FECHA_INICIAL = /^\s*(\d{2})\/(\d{2})\/(\d{4})\b/;

/**
 * Secuencia de exactamente once dígitos, no pegada a otros dígitos.
 *
 * Los delimitadores importan: en el archivo real hay también números de diez
 * dígitos dentro del concepto —referencias, teléfonos— y sin ellos un `\d{11}`
 * podría morder parte de una secuencia más larga.
 */
const ONCE_DIGITOS_SUELTOS = /(?<!\d)\d{11}(?!\d)/g;

/** Fecha del principio, en ISO. Conversión léxica: nunca se usa `Date`. */
export function fechaDeObservacion(texto: string): string | null {
  const m = FECHA_INICIAL.exec(texto);
  if (!m) return null;
  const [, dia, mes, anio] = m;
  const d = Number(dia);
  const n = Number(mes);
  if (n < 1 || n > 12 || d < 1 || d > 31) return null;
  return `${anio}-${mes}-${dia}`;
}

/** Todas las secuencias de once dígitos, en orden de aparición. */
export function candidatosACuit(texto: string): string[] {
  return texto.match(ONCE_DIGITOS_SUELTOS) ?? [];
}

/** El segundo segmento separado por ` - `: la operación bancaria. */
export function operacionDeObservacion(texto: string): string | null {
  const partes = texto.split(" - ");
  if (partes.length < 2) return null;
  const op = partes[1].trim();
  return op === "" ? null : op;
}

/**
 * Lee el campo completo.
 *
 * Toma **el último** candidato a CUIT, no el primero: en el archivo real el
 * CUIT cierra siempre la cadena, y los números que aparecen antes pertenecen
 * al concepto que escribió el depositante.
 */
export function leerObservacion(texto: string | null | undefined): ObservacionLeida {
  const original = (texto ?? "").trim();

  if (original === "") {
    return {
      original,
      patron: "VACIA",
      fecha: null,
      operacion: null,
      descripcion: null,
      cuit: null,
      candidatosCuit: 0,
    };
  }

  if (/mantenimiento de plataforma/i.test(original)) {
    return {
      original,
      patron: "MANTENIMIENTO",
      fecha: null,
      operacion: OPERACION_MANTENIMIENTO,
      descripcion: null,
      cuit: null,
      candidatosCuit: 0,
    };
  }

  const fecha = fechaDeObservacion(original);
  const operacion = operacionDeObservacion(original);
  const candidatos = candidatosACuit(original);
  const cuit = candidatos.length > 0 ? analizarCuit(candidatos[candidatos.length - 1]) : null;

  const descripcion = (() => {
    const partes = original.split(" - ");
    if (partes.length < 3) return null;
    const resto = partes.slice(2).join(" - ");
    const ultimo = candidatos[candidatos.length - 1];
    const corte = ultimo ? resto.lastIndexOf(ultimo) : -1;
    const limpio = (corte >= 0 ? resto.slice(0, corte) : resto).replace(/[\s/]+$/, "").trim();
    return limpio === "" ? null : limpio;
  })();

  const conocida =
    operacion !== null &&
    (OPERACIONES_CONOCIDAS as readonly string[]).includes(operacion);

  let patron: PatronObservacion;
  if (fecha === null) patron = "DESCONOCIDO";
  else if (candidatos.length === 0) patron = "SIN_CUIT";
  else if (conocida) patron = "TRANSFERENCIA_COMPLETA";
  else patron = "TRANSFERENCIA_OPERACION_NUEVA";

  return { original, patron, fecha, operacion, descripcion, cuit, candidatosCuit: candidatos.length };
}
