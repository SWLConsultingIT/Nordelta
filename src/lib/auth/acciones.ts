"use server";

import { redirect } from "next/navigation";
import { aResultadoError, type Resultado } from "../domain/errors";
import { usaSupabase } from "../data";

/**
 * Ingreso.
 *
 * Vive acá y no en el componente para que ninguna pantalla hable con
 * Supabase directamente. El formulario solo conoce esta función.
 */
export async function ingresar(
  email: string,
  password: string,
): Promise<Resultado<{ demo: boolean }>> {
  try {
    if (!usaSupabase) {
      return { ok: true, datos: { demo: true } };
    }
    if (!email.trim() || !password) {
      return { ok: false, codigo: "VALIDACION", mensaje: "Completá el correo y la contraseña." };
    }

    const { createClient } = await import("../supabase/server");
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      // No se distingue «usuario inexistente» de «contraseña incorrecta»:
      // decirlo permitiría enumerar cuentas válidas.
      return {
        ok: false,
        codigo: "AUTH",
        mensaje: "No pudimos validar esos datos. Revisá el correo y la contraseña.",
      };
    }
    return { ok: true, datos: { demo: false } };
  } catch (e) {
    return aResultadoError(e);
  }
}

export async function salir(): Promise<void> {
  if (usaSupabase) {
    const { createClient } = await import("../supabase/server");
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}
