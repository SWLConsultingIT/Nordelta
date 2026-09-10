/**
 * Taxonomía de errores del POC de Fullcarga.
 *
 * Deliberadamente **no** extiende `ErrorApp` de `domain/errors`: este módulo
 * es transporte contra un tercero, no dominio financiero, y mantenerlo
 * aislado es parte del encargo. Si mañana se integra a la aplicación, el
 * puente se hace en el borde, no acá.
 *
 * Regla que atraviesa todo el archivo: **un error nunca lleva adentro la
 * contraseña, la cookie de sesión, el token ni HTML autenticado.** El
 * contexto se limita a escalares que se puedan leer en un incidente.
 */

export type CodigoFullcarga =
  | "CONFIGURACION"
  | "RED"
  | "AUTENTICACION"
  | "SESION_EXPIRADA"
  | "TOKEN"
  | "GENERACION_INFORME"
  | "DESCARGA"
  | "INFORME_INVALIDO";

/** Contexto admitido: solo escalares. No hay lugar donde meter un secreto. */
export type ContextoFullcarga = Record<string, string | number | boolean | null>;

export abstract class ErrorFullcarga extends Error {
  abstract readonly codigo: CodigoFullcarga;
  readonly contexto: ContextoFullcarga;

  constructor(mensaje: string, contexto: ContextoFullcarga = {}) {
    super(mensaje);
    this.name = new.target.name;
    this.contexto = contexto;
  }
}

/** Falta una variable de entorno, o un argumento es inválido. */
export class FullcargaConfigurationError extends ErrorFullcarga {
  readonly codigo = "CONFIGURACION" as const;
}

/** No se pudo hablar con el servidor: DNS, TLS, timeout, conexión cortada. */
export class FullcargaNetworkError extends ErrorFullcarga {
  readonly codigo = "RED" as const;
}

/** El servidor respondió, pero la sesión no quedó autenticada. */
export class FullcargaAuthenticationError extends ErrorFullcarga {
  readonly codigo = "AUTENTICACION" as const;
}

/** Había sesión y se cayó a mitad del flujo. Distinto de no haber entrado. */
export class FullcargaSessionExpiredError extends ErrorFullcarga {
  readonly codigo = "SESION_EXPIRADA" as const;
}

/** El token de Struts no está en el formulario, o no se puede resolver. */
export class FullcargaTokenError extends ErrorFullcarga {
  readonly codigo = "TOKEN" as const;
}

/** El POST del informe no fue aceptado. */
export class FullcargaReportGenerationError extends ErrorFullcarga {
  readonly codigo = "GENERACION_INFORME" as const;
}

/** La descarga falló a nivel HTTP. */
export class FullcargaDownloadError extends ErrorFullcarga {
  readonly codigo = "DESCARGA" as const;
}

/** Llegó algo, pero no es el informe: HTML, vacío, o firma desconocida. */
export class FullcargaInvalidReportError extends ErrorFullcarga {
  readonly codigo = "INFORME_INVALIDO" as const;
}
