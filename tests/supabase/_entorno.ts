import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Entorno de pruebas contra Supabase real.
 *
 * Requiere tres variables. La `service_role` **solo** se usa para armar y
 * limpiar el escenario (crear usuarios, asignar perfiles); ninguna prueba de
 * aislamiento la usa, porque esa clave saltea la seguridad por fila y haría
 * pasar cualquier test.
 */
export interface Config {
  url: string;
  anonKey: string;
  serviceKey: string;
}

export function leerConfig(): Config | null {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) return null;
  return { url, anonKey, serviceKey };
}

export const MOTIVO_OMISION =
  "Faltan SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY. " +
  "Ver docs/SUPABASE_VALIDATION.md.";

/** Cliente administrativo. Saltea RLS: solo para preparar y limpiar. */
export function clienteAdmin(c: Config): SupabaseClient {
  return createClient(c.url, c.serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export interface UsuarioPrueba {
  id: string;
  email: string;
  password: string;
  /** Cliente con la sesión de este usuario. RLS aplica. */
  cliente: SupabaseClient;
}

/** Prefijo con el que se marcan todos los datos de prueba, para poder limpiar. */
export const MARCA = "nordelta-test";

function emailAleatorio(etiqueta: string) {
  return `${MARCA}-${etiqueta}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

/**
 * Crea un usuario, le asigna rol y alcance de oficina, y devuelve un cliente
 * con su sesión iniciada.
 *
 * El trigger `trg_crear_perfil` le arma el perfil solo, con el alcance más
 * bajo posible; acá se eleva a lo que la prueba necesite.
 */
export async function crearUsuario(
  c: Config,
  admin: SupabaseClient,
  opciones: {
    etiqueta: string;
    rol?: "admin" | "supervisor" | "operador" | "lectura";
    oficinaId?: number | null;
    todasLasOficinas?: boolean;
    /** Si es falso, no se le asigna perfil ni alcance. */
    conPerfil?: boolean;
  },
): Promise<UsuarioPrueba> {
  const email = emailAleatorio(opciones.etiqueta);
  const password = `Pw-${Math.random().toString(36).slice(2)}-${Date.now()}`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`No se pudo crear el usuario: ${error?.message}`);
  const id = data.user.id;

  if (opciones.conPerfil !== false) {
    const { error: e2 } = await admin
      .from("perfiles")
      .update({
        rol: opciones.rol ?? "operador",
        oficina_id: opciones.oficinaId ?? null,
        todas_las_oficinas: opciones.todasLasOficinas ?? false,
        nombre: `${MARCA} ${opciones.etiqueta}`,
      })
      .eq("id", id);
    if (e2) throw new Error(`No se pudo configurar el perfil: ${e2.message}`);
  } else {
    // Escenario «usuario de auth sin perfil»: se borra el que creó el trigger.
    await admin.from("perfiles").delete().eq("id", id);
  }

  const cliente = createClient(c.url, c.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: e3 } = await cliente.auth.signInWithPassword({ email, password });
  if (e3) throw new Error(`No se pudo iniciar sesión: ${e3.message}`);

  return { id, email, password, cliente };
}

/** Cliente sin sesión, para probar el acceso anónimo. */
export function clienteAnonimo(c: Config): SupabaseClient {
  return createClient(c.url, c.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Borra todo lo que crearon las pruebas.
 *
 * Se hace con la clave administrativa y filtrando por la marca, así nunca
 * puede tocar datos que no sean de prueba.
 */
export async function limpiar(admin: SupabaseClient, usuarios: UsuarioPrueba[]) {
  // Los movimientos de prueba se marcan en `origen`.
  await admin.from("movimientos").delete().eq("origen->>source_system", MARCA);
  await admin.from("contrapartes").delete().like("nombre", `${MARCA}%`);
  for (const u of usuarios) {
    await admin.auth.admin.deleteUser(u.id).catch(() => {});
  }
}

/** Partida mínima válida, en la forma que espera el RPC. */
export function pataJson(
  moneda: "ARS" | "USD" | "EUR" | "BRL",
  monto: number,
  extra: { tipo_cambio?: number; comision_pct?: number; medio_pago?: string } = {},
) {
  return {
    medio_pago: extra.medio_pago ?? "efectivo",
    moneda_nominal: moneda,
    monto_nominal: String(monto),
    ...(extra.tipo_cambio ? { tipo_cambio: String(extra.tipo_cambio) } : {}),
    ...(extra.comision_pct ? { comision_pct: String(extra.comision_pct) } : {}),
  };
}
