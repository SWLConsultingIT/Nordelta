/**
 * Escritor mínimo de `.xlsx`.
 *
 * Existe por una razón puntual: poder generar una planilla de ejemplo con la
 * que probar la importación de punta a punta, sin pedirle a nadie un archivo
 * real y sin agregar una dependencia —el proyecto no suma paquetes—.
 *
 * Es deliberadamente pobre. Escribe texto y números, una hoja, sin estilos ni
 * fórmulas ni fechas tipadas: las fechas van como texto `YYYY-MM-DD`, que es
 * lo que el lector acepta. **No sirve para exportar**, y no debería crecer
 * para eso: si algún día hace falta exportar en serio, el lugar es otro.
 *
 * Las entradas del ZIP se guardan **sin comprimir** (método 0). Un `.xlsx` es
 * un ZIP y el método almacenado es perfectamente válido; evita tener que
 * coordinar el deflate con el lector, y los archivos son chicos.
 */

/** CRC-32, que es lo único que el encabezado de ZIP exige calcular. */
const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = TABLA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

interface Entrada {
  nombre: string;
  datos: Buffer;
}

/** Arma el ZIP con las entradas dadas, todas almacenadas sin comprimir. */
function armarZip(entradas: readonly Entrada[]): Buffer {
  const locales: Buffer[] = [];
  const central: Buffer[] = [];
  let desplazamiento = 0;

  for (const e of entradas) {
    const nombre = Buffer.from(e.nombre, "utf8");
    const crc = crc32(e.datos);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);       // versión necesaria
    local.writeUInt16LE(0, 6);        // sin banderas
    local.writeUInt16LE(0, 8);        // método 0: almacenado
    local.writeUInt16LE(0, 10);       // hora
    local.writeUInt16LE(0x2821, 12);  // fecha: 2020-01-01, fija y reproducible
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(e.datos.length, 18);
    local.writeUInt32LE(e.datos.length, 22);
    local.writeUInt16LE(nombre.length, 26);
    local.writeUInt16LE(0, 28);
    locales.push(local, nombre, e.datos);

    const cab = Buffer.alloc(46);
    cab.writeUInt32LE(0x02014b50, 0);
    cab.writeUInt16LE(20, 4);
    cab.writeUInt16LE(20, 6);
    cab.writeUInt16LE(0, 8);
    cab.writeUInt16LE(0, 10);
    cab.writeUInt16LE(0, 12);
    cab.writeUInt16LE(0x2821, 14);
    cab.writeUInt32LE(crc, 16);
    cab.writeUInt32LE(e.datos.length, 20);
    cab.writeUInt32LE(e.datos.length, 24);
    cab.writeUInt16LE(nombre.length, 28);
    cab.writeUInt32LE(0, 38);         // atributos externos
    cab.writeUInt32LE(desplazamiento, 42);
    central.push(cab, nombre);

    desplazamiento += 30 + nombre.length + e.datos.length;
  }

  const cuerpoCentral = Buffer.concat(central);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(entradas.length, 8);
  fin.writeUInt16LE(entradas.length, 10);
  fin.writeUInt32LE(cuerpoCentral.length, 12);
  fin.writeUInt32LE(desplazamiento, 16);

  return Buffer.concat([...locales, cuerpoCentral, fin]);
}

const escapar = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Índice de columna a letra: 0 → A, 26 → AA. */
export function letraColumna(i: number): string {
  let n = i + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export type CeldaEscritura = string | number | null;

/** Genera un `.xlsx` de una hoja a partir de una matriz de celdas. */
export function escribirXlsx(filas: readonly (readonly CeldaEscritura[])[], hoja = "Hoja1"): Buffer {
  const cuerpo = filas
    .map((fila, f) => {
      const celdas = fila
        .map((v, c) => {
          if (v === null || v === "") return "";
          const ref = `${letraColumna(c)}${f + 1}`;
          return typeof v === "number"
            ? `<c r="${ref}"><v>${v}</v></c>`
            : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapar(v)}</t></is></c>`;
        })
        .join("");
      return `<row r="${f + 1}">${celdas}</row>`;
    })
    .join("");

  const b = (s: string) => Buffer.from(s, "utf8");

  return armarZip([
    {
      nombre: "[Content_Types].xml",
      datos: b(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
          '<Default Extension="xml" ContentType="application/xml"/>' +
          '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
          '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
          "</Types>",
      ),
    },
    {
      nombre: "_rels/.rels",
      datos: b(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
          "</Relationships>",
      ),
    },
    {
      nombre: "xl/workbook.xml",
      datos: b(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
          'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
          `<sheets><sheet name="${escapar(hoja)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      ),
    },
    {
      nombre: "xl/_rels/workbook.xml.rels",
      datos: b(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
          "</Relationships>",
      ),
    },
    {
      nombre: "xl/worksheets/sheet1.xml",
      datos: b(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
          `<sheetData>${cuerpo}</sheetData></worksheet>`,
      ),
    },
  ]);
}
