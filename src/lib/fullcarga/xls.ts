/**
 * Lector de XLS binario (Excel 97-2003).
 *
 * Fullcarga entrega el informe en formato **BIFF8 dentro de un contenedor
 * OLE2/CFB** — verificado sobre el archivo real: `CDFV2 Microsoft Excel`, un
 * único stream `Workbook`, versión de BIFF `0x0600`.
 *
 * Se implementa a mano, sin dependencias, por tres razones concretas:
 *
 *   · **no hay alternativa razonable en el ecosistema**: `exceljs` solo lee
 *     `.xlsx`; SheetJS dejó de publicarse en npm después de la 0.18.5, que
 *     arrastra una vulnerabilidad de contaminación de prototipo corregida solo
 *     en versiones que no están en el registro;
 *   · en esta máquina `npm install` falla con `EACCES`, así que cada
 *     dependencia nueva cuesta más de lo que parece;
 *   · el subconjunto que hace falta es chico y está completamente
 *     determinado por el archivo real.
 *
 * Alcance deliberado: **leer valores de celda**. No hay estilos, ni fórmulas
 * evaluadas, ni gráficos, ni formatos condicionales. Si el informe algún día
 * llega en `.xlsx`, esto no sirve y hay que detectarlo — por eso
 * `leerLibro()` falla con un mensaje explícito ante una firma ZIP.
 */

import { FullcargaInvalidReportError } from "./errores";

/* ── Contenedor OLE2 / Compound File Binary ─────────────────── */

const FIRMA_CFB = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const FIRMA_ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

/** Marcas de fin de cadena en la FAT. Todo lo `>= 0xFFFFFFFA` corta. */
const FIN_DE_CADENA = 0xfffffffa;

interface EntradaDirectorio {
  nombre: string;
  tipo: number;
  primerSector: number;
  tamano: number;
}

function cadenaDeSectores(fat: readonly number[], inicio: number, maximo: number): number[] {
  const sectores: number[] = [];
  let s = inicio;
  while (s < FIN_DE_CADENA && sectores.length < maximo) {
    sectores.push(s);
    s = fat[s] ?? 0xffffffff;
  }
  return sectores;
}

