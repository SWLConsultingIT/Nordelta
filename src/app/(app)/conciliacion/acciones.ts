"use server";

import { revalidatePath } from "next/cache";
import { exigirSesion } from "@/lib/auth";
import { aResultadoError, type Resultado } from "@/lib/domain/errors";
import { reevaluarTodo, resolverExcepcion, type EntradaResolucion } from "@/lib/data/operaciones";
import type { Corrida } from "@/lib/operaciones/tipos";

/**
 * Acciones del módulo operativo.
 *
 * `exigirSesion()` va primero en todas y no es negociable: una Server Action
 * es un POST alcanzable por cualquiera que arme el request, así que no
 * renderizar el botón no protege nada.
 */

/** Todo lo que cambia el estado invalida las mismas pantallas. */
function refrescar() {
  for (const ruta of ["/conciliacion", "/planillas", "/clientes", "/inicio", "/fullcarga"]) {
    revalidatePath(ruta, "layout");
  }
}

/**
 * «Actualizar conciliación»: vuelve a intentar contra todo lo que sigue
 * abierto. Es el equivalente manual del cron que todavía no existe, y
 * alcanza para lo que importa: que una pendiente pueda acreditarse sin que
 * nadie la vuelva a cargar.
 */
export async function accionActualizar(): Promise<Resultado<Corrida>> {
  try {
    await exigirSesion();
    const corrida = await reevaluarTodo("MANUAL");
    refrescar();
    return { ok: true, datos: corrida };
  } catch (e) {
    return aResultadoError(e);
  }
}

export async function accionResolver(entrada: EntradaResolucion): Promise<Resultado<Corrida>> {
  try {
    const sesion = await exigirSesion();
    const corrida = await resolverExcepcion({ ...entrada, actor: sesion?.email ?? entrada.actor });
    refrescar();
    return { ok: true, datos: corrida };
  } catch (e) {
    return aResultadoError(e);
  }
}
