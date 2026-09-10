/**
 * Generador de archivos XLS sintéticos.
 *
 * Arma un contenedor OLE2 mínimo con un stream `Workbook` en BIFF8. Nació
 * para los tests, porque el lector de `.xls` es el código más riesgoso del
 * módulo y no se puede probar con el archivo real —**tiene datos de terceros
 * y no se commitea**—. Se usa además para generar el informe de ejemplo con
 * el que se demuestra la importación. Todo lo que sale de acá es inventado.
 *
 * No es un exportador: no escribe estilos, ni fechas tipadas, ni varias
 * hojas. Si algún día hace falta exportar en serio, el lugar es otro.
 *
 * Cubre los dos caminos del contenedor:
 *   · stream grande → cadena de sectores en la FAT normal;
 *   · stream chico (< 4096 bytes) → mini-stream y mini-FAT.
 *
 * El segundo importa: un informe de un día sin movimientos es chico, y ese
 * camino se rompería en producción sin que ningún test lo notara.
 */

const SECTOR = 512;
const MINI = 64;
const CORTE_MINI = 4096;
const LIBRE = 0xffffffff;
const FIN = 0xfffffffe;
const FATSECT = 0xfffffffd;

/* ── BIFF8 ──────────────────────────────────────────────────── */

function registro(tipo: number, cuerpo: Buffer): Buffer {
  const cab = Buffer.alloc(4);
  cab.writeUInt16LE(tipo, 0);
  cab.writeUInt16LE(cuerpo.length, 2);
  return Buffer.concat([cab, cuerpo]);
}

/** Cadena BIFF8: largo en 16 bits, bandera de ancho, y el texto. */
function cadenaUnicode(texto: string): Buffer {
  const ancho = [...texto].some((c) => c.charCodeAt(0) > 0xff);
  const cuerpo = Buffer.from(texto, ancho ? "utf16le" : "latin1");
  const cab = Buffer.alloc(3);
  cab.writeUInt16LE(texto.length, 0);
  cab.writeUInt8(ancho ? 1 : 0, 2);
  return Buffer.concat([cab, cuerpo]);
}

export type CeldaSintetica = string | number | null;

export interface HojaSintetica {
  nombre: string;
  filas: CeldaSintetica[][];
}

/** Arma el stream `Workbook` con una hoja. */
function streamWorkbook(hoja: HojaSintetica): Buffer {
  // Tabla de cadenas compartidas.
  const indice = new Map<string, number>();
  for (const fila of hoja.filas) {
    for (const c of fila) {
      if (typeof c === "string" && !indice.has(c)) indice.set(c, indice.size);
    }
  }
  const cadenas = [...indice.keys()];

  const bofGlobales = registro(
    0x0809,
    Buffer.concat([
      Buffer.from([0x00, 0x06, 0x05, 0x00]), // versión 0x0600, tipo 0x0005
      Buffer.alloc(12),
    ]),
  );

  // El offset del BOF de la hoja se rellena después; el lector no lo usa.
  const nombre = Buffer.from(hoja.nombre, "latin1");
  const boundsheet = registro(
    0x0085,
    Buffer.concat([
      Buffer.alloc(4), // posición del BOF
      Buffer.from([0x00, 0x00]), // visible, worksheet
      Buffer.from([nombre.length, 0x00]), // largo y bandera de ancho
      nombre,
    ]),
  );

  const cabSst = Buffer.alloc(8);
  cabSst.writeInt32LE(cadenas.length, 0);
  cabSst.writeInt32LE(cadenas.length, 4);
  const sst = registro(0x00fc, Buffer.concat([cabSst, ...cadenas.map(cadenaUnicode)]));

  const eof = registro(0x000a, Buffer.alloc(0));

  const bofHoja = registro(
    0x0809,
    Buffer.concat([Buffer.from([0x00, 0x06, 0x10, 0x00]), Buffer.alloc(12)]),
  );

  const celdas: Buffer[] = [];
  hoja.filas.forEach((fila, f) => {
    fila.forEach((valor, c) => {
      if (valor === null || valor === undefined) return;
      if (typeof valor === "number") {
        const b = Buffer.alloc(14);
        b.writeUInt16LE(f, 0);
        b.writeUInt16LE(c, 2);
        b.writeUInt16LE(15, 4); // XF cualquiera
        b.writeDoubleLE(valor, 6);
        celdas.push(registro(0x0203, b));
      } else {
        const b = Buffer.alloc(10);
        b.writeUInt16LE(f, 0);
        b.writeUInt16LE(c, 2);
        b.writeUInt16LE(15, 4);
        b.writeUInt32LE(indice.get(valor)!, 6);
        celdas.push(registro(0x00fd, b));
      }
    });
  });

  return Buffer.concat([bofGlobales, boundsheet, sst, eof, bofHoja, ...celdas, eof]);
}

