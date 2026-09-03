import { describe, expect, it } from "vitest";
import { calcularImpacto, impactoPorMoneda } from "@/lib/domain/fx";
import { redondear } from "@/lib/domain/dinero";
import { MONEDAS, type Moneda } from "@/lib/domain/types";
import { ef, tr, pf } from "./_helpers";

/* ═══════════════════════════════════════════════════════════════
   BUG 5 DEL SISTEMA LEGACY — REGRESIÓN OBLIGATORIA

   El consolidado 2026 anula la columna PESOS cuando **cualquiera** de los
   dos tipos de cambio existe, pero la columna DOLARES solo recupera la pata
   efectivo cuando TC > 0. Resultado: en cualquier fila que mezcle una pata
   convertida con una pata en pesos sin convertir, la pata sin convertir
   desaparece del saldo.

   Acá se reproduce la fórmula legacy tal como está en producción, para
   demostrar la divergencia en lugar de afirmarla.
   ═══════════════════════════════════════════════════════════════ */

interface FilaAncha {
  PESOS?: number;
  Pago_Facil?: number;
  DOLARES?: number;
  TC?: number;
  Transferencia_Pesos?: number;
  Transferencias_en_Dolares?: number;
  TC_Transferencia?: number;
  Comision?: number;
  EUROS?: number;
  Transferencias_EUROS?: number;
  REALES?: number;
  Transferencia_REALES?: number;
}

/** Transcripción de `Consolidado.Transacciones26` tal como corre hoy. */
function consolidado2026Legacy(f: FilaAncha) {
  const c = f.Comision ?? 0;
  const tc = f.TC ?? 0;
  const tct = f.TC_Transferencia ?? 0;
  const pesos = f.PESOS ?? 0;
  const pf_ = f.Pago_Facil ?? 0;
  const trp = f.Transferencia_Pesos ?? 0;

  const PESOS =
    tc > 0 || tct > 0 ? null : redondear(pesos + pf_ + trp * (1 + c), 2);

  const d1 = (f.DOLARES ?? 0) !== 0 ? f.DOLARES! : tc > 0 ? (pesos + pf_) / tc : 0;
  const d2 =
    (f.Transferencias_en_Dolares ?? 0) !== 0
      ? f.Transferencias_en_Dolares! * (1 + c)
      : tct > 0
        ? (trp * (1 + c)) / tct
        : 0;

  return {
    PESOS,
    DOLARES: redondear(d1 + d2, 2),
    EUROS: redondear((f.EUROS ?? 0) + (f.Transferencias_EUROS ?? 0) * (1 + c), 2),
    REALES: redondear((f.REALES ?? 0) + (f.Transferencia_REALES ?? 0) * (1 + c), 2),
  };
}

describe("Bug 5 · el caso canónico", () => {
  // Efectivo 100.000 ARS sin TC, más transferencia 50.000 ARS a TC 1.485 con 2 %.
  const legacy = consolidado2026Legacy({
    PESOS: 100000,
    Transferencia_Pesos: 50000,
    TC_Transferencia: 1485,
    Comision: 0.02,
  });
  const nuevo = impactoPorMoneda([ef("ARS", 100000), tr("ARS", 50000, 1485, 0.02)]);

  it("el legacy pierde los 100.000 en efectivo", () => {
    expect(legacy.PESOS).toBeNull();
    expect(legacy.DOLARES).toBe(34.34);
  });

  it("el modelo nuevo conserva las dos patas", () => {
    expect(nuevo).toEqual({ ARS: 100000, USD: 34.34 });
  });

  it("los dos coinciden en la pata que el legacy sí procesa", () => {
    expect(nuevo.USD).toBe(legacy.DOLARES);
  });
});

