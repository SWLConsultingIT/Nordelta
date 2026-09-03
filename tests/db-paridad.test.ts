import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { pgConMigraciones, num } from "./_pg";
import { calcularImpacto } from "@/lib/domain/fx";
import { construirCtaCte } from "@/lib/domain/saldos";
import { normalizarNombre } from "@/lib/domain/contrapartes";
import { MONEDAS, type MedioPago, type Moneda } from "@/lib/domain/types";
import { ef, tr, mov } from "./_helpers";

/* ═══════════════════════════════════════════════════════════════
   PARIDAD ENTRE EL DOMINIO Y POSTGRES

   Es la prueba más importante del proyecto. El front calcula para dar
   respuesta inmediata en la grilla, pero la autoridad es la base. Si las
   dos fórmulas divergen, el operador ve un número y el libro guarda otro.

   Corre contra PostgreSQL 18 de verdad (PGlite, en WASM).
   ═══════════════════════════════════════════════════════════════ */

let db: PGlite;

beforeAll(async () => {
  db = await pgConMigraciones();
}, 120_000);

afterAll(async () => {
  await db?.close();
});

/** Inserta una pata y devuelve lo que la base calculó. */
async function impactoEnBase(p: {
  medio_pago: MedioPago; moneda_nominal: Moneda; monto_nominal: number;
  tipo_cambio: number | null; comision_pct: number | null;
}) {
  const m = await db.query<{ id: string }>(
    `insert into movimientos (fecha, oficina_id, contraparte_id, categoria, afecta_cta_cte)
     values (date '2026-01-01', 1, null, 'compra', false) returning id`,
  );
  const r = await db.query<{ moneda_impacto: Moneda; monto_impacto: string }>(
    `insert into partidas (movimiento_id, medio_pago, moneda_nominal, monto_nominal, tipo_cambio, comision_pct)
     values ($1, $2::medio_pago, $3::moneda, $4, $5, $6)
     returning moneda_impacto, monto_impacto`,
    [m.rows[0].id, p.medio_pago, p.moneda_nominal, p.monto_nominal, p.tipo_cambio, p.comision_pct],
  );
  return { moneda: r.rows[0].moneda_impacto, monto: num(r.rows[0].monto_impacto) };
}

describe("columnas generadas · el TypeScript da el mismo número que Postgres", () => {
  const casos = [
    ef("ARS", 2400000), ef("ARS", 4455000, 1485), ef("USD", 3500),
    ef("EUR", 2200), ef("BRL", 4100), ef("ARS", -1200000),
    ef("ARS", -1485000, 1485),
    tr("ARS", 50000, 1485, 0.02), tr("USD", 3500, null, 0.02),
    tr("EUR", 2200, null, 0.015), tr("BRL", 1000, null, 0.01),
    tr("ARS", -50000, 1485, 0.02),
    // Casos de redondeo al medio, donde JS y PG divergían.
    ef("ARS", 1.005), ef("ARS", -1.005), ef("ARS", 2.675), ef("ARS", -2.675),
    tr("ARS", 100, 3, 0.015),          // división no exacta
    tr("ARS", 1, 7, 0.333333),         // muchos decimales
    ef("ARS", 99999999999.9999),       // justo abajo de MONTO_MAXIMO
    tr("ARS", 0.0001, null, 1),        // comisión máxima
  ];

  for (const p of casos) {
    const etiqueta = `${p.medio_pago} ${p.monto_nominal} ${p.moneda_nominal}` +
      (p.tipo_cambio ? ` @${p.tipo_cambio}` : "") +
      (p.comision_pct ? ` +${p.comision_pct}` : "");
    it(etiqueta, async () => {
      expect(await impactoEnBase(p)).toEqual(calcularImpacto(p));
    });
  }
});

