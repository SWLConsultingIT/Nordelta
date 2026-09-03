import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  clienteAdmin, clienteAnonimo, crearUsuario, leerConfig, limpiar,
  MOTIVO_OMISION, type Config, type UsuarioPrueba,
} from "./_entorno";

const config = leerConfig();
const suite = config ? describe : describe.skip;
if (!config) console.warn(`\n⚠ Suite de Supabase omitida. ${MOTIVO_OMISION}\n`);

suite("Auth contra Supabase real", () => {
  const c = config as Config;
  let admin: SupabaseClient;
  const creados: UsuarioPrueba[] = [];

  beforeAll(async () => {
    admin = clienteAdmin(c);
  });
  afterAll(async () => {
    await limpiar(admin, creados);
  });

  it("un cliente anónimo no lee movimientos", async () => {
    const anon = clienteAnonimo(c);
    const { data, error } = await anon.from("movimientos").select("id").limit(1);
    // RLS sin sesión: o error de permiso, o cero filas. Nunca datos.
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  it("un cliente anónimo no lee la vista de cuenta corriente", async () => {
    const anon = clienteAnonimo(c);
    const { data, error } = await anon.from("v_cta_cte").select("movimiento_id").limit(1);
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  it("un cliente anónimo no puede llamar a los RPC", async () => {
    const anon = clienteAnonimo(c);
    const { error } = await anon.rpc("obtener_o_crear_contraparte", { p_nombre: "X" });
    expect(error).not.toBeNull();
  });

  it("un usuario autenticado obtiene su sesión y su perfil", async () => {
    const u = await crearUsuario(c, admin, { etiqueta: "auth-ok", oficinaId: 1 });
    creados.push(u);

    const { data: sesion } = await u.cliente.auth.getUser();
    expect(sesion.user?.id).toBe(u.id);

    const { data: perfil, error } = await u.cliente
      .from("perfiles").select("id, rol, oficina_id").eq("id", u.id).single();
    expect(error).toBeNull();
    expect(perfil?.rol).toBe("operador");
    expect(perfil?.oficina_id).toBe(1);
  });

  it("el trigger crea el perfil solo, con el alcance más bajo", async () => {
    // Se crea sin tocar el perfil: debe existir, en 'lectura' y sin oficina.
    const email = `nordelta-test-trigger-${Date.now()}@example.test`;
    const { data, error } = await admin.auth.admin.createUser({
      email, password: `Pw-${Date.now()}`, email_confirm: true,
    });
    expect(error).toBeNull();
    const id = data.user!.id;

    const { data: perfil } = await admin
      .from("perfiles").select("rol, oficina_id, todas_las_oficinas").eq("id", id).single();

    expect(perfil?.rol).toBe("lectura");
    expect(perfil?.oficina_id).toBeNull();
    expect(perfil?.todas_las_oficinas).toBe(false);

    await admin.auth.admin.deleteUser(id);
  });

  it("un usuario de auth SIN perfil no ve nada — falla cerrado", async () => {
    const u = await crearUsuario(c, admin, { etiqueta: "sin-perfil", conPerfil: false });
    creados.push(u);

    const { data } = await u.cliente.from("movimientos").select("id").limit(1);
    expect(data ?? []).toHaveLength(0);

    const { data: vista } = await u.cliente.from("v_cta_cte").select("movimiento_id").limit(1);
    expect(vista ?? []).toHaveLength(0);
  });

  it("un perfil con rol 'lectura' no puede escribir", async () => {
    const u = await crearUsuario(c, admin, {
      etiqueta: "lectura", rol: "lectura", oficinaId: 1,
    });
    creados.push(u);

    const { error } = await u.cliente.rpc("crear_movimiento", {
      p_fecha: "2026-09-01", p_oficina_id: 1, p_contraparte_id: null,
      p_concepto: "no debería entrar", p_categoria: "compra",
      p_partidas: [{ medio_pago: "efectivo", moneda_nominal: "ARS", monto_nominal: "100" }],
    });
    expect(error).not.toBeNull();
  });

  it("una sesión cerrada deja de leer", async () => {
    const u = await crearUsuario(c, admin, { etiqueta: "logout", oficinaId: 1 });
    creados.push(u);

    const antes = await u.cliente.from("perfiles").select("id").eq("id", u.id);
    expect(antes.error).toBeNull();

    await u.cliente.auth.signOut();

    const despues = await u.cliente.from("perfiles").select("id").eq("id", u.id);
    expect(despues.error !== null || (despues.data ?? []).length === 0).toBe(true);
  });

  it("un token corrupto se rechaza", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const roto = createClient(c.url, c.anonKey, {
      global: { headers: { Authorization: "Bearer no-es-un-token" } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await roto.from("movimientos").select("id").limit(1);
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });
});