describe("Bug 5 · el caso simétrico, que también pierde plata", () => {
  // Ahora el TC está en la pata efectivo y la transferencia queda sin convertir.
  const legacy = consolidado2026Legacy({
    PESOS: 100000,
    TC: 1485,
    Transferencia_Pesos: 50000,
    Comision: 0.02,
  });
  const nuevo = impactoPorMoneda([ef("ARS", 100000, 1485), tr("ARS", 50000, null, 0.02)]);

  it("el legacy pierde los 50.000 de transferencia", () => {
    expect(legacy.PESOS).toBeNull();
    expect(legacy.DOLARES).toBe(67.34); // solo la pata efectivo convertida
  });

  it("el modelo nuevo conserva las dos: 51.000 ARS con comisión, más 67,34 USD", () => {
    expect(nuevo.ARS).toBe(51000);
    expect(nuevo.USD).toBe(67.34);
  });
});

describe("Bug 5 · control: sin mezcla, legacy y nuevo coinciden", () => {
  it("solo efectivo en pesos", () => {
    const legacy = consolidado2026Legacy({ PESOS: 100000 });
    expect(impactoPorMoneda([ef("ARS", 100000)]).ARS).toBe(legacy.PESOS);
  });

  it("solo transferencia convertida", () => {
    const legacy = consolidado2026Legacy({
      Transferencia_Pesos: 50000, TC_Transferencia: 1485, Comision: 0.02,
    });
    expect(impactoPorMoneda([tr("ARS", 50000, 1485, 0.02)]).USD).toBe(legacy.DOLARES);
  });

  it("euros y reales con comisión", () => {
    const legacy = consolidado2026Legacy({
      EUROS: 2200, Transferencias_EUROS: 1000, REALES: 500, Transferencia_REALES: 100, Comision: 0.015,
    });
    const nuevo = impactoPorMoneda([
      ef("EUR", 2200), tr("EUR", 1000, null, 0.015),
      ef("BRL", 500), tr("BRL", 100, null, 0.015),
    ]);
    expect(nuevo.EUR).toBe(legacy.EUROS);
    expect(nuevo.BRL).toBe(legacy.REALES);
  });
});

describe("Bug 5 · la garantía estructural", () => {
  // La propiedad que hace el bug imposible: cada pata resuelve su moneda de
  // impacto por su cuenta, así que ninguna puede desaparecer porque otra
  // pata de la misma operación tenga tipo de cambio.
  const patas = [
    ef("ARS", 100000), pf("ARS", 25000), ef("USD", 500), ef("EUR", 300), ef("BRL", 700),
    tr("ARS", 50000, 1485, 0.02), tr("USD", 1000, null, 0.02),
    tr("EUR", 200, null, 0.01), tr("BRL", 400, null, 0.01),
    ef("ARS", 1485000, 1485),
  ];

  it("toda combinación de patas conserva cada aporte", () => {
    // Se recorren las 1023 combinaciones no vacías del conjunto.
    for (let mascara = 1; mascara < 1 << patas.length; mascara++) {
      const sel = patas.filter((_, i) => mascara & (1 << i));
      const agrupado = impactoPorMoneda(sel);

      // El total esperado por moneda, calculado pata por pata.
      const esperado = new Map<Moneda, number>();
      for (const p of sel) {
        const { moneda, monto } = calcularImpacto(p);
        esperado.set(moneda, (esperado.get(moneda) ?? 0) + monto);
      }

      for (const [moneda, crudo] of esperado) {
        expect(agrupado[moneda]).toBe(redondear(crudo, 2));
      }
      // Y ninguna moneda aparece de la nada.
      for (const m of MONEDAS) {
        if (!esperado.has(m)) expect(agrupado[m]).toBeUndefined();
      }
    }
  });

  it("ninguna pata no nula puede quedar en cero por culpa de otra", () => {
    for (let mascara = 1; mascara < 1 << patas.length; mascara++) {
      const sel = patas.filter((_, i) => mascara & (1 << i));
      const agrupado = impactoPorMoneda(sel);
      const monedasConAporte = new Set(sel.map((p) => calcularImpacto(p).moneda));
      for (const m of monedasConAporte) {
        expect(agrupado[m]).toBeDefined();
      }
    }
  });
});