/* ── Contenedor OLE2 ────────────────────────────────────────── */

function entradaDirectorio(
  nombre: string,
  tipo: number,
  primerSector: number,
  tamano: number,
): Buffer {
  const e = Buffer.alloc(128);
  const utf16 = Buffer.from(nombre, "utf16le");
  utf16.copy(e, 0);
  e.writeUInt16LE(utf16.length + 2, 64);
  e.writeUInt8(tipo, 66);
  e.writeUInt8(1, 67); // negro
  e.writeUInt32LE(LIBRE, 68);
  e.writeUInt32LE(LIBRE, 72);
  e.writeUInt32LE(LIBRE, 76);
  e.writeUInt32LE(primerSector, 116);
  e.writeUInt32LE(tamano, 120);
  return e;
}

function cabecera(opciones: {
  sectorDirectorio: number;
  sectoresFat: number;
  primerFat: number;
  primerMiniFat: number;
  sectoresMiniFat: number;
}): Buffer {
  const h = Buffer.alloc(SECTOR, 0);
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]).copy(h, 0);
  h.writeUInt16LE(0x003e, 24); // minor
  h.writeUInt16LE(3, 26); // major
  h.writeUInt16LE(0xfffe, 28); // orden de bytes
  h.writeUInt16LE(9, 30); // 2^9 = 512
  h.writeUInt16LE(6, 32); // 2^6 = 64
  h.writeUInt32LE(opciones.sectoresFat, 44);
  h.writeUInt32LE(opciones.sectorDirectorio, 48);
  h.writeUInt32LE(CORTE_MINI, 56);
  h.writeUInt32LE(opciones.primerMiniFat, 60);
  h.writeUInt32LE(opciones.sectoresMiniFat, 64);
  h.writeUInt32LE(FIN, 68); // sin DIFAT extra
  h.writeUInt32LE(0, 72);
  for (let i = 0; i < 109; i++) h.writeUInt32LE(i === 0 ? opciones.primerFat : LIBRE, 76 + i * 4);
  return h;
}

function sectorDeEnteros(valores: readonly number[]): Buffer {
  const b = Buffer.alloc(SECTOR, 0xff);
  valores.forEach((v, i) => b.writeUInt32LE(v, i * 4));
  return b;
}

/**
 * Empaqueta el stream en un contenedor OLE2.
 *
 * Elige solo el camino del mini-stream cuando corresponde, igual que Excel:
 * por debajo de 4096 bytes el stream vive en el mini-stream.
 */
