import "server-only";
import { ErrorAuth } from "../domain/errors";
import { usaSupabase } from "../data";

export interface Sesion {
  userId: string;
  email: string;
  /** Verdadero cuando no hay Supabase configurado y la app corre en demo. */
  demo: boolean;
}

/**
 * Sesión actual, o null.
 *
 * Sin Supabase configurado devuelve una sesión de demostración, para que la
 * aplicación se pueda recorrer. En cuanto hay credenciales, la sesión es la
 * real y `exigirSesion()` bloquea de verdad.
 */
export async function sesionActual(): Promise<Sesion | null> {
  if (!usaSupabase) {
    return { userId: "demo", email: "demo@nordelta.com", demo: true };
  }
  const { createClient } = await import("../supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { userId: data.user.id, email: data.user.email ?? "", demo: false };
}

/**
 * Sesión o error.
 *
 * Se llama al principio de CADA Server Action y de cada route handler que
 * toque datos. La documentación de Next lo dice explícito: una Server Action
 * es un POST alcanzable por cualquiera que pueda armar el request, así que
 * no renderizar el formulario **no** es una frontera de seguridad.
 */
export async function exigirSesion(): Promise<Sesion> {
  const s = await sesionActual();
  if (!s) throw new ErrorAuth("Sin sesión");
  return s;
}
