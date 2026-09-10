/**
 * Lector de `.xlsx` — el formato de Excel 2007 en adelante.
 *
 * Un `.xlsx` es un ZIP con XML adentro, nada que ver con el `.xls` binario
 * que manda Fullcarga. Por eso este lector es un módulo aparte de
 * `src/lib/fullcarga/xls.ts` y no comparte una línea con él.
 *
 * Sin dependencias, por las mismas razones de siempre: `exceljs` traería un
 * árbol grande para leer once archivos XML, y en esta máquina `npm install`
 * falla con `EACCES`. Lo que hace falta es un lector de ZIP —que `node:zlib`
 * resuelve— y sacar texto de un XML con estructura fija y generada por
 * plantilla.
 *
 * Alcance: **valores de celda y las señales que hacen falta para auditar una
 * planilla ajena** — filas y columnas ocultas, celdas combinadas y fórmulas.
 * Esas tres cosas se leen a propósito: una planilla de un tercero puede
 * esconder datos, y leerla como si fuera plana es cómo se pierde una fila sin
 * enterarse.
 */

import { inflateRawSync } from "node:zlib";

/* ── ZIP ────────────────────────────────────────────────────── */

const FIRMA_EOCD = 0x06054b50;
const FIRMA_CENTRAL = 0x02014b50;

/** Descomprime el ZIP en un mapa nombre → contenido. */
export function abrirZip(bytes: Buffer): Map<string, Buffer> {
  // El directorio central está al final; su cabecera puede tener comentario.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0 && i > bytes.length - 65558; i--) {
    if (bytes.readUInt32LE(i) === FIRMA_EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("El archivo no es un ZIP válido: falta el directorio central");

  const cantidad = bytes.readUInt16LE(eocd + 10);
  let p = bytes.readUInt32LE(eocd + 16);

  const salida = new Map<string, Buffer>();
  for (let n = 0; n < cantidad && p + 46 <= bytes.length; n++) {
    if (bytes.readUInt32LE(p) !== FIRMA_CENTRAL) break;
    const metodo = bytes.readUInt16LE(p + 10);
    const comprimido = bytes.readUInt32LE(p + 20);
    const largoNombre = bytes.readUInt16LE(p + 28);
    const largoExtra = bytes.readUInt16LE(p + 30);
    const largoComentario = bytes.readUInt16LE(p + 32);
    const desplazamiento = bytes.readUInt32LE(p + 42);
    const nombre = bytes.subarray(p + 46, p + 46 + largoNombre).toString("utf8");

    // La cabecera local repite los largos, que pueden diferir de los del
    // directorio: hay que leerlos de ahí.
    const localNombre = bytes.readUInt16LE(desplazamiento + 26);
    const localExtra = bytes.readUInt16LE(desplazamiento + 28);
    const inicio = desplazamiento + 30 + localNombre + localExtra;
    const datos = bytes.subarray(inicio, inicio + comprimido);

    salida.set(nombre, metodo === 0 ? Buffer.from(datos) : inflateRawSync(datos));
    p += 46 + largoNombre + largoExtra + largoComentario;
  }
  return salida;
}

/* ── XML ────────────────────────────────────────────────────── */

/** Las cinco entidades de XML. */
function desescapar(t: string): string {
  return t
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");
}

function atributo(etiqueta: string, nombre: string): string | null {
  const m = new RegExp(`\\b${nombre}\\s*=\\s*"([^"]*)"`).exec(etiqueta);
  return m ? desescapar(m[1]) : null;
}

/* ── Fechas ─────────────────────────────────────────────────── */

/** Formatos de fecha que Excel trae de fábrica. */
const NUMFMT_FECHA = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

/** ¿El patrón de formato describe una fecha? */
function patronEsFecha(codigo: string): boolean {
  // Se sacan literales entre comillas y colores entre corchetes, que pueden
  // traer letras que confundirían la detección.
  const limpio = codigo.replace(/"[^"]*"/g, "").replace(/\[[^\]]*\]/g, "");
  return /[dmyhs]/i.test(limpio) && !/^[#0.,%\s]*$/.test(limpio);
}

/**
 * Serial de Excel a fecha calendario, **sin usar `Date`**.
 *
 * Excel cuenta días desde el 1899-12-30 y arrastra el bug histórico de creer
 * que 1900 fue bisiesto. Convertir vía `Date` y volver a formatear es cómo
 * una fecha se corre un día según el huso, así que la conversión es
 * aritmética entera.
 */
export function serialAFecha(serial: number): string | null {
  const dias = Math.floor(serial);
  if (!Number.isFinite(dias) || dias < 1 || dias > 2958465) return null;
  // 2440588 es el día juliano del 1970-01-01; 25569 es el serial de esa fecha.
  let jd = dias + 2440588 - 25569;
  // Excel cree que existió el 29-02-1900: los seriales <= 59 van corridos.
  if (dias <= 59) jd += 1;

  const a = jd + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d2 = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d2) / 4);
  const m = Math.floor((5 * e + 2) / 153);

  const dia = e - Math.floor((153 * m + 2) / 5) + 1;
  const mes = m + 3 - 12 * Math.floor(m / 10);
  const anio = 100 * b + d2 - 4800 + Math.floor(m / 10);

  const dd = String(dia).padStart(2, "0");
  const mm = String(mes).padStart(2, "0");
  return `${anio}-${mm}-${dd}`;
}

