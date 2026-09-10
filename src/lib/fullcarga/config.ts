/**
 * Configuración por variables de entorno.
 *
 * Reglas que este archivo hace cumplir:
 *   · las credenciales **solo** salen de `FULLCARGA_USERNAME` y
 *     `FULLCARGA_PASSWORD`. No hay parámetro de CLI, ni archivo, ni valor por
 *     defecto que las pueda traer;
 *   · se validan **antes** de cualquier petición, para no descubrir a mitad
 *     del flujo que faltaba una;
 *   · nunca se imprimen. `describir()` existe justamente para poder mostrar
 *     el estado de la configuración sin mostrar su contenido.
 */

import { FullcargaConfigurationError } from "./errores";

export const BASE_POR_DEFECTO = "https://www.fullcarga-titan.com.ar/TITAN/";

/** Rutas observadas durante la inspección autenticada con DevTools. */
export const RUTAS = {
  ingreso: "Inicio.html",
  login: "Login.html",
  formularioInforme: "informeIngresosCreditos.html",
  descarga: "Informes.html",
} as const;

export interface Credenciales {
  usuario: string;
  /** Nunca se registra, ni se incluye en un error, ni se imprime. */
  password: string;
}

export interface ConfiguracionFullcarga {
  baseUrl: string;
  credenciales: Credenciales;
}

function limpia(v: string | undefined): string {
  return (v ?? "").trim();
}

/**
 * Lee y valida la configuración. Falla si falta algo, antes de la red.
 *
 * El mensaje nombra la variable que falta y **nunca** el valor de ninguna.
 */
export function leerConfiguracion(
  entorno: NodeJS.ProcessEnv = process.env,
): ConfiguracionFullcarga {
  const usuario = limpia(entorno.FULLCARGA_USERNAME);
  const password = limpia(entorno.FULLCARGA_PASSWORD);
  const baseUrl = limpia(entorno.FULLCARGA_BASE_URL) || BASE_POR_DEFECTO;

  const faltan: string[] = [];
  if (usuario === "") faltan.push("FULLCARGA_USERNAME");
  if (password === "") faltan.push("FULLCARGA_PASSWORD");

  if (faltan.length > 0) {
    throw new FullcargaConfigurationError(
      `Faltan variables de entorno: ${faltan.join(", ")}. Definilas en .env.local (no se commitea) antes de correr con --live.`,
      { faltantes: faltan.join(",") },
    );
  }

  try {
    const u = new URL(baseUrl);
    if (u.protocol !== "https:") {
      throw new FullcargaConfigurationError(
        "FULLCARGA_BASE_URL tiene que ser https: no se mandan credenciales sin cifrar",
        { protocolo: u.protocol },
      );
    }
  } catch (e) {
    if (e instanceof FullcargaConfigurationError) throw e;
    throw new FullcargaConfigurationError("FULLCARGA_BASE_URL no es una URL válida");
  }

  return { baseUrl, credenciales: { usuario, password } };
}

/** ¿Están las dos credenciales? Para chequear sin construir la configuración. */
export function hayCredenciales(entorno: NodeJS.ProcessEnv = process.env): boolean {
  return limpia(entorno.FULLCARGA_USERNAME) !== "" && limpia(entorno.FULLCARGA_PASSWORD) !== "";
}

/**
 * Estado de la configuración, apto para imprimir.
 * Dice si cada variable está definida; jamás qué contiene.
 */
export function describir(entorno: NodeJS.ProcessEnv = process.env): string {
  const marca = (v: string | undefined) => (limpia(v) !== "" ? "definida" : "AUSENTE");
  const base = limpia(entorno.FULLCARGA_BASE_URL) || `${BASE_POR_DEFECTO} (por defecto)`;
  return [
    `FULLCARGA_BASE_URL  ${base}`,
    `FULLCARGA_USERNAME  ${marca(entorno.FULLCARGA_USERNAME)}`,
    `FULLCARGA_PASSWORD  ${marca(entorno.FULLCARGA_PASSWORD)}`,
  ].join("\n");
}
