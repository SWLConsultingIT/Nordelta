import { ErrorApp } from "../domain/errors";

/**
 * Observabilidad mínima para poder investigar un fallo real.
 *
 * El objetivo es responder, ante un incidente: qué usuario, qué acción, qué
 * movimiento, qué request, qué error y cuándo. Nada más.
 *
 * Lo que NO se registra, a propósito:
 *   · secretos, tokens ni claves;
 *   · montos, saldos ni ningún importe;
 *   · nombres de contraparte;
 *   · el contenido de las filas cargadas.
 *
 * Un log de una aplicación financiera que vuelca los datos financieros
 * multiplica la superficie de exposición sin agregar capacidad de
 * diagnóstico: para investigar alcanza con el identificador del movimiento.
 */

export type Nivel = "info" | "warn" | "error";

export interface Evento {
  /** Correlaciona todo lo que pasó dentro de un mismo request. */
  correlacion: string;
  nivel: Nivel;
  /** Acción del dominio: "carga.guardar", "ajuste.registrar", "export.balance". */
  accion: string;
  /** Id del usuario. Nunca el correo, que es dato personal. */
  usuario?: string;
  /** Entidad involucrada, para poder rastrearla. Ids, no contenido. */
  contexto?: Record<string, string | number | boolean | null>;
  /** Clase del error, no su mensaje: el mensaje puede traer datos. */
  claseError?: string;
  codigoError?: string;
  duracionMs?: number;
  momento: string;
}

/** Campos cuyo valor nunca se registra, por si alguien los pasa sin pensar. */
const PROHIBIDOS = new Set([
  "password", "token", "authorization", "apikey", "api_key", "secret",
  "anon_key", "service_role", "jwt", "cookie",
  "monto", "monto_nominal", "monto_impacto", "saldo", "importe",
  "contraparte", "nombre", "concepto", "detalle", "email",
]);

function sanear(
  contexto: Record<string, unknown> | undefined,
): Record<string, string | number | boolean | null> | undefined {
  if (!contexto) return undefined;
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(contexto)) {
    if (PROHIBIDOS.has(k.toLowerCase())) {
      out[k] = "[omitido]";
      continue;
    }
    if (v === null) out[k] = null;
    else if (typeof v === "string") out[k] = v.length > 120 ? v.slice(0, 120) + "…" : v;
    else if (typeof v === "number" || typeof v === "boolean") out[k] = v;
    else out[k] = "[no escalar]";
  }
  return out;
}

export function nuevaCorrelacion(): string {
  return globalThis.crypto?.randomUUID?.() ?? `c-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function emitir(e: Evento) {
  // Una línea de JSON por evento: legible por cualquier agregador sin
  // configurar nada, y grepeable a mano mientras no haya uno.
  const linea = JSON.stringify(e);
  if (e.nivel === "error") console.error(linea);
  else if (e.nivel === "warn") console.warn(linea);
  else console.log(linea);
}

export function registrar(
  nivel: Nivel,
  accion: string,
  datos: {
    correlacion: string;
    usuario?: string;
    contexto?: Record<string, unknown>;
    error?: unknown;
    duracionMs?: number;
  },
) {
  const e: Evento = {
    correlacion: datos.correlacion,
    nivel,
    accion,
    usuario: datos.usuario,
    contexto: sanear(datos.contexto),
    momento: new Date().toISOString(),
    duracionMs: datos.duracionMs,
  };

  if (datos.error !== undefined) {
    e.claseError = datos.error instanceof Error ? datos.error.constructor.name : typeof datos.error;
    if (datos.error instanceof ErrorApp) e.codigoError = datos.error.codigo;
  }
  emitir(e);
}

/**
 * Envuelve una acción del dominio: mide, correlaciona y registra el fallo.
 *
 * El error se vuelve a lanzar siempre. Registrar no es manejar.
 */
export async function conObservabilidad<T>(
  accion: string,
  datos: { usuario?: string; contexto?: Record<string, unknown> },
  fn: (correlacion: string) => Promise<T>,
): Promise<T> {
  const correlacion = nuevaCorrelacion();
  const arranque = Date.now();
  try {
    const r = await fn(correlacion);
    registrar("info", accion, { ...datos, correlacion, duracionMs: Date.now() - arranque });
    return r;
  } catch (error) {
    registrar("error", accion, {
      ...datos, correlacion, error, duracionMs: Date.now() - arranque,
    });
    throw error;
  }
}
