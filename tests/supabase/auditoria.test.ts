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
 * Auditoría contra Supabase real.
 *
 * Se verifican dos cosas distintas: que registre lo que tiene que registrar
 * —con el actor correcto, el antes y el después— y que **no se pueda tocar**.
 * Append-only por construcción, no por convención.
 */
suite("Auditoría", () => {
  const c = config as Config;
  let admin: SupabaseClient;
  let U: UsuarioPrueba;      // supervisor: escribe y lee auditoría
  let OP: UsuarioPrueba;     // operador: no debería leer auditoría
  let cp = 0;

  const auditoriaDe = async (movId: string) => {
    const { data } = await admin
      .from("auditoria")
      .select("entidad, entidad_id, movimiento_id, operacion, campo, valor_anterior, valor_nuevo, actor, ocurrido_en, motivo")
      .eq("movimiento_id", movId)
      .order("ocurrido_en", { ascending: true });
    return data ?? [];
  };

  beforeAll(async () => {
    admin = clienteAdmin(c);
    U = await crearUsuario(c, admin, { etiqueta: "audit-sup", rol: "supervisor", oficinaId: 1 });
    OP = await crearUsuario(c, admin, { etiqueta: "audit-op", rol: "operador", oficinaId: 1 });
    const { data } = await U.cliente.rpc("obtener_o_crear_contraparte", {
      p_nombre: `${MARCA} auditoria`,
    });
    cp = Number(data);
  });

  afterAll(async () => {
    await limpiar(admin, [U, OP]);
  });

  /* ── Registro ──────────────────────────────────────────── */

  it("un alta registra INSERT del movimiento y de cada partida, con el actor", async () => {
    const { data: mov } = await U.cliente.rpc("crear_movimiento", {
      p_fecha: "2026-09-15", p_oficina_id: 1, p_contraparte_id: cp,
      p_concepto: `${MARCA} alta auditada`, p_categoria: "ingreso",
      p_partidas: [pataJson("ARS", 100000), pataJson("USD", 500)],
      p_origen: { source_system: MARCA },
    });
    const filas = await auditoriaDe(String(mov));

    const delMovimiento = filas.filter((f) => f.entidad === "movimientos");
    const dePartidas = filas.filter((f) => f.entidad === "partidas");

    expect(delMovimiento).toHaveLength(1);
    expect(delMovimiento[0].operacion).toBe("INSERT");
    // Las partidas SON el dinero: se auditan.
    expect(dePartidas).toHaveLength(2);
    expect(dePartidas.every((f) => f.operacion === "INSERT")).toBe(true);

    // Actor y momento.
    expect(filas.every((f) => f.actor === U.id)).toBe(true);
    expect(filas.every((f) => typeof f.ocurrido_en === "string" && f.ocurrido_en !== "")).toBe(true);
  });

  it("un cambio registra el campo con su valor anterior y el nuevo", async () => {
    const { data: mov } = await U.cliente.rpc("crear_movimiento", {
      p_fecha: "2026-09-16", p_oficina_id: 1, p_contraparte_id: cp,
      p_concepto: `${MARCA} antes`, p_categoria: "ingreso",
      p_partidas: [pataJson("ARS", 1000)],
      p_origen: { source_system: MARCA },
    });
    const id = String(mov);

    const { error } = await U.cliente
      .from("movimientos").update({ concepto: `${MARCA} despues` }).eq("id", id);
    expect(error).toBeNull();

    const cambios = (await auditoriaDe(id)).filter((f) => f.operacion === "UPDATE");
    const concepto = cambios.find((f) => f.campo === "concepto");

    expect(concepto).toBeDefined();
    expect(concepto!.valor_anterior).toBe(`${MARCA} antes`);
    expect(concepto!.valor_nuevo).toBe(`${MARCA} despues`);
    expect(concepto!.actor).toBe(U.id);
  });

  it("no registra ruido: updated_at y las columnas generadas quedan afuera", async () => {
    const { data: mov } = await U.cliente.rpc("crear_movimiento", {
      p_fecha: "2026-09-17", p_oficina_id: 1, p_contraparte_id: cp,
      p_concepto: `${MARCA} ruido`, p_categoria: "ingreso",
      p_partidas: [pataJson("ARS", 1000)],
      p_origen: { source_system: MARCA },
    });
    const id = String(mov);
    await U.cliente.from("movimientos").update({ concepto: `${MARCA} ruido 2` }).eq("id", id);

    const campos = (await auditoriaDe(id))
      .filter((f) => f.operacion === "UPDATE").map((f) => f.campo);
    expect(campos).not.toContain("updated_at");
    expect(campos).not.toContain("moneda_impacto");
    expect(campos).not.toContain("monto_impacto");
  });

  it("una baja queda registrada con el contenido anterior", async () => {
    const { data: mov } = await U.cliente.rpc("crear_movimiento", {
      p_fecha: "2026-09-18", p_oficina_id: 1, p_contraparte_id: cp,
      p_concepto: `${MARCA} a borrar`, p_categoria: "ingreso",
      p_partidas: [pataJson("ARS", 4321)],
      p_origen: { source_system: MARCA },
    });
    const id = String(mov);

    // Borrar es privilegio de admin.
    const ADM = await crearUsuario(c, admin, {
      etiqueta: "audit-adm", rol: "admin", todasLasOficinas: true,
    });
    try {
      const { error } = await ADM.cliente.from("movimientos").delete().eq("id", id);
      expect(error).toBeNull();

      const filas = await auditoriaDe(id);
      const baja = filas.find((f) => f.entidad === "movimientos" && f.operacion === "DELETE");
      expect(baja).toBeDefined();
      expect(baja!.valor_anterior).toContain(`${MARCA} a borrar`);
      expect(baja!.actor).toBe(ADM.id);

      // El cascade también audita la baja de la partida.
      const bajaPartida = filas.find((f) => f.entidad === "partidas" && f.operacion === "DELETE");
      expect(bajaPartida).toBeDefined();

      // Y la auditoría sobrevive al borrado del movimiento.
      expect(filas.length).toBeGreaterThan(0);
    } finally {
      await admin.auth.admin.deleteUser(ADM.id).catch(() => {});
    }
  });

  it("registra los cambios sobre contrapartes", async () => {
    const { data: nueva } = await U.cliente.rpc("obtener_o_crear_contraparte", {
      p_nombre: `${MARCA} para renombrar`,
    });
    const id = String(nueva);

    const { data } = await admin
      .from("auditoria").select("operacion, entidad")
      .eq("entidad", "contrapartes").eq("entidad_id", id);
    expect((data ?? []).some((f) => f.operacion === "INSERT")).toBe(true);
  });

  it("el motivo de una edición queda guardado", async () => {
    const { data: mov } = await U.cliente.rpc("crear_movimiento", {
      p_fecha: "2026-09-19", p_oficina_id: 1, p_contraparte_id: cp,
      p_concepto: `${MARCA} con motivo`, p_categoria: "ingreso",
      p_partidas: [pataJson("ARS", 100)],
      p_origen: { source_system: MARCA },
    });
    const id = String(mov);

    await U.cliente.rpc("actualizar_movimiento", {
      p_id: id, p_fecha: "2026-09-19", p_oficina_id: 1, p_contraparte_id: cp,
      p_concepto: `${MARCA} corregido`, p_categoria: "ingreso",
      p_partidas: [pataJson("ARS", 200)],
      p_motivo: "corrección de importe pedida por el cliente",
    });

    const filas = await auditoriaDe(id);
    expect(filas.some((f) => f.motivo?.includes("corrección de importe"))).toBe(true);
  });

  /* ── Inmutabilidad ─────────────────────────────────────── */
  // No hay política de INSERT, UPDATE ni DELETE sobre `auditoria`. Con RLS
  // activo, la ausencia de política DENIEGA. Ni un admin puede reescribir
  // el historial desde la aplicación.

  it("un supervisor puede LEER la auditoría", async () => {
    const { error } = await U.cliente.from("auditoria").select("id").limit(1);
    expect(error).toBeNull();
  });

  it("un operador NO puede leer la auditoría", async () => {
    const { data, error } = await OP.cliente.from("auditoria").select("id").limit(1);
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  it("un supervisor NO puede insertar en la auditoría a mano", async () => {
    const { error } = await U.cliente.from("auditoria").insert({
      entidad: "movimientos", entidad_id: "0", operacion: "INSERT",
      valor_nuevo: "inventado", actor: U.id,
    });
    expect(error).not.toBeNull();
  });

  it("un supervisor NO puede editar la auditoría", async () => {
    const { data: fila } = await admin.from("auditoria").select("id").limit(1).single();
    const { error, data } = await U.cliente
      .from("auditoria").update({ valor_nuevo: "reescrito" }).eq("id", fila!.id).select();
    expect(error !== null || (data ?? []).length === 0).toBe(true);

    const { data: verif } = await admin
      .from("auditoria").select("valor_nuevo").eq("id", fila!.id).single();
    expect(verif?.valor_nuevo).not.toBe("reescrito");
  });

  it("un supervisor NO puede borrar de la auditoría", async () => {
    const { count: antes } = await admin
      .from("auditoria").select("id", { count: "exact", head: true });
    await U.cliente.from("auditoria").delete().neq("id", 0);
    const { count: despues } = await admin
      .from("auditoria").select("id", { count: "exact", head: true });
    expect(despues).toBe(antes);
  });

  it("un admin tampoco puede reescribir el historial", async () => {
    const ADM = await crearUsuario(c, admin, {
      etiqueta: "audit-adm2", rol: "admin", todasLasOficinas: true,
    });
    try {
      const { data: fila } = await admin.from("auditoria").select("id").limit(1).single();
      const { error, data } = await ADM.cliente
        .from("auditoria").update({ valor_nuevo: "admin reescribió" }).eq("id", fila!.id).select();
      expect(error !== null || (data ?? []).length === 0).toBe(true);

      const { error: e2 } = await ADM.cliente.from("auditoria").insert({
        entidad: "movimientos", entidad_id: "0", operacion: "INSERT", actor: ADM.id,
      });
      expect(e2).not.toBeNull();
    } finally {
      await admin.auth.admin.deleteUser(ADM.id).catch(() => {});
    }
  });
});