export function armarXls(hoja: HojaSintetica, forzarMiniStream = false): Buffer {
  const wb = streamWorkbook(hoja);
  const usaMini = forzarMiniStream || wb.length < CORTE_MINI;

  if (!usaMini) {
    const nSectores = Math.ceil(wb.length / SECTOR);
    // sector 0: FAT · sector 1: directorio · 2..: datos
    const fat: number[] = [FATSECT, FIN];
    for (let i = 0; i < nSectores; i++) fat.push(i === nSectores - 1 ? FIN : 3 + i);

    const dir = Buffer.alloc(SECTOR, 0);
    entradaDirectorio("Root Entry", 5, FIN, 0).copy(dir, 0);
    entradaDirectorio("Workbook", 2, 2, wb.length).copy(dir, 128);

    const datos = Buffer.alloc(nSectores * SECTOR, 0);
    wb.copy(datos, 0);

    return Buffer.concat([
      cabecera({ sectorDirectorio: 1, sectoresFat: 1, primerFat: 0, primerMiniFat: FIN, sectoresMiniFat: 0 }),
      sectorDeEnteros(fat),
      dir,
      datos,
    ]);
  }

  // Camino chico: sector 0 FAT · 1 directorio · 2 miniFAT · 3.. mini-stream
  const nMini = Math.ceil(wb.length / MINI);
  const bytesMini = nMini * MINI;
  const nSectoresMini = Math.ceil(bytesMini / SECTOR);

  const fat: number[] = [FATSECT, FIN, FIN];
  for (let i = 0; i < nSectoresMini; i++) fat.push(i === nSectoresMini - 1 ? FIN : 4 + i);

  const miniFat: number[] = [];
  for (let i = 0; i < nMini; i++) miniFat.push(i === nMini - 1 ? FIN : i + 1);

  const dir = Buffer.alloc(SECTOR, 0);
  // La raíz apunta al mini-stream y declara su tamaño.
  entradaDirectorio("Root Entry", 5, 3, bytesMini).copy(dir, 0);
  entradaDirectorio("Workbook", 2, 0, wb.length).copy(dir, 128);

  const datos = Buffer.alloc(nSectoresMini * SECTOR, 0);
  wb.copy(datos, 0);

  return Buffer.concat([
    cabecera({ sectorDirectorio: 1, sectoresFat: 1, primerFat: 0, primerMiniFat: 2, sectoresMiniFat: 1 }),
    sectorDeEnteros(fat),
    dir,
    sectorDeEnteros(miniFat),
    datos,
  ]);
}

/** Encabezados del informe real, en su orden. */
export const ENCABEZADOS = [
  "CODIGO CLIENTE",
  "CODIGO DISTRIBUIDOR",
  "CODIGO MAYORISTA",
  "RAZON SOCIAL",
  "TARJETA",
  "CREDITO INICIAL",
  "INCREMENTO",
  "CREDITO FINAL",
  "FECHA",
  "FECHA INGRESO",
  "BANCO",
  "TIPO INCREMENTO",
  "BOLSA DESTINO",
  " OBSERVACION",
];

/**
 * Informe sintético con la misma forma que el real: título, fila vacía,
 * encabezados y datos. Todos los CUIT de acá son inventados y **válidos por
 * dígito verificador**, calculado a mano para el test.
 */
export function informeSintetico(filasDatos: CeldaSintetica[][]): Buffer {
  return armarXls({
    nombre: "Hoja 1",
    filas: [
      ["Informe Movimiento de Saldos, 08-09-2026", ...Array<null>(13).fill(null)],
      Array<null>(14).fill(null),
      ENCABEZADOS,
      ...filasDatos,
    ],
  });
}

/** Fila de acreditación lista para armar, con valores inventados. */
export function filaAcreditacion(opciones: {
  observacion: string;
  importe?: number;
  fecha?: string;
  fechaIngreso?: string;
  tipoIncremento?: string;
  banco?: string;
}): CeldaSintetica[] {
  return [
    "10001",
    null,
    null,
    "EMPRESA DE PRUEBA SRL",
    null,
    0,
    opciones.importe ?? 1000,
    1000,
    opciones.fecha ?? "2026-09-08 10:00:00.000",
    opciones.fechaIngreso ?? "2026-09-05 09:00:00.0",
    opciones.banco ?? "Banco de Prueba",
    opciones.tipoIncremento ?? "Depósito bancario",
    "Bolsa General",
    opciones.observacion,
  ];
}