/** Extrae el stream `Workbook` del contenedor OLE2. */
export function extraerWorkbook(bytes: Buffer): Buffer {
  if (bytes.subarray(0, 4).equals(FIRMA_ZIP)) {
    throw new FullcargaInvalidReportError(
      "El archivo es un .xlsx (contenedor ZIP), no el .xls binario que este lector entiende",
      { bytes: bytes.length },
    );
  }
  if (!bytes.subarray(0, 8).equals(FIRMA_CFB)) {
    throw new FullcargaInvalidReportError("El archivo no tiene la firma OLE2 de un .xls", {
      bytes: bytes.length,
    });
  }

  const tamSector = 1 << bytes.readUInt16LE(30);
  const tamMini = 1 << bytes.readUInt16LE(32);
  const sectoresFat = bytes.readUInt32LE(44);
  const inicioDirectorio = bytes.readUInt32LE(48);
  const corteMini = bytes.readUInt32LE(56);
  const inicioMiniFat = bytes.readUInt32LE(60);
  const inicioDifat = bytes.readUInt32LE(68);
  const sectoresDifat = bytes.readUInt32LE(72);

  const desplazamiento = (s: number) => 512 + s * tamSector;
  const porSector = tamSector / 4;
  const totalSectores = Math.ceil((bytes.length - 512) / tamSector);

  // DIFAT: los primeros 109 en la cabecera, el resto encadenados.
  const difat: number[] = [];
  for (let i = 0; i < 109; i++) {
    const s = bytes.readUInt32LE(76 + i * 4);
    if (s < FIN_DE_CADENA) difat.push(s);
  }
  let sectorDifat = inicioDifat;
  for (let n = 0; n < sectoresDifat && sectorDifat < FIN_DE_CADENA; n++) {
    const base = desplazamiento(sectorDifat);
    for (let i = 0; i < porSector - 1; i++) {
      const s = bytes.readUInt32LE(base + i * 4);
      if (s < FIN_DE_CADENA) difat.push(s);
    }
    sectorDifat = bytes.readUInt32LE(base + (porSector - 1) * 4);
  }

  const fat: number[] = [];
  for (const s of difat.slice(0, sectoresFat)) {
    const base = desplazamiento(s);
    if (base + tamSector > bytes.length) break;
    for (let i = 0; i < porSector; i++) fat.push(bytes.readUInt32LE(base + i * 4));
  }

  const leerCadena = (inicio: number, tamano: number): Buffer => {
    const trozos = cadenaDeSectores(fat, inicio, totalSectores).map((s) =>
      bytes.subarray(desplazamiento(s), desplazamiento(s) + tamSector),
    );
    return Buffer.concat(trozos).subarray(0, tamano);
  };

  // Directorio.
  const entradas: EntradaDirectorio[] = [];
  for (const s of cadenaDeSectores(fat, inicioDirectorio, totalSectores)) {
    const base = desplazamiento(s);
    for (let i = 0; i + 128 <= tamSector; i += 128) {
      const e = base + i;
      if (e + 128 > bytes.length) break;
      const largoNombre = bytes.readUInt16LE(e + 64);
      if (largoNombre <= 2) continue;
      entradas.push({
        nombre: bytes.subarray(e, e + largoNombre - 2).toString("utf16le"),
        tipo: bytes.readUInt8(e + 66),
        primerSector: bytes.readUInt32LE(e + 116),
        // El tamaño es de 64 bits; un informe jamás pasa los 4 GB.
        tamano: bytes.readUInt32LE(e + 120),
      });
    }
  }

  const workbook = entradas.find((x) => x.nombre === "Workbook" || x.nombre === "Book");
  if (!workbook) {
    throw new FullcargaInvalidReportError(
      `El .xls no tiene stream "Workbook". Streams presentes: ${entradas.map((x) => x.nombre).join(", ")}`,
      { streams: entradas.length },
    );
  }

  // Un stream chico vive en el mini-stream, encadenado por la mini-FAT.
  if (workbook.tamano < corteMini) {
    const raiz = entradas.find((x) => x.tipo === 5);
    if (!raiz) throw new FullcargaInvalidReportError("El .xls no tiene entrada raíz");
    const miniStream = leerCadena(raiz.primerSector, raiz.tamano);

    const miniFat: number[] = [];
    for (const s of cadenaDeSectores(fat, inicioMiniFat, totalSectores)) {
      const base = desplazamiento(s);
      for (let i = 0; i < porSector; i++) miniFat.push(bytes.readUInt32LE(base + i * 4));
    }
    const trozos = cadenaDeSectores(miniFat, workbook.primerSector, miniFat.length).map((s) =>
      miniStream.subarray(s * tamMini, (s + 1) * tamMini),
    );
    return Buffer.concat(trozos).subarray(0, workbook.tamano);
  }

  return leerCadena(workbook.primerSector, workbook.tamano);
}

/* ── BIFF8 ──────────────────────────────────────────────────── */

const REC = {
  BOF: 0x0809,
  EOF: 0x000a,
  BOUNDSHEET: 0x0085,
  SST: 0x00fc,
  CONTINUE: 0x003c,
  LABELSST: 0x00fd,
  LABEL: 0x0204,
  NUMBER: 0x0203,
  RK: 0x027e,
  MULRK: 0x00bd,
  BOOLERR: 0x0205,
  FORMULA: 0x0006,
  STRING: 0x0207,
} as const;

interface Registro {
  tipo: number;
  cuerpo: Buffer;
}

