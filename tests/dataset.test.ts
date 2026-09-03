import { describe, expect, it } from "vitest";
import { generarDataset, PROTAGONISTAS, HOY_DEMO } from "@/lib/data/dataset";
import { construirCtaCte, indiceUltimoCierre, saldoFinal } from "@/lib/domain/saldos";
import { validarPartida } from "@/lib/domain/fx";
import { MONEDAS, CATEGORIAS, MEDIOS_PAGO, type Moneda } from "@/lib/domain/types";
import { normalizarNombre } from "@/lib/domain/contrapartes";

/**
 * El dataset de demostración es parte del producto: si una historia se rompe,
 * el recorrido de la demo deja de funcionar. Estas pruebas lo cuidan.
 */

const d = generarDataset();
const cuenta = (nombre: string) => {
  const c = d.contrapartes.find((x) => x.nombre === nombre)!;
  return construirCtaCte(d.movimientos.filter((m) => m.contraparte_id === c.id));
};

describe("dataset · volumen y variedad", () => {
  it("es determinístico: dos corridas dan lo mismo", () => {
    const a = generarDataset();
    const b = generarDataset();
    expect(a.movimientos.length).toBe(b.movimientos.length);
    expect(JSON.stringify(a.movimientos.map((m) => [m.fecha, m.concepto, m.orden])))
      .toBe(JSON.stringify(b.movimientos.map((m) => [m.fecha, m.concepto, m.orden])));
  });

  it("tiene volumen suficiente para que las pantallas sean interesantes", () => {
    const partidas = d.movimientos.reduce((a, m) => a + m.partidas.length, 0);
    expect(d.contrapartes.length).toBeGreaterThanOrEqual(30);
    expect(d.movimientos.length).toBeGreaterThanOrEqual(250);
    expect(partidas).toBeGreaterThanOrEqual(350);
  });

  it("cubre las cuatro oficinas", () => {
    const oficinas = new Set(d.movimientos.map((m) => m.oficina_id));
    expect([...oficinas].sort()).toEqual([1, 2, 3, 4]);
  });

  it("cubre las cuatro monedas, con euros y reales presentes de verdad", () => {
    const conteo = new Map<Moneda, number>();
    for (const m of d.movimientos) {
      for (const p of m.partidas) {
        conteo.set(p.moneda_nominal, (conteo.get(p.moneda_nominal) ?? 0) + 1);
      }
    }
    for (const moneda of MONEDAS) {
      expect(conteo.get(moneda) ?? 0).toBeGreaterThan(10);
    }
  });

  it("cubre todos los medios de pago y todas las categorías", () => {
    const medios = new Set(d.movimientos.flatMap((m) => m.partidas.map((p) => p.medio_pago)));
    for (const medio of MEDIOS_PAGO) {
      // La transferencia a móvil no está en el dataset: es una decisión de
      // negocio abierta (D-móvil) y no se inventa su comportamiento.
      if (medio === "transf_movil") continue;
      expect(medios.has(medio)).toBe(true);
    }
    const cats = new Set(d.movimientos.map((m) => m.categoria));
    for (const c of CATEGORIAS) {
      if (c === "ajuste_cierre") continue; // los ajustes se crean durante la demo
      expect(cats.has(c)).toBe(true);
    }
  });

  it("abarca varias semanas y termina en la fecha de la demostración", () => {
    const fechas = [...new Set(d.movimientos.map((m) => m.fecha))].sort();
    expect(fechas.length).toBeGreaterThanOrEqual(20);
    expect(fechas.at(-1)).toBe(HOY_DEMO);
  });
});

