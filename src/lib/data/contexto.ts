import "server-only";
import type { Repositorios } from "./puertos";
import { faltantes, haySupabase } from "../supabase/config";
import { repositoriosLocales } from "./local";

/**
 * Qué implementación de datos usa la aplicación.
 *
 * La elección es **explícita**, no deducida. En la iteración anterior el
 * modo se derivaba de si había variables de Supabase, y eso significaba
 * que una variable faltante en producción degradaba la aplicación a algo
 * que parecía funcionar. Un despliegue incompleto tiene que romperse.
 *
 *   `DATA_MODE=local`     → almacén respaldado en archivo (desarrollo)
 *   `DATA_MODE=demo`      → todo en memoria, sin disco (hosteable)
 *   `DATA_MODE=supabase`  → Postgres
 *
 * Sin la variable: en desarrollo se asume `local`, que es lo cómodo; en
 * producción **no se asume nada** y la aplicación falla cerrada.
 *
 * `demo` existe para poder mostrar el producto hosteado antes de tener
 * base. Está permitido en producción, pero **solo si se pide
 * explícitamente**: la regla que sigue en pie es que una variable
 * faltante nunca puede convertir un despliegue real en una demostración
 * pública. Pedirla a propósito es otra cosa.
 */

export type ModoDatos = "local" | "demo" | "supabase";

export class ErrorConfiguracion extends Error {
  readonly codigo = "CONFIGURACION";
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorConfiguracion";
  }
}

/** Resuelve el modo, o explica por qué no puede. */
export function modoDatos(entorno: NodeJS.ProcessEnv = process.env): ModoDatos {
  const declarado = entorno.DATA_MODE;
  const produccion = entorno.NODE_ENV === "production";

  if (declarado === "local") {
    if (produccion) {
      // El almacén local en producción es un archivo en el disco de un
      // contenedor efímero: se pierde en el próximo despliegue y no lo
      // comparten dos instancias. No es una limitación aceptable, es
      // pérdida de datos silenciosa.
      throw new ErrorConfiguracion(
        "DATA_MODE=local no está permitido en producción: el almacén en archivo no persiste entre despliegues.",
      );
    }
    return "local";
  }

  if (declarado === "demo") {
    // Memoria pura: en un contenedor efímero el disco no persiste y en
    // varios casos ni siquiera se puede escribir. El estado dura lo que
    // dure la instancia, que para una demostración es suficiente y
    // honesto.
    return "demo";
  }

  if (declarado === "supabase") {
    // Los nombres los resuelve `supabase/config`, que acepta la
    // convención nueva y la vieja. Comprobarlos acá por separado era
    // garantizar que las dos se desincronizaran, y fue exactamente lo
    // que pasó: la aplicación rechazaba una configuración válida.
    if (!haySupabase(entorno)) {
      throw new ErrorConfiguracion(
        `DATA_MODE=supabase pero falta: ${faltantes(entorno).join(", ")}.`,
      );
    }
    return "supabase";
  }

  if (declarado !== undefined) {
    throw new ErrorConfiguracion(
      `DATA_MODE desconocido: "${declarado}". Usá local, demo o supabase.`,
    );
  }

  if (produccion) {
    throw new ErrorConfiguracion(
      "Falta DATA_MODE. En producción no se asume ningún modo de datos.",
    );
  }
  return "local";
}

/**
 * Los repositorios del dominio operativo.
 *
 * Quien los consume no sabe —ni tiene por qué saber— qué hay debajo. Es lo
 * que permite que el servicio de conciliación se pruebe contra el almacén
 * local y corra en producción contra Postgres sin una sola rama.
 */
export async function repositorios(): Promise<Repositorios> {
  if (modoDatos() === "supabase") {
    const [{ createClient }, { repositoriosSupabase }] = await Promise.all([
      import("../supabase/server"),
      import("./supabase"),
    ]);
    return repositoriosSupabase(await createClient());
  }
  return repositoriosLocales();
}