function registros(stream: Buffer): Registro[] {
  const salida: Registro[] = [];
  let p = 0;
  while (p + 4 <= stream.length) {
    const tipo = stream.readUInt16LE(p);
    const largo = stream.readUInt16LE(p + 2);
    if (p + 4 + largo > stream.length) break;
    salida.push({ tipo, cuerpo: stream.subarray(p + 4, p + 4 + largo) });
    p += 4 + largo;
  }
  return salida;
}

/**
 * Tabla de cadenas compartidas.
 *
 * Es la parte con más trampa de BIFF8: una cadena puede quedar partida entre
 * el registro `SST` y varios `CONTINUE`, y **cada continuación vuelve a
 * declarar si el trozo es de 8 o de 16 bits**. Ignorar ese byte es el error
 * clásico que produce texto con basura intercalada.
 */
function leerSST(sst: Buffer, continuaciones: readonly Buffer[]): string[] {
  const bloques = [sst, ...continuaciones];
  let bi = 0;
  let p = 8; // se saltean total y únicas
  const unicas = sst.length >= 8 ? sst.readInt32LE(4) : 0;
  const cadenas: string[] = [];

  const siguiente = (): boolean => {
    if (bi + 1 >= bloques.length) return false;
    bi += 1;
    p = 0;
    return true;
  };

  for (let i = 0; i < unicas; i++) {
    while (p + 3 > bloques[bi].length) {
      if (!siguiente()) return cadenas;
    }
    let bloque = bloques[bi];
    const largo = bloque.readUInt16LE(p);
    p += 2;
    const banderas = bloque.readUInt8(p);
    p += 1;
    let ancho = (banderas & 0x01) !== 0;
    const richTexto = (banderas & 0x08) !== 0;
    const farEast = (banderas & 0x04) !== 0;
    const corridas = richTexto ? bloque.readUInt16LE(p) : 0;
    if (richTexto) p += 2;
    const extra = farEast ? bloque.readInt32LE(p) : 0;
    if (farEast) p += 4;

    const partes: string[] = [];
    let faltan = largo;
    while (faltan > 0) {
      bloque = bloques[bi];
      if (p >= bloque.length) {
        if (!siguiente()) break;
        bloque = bloques[bi];
        // Cada continuación redeclara el ancho de sus caracteres.
        ancho = (bloque.readUInt8(p) & 0x01) !== 0;
        p += 1;
        continue;
      }
      const disponibles = bloque.length - p;
      const n = Math.min(faltan, ancho ? Math.floor(disponibles / 2) : disponibles);
      if (n <= 0) {
        if (!siguiente()) break;
        bloque = bloques[bi];
        ancho = (bloque.readUInt8(p) & 0x01) !== 0;
        p += 1;
        continue;
      }
      const bytesTrozo = ancho ? n * 2 : n;
      partes.push(bloque.subarray(p, p + bytesTrozo).toString(ancho ? "utf16le" : "latin1"));
      p += bytesTrozo;
      faltan -= n;
    }
    cadenas.push(partes.join(""));
    p += corridas * 4 + extra;
  }
  return cadenas;
}

/** Decodifica un valor RK: entero o double, escalado por 100 o no. */
function valorRK(crudo: number): number {
  const centesimas = (crudo & 0x01) !== 0;
  const esEntero = (crudo & 0x02) !== 0;
  let n: number;
  if (esEntero) {
    n = crudo >> 2;
  } else {
    const b = Buffer.alloc(8);
    b.writeUInt32LE((crudo & 0xfffffffc) >>> 0, 4);
    n = b.readDoubleLE(0);
  }
  return centesimas ? n / 100 : n;
}

export type ValorCelda = string | number | null;

export interface Hoja {
  nombre: string;
  /** Indexada por `fila,columna`, ambas base cero. */
  celdas: Map<string, ValorCelda>;
  maxFila: number;
  maxColumna: number;
}

export const clave = (fila: number, columna: number) => `${fila},${columna}`;

