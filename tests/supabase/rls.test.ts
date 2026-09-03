import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  clienteAdmin, crearUsuario, leerConfig, limpiar, pataJson, MARCA,
  MOTIVO_OMISION, type Config, type UsuarioPrueba,
} from "./_entorno";

const config = leerConfig();
const suite = config ? describe : describe.skip;
if (!config) console.warn(`\n⚠ Suite de Supabase omitida. ${MOTIVO_OMISION}\n`);

/**
 * Aislamiento por oficina.
 *
 * Usuario A opera en Nordelta (oficina 1). Usuario B en Puertos (oficina 3).
 *
 * Cada prueba positiva —«A ve lo suyo»— va acompañada de su negativa —«A NO
 * ve lo de B»—. Una prueba de seguridad que solo verifica que el usuario
 * correcto ve sus datos no demuestra nada.
 */
suite("RLS · aislamiento entre usuarios", () => {
  const c = config as Config;
  let admin: SupabaseClient;
  let A: UsuarioPrueba;
  let B: UsuarioPrueba;
  let cpA = 0;
  let cpB = 0;
  let movA = "";
  let movB = "";

  beforeAll(async () => {
    admin = clienteAdmin(c);
    A = await crearUsuario(c, admin, { etiqueta: "A", rol: "supervisor", oficinaId: 1 });
    B = await crearUsuario(c, admin, { etiqueta: "B", rol: "supervisor", oficinaId: 3 });

    // Contrapartes y un movimiento por usuario, cada uno en su oficina.
    const { data: ca } = await A.cliente.rpc("obtener_o_crear_contraparte", {
      p_nombre: `${MARCA} contraparte A`,
    });
    cpA = Number(ca);
    const { data: cb } = await B.cliente.rpc("obtener_o_crear_contraparte", {
      p_nombre: `${MARCA} contraparte B`,
    });
    cpB = Number(cb);

    const { data: ma, error: ea } = await A.cliente.rpc("crear_movimiento", {
      p_fecha: "2026-09-01", p_oficina_id: 1, p_contraparte_id: cpA,
      p_concepto: `${MARCA} de A`, p_categoria: "ingreso",
      p_partidas: [pataJson("ARS", 100000)],
      p_origen: { source_system: MARCA },
    });
    if (ea) throw new Error(`A no pudo crear su movimiento: ${ea.message}`);
    movA = String(ma);

    const { data: mb, error: eb } = await B.cliente.rpc("crear_movimiento", {
      p_fecha: "2026-09-01", p_oficina_id: 3, p_contraparte_id: cpB,
      p_concepto: `${MARCA} de B`, p_categoria: "ingreso",
      p_partidas: [pataJson("USD", 5000)],
      p_origen: { source_system: MARCA },
    });
    if (eb) throw new Error(`B no pudo crear su movimiento: ${eb.message}`);
    movB = String(mb);
  });

  afterAll(async () => {
    await limpiar(admin, [A, B]);
  });

  /* ── Lectura ───────────────────────────────────────────── */

  it("A lee su propio movimiento", async () => {
    const { data, error } = await A.cliente
      .from("movimientos").select("id, concepto").eq("id", movA);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("A NO lee el movimiento de B", async () => {
    const { data, error } = await A.cliente
      .from("movimientos").select("id").eq("id", movB);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("B NO lee el movimiento de A", async () => {
    const { data } = await B.cliente.from("movimientos").select("id").eq("id", movA);
    expect(data ?? []).toHaveLength(0);
  });

  it("A no encuentra el movimiento de B ni listando todo", async () => {
    const { data } = await A.cliente.from("movimientos").select("id, oficina_id");
    const ids = (data ?? []).map((m) => String(m.id));
    expect(ids).not.toContain(movB);
    expect((data ?? []).every((m) => m.oficina_id === 1)).toBe(true);
  });

  it("A NO lee las partidas de B", async () => {
    const { data } = await A.cliente
      .from("partidas").select("id, movimiento_id").eq("movimiento_id", movB);
    expect(data ?? []).toHaveLength(0);
  });

  /* ── Escritura ─────────────────────────────────────────── */

  it("A NO puede insertar un movimiento en la oficina de B", async () => {
    const { error } = await A.cliente.from("movimientos").insert({
      fecha: "2026-09-02", oficina_id: 3, contraparte_id: cpA,
      concepto: `${MARCA} intrusión`, categoria: "ingreso", afecta_cta_cte: true,
    });
    expect(error).not.toBeNull();
  });

  it("A NO puede crear vía RPC en la oficina de B", async () => {
    const { error } = await A.cliente.rpc("crear_movimiento", {
      p_fecha: "2026-09-02", p_oficina_id: 3, p_contraparte_id: cpA,
      p_concepto: `${MARCA} intrusión rpc`, p_categoria: "ingreso",
      p_partidas: [pataJson("ARS", 1)],
    });
    expect(error).not.toBeNull();
  });

  it("A NO puede editar el movimiento de B", async () => {
    const { error, data } = await A.cliente
      .from("movimientos").update({ concepto: "editado por A" })
      .eq("id", movB).select();
    // O falla, o no afecta ninguna fila. Nunca modifica.
    expect(error !== null || (data ?? []).length === 0).toBe(true);

    const { data: verificacion } = await admin
      .from("movimientos").select("concepto").eq("id", movB).single();
    expect(verificacion?.concepto).toBe(`${MARCA} de B`);
  });

  it("A NO puede editar el movimiento de B vía RPC", async () => {
    const { error } = await A.cliente.rpc("actualizar_movimiento", {
      p_id: movB, p_fecha: "2026-09-01", p_oficina_id: 3, p_contraparte_id: cpB,
      p_concepto: "editado por A", p_categoria: "ingreso",
      p_partidas: [pataJson("USD", 1)],
    });
    expect(error).not.toBeNull();

    const { data } = await admin.from("movimientos").select("concepto").eq("id", movB).single();
    expect(data?.concepto).toBe(`${MARCA} de B`);
  });

  it("A NO puede borrar el movimiento de B", async () => {
    const { error, data } = await A.cliente
      .from("movimientos").delete().eq("id", movB).select();
    expect(error !== null || (data ?? []).length === 0).toBe(true);

    const { count } = await admin
      .from("movimientos").select("id", { count: "exact", head: true }).eq("id", movB);
    expect(count).toBe(1);
  });

  it("A NO puede borrar las partidas de B", async () => {
    const { data: antes } = await admin
      .from("partidas").select("id", { count: "exact" }).eq("movimiento_id", movB);
    const cantidad = (antes ?? []).length;

    await A.cliente.from("partidas").delete().eq("movimiento_id", movB);

    const { data: despues } = await admin
      .from("partidas").select("id").eq("movimiento_id", movB);
    expect((despues ?? []).length).toBe(cantidad);
  });

  /* ── Vistas ────────────────────────────────────────────── */
  // `security_invoker = true` es lo que hace que estas vistas respeten RLS.
  // Sin esa opción corren con los permisos del dueño y muestran todo.

  it("v_cta_cte respeta el aislamiento: A no ve la cuenta de B", async () => {
    const { data, error } = await A.cliente
      .from("v_cta_cte").select("movimiento_id, contraparte_id, oficina_id");
    expect(error).toBeNull();
    const ids = (data ?? []).map((f) => String(f.movimiento_id));
    expect(ids).not.toContain(movB);
    expect((data ?? []).every((f) => f.oficina_id === 1)).toBe(true);
  });

  it("v_cta_cte filtrada explícitamente por la contraparte de B devuelve vacío", async () => {
    const { data } = await A.cliente
      .from("v_cta_cte").select("movimiento_id").eq("contraparte_id", cpB);
    expect(data ?? []).toHaveLength(0);
  });

  it("v_balance no expone el saldo de la contraparte de B", async () => {
    const { data } = await A.cliente
      .from("v_balance").select("contraparte_id, moneda, saldo").eq("contraparte_id", cpB);
    expect(data ?? []).toHaveLength(0);
  });

  it("v_partidas_detalle no expone las partidas de B", async () => {
    const { data } = await A.cliente
      .from("v_partidas_detalle").select("partida_id").eq("movimiento_id", movB);
    expect(data ?? []).toHaveLength(0);
  });

  it("v_ultimo_cierre no expone los cierres de la contraparte de B", async () => {
    const { data } = await A.cliente
      .from("v_ultimo_cierre").select("contraparte_id").eq("contraparte_id", cpB);
    expect(data ?? []).toHaveLength(0);
  });

  it("cada uno sí ve lo suyo en las vistas — el aislamiento no rompe la función", async () => {
    const { data: da } = await A.cliente
      .from("v_cta_cte").select("movimiento_id").eq("movimiento_id", movA);
    expect(da).toHaveLength(1);

    const { data: db } = await B.cliente
      .from("v_cta_cte").select("movimiento_id").eq("movimiento_id", movB);
    expect(db).toHaveLength(1);
  });

  /* ── Alcance global ────────────────────────────────────── */

  it("un usuario con todas_las_oficinas ve las dos", async () => {
    const G = await crearUsuario(c, admin, {
      etiqueta: "global", rol: "admin", todasLasOficinas: true,
    });
    try {
      const { data } = await G.cliente.from("movimientos").select("id");
      const ids = (data ?? []).map((m) => String(m.id));
      expect(ids).toContain(movA);
      expect(ids).toContain(movB);
    } finally {
      await admin.auth.admin.deleteUser(G.id).catch(() => {});
    }
  });
});
