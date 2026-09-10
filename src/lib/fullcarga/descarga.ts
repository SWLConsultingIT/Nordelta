/**
 * Validación de lo que llega.
 *
 * Premisa: **HTTP 200 no significa que tengamos el informe.** Una aplicación
 * Java que perdió la sesión responde 200 con la pantalla de ingreso; una que
 * falló al generar responde 200 con una página de error; y las dos cosas se
 * ven idénticas desde el código de estado.
 *
 * Por eso acá se mira el contenido, no el estado.
 */

import { createHash } from "node:crypto";
import { FullcargaInvalidReportError, FullcargaSessionExpiredError } from "./errores";
import { esPantallaDeIngreso } from "./formulario";
import { seguro } from "./redaccion";

/** Firma OLE2 (Compound File Binary): es lo que hay al principio de un .xls. */
const FIRMA_OLE2 = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
/** Firma ZIP: un .xlsx moderno es un zip. */
const FIRMA_ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

export type FormatoDetectado = "xls" | "xlsx" | "html" | "vacio" | "desconocido";

/** Qué es realmente el archivo, mirando sus primeros bytes. */
export function detectarFormato(bytes: Buffer): FormatoDetectado {
  if (bytes.length === 0) return "vacio";
  if (bytes.subarray(0, 8).equals(FIRMA_OLE2)) return "xls";
  if (bytes.subarray(0, 4).equals(FIRMA_ZIP)) return "xlsx";

  const inicio = bytes.subarray(0, 1024).toString("latin1").trimStart().toLowerCase();
  if (inicio.startsWith("<!doctype") || inicio.startsWith("<html") || inicio.startsWith("<?xml")) {
    return "html";
  }
  if (inicio.startsWith("<")) return "html";
  return "desconocido";
}

/**
 * Nombre del archivo según `Content-Disposition`.
 *
 * Soporta `filename*=UTF-8''...` (RFC 5987), que es el que gana cuando están
 * los dos, y el `filename=` de toda la vida.
 */
export function nombreDeContentDisposition(cabecera: string | null): string | null {
  if (!cabecera) return null;

  const extendido = /filename\*\s*=\s*([\w-]+)''([^;]+)/i.exec(cabecera);
  if (extendido) {
    try {
      return decodeURIComponent(extendido[2].trim());
    } catch {
      // Porcentaje mal formado: se sigue con el `filename` simple.
    }
  }

  const simple = /filename\s*=\s*(?:"([^"]*)"|([^;]+))/i.exec(cabecera);
  const crudo = simple?.[1] ?? simple?.[2];
  return crudo ? crudo.trim() : null;
}

/**
 * Deja el nombre en algo seguro de escribir en disco.
 *
 * Quita cualquier rastro de ruta, caracteres de control y los que rompen en
 * Windows o en macOS. Nunca devuelve cadena vacía ni un nombre relativo como
 * `..`: un nombre de archivo que viene de un tercero es entrada no confiable.
 */
export function sanearNombre(nombre: string, porDefecto = "informe.xls"): string {
  const soloBase = nombre.replace(/\\/g, "/").split("/").pop() ?? "";
  const limpio = soloBase
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[<>:"|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "");
  if (limpio === "") return porDefecto;
  return limpio.length > 180 ? limpio.slice(0, 180) : limpio;
}

export function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export interface ResultadoValidacion {
  /** Ya angostado: los demás formatos lanzan, no se devuelven. */
  formato: "xls" | "xlsx";
  bytes: number;
}

/**
 * Acepta el archivo o falla con el motivo exacto.
 *
 * Distingue a propósito «se cayó la sesión» de «esto no es un Excel»: son dos
 * incidentes distintos y llevan a dos acciones distintas.
 */
export function validarInforme(bytes: Buffer, contentType: string | null): ResultadoValidacion {
  const formato = detectarFormato(bytes);

  if (formato === "vacio") {
    throw new FullcargaInvalidReportError(
      "El servidor devolvió un archivo vacío",
      { bytes: 0, contentType: contentType ? seguro(contentType, 60) : null },
    );
  }

  if (formato === "html") {
    // No se guarda ni se registra el HTML: puede traer datos de la cuenta.
    const texto = bytes.subarray(0, 4096).toString("latin1");
    if (esPantallaDeIngreso(texto)) {
      throw new FullcargaSessionExpiredError(
        "En lugar del informe llegó la pantalla de ingreso: la sesión no estaba activa al pedir la descarga",
        { bytes: bytes.length },
      );
    }
    throw new FullcargaInvalidReportError(
      "En lugar del informe llegó una página HTML, probablemente un error de la aplicación",
      { bytes: bytes.length, contentType: contentType ? seguro(contentType, 60) : null },
    );
  }

  if (formato === "desconocido") {
    throw new FullcargaInvalidReportError(
      "El archivo no tiene una firma reconocible de Excel (ni OLE2 ni ZIP)",
      { bytes: bytes.length, contentType: contentType ? seguro(contentType, 60) : null },
    );
  }

  return { formato, bytes: bytes.length };
}

/**
 * ¿La cabecera declara una descarga y no una página?
 *
 * Se exige `attachment` porque es lo que se observó en la sesión legítima. Si
 * un día viniera sin él, el POC falla con un mensaje claro en lugar de
 * guardar en silencio algo que quizá no es el informe.
 */
export function esAttachment(contentDisposition: string | null): boolean {
  if (!contentDisposition) return false;
  return /^\s*attachment\b/i.test(contentDisposition);
}

/**
 * Ruta relativa con la que se guarda en disco: **una carpeta por fecha**.
 *
 *     2026-09-08/automatico-18db6824841b.xls
 *
 * Se arma acá y no se usa el nombre del servidor: el original lleva espacios,
 * acentos y —lo peor— **la fecha de generación en vez de la del informe**, así
 * que dos descargas de días distintos pueden parecer la misma. El nombre
 * original se conserva en `InformeDescargado.filename`.
 *
 * El hash corto ata el archivo a su SHA-256 completo y permite que convivan
 * dos descargas del mismo día: **el informe de un día crece mientras ese día
 * transcurre**, así que dos tomas pueden diferir legítimamente.
 */
export function nombreArchivoLocal(fecha: string, hash: string, formato: "xls" | "xlsx"): string {
  return `${fecha}/automatico-${hash.slice(0, 12)}.${formato}`;
}

/** ¿El `Content-Type` es compatible con una descarga de Excel? */
export function contentTypeRazonable(contentType: string | null): boolean {
  if (!contentType) return false;
  const t = contentType.toLowerCase();
  if (t.includes("text/html")) return false;
  return (
    t.includes("application/vnd.ms-excel") ||
    t.includes("application/vnd.openxmlformats-officedocument.spreadsheetml") ||
    t.includes("application/octet-stream") ||
    t.includes("application/x-msexcel") ||
    t.includes("application/excel")
  );
}
