/**
 * Taxonomía de errores.
 *
 * Regla: fallar fuerte hacia adentro, claro hacia afuera. Nunca
 * `catch { return [] }` en un camino que toca dinero — un saldo vacío por
 * error silencioso es peor que una pantalla de error.
 */

export type CodigoError =
  | "DOMINIO"        // invariante del dominio violada
  | "VALIDACION"     // entrada del usuario inválida
  | "AUTH"           // sin sesión o sin permiso
  | "DATOS"          // fallo de la capa de datos
  | "NO_ENCONTRADO";

export abstract class ErrorApp extends Error {
  abstract readonly codigo: CodigoError;
  /** Mensaje apto para mostrarle al usuario. */
  abstract get mensajeUsuario(): string;
  readonly contexto: Record<string, unknown>;

  constructor(mensaje: string, contexto: Record<string, unknown> = {}) {
    super(mensaje);
    this.name = new.target.name;
    this.contexto = contexto;
  }
}

/** Una invariante del dominio no se cumple. Es un bug, no un dato malo. */
export class ErrorDominio extends ErrorApp {
  readonly codigo = "DOMINIO" as const;
  get mensajeUsuario() {
    return "La operación no pudo procesarse por una inconsistencia interna. El equipo fue notificado.";
  }
}

/** El usuario cargó algo inválido. Se puede corregir en pantalla. */
export class ErrorValidacion extends ErrorApp {
  readonly codigo = "VALIDACION" as const;
  /** Campo al que anclar el mensaje en la interfaz, si aplica. */
  readonly campo?: string;

  constructor(mensaje: string, campo?: string, contexto: Record<string, unknown> = {}) {
    super(mensaje, contexto);
    this.campo = campo;
  }
  get mensajeUsuario() {
    return this.message;
  }
}

export class ErrorAuth extends ErrorApp {
  readonly codigo = "AUTH" as const;
  get mensajeUsuario() {
    return "No tenés permiso para hacer esto.";
  }
}

export class ErrorDatos extends ErrorApp {
  readonly codigo = "DATOS" as const;
  get mensajeUsuario() {
    return "No pudimos comunicarnos con la base de datos. Volvé a intentar en un momento.";
  }
}

export class ErrorNoEncontrado extends ErrorApp {
  readonly codigo = "NO_ENCONTRADO" as const;
  get mensajeUsuario() {
    return "No encontramos lo que buscabas.";
  }
}

/** Forma serializable para devolver desde una Server Action.
 *  Nunca expone `contexto`, que puede contener datos internos. */
export interface ResultadoError {
  ok: false;
  codigo: CodigoError;
  mensaje: string;
  campo?: string;
}
export type Resultado<T> = { ok: true; datos: T } | ResultadoError;

export function aResultadoError(e: unknown): ResultadoError {
  if (e instanceof ErrorValidacion) {
    return { ok: false, codigo: e.codigo, mensaje: e.mensajeUsuario, campo: e.campo };
  }
  if (e instanceof ErrorApp) {
    return { ok: false, codigo: e.codigo, mensaje: e.mensajeUsuario };
  }
  return {
    ok: false,
    codigo: "DATOS",
    mensaje: "Ocurrió un error inesperado. Volvé a intentar.",
  };
}
