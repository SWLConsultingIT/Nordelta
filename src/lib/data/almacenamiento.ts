import "server-only";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { modoDatos } from "./contexto";
import { ErrorValidacion } from "../domain/errors";

/**
 * Guardado de los archivos originales.
 *
 * Se conservan la planilla que mandó el cliente y el informe que devolvió
 * Fullcarga. No es una comodidad: es la única prueba de qué llegó, el día
 * que alguien discute un importe o una fecha. Lo parseado es una
 * interpretación; el archivo es el hecho.
 *
 * La interfaz es deliberadamente chica —guardar, leer, la ruta— porque no
 * hace falta más. Un sistema de archivos con versiones, permisos y ciclo
 * de vida sería construir un producto distinto.
 */

export interface ArchivoGuardado {
  /** Ruta lógica, estable. Es lo que se persiste en la fila. */
  ruta: string;
  sha256: string;
  bytes: number;
}

/** Los dos tipos de original que se conservan. */
export type Sector = "planillas" | "fullcarga";

export interface AlmacenArchivos {
  /**
   * Guarda un original.
   *
   * La ruta **la arma el almacén**, no quien llama:
   *
   *     {organizacion}/{sector}/{huella}/{nombre saneado}
   *
   * Que el prefijo de organización sea estructural y no un argumento es
   * deliberado: así ningún camino del código puede olvidarse de ponerlo,
   * y la política de almacenamiento —que compara el primer segmento
   * contra la organización de quien consulta— siempre tiene qué comparar.
   *
   * La huella va en la ruta en lugar del identificador de la planilla o
   * del informe porque resuelve sola la idempotencia: el mismo archivo
   * subido dos veces cae en el mismo lugar y no se duplica. La
   * trazabilidad va en el otro sentido —de la fila a la ruta— y para eso
   * la fila guarda `storage_path` y `sha256`.
   */
  guardar(sector: Sector, nombre: string, datos: Buffer): Promise<ArchivoGuardado>;
  leer(ruta: string): Promise<Buffer | null>;
}

/* ── Validación de lo que se acepta ─────────────────────────── */

/** 8 MB. Una planilla de 600 filas pesa menos de 100 KB. */
export const TAMANO_MAXIMO = 8 * 1024 * 1024;

const EXTENSIONES: Record<string, readonly string[]> = {
  ".xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ".xls": ["application/vnd.ms-excel", "application/octet-stream"],
};

/** Firmas de los formatos que se aceptan, leídas del propio archivo. */
const FIRMAS: [string, readonly number[]][] = [
  // ZIP: todo .xlsx es un ZIP.
  [".xlsx", [0x50, 0x4b, 0x03, 0x04]],
  // OLE2 / CFB: el contenedor de un .xls clásico.
  [".xls", [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]],
];

/**
 * Nombre seguro para guardar.
 *
 * Se descarta cualquier ruta que venga en el nombre: un archivo llamado
 * `../../etc/passwd` no puede escribir fuera de su carpeta. Tampoco se
 * confía en la extensión declarada —eso lo verifica el contenido—, pero sí
 * se limita el juego de caracteres.
 */
export function nombreSeguro(nombre: string): string {
  const base = nombre.split(/[/\\]/).pop() ?? "archivo";
  const limpio = base
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^[.-]+/, "")
    .slice(0, 120);
  return limpio === "" ? "archivo" : limpio;
}

/**
 * Verifica que el archivo sea lo que dice ser.
 *
 * **La extensión y el tipo declarado no alcanzan**: los dos los elige quien
 * sube el archivo. Lo que decide es la firma en los primeros bytes.
 */