describe("vista v_cta_cte · el saldo corrido y el cierre coinciden con el dominio", () => {
  const historial = [
    mov("2026-01-12", [ef("ARS", 4455000, 1485)], { id: "1", orden: 1, concepto: "Préstamo" }),
    mov("2026-01-28", [ef("USD", -1200)], { id: "2", orden: 1, concepto: "Pago parcial", categoria: "pago_proveedor" }),
    mov("2026-02-14", [ef("USD", -1800)], { id: "3", orden: 1, concepto: "Saldo cancelado", categoria: "pago_proveedor" }),
    mov("2026-03-03", [ef("ARS", 100000), tr("ARS", 50000, 1485, 0.02)], { id: "4", orden: 1, concepto: "Mixta" }),
    mov("2026-03-21", [ef("EUR", 500), ef("BRL", 300)], { id: "5", orden: 1, concepto: "Multi" }),
    mov("2026-04-01", [ef("USD", -34.34), ef("ARS", -100000), ef("EUR", -500), ef("BRL", -300)],
        { id: "6", orden: 1, concepto: "Cierra todo", categoria: "pago_proveedor" }),
  ];

  let filasBase: Record<string, unknown>[];

  beforeAll(async () => {
    const c = await db.query<{ id: string }>(
      `insert into contrapartes (nombre) values ('Comercial del Plata SA') returning id`,
    );
    const cid = c.rows[0].id;

    for (const m of historial) {
      const partidas = m.partidas.map((p) => ({
        medio_pago: p.medio_pago,
        moneda_nominal: p.moneda_nominal,
        monto_nominal: String(p.monto_nominal),
        ...(p.tipo_cambio ? { tipo_cambio: String(p.tipo_cambio) } : {}),
        ...(p.comision_pct ? { comision_pct: String(p.comision_pct) } : {}),
      }));
      await db.query(
        `select crear_movimiento($1::date, 1::smallint, $2::bigint, $3, $4::categoria, $5::jsonb, $6::integer)`,
        [m.fecha, cid, m.concepto, m.categoria, JSON.stringify(partidas), m.orden],
      );
    }

    const r = await db.query(
      `select concepto, saldo_ars, saldo_usd, saldo_eur, saldo_brl, es_cierre
       from v_cta_cte where contraparte_id = $1
       order by fecha, case when categoria='ajuste_cierre' then 1 else 0 end, orden, movimiento_id`,
      [cid],
    );
    filasBase = r.rows as Record<string, unknown>[];
  }, 120_000);

  it("devuelve la misma cantidad de filas que el dominio", () => {
    expect(filasBase).toHaveLength(construirCtaCte(historial).length);
  });

  it("cada saldo por moneda coincide fila por fila", () => {
    const dominio = construirCtaCte(historial);
    filasBase.forEach((base, i) => {
      const esperado = dominio[i].saldo;
      expect({
        ARS: num(base.saldo_ars), USD: num(base.saldo_usd),
        EUR: num(base.saldo_eur), BRL: num(base.saldo_brl),
      }).toEqual(esperado);
    });
  });

  it("la marca de cierre coincide fila por fila", () => {
    const dominio = construirCtaCte(historial);
    expect(filasBase.map((f) => f.es_cierre)).toEqual(dominio.map((f) => f.esCierre));
  });

  it("detecta el cierre en el último movimiento, con las cuatro monedas en cero", () => {
    const ultima = filasBase.at(-1)!;
    expect(ultima.es_cierre).toBe(true);
    for (const k of ["saldo_ars", "saldo_usd", "saldo_eur", "saldo_brl"]) {
      expect(num(ultima[k])).toBe(0);
    }
  });

  it("la fila mixta conserva las dos patas, igual que el dominio", () => {
    const mixta = filasBase.find((f) => f.concepto === "Mixta")!;
    expect(num(mixta.saldo_ars)).toBe(100000);
  });
});

describe("v_balance · nunca suma monedas distintas entre sí", () => {
  it("devuelve una fila por moneda, no un total mezclado", async () => {
    const c = await db.query<{ id: string }>(
      `insert into contrapartes (nombre) values ('Multi Moneda SRL') returning id`,
    );
    const cid = c.rows[0].id;
    await db.query(
      `select crear_movimiento(date '2026-05-01', 1::smallint, $1::bigint, 'varias', 'ingreso'::categoria, $2::jsonb)`,
      [cid, JSON.stringify(MONEDAS.map((m) => ({
        medio_pago: "efectivo", moneda_nominal: m, monto_nominal: "100",
      })))],
    );
    const r = await db.query<{ moneda: Moneda; saldo: string }>(
      `select moneda, saldo from v_balance where contraparte_id = $1 order by moneda`, [cid],
    );
    expect(r.rows).toHaveLength(4);
    expect(r.rows.every((f) => num(f.saldo) === 100)).toBe(true);
  });
});

describe("nombre_norm · la base normaliza igual que el dominio", () => {
  const nombres = ["Bonomi", " Perez  Garcia. ", "GASTOS OFICINA", "José", "Alvarez, J.", "Peña"];
  for (const n of nombres) {
    it(`${JSON.stringify(n)}`, async () => {
      const r = await db.query<{ nombre_norm: string }>(
        `insert into contrapartes (nombre) values ($1) returning nombre_norm`, [n],
      );
      expect(r.rows[0].nombre_norm).toBe(normalizarNombre(n));
    });
  }

  it("rechaza el duplicado que hoy rompe el balance", async () => {
    await db.query(`insert into contrapartes (nombre) values ('Duplicado SA')`);
    await expect(
      db.query(`insert into contrapartes (nombre) values ('DUPLICADO sa')`),
    ).rejects.toThrow(/contrapartes_nombre_norm_key|duplicate key/i);
  });
});
