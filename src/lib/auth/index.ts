import "server-only";
import { ErrorAuth } from "../domain/errors";
import { esDemo, usaSupabase } from "../data";

export interface Sesion {
  userId: string;
  email: string;
  /** Verdadero cuando no hay Supabase configurado y la app corre en demo. */
  demo: boolean;
}

/**
 * Quién soy y en qué organización estoy.
 *
 * La aplicación necesita las dos cosas para mostrar contexto sin exponer
 * identificadores técnicos: nadie tiene por qué ver un UUID en pantalla.
 * Cuando el perfil todavía no existe —usuario recién creado— se devuelve
 * lo que se sabe, no un error: bloquear la aplicación por no tener nombre
 * sería desproporcionado.
 */
export interface Perfil {
  userId: string;
  email: string;
  /** Nombre para mostrar. Cae al correo si no hay otro. */
  nombre: string;
  rol: "admin" | "supervisor" | "operador" | "lectura";
  organizacion: { id: string; nombre: string } | null;
  demo: boolean;
}

/**
 * Sesión actual, o null.
 *
 * En modo demostración devuelve una sesión ficticia para que la aplicación
 * se pueda recorrer. **Ese modo no existe en producción** —ver `esDemo`—,
 * así que un despliegue real nunca obtiene una sesión por esta vía.
 *
 * Si no hay Supabase y tampoco modo demostración, no hay sesión: la
 * aplicación bloquea. Es deliberado: preferimos que falle a que abra.
 */
export async function sesionActual(): Promise<Sesion | null> {
  if (esDemo) {
    return { userId: "demo", email: "demo@nordelta.com", demo: true };
  }
  if (!usaSupabase) return null;
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

/**
 * El perfil completo del usuario de la sesión.
 *
 * En modo demostración se arma uno coherente sin consultar nada. Con
 * Supabase se leen `perfiles` y `organizaciones`; si la consulta falla, se
 * devuelve el perfil mínimo en lugar de romper la pantalla: no saber el
 * nombre de la organización no es motivo para dejar a nadie afuera.
 */
export async function perfilActual(): Promise<Perfil | null> {
  const sesion = await sesionActual();
  if (!sesion) return null;

  if (sesion.demo) {
    return {
      userId: sesion.userId,
      email: sesion.email,
      nombre: "Equipo Nordelta",
      rol: "operador",
      organizacion: { id: "demo", nombre: "Nordelta" },
      demo: true,
    };
  }

  const minimo: Perfil = {
    userId: sesion.userId,
    email: sesion.email,
    nombre: sesion.email,
    rol: "lectura",
    organizacion: null,
    demo: false,
  };

  try {
    const { createClient } = await import("../supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("perfiles")
      .select("nombre, rol, organizaciones ( id, nombre )")
      .eq("id", sesion.userId)
      .maybeSingle();
    if (error || !data) return minimo;

    const fila = data as unknown as {
      nombre: string | null;
      rol: Perfil["rol"] | null;
      organizaciones: { id: string; nombre: string } | null;
    };
    return {
      ...minimo,
      nombre: fila.nombre?.trim() || sesion.email,
      rol: fila.rol ?? "lectura",
      organizacion: fila.organizaciones ?? null,
    };
  } catch {
    return minimo;
  }
}