/** Lee el libro completo. Devuelve una hoja por worksheet, en orden. */
export function leerLibro(bytes: Buffer): Hoja[] {
  const stream = extraerWorkbook(bytes);
  const recs = registros(stream);

  // Cadenas compartidas: el SST y todos sus CONTINUE inmediatos.
  let sst: string[] = [];
  for (let i = 0; i < recs.length; i++) {
    if (recs[i].tipo !== REC.SST) continue;
    const conts: Buffer[] = [];
    for (let j = i + 1; j < recs.length && recs[j].tipo === REC.CONTINUE; j++) {
      conts.push(recs[j].cuerpo);
    }
    sst = leerSST(recs[i].cuerpo, conts);
    break;
  }

  const nombres: string[] = [];
  for (const r of recs) {
    if (r.tipo !== REC.BOUNDSHEET || r.cuerpo.length < 8) continue;
    const largo = r.cuerpo.readUInt8(6);
    const ancho = (r.cuerpo.readUInt8(7) & 0x01) !== 0;
    nombres.push(
      r.cuerpo
        .subarray(8, 8 + (ancho ? largo * 2 : largo))
        .toString(ancho ? "utf16le" : "latin1"),
    );
  }

  const hojas: Hoja[] = [];
  let actual: Hoja | null = null;
  let enGlobales = true;

  const poner = (fila: number, columna: number, valor: ValorCelda) => {
    if (!actual) return;
    actual.celdas.set(clave(fila, columna), valor);
    if (fila > actual.maxFila) actual.maxFila = fila;
    if (columna > actual.maxColumna) actual.maxColumna = columna;
  };

  for (const r of recs) {
    if (r.tipo === REC.BOF) {
      const tipoSubstream = r.cuerpo.length >= 4 ? r.cuerpo.readUInt16LE(2) : 0;
      if (enGlobales) {
        enGlobales = false; // el primer BOF es el de globales
      } else if (tipoSubstream === 0x0010) {
        actual = {
          nombre: nombres[hojas.length] ?? `Hoja ${hojas.length + 1}`,
          celdas: new Map(),
          maxFila: -1,
          maxColumna: -1,
        };
        hojas.push(actual);
      }
      continue;
    }

    if (!actual) continue;
    const b = r.cuerpo;

    switch (r.tipo) {
      case REC.LABELSST:
        if (b.length >= 10) {
          const idx = b.readUInt32LE(6);
          poner(b.readUInt16LE(0), b.readUInt16LE(2), sst[idx] ?? "");
        }
        break;
      case REC.LABEL:
        if (b.length >= 9) {
          const largo = b.readUInt16LE(6);
          const ancho = (b.readUInt8(8) & 0x01) !== 0;
          poner(
            b.readUInt16LE(0),
            b.readUInt16LE(2),
            b.subarray(9, 9 + (ancho ? largo * 2 : largo)).toString(ancho ? "utf16le" : "latin1"),
          );
        }
        break;
      case REC.NUMBER:
        if (b.length >= 14) poner(b.readUInt16LE(0), b.readUInt16LE(2), b.readDoubleLE(6));
        break;
      case REC.RK:
        if (b.length >= 10) poner(b.readUInt16LE(0), b.readUInt16LE(2), valorRK(b.readInt32LE(6)));
        break;
      case REC.MULRK:
        if (b.length >= 6) {
          const fila = b.readUInt16LE(0);
          const primera = b.readUInt16LE(2);
          const n = Math.floor((b.length - 6) / 6);
          for (let i = 0; i < n; i++) {
            poner(fila, primera + i, valorRK(b.readInt32LE(4 + i * 6 + 2)));
          }
        }
        break;
      case REC.FORMULA:
        // Solo el resultado numérico. Un resultado de texto llega en el
        // STRING que sigue, y en este informe no aparece ninguno.
        if (b.length >= 14 && b.readUInt16LE(12) !== 0xffff) {
          poner(b.readUInt16LE(0), b.readUInt16LE(2), b.readDoubleLE(6));
        }
        break;
      default:
        break;
    }
  }

  return hojas;
}