export function validarArchivo(
  nombre: string,
  datos: Buffer,
  contentType?: string,
): { extension: string } {
  if (datos.length === 0) throw new ErrorValidacion("El archivo está vacío", "archivo");
  if (datos.length > TAMANO_MAXIMO) {
    throw new ErrorValidacion(
      `El archivo supera los ${Math.round(TAMANO_MAXIMO / 1024 / 1024)} MB`, "archivo",
    );
  }

  const declarada = Object.keys(EXTENSIONES).find((e) => nombre.toLowerCase().endsWith(e));
  if (!declarada) {
    throw new ErrorValidacion("Solo se aceptan archivos .xlsx o .xls", "archivo");
  }

  const real = FIRMAS.find(([, firma]) =>
    firma.every((b, i) => datos[i] === b),
  )?.[0];
  if (!real) {
    throw new ErrorValidacion(
      "El contenido del archivo no corresponde a una planilla de Excel", "archivo",
    );
  }
  if (real !== declarada) {
    throw new ErrorValidacion(
      `El archivo dice ser ${declarada} pero su contenido es ${real}`, "archivo",
    );
  }
  if (contentType && !EXTENSIONES[declarada].includes(contentType)) {
    // No es motivo de rechazo por sí solo —los navegadores mandan
    // cualquier cosa—, pero sí se prefiere la firma real.
  }
  return { extension: real };
}

export const sha256 = (datos: Buffer) => createHash("sha256").update(datos).digest("hex");

/* ── Implementación local ───────────────────────────────────── */

const RAIZ = () => join(process.env.NORD_DATA_DIR ?? join(process.cwd(), ".data"), "archivos");

/** La misma forma de ruta en los dos almacenes, para que no diverjan. */
export function rutaDe(organizacionId: string, sector: Sector, nombre: string, huella: string) {
  return `${organizacionId}/${sector}/${huella}/${nombreSeguro(nombre)}`;
}

function almacenLocal(organizacionId: string): AlmacenArchivos {
  return {
    async guardar(sector, nombre, datos) {
      const huella = sha256(datos);
      const ruta = rutaDe(organizacionId, sector, nombre, huella);
      const destino = join(RAIZ(), ruta);
      mkdirSync(dirname(destino), { recursive: true });
      writeFileSync(destino, datos);
      return { ruta, sha256: huella, bytes: datos.length };
    },
    async leer(ruta) {
      const destino = join(RAIZ(), ruta);
      // La ruta se normaliza contra la raíz: nada puede leer fuera de ella.
      if (!destino.startsWith(RAIZ())) return null;
      return existsSync(destino) ? readFileSync(destino) : null;
    },
  };
}

/* ── Implementación Supabase ────────────────────────────────── */

const BUCKET = "originales";

async function almacenSupabase(organizacionId: string): Promise<AlmacenArchivos> {
  const { createClient } = await import("../supabase/server");
  const sb = await createClient();
  return {
    async guardar(sector, nombre, datos) {
      const huella = sha256(datos);
      const ruta = rutaDe(organizacionId, sector, nombre, huella);
      const { error } = await sb.storage
        .from(BUCKET)
        .upload(ruta, datos, { upsert: true, contentType: "application/octet-stream" });
      if (error) throw new ErrorValidacion(`No se pudo guardar el archivo: ${error.message}`, "archivo");
      return { ruta, sha256: huella, bytes: datos.length };
    },
    async leer(ruta) {
      const { data, error } = await sb.storage.from(BUCKET).download(ruta);
      if (error || !data) return null;
      return Buffer.from(await data.arrayBuffer());
    },
  };
}

/**
 * El almacén de la organización de quien está operando.
 *
 * Resuelve la organización por su cuenta en lugar de recibirla: es lo que
 * hace que el aislamiento sea estructural. Sin sesión con organización no
 * hay almacén, porque no habría prefijo que poner y todo terminaría en la
 * misma carpeta.
 */
export async function almacenDeArchivos(): Promise<AlmacenArchivos> {
  const supabase = modoDatos() === "supabase";
  const { perfilActual } = await import("../auth");
  const perfil = await perfilActual();
  const organizacionId = perfil?.organizacion?.id;

  if (!organizacionId) {
    if (supabase) {
      throw new ErrorValidacion(
        "No se puede guardar el archivo: la sesión no tiene organización.",
        "organizacion",
      );
    }
    // Fuera de Supabase no hay inquilinos: una carpeta fija alcanza y
    // mantiene la misma forma de ruta.
    return almacenLocal("local");
  }
  return supabase ? almacenSupabase(organizacionId) : almacenLocal(organizacionId);
}