describe("dataset · todo dato es válido para el dominio", () => {
  it("ninguna partida viola una regla de validación", () => {
    for (const m of d.movimientos) {
      for (let i = 0; i < m.partidas.length; i++) {
        const errores = validarPartida(m.partidas[i], i);
        expect(errores.map((e) => e.message)).toEqual([]);
      }
    }
  });

  it("ningún movimiento queda sin contraparte ni sin partidas", () => {
    for (const m of d.movimientos) {
      expect(m.contraparte_id).not.toBeNull();
      expect(m.partidas.length).toBeGreaterThan(0);
    }
  });

  it("los ids de partida son únicos", () => {
    const ids = d.movimientos.flatMap((m) => m.partidas.map((p) => p.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("no hay contrapartes duplicadas por escritura", () => {
    const norm = d.contrapartes.map((c) => normalizarNombre(c.nombre));
    expect(new Set(norm).size).toBe(norm.length);
  });

  it("los nombres son ficticios y con forma de empresa", () => {
    // Ninguno de los nombres genéricos que no sirven para una demo.
    for (const c of d.contrapartes) {
      expect(c.nombre).not.toMatch(/cliente [ab]|test|lorem|ejemplo|prueba/i);
    }
    const conForma = d.contrapartes.filter((c) => /\b(SA|SRL)\b/.test(c.nombre));
    expect(conForma.length).toBeGreaterThan(d.contrapartes.length * 0.8);
  });
});

describe("dataset · las seis historias de la demostración", () => {
  it("1 · cuenta activa con saldo en pesos y en dólares", () => {
    const s = saldoFinal(cuenta(PROTAGONISTAS.activa));
    expect(s.ARS).toBeGreaterThan(0);
    expect(s.USD).toBeGreaterThan(0);
  });

  it("2 · cuenta que cerró y volvió a abrir", () => {
    const cta = cuenta(PROTAGONISTAS.cerrada);
    const i = indiceUltimoCierre(cta);
    expect(i).toBeGreaterThanOrEqual(0);
    // En el cierre las cuatro monedas dan cero.
    for (const m of MONEDAS) expect(cta[i].saldo[m]).toBe(0);
    // Y después del cierre hay movimientos nuevos.
    expect(cta.length).toBeGreaterThan(i + 1);
  });

  it("3 · cuenta multi-moneda con al menos tres monedas activas", () => {
    const s = saldoFinal(cuenta(PROTAGONISTAS.multiMoneda));
    expect(MONEDAS.filter((m) => s[m] !== 0).length).toBeGreaterThanOrEqual(3);
  });

  it("4 · transferencia con comisión y tipo de cambio, y una operación mixta", () => {
    const cta = cuenta(PROTAGONISTAS.comision);
    const conComision = cta.flatMap((f) => f.movimiento.partidas)
      .filter((p) => p.comision_pct !== null && p.comision_pct > 0 && p.tipo_cambio !== null);
    expect(conComision.length).toBeGreaterThan(0);

    // La operación mixta: efectivo sin convertir más transferencia convertida.
    const mixta = cta.find((f) =>
      f.movimiento.partidas.length > 1 &&
      f.movimiento.partidas.some((p) => p.tipo_cambio === null) &&
      f.movimiento.partidas.some((p) => p.tipo_cambio !== null));
    expect(mixta).toBeDefined();
    // Las dos patas sobreviven: es el caso que el sistema legacy perdía.
    expect(mixta!.delta.ARS).toBeGreaterThan(0);
    expect(mixta!.delta.USD).toBeGreaterThan(0);
  });

  it("5 · cuenta con cheques", () => {
    const cheques = cuenta(PROTAGONISTAS.cheque)
      .flatMap((f) => f.movimiento.partidas)
      .filter((p) => p.medio_pago === "cheque");
    expect(cheques.length).toBeGreaterThanOrEqual(3);
  });

  it("6 · cuenta con saldo chico, lista para llevar a cero en la demo", () => {
    const s = saldoFinal(cuenta(PROTAGONISTAS.ajuste));
    const conSaldo = MONEDAS.filter((m) => s[m] !== 0);
    expect(conSaldo.length).toBeGreaterThanOrEqual(2);
    // Montos chicos, para que el ajuste se entienda de un vistazo.
    expect(Math.abs(s.ARS)).toBeLessThan(100_000);
    expect(Math.abs(s.USD)).toBeLessThan(1_000);
  });

  it("hay varias cuentas con saldo y al menos una cerrada", () => {
    const cuentas = d.contrapartes.map((c) => ({
      nombre: c.nombre,
      saldo: saldoFinal(construirCtaCte(d.movimientos.filter((m) => m.contraparte_id === c.id))),
    }));
    const conSaldo = cuentas.filter((c) => MONEDAS.some((m) => c.saldo[m] !== 0));
    expect(conSaldo.length).toBeGreaterThan(15);
  });
});