/* ── Hoja ───────────────────────────────────────────────────── */

export type ValorXlsx = string | number | null;

export interface CeldaXlsx {
  fila: number;
  columna: number;
  valor: ValorXlsx;
  /** `YYYY-MM-DD` cuando el formato de la celda declara una fecha. */
  fecha: string | null;
  /** La fórmula, si la celda tiene una. */
  formula: string | null;
}

export interface HojaXlsx {
  nombre: string;
  celdas: Map<string, CeldaXlsx>;
  maxFila: number;
  maxColumna: number;
  filasOcultas: number[];
  columnasOcultas: number[];
  /** Rangos combinados, tal como los declara el archivo (`A1:B2`). */
  combinadas: string[];
  conFormula: number;
}

export const clave = (fila: number, columna: number) => `${fila},${columna}`;

/** `B3` → columna 1, fila 2 (base cero). */
export function referenciaACelda(ref: string): { fila: number; columna: number } | null {
  const m = /^([A-Z]+)(\d+)$/.exec(ref);
  if (!m) return null;
  let columna = 0;
  for (const c of m[1]) columna = columna * 26 + (c.charCodeAt(0) - 64);
  return { fila: Number(m[2]) - 1, columna: columna - 1 };
}

function leerCadenasCompartidas(xml: string): string[] {
  const salida: string[] = [];
  for (const si of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
    // Un texto con formato viene partido en varios <t> dentro de <r>.
    const partes = [...si[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => desescapar(m[1]));
    salida.push(partes.join(""));
  }
  return salida;
}

/** Índices de `cellXfs` que corresponden a un formato de fecha. */
function estilosDeFecha(xml: string): Set<number> {
  const personalizados = new Map<number, string>();
  for (const m of xml.matchAll(/<numFmt\b[^>]*\/?>/g)) {
    const id = Number(atributo(m[0], "numFmtId"));
    const codigo = atributo(m[0], "formatCode") ?? "";
    if (Number.isFinite(id)) personalizados.set(id, codigo);
  }

  const bloque = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(xml);
  const fechas = new Set<number>();
  if (!bloque) return fechas;

  let i = 0;
  for (const xf of bloque[1].matchAll(/<xf\b[^>]*\/?>/g)) {
    const id = Number(atributo(xf[0], "numFmtId") ?? "0");
    const codigo = personalizados.get(id);
    if (NUMFMT_FECHA.has(id) || (codigo !== undefined && patronEsFecha(codigo))) fechas.add(i);
    i += 1;
  }
  return fechas;
}

/** Lee el libro completo. Una entrada por hoja, en el orden del archivo. */
export function leerXlsx(bytes: Buffer): HojaXlsx[] {
  const zip = abrirZip(bytes);
  const texto = (nombre: string) => zip.get(nombre)?.toString("utf8") ?? "";

  const compartidas = leerCadenasCompartidas(texto("xl/sharedStrings.xml"));
  const fechas = estilosDeFecha(texto("xl/styles.xml"));

  // Nombre de hoja y ruta: el workbook referencia por r:id y los rels
  // traducen a la ruta real.
  const rels = new Map<string, string>();
  for (const m of texto("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b[^>]*\/?>/g)) {
    const id = atributo(m[0], "Id");
    const destino = atributo(m[0], "Target");
    if (id && destino) rels.set(id, destino.replace(/^\/?xl\//, "").replace(/^\//, ""));
  }

  const hojas: HojaXlsx[] = [];
  const wb = texto("xl/workbook.xml");
  let n = 0;
  for (const m of wb.matchAll(/<sheet\b[^>]*\/?>/g)) {
    n += 1;
    const nombre = atributo(m[0], "name") ?? `Hoja ${n}`;
    const rid = atributo(m[0], "r:id") ?? atributo(m[0], "id");
    const ruta = (rid && rels.get(rid)) || `worksheets/sheet${n}.xml`;
    const xml = texto(`xl/${ruta}`);
    if (xml === "") continue;

    const celdas = new Map<string, CeldaXlsx>();
    let maxFila = -1;
    let maxColumna = -1;
    let conFormula = 0;

    for (const c of xml.matchAll(/<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const atributos = c[1];
      const cuerpo = c[2] ?? "";
      const ref = atributo(`<c${atributos}>`, "r");
      if (!ref) continue;
      const pos = referenciaACelda(ref);
      if (!pos) continue;

      const tipo = atributo(`<c${atributos}>`, "t") ?? "n";
      const estilo = Number(atributo(`<c${atributos}>`, "s") ?? "-1");
      const formula = /<f\b[^>]*>([\s\S]*?)<\/f>/.exec(cuerpo)?.[1] ?? null;
      if (formula !== null) conFormula += 1;

      let valor: ValorXlsx = null;
      if (tipo === "inlineStr") {
        const partes = [...cuerpo.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((x) => desescapar(x[1]));
        valor = partes.join("");
      } else {
        const v = /<v>([\s\S]*?)<\/v>/.exec(cuerpo)?.[1];
        if (v === undefined) valor = null;
        else if (tipo === "s") valor = compartidas[Number(v)] ?? "";
        else if (tipo === "str" || tipo === "e") valor = desescapar(v);
        else if (tipo === "b") valor = v === "1" ? "VERDADERO" : "FALSO";
        else valor = Number(v);
      }

      const esFecha = typeof valor === "number" && estilo >= 0 && fechas.has(estilo);
      celdas.set(clave(pos.fila, pos.columna), {
        fila: pos.fila,
        columna: pos.columna,
        valor,
        fecha: esFecha && typeof valor === "number" ? serialAFecha(valor) : null,
        formula,
      });
      if (pos.fila > maxFila) maxFila = pos.fila;
      if (pos.columna > maxColumna) maxColumna = pos.columna;
    }

    // Filas ocultas: una planilla ajena puede esconder datos.
    const filasOcultas: number[] = [];
    for (const r of xml.matchAll(/<row\b[^>]*>/g)) {
      if (atributo(r[0], "hidden") === "1") {
        const num = Number(atributo(r[0], "r") ?? "0");
        if (num > 0) filasOcultas.push(num - 1);
      }
    }
    const columnasOcultas: number[] = [];
    for (const col of xml.matchAll(/<col\b[^>]*\/?>/g)) {
      if (atributo(col[0], "hidden") !== "1") continue;
      const min = Number(atributo(col[0], "min") ?? "0");
      const max = Number(atributo(col[0], "max") ?? String(min));
      for (let i = min; i <= max && i - min < 1000; i++) columnasOcultas.push(i - 1);
    }
    const combinadas = [...xml.matchAll(/<mergeCell\b[^>]*ref="([^"]+)"/g)].map((x) => x[1]);

    hojas.push({
      nombre, celdas, maxFila, maxColumna,
      filasOcultas, columnasOcultas, combinadas, conFormula,
    });
  }

  return hojas;
}
