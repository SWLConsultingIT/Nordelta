"use server";

import { revalidatePath } from "next/cache";
import { exigirSesion } from "@/lib/auth";
import { restablecerDemo, esDemo } from "@/lib/data";
import { restablecerOperaciones } from "@/lib/data/operaciones";
import { aResultadoError, ErrorValidacion, type Resultado } from "@/lib/domain/errors";

/**
 * Vuelve los datos de demostración al estado inicial.
 *
 * Solo existe en modo demostración: sirve para repetir un recorrido de demo
 * sin reiniciar el servidor.
 */
export async function reiniciarDatosDemo(): Promise<Resultado<{ ok: true }>> {
  try {
    await exigirSesion();
    if (!esDemo) {
      throw new ErrorValidacion("Los datos solo se restablecen en modo demostración");
    }
    await restablecerDemo();
    await restablecerOperaciones();
    for (const r of [
      "/inicio", "/carga", "/cuentas", "/balance", "/ajustes", "/auditoria",
      "/conciliacion", "/planillas", "/clientes", "/fullcarga",
    ]) {
      revalidatePath(r, "layout");
    }
    return { ok: true, datos: { ok: true } };
  } catch (e) {
    return aResultadoError(e);
  }
}
