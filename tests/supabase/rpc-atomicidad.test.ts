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
 * Atomicidad de las operaciones multi-tabla.
 *
 * Lo que se demuestra: ante un fallo en la segunda partida, no queda ni
 * cabecera, ni partidas, ni auditoría. Un movimiento a medias es un saldo
 * incorrecto que además parece válido, y es peor que un error.
 */
suite("RPC · atomicidad", () => {
  const c = config as Config;
  let admin: SupabaseClient;
  let U: UsuarioPrueba;
  let cp = 0;

  const contarMovimientos = async () => {
    const { count } = await admin
      .from("movimientos").select("id", { count: "exact", head: true })
      .eq("origen->>source_system", MARCA);
    return count ?? 0;
  };
  const contarPartidas = async (movId: string) => {
    const { count } = await admin
      .from("partidas").select("id", { count: "exact", head: true })
      .eq("movimiento_id", movId);
    return count ?? 0;
  };

  beforeAll(async () => {
    admin = clienteAdmin(c);
    U = await crearUsuario(c, admin, { etiqueta: "rpc", rol: "supervisor", oficinaId: 1 });
    const { data } = await U.cliente.rpc("obtener_o_crear_contraparte", {
      p_nombre: `${MARCA} atomicidad`,
    });
    cp = Number(data);
  });

  afterAll(async () => {
    await limpiar(admin, [U]);
  });

  /* ── Camino feliz ──────────────────────────────────────── */

  it("crea un movimiento con tres partidas y las guarda todas", async () => {
    const { data, error } = await U.cliente.rpc("crear_movimiento", {
      p_fecha: "2026-09-05", p_oficina_id: 1, p_contraparte_id: cp,
      p_concepto: `${MARCA} tres patas`, p_categoria: "ingreso",
      p_partidas: [
        pataJson("ARS", 100000),
        pataJson("ARS", 50000, { medio_pago: "transferencia", tipo_cambio: 1485, comision_pct: 0.02 }),
        pataJson("USD", 500),
      ],
      p_origen: { source_system: MARCA },
    });
    expect(error).toBeNull();
    expect(await contarPartidas(String(data))).toBe(3);
  });

  it("las columnas generadas quedan calculadas por la base", async () => {
    const { data: mov } = await U.cliente.rpc("crear_movimiento", {
      p_fecha: "2026-09-05", p_oficina_id: 1, p_contraparte_id: cp,
      p_concepto: `${MARCA} generadas`, p_categoria: "ingreso",
      p_partidas: [pataJson("ARS", 4455000, { tipo_cambio: 1485 })],
      p_origen: { source_system: MARCA },
    });
    const { data } = await admin
      .from("partidas").select("moneda_impacto, monto_impacto")
      .eq("movimiento_id", String(mov)).single();
    expect(data?.moneda_impacto).toBe("USD");
    expect(Number(data?.monto_impacto)).toBe(3000);
  });

  it("afecta_cta_cte se deriva de la categoría y no se puede pasar por alto", async () => {
    const { data: mov } = await U.cliente.rpc("crear_movimiento", {
      p_fecha: "2026-09-05", p_oficina_id: 1, p_contraparte_id: cp,
      p_concepto: `${MARCA} compra`, p_categoria: "compra",
      p_partidas: [pataJson("ARS", 1000)],
      p_origen: { source_system: MARCA },
    });
    const { data } = await admin
      .from("movimientos").select("afecta_cta_cte").eq("id", String(mov)).single();
    expect(data?.afecta_cta_cte).toBe(false);
  });

  /* ── Fallo intermedio ──────────────────────────────────── */

  it("un monto en cero en la SEGUNDA partida no deja nada escrito", async () => {
    const antes = await contarMovimientos();

    const { error } = await U.cliente.rpc("crear_movimiento", {
      p_fecha: "2026-09-06", p_oficina_id: 1, p_contraparte_id: cp,
      p_concepto: `${MARCA} debe revertirse`, p_categoria: "ingreso",
      p_partidas: [
        pataJson("ARS", 100000),
        pataJson("ARS", 0), // viola partidas_monto_no_cero
        pataJson("USD", 500),
      ],
      p_origen: { source_system: MARCA },
    });

    expect(error).not.toBeNull();
    expect(await contarMovimientos()).toBe(antes);

    const { data } = await admin
      .from("movimientos").select("id").eq("concepto", `${MARCA} debe revertirse`);
    expect(data ?? []).toHaveLength(0);
  });

  it("una comisión sobre efectivo en la tercera partida revierte todo", async () => {
    const antes = await contarMovimientos();
    const { error } = await U.cliente.rpc("crear_movimiento", {
      p_fecha: "2026-09-06", p_oficina_id: 1, p_contraparte_id: cp,
      p_concepto: `${MARCA} comision invalida`, p_categoria: "ingreso",
      p_partidas: [
        pataJson("ARS", 100000),
        pataJson("USD", 500),
        pataJson("ARS", 1000, { comision_pct: 0.02 }), // efectivo con comisión
      ],
      p_origen: { source_system: MARCA },
    });
    expect(error).not.toBeNull();
    expect(await contarMovimientos()).toBe(antes);
  });

  it("un tipo de cambio sobre una pata en dólares revierte todo", async () => {
    const antes = await contarMovimientos();
    const { error } = await U.cliente.rpc("crear_movimiento", {
      p_fecha: "2026-09-06", p_oficina_id: 1, p_contraparte_id: cp,
      p_concepto: `${MARCA} tc en usd`, p_categoria: "ingreso",
      p_partidas: [pataJson("ARS", 100), pataJson("USD", 500, { tipo_cambio: 1485 })],
      p_origen: { source_system: MARCA },
    });
    expect(error).not.toBeNull();
    expect(await contarMovimientos()).toBe(antes);
  });

  it("un movimiento sin partidas se rechaza", async () => {
    const { error } = await U.cliente.rpc("crear_movimiento", {
      p_fecha: "2026-09-06", p_oficina_id: 1, p_contraparte_id: cp,
      p_concepto: `${MARCA} vacio`, p_categoria: "ingreso", p_partidas: [],
    });
    expect(error).not.toBeNull();
  });

  it("el fallo no deja auditoría huérfana", async () => {
    const { data } = await admin
      .from("auditoria").select("id, entidad_id")
      .eq("entidad", "movimientos").ilike("valor_nuevo", `%${MARCA} debe revertirse%`);
    expect(data ?? []).toHaveLength(0);
  });

  /* ── Lote ──────────────────────────────────────────────── */

  it("el lote guarda todos los movimientos cuando todos son válidos", async () => {
    const antes = await contarMovimientos();
    const { data, error } = await U.cliente.rpc("crear_movimientos_lote", {
      p_movimientos: [1, 2, 3].map((i) => ({
        fecha: "2026-09-07", oficina_id: 1, contraparte_id: cp,
        concepto: `${MARCA} lote ${i}`, categoria: "ingreso",
        partidas: [pataJson("ARS", 1000 * i)],
        origen: { source_system: MARCA },
      })),
    });
    expect(error).toBeNull();
    expect(data).toHaveLength(3);
    expect(await contarMovimientos()).toBe(antes + 3);
  });

  it("el lote no guarda NINGUNO si una fila del medio es inválida", async () => {
    const antes = await contarMovimientos();
    const { error } = await U.cliente.rpc("crear_movimientos_lote", {
      p_movimientos: [
        { fecha: "2026-09-08", oficina_id: 1, contraparte_id: cp,
          concepto: `${MARCA} lote-ok-1`, categoria: "ingreso",
          partidas: [pataJson("ARS", 1000)], origen: { source_system: MARCA } },
        { fecha: "2026-09-08", oficina_id: 1, contraparte_id: cp,
          concepto: `${MARCA} lote-mala`, categoria: "ingreso",
          partidas: [pataJson("ARS", 0)], origen: { source_system: MARCA } },
        { fecha: "2026-09-08", oficina_id: 1, contraparte_id: cp,
          concepto: `${MARCA} lote-ok-2`, categoria: "ingreso",
          partidas: [pataJson("ARS", 2000)], origen: { source_system: MARCA } },
      ],
    });
    expect(error).not.toBeNull();
    expect(await contarMovimientos()).toBe(antes);

    const { data } = await admin
      .from("movimientos").select("id").like("concepto", `${MARCA} lote-ok-%`);
    expect(data ?? []).toHaveLength(0);
  });

  /* ── Edición ───────────────────────────────────────────── */

  it("la edición reemplaza todas las partidas de una vez", async () => {
    const { data: mov } = await U.cliente.rpc("crear_movimiento", {
      p_fecha: "2026-09-09", p_oficina_id: 1, p_contraparte_id: cp,
      p_concepto: `${MARCA} a editar`, p_categoria: "ingreso",
      p_partidas: [pataJson("ARS", 100), pataJson("USD", 200)],
      p_origen: { source_system: MARCA },
    });
    const id = String(mov);
    expect(await contarPartidas(id)).toBe(2);

    const { error } = await U.cliente.rpc("actualizar_movimiento", {
      p_id: id, p_fecha: "2026-09-09", p_oficina_id: 1, p_contraparte_id: cp,
      p_concepto: `${MARCA} editado`, p_categoria: "ingreso",
      p_partidas: [pataJson("EUR", 300)],
      p_motivo: "prueba de edición",
    });
    expect(error).toBeNull();
    expect(await contarPartidas(id)).toBe(1);

    const { data } = await admin
      .from("partidas").select("moneda_nominal").eq("movimiento_id", id).single();
    expect(data?.moneda_nominal).toBe("EUR");
  });

  it("una edición con una partida inválida deja el movimiento como estaba", async () => {
    const { data: mov } = await U.cliente.rpc("crear_movimiento", {
      p_fecha: "2026-09-10", p_oficina_id: 1, p_contraparte_id: cp,
      p_concepto: `${MARCA} intacto`, p_categoria: "ingreso",
      p_partidas: [pataJson("ARS", 777)],
      p_origen: { source_system: MARCA },
    });
    const id = String(mov);

    const { error } = await U.cliente.rpc("actualizar_movimiento", {
      p_id: id, p_fecha: "2026-09-10", p_oficina_id: 1, p_contraparte_id: cp,
      p_concepto: `${MARCA} roto`, p_categoria: "ingreso",
      p_partidas: [pataJson("ARS", 1), pataJson("ARS", 0)],
    });
    expect(error).not.toBeNull();

    const { data: cabecera } = await admin
      .from("movimientos").select("concepto").eq("id", id).single();
    expect(cabecera?.concepto).toBe(`${MARCA} intacto`);

    const { data: patas } = await admin
      .from("partidas").select("monto_nominal").eq("movimiento_id", id);
    expect(patas).toHaveLength(1);
    expect(Number(patas![0].monto_nominal)).toBe(777);
  });

  /* ── Ajuste a cero ─────────────────────────────────────── */

  it("el ajuste genera un asiento explícito y deja la cuenta en cero", async () => {
    const { data: c2 } = await U.cliente.rpc("obtener_o_crear_contraparte", {
      p_nombre: `${MARCA} a cerrar`,
    });
    const cpCierre = Number(c2);

    await U.cliente.rpc("crear_movimiento", {
      p_fecha: "2026-09-11", p_oficina_id: 1, p_contraparte_id: cpCierre,
      p_concepto: `${MARCA} deuda`, p_categoria: "ingreso",
      p_partidas: [pataJson("USD", 1500), pataJson("ARS", 90000)],
      p_origen: { source_system: MARCA },
    });

    const { data: ajuste, error } = await U.cliente.rpc("ajustar_cuenta_a_cero", {
      p_contraparte_id: cpCierre, p_oficina_id: 1, p_fecha: "2026-09-12",
      p_concepto: `${MARCA} cierre`,
    });
    expect(error).toBeNull();
    expect(ajuste).not.toBeNull();

    // Una partida por moneda con saldo, y la categoría correcta.
    const { data: cat } = await admin
      .from("movimientos").select("categoria").eq("id", String(ajuste)).single();
    expect(cat?.categoria).toBe("ajuste_cierre");
    expect(await contarPartidas(String(ajuste))).toBe(2);

    // El saldo queda en cero en las cuatro monedas.
    const { data: saldos } = await U.cliente
      .from("v_balance").select("moneda, saldo").eq("contraparte_id", cpCierre);
    for (const s of saldos ?? []) expect(Number(s.saldo)).toBe(0);

    // Y la vista marca el cierre sola.
    const { data: cierre } = await U.cliente
      .from("v_cta_cte").select("es_cierre").eq("movimiento_id", String(ajuste)).single();
    expect(cierre?.es_cierre).toBe(true);
  });

  it("el ajuste sobre una cuenta ya en cero no crea un movimiento vacío", async () => {
    const { data: c3 } = await U.cliente.rpc("obtener_o_crear_contraparte", {
      p_nombre: `${MARCA} ya en cero`,
    });
    const { data, error } = await U.cliente.rpc("ajustar_cuenta_a_cero", {
      p_contraparte_id: Number(c3), p_oficina_id: 1, p_fecha: "2026-09-12",
      p_concepto: `${MARCA} nada que cerrar`,
    });
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  /* ── Contrapartes ──────────────────────────────────────── */

  it("obtener_o_crear_contraparte resuelve el duplicado por mayúsculas", async () => {
    const { data: a } = await U.cliente.rpc("obtener_o_crear_contraparte", {
      p_nombre: `${MARCA} Sanchez`,
    });
    const { data: b } = await U.cliente.rpc("obtener_o_crear_contraparte", {
      p_nombre: `${MARCA} SANCHEZ`,
    });
    expect(Number(a)).toBe(Number(b));
  });
});
