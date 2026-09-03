import { describe, expect, it } from "vitest";
import { calcularImpacto, impactoPorMoneda, validarPartida, COMISION_MAXIMA } from "@/lib/domain/fx";
import { ErrorDominio } from "@/lib/domain/errors";
import { ef, tr, pf, chq } from "./_helpers";

describe("calcularImpacto · espejo de las columnas generadas de Postgres", () => {
  it("efectivo en pesos sin tipo de cambio queda en pesos", () => {
    expect(calcularImpacto(ef("ARS", 2400000))).toEqual({ moneda: "ARS", monto: 2400000 });
  });

  it("efectivo en pesos con tipo de cambio pasa a dólares", () => {
    expect(calcularImpacto(ef("ARS", 4455000, 1485))).toEqual({ moneda: "USD", monto: 3000 });
  });

  it("aplica la comisión ANTES de dividir, no después", () => {
    // (50000 × 1,02) / 1485 = 34,3434…  ≠  (50000 / 1485) × 1,02
    expect(calcularImpacto(tr("ARS", 50000, 1485, 0.02))).toEqual({ moneda: "USD", monto: 34.3434 });
  });

  it("transferencia en dólares con comisión no divide", () => {
    expect(calcularImpacto(tr("USD", 3500, null, 0.02))).toEqual({ moneda: "USD", monto: 3570 });
  });

  it("un tipo de cambio sobre una pata ya en dólares no convierte", () => {
    expect(calcularImpacto(ef("USD", 1000, 1485))).toEqual({ moneda: "USD", monto: 1000 });
  });

  it("euros y reales pasan sin conversión", () => {
    expect(calcularImpacto(ef("EUR", 2200))).toEqual({ moneda: "EUR", monto: 2200 });
    expect(calcularImpacto(ef("BRL", 4100))).toEqual({ moneda: "BRL", monto: 4100 });
  });

  it("transferencia en euros y reales recibe comisión sin convertir", () => {
    expect(calcularImpacto(tr("EUR", 2200, null, 0.015))).toEqual({ moneda: "EUR", monto: 2233 });
    expect(calcularImpacto(tr("BRL", 1000, null, 0.01))).toEqual({ moneda: "BRL", monto: 1010 });
  });

  it("pago fácil se comporta como efectivo y comparte el tipo de cambio", () => {
    // La base suma (PESOS + Pago_Facil) y divide por el mismo TC. Con una pata
    // por concepto, x/tc + y/tc es idéntico a (x+y)/tc.
    const juntos = calcularImpacto(ef("ARS", 150000, 1500)).monto;
    const separados =
      calcularImpacto(ef("ARS", 100000, 1500)).monto + calcularImpacto(pf("ARS", 50000, 1500)).monto;
    expect(separados).toBe(juntos);
    expect(juntos).toBe(100);
  });

  it("tipo de cambio nulo o cero no convierte", () => {
    expect(calcularImpacto(ef("ARS", 1000, null)).moneda).toBe("ARS");
    expect(calcularImpacto(ef("ARS", 1000, 0)).moneda).toBe("ARS");
  });

  it("montos negativos conservan el signo al convertir", () => {
    expect(calcularImpacto(ef("ARS", -1485000, 1485))).toEqual({ moneda: "USD", monto: -1000 });
    expect(calcularImpacto(tr("ARS", -50000, 1485, 0.02)).monto).toBe(-34.3434);
  });

  it("los cheques no reciben comisión aunque venga cargada la validación la rechaza", () => {
    expect(calcularImpacto(chq("ARS", 1750000))).toEqual({ moneda: "ARS", monto: 1750000 });
  });

  it("rechaza no finitos en lugar de contaminar un saldo con NaN", () => {
    expect(() => calcularImpacto(ef("ARS", NaN))).toThrow(ErrorDominio);
    expect(() => calcularImpacto(ef("ARS", 100, Infinity))).toThrow(ErrorDominio);
    expect(() => calcularImpacto(tr("ARS", 100, 1000, NaN))).toThrow(ErrorDominio);
  });
});

describe("impactoPorMoneda · agrupa y redondea una sola vez", () => {
  it("agrupa varias patas de la misma moneda", () => {
    expect(impactoPorMoneda([ef("ARS", 100), ef("ARS", 200), pf("ARS", 50)])).toEqual({ ARS: 350 });
  });

  it("mantiene monedas separadas sin sumarlas entre sí", () => {
    const r = impactoPorMoneda([ef("ARS", 100), ef("USD", 50), ef("EUR", 25), ef("BRL", 10)]);
    expect(r).toEqual({ ARS: 100, USD: 50, EUR: 25, BRL: 10 });
  });

  it("suma las patas convertidas junto con las nominales en dólares", () => {
    // efectivo 1.485.000 ARS @1485 = 1000 USD, más 500 USD nominales
    expect(impactoPorMoneda([ef("ARS", 1485000, 1485), ef("USD", 500)])).toEqual({ USD: 1500 });
  });

  it("ignora las patas en cero", () => {
    expect(impactoPorMoneda([ef("ARS", 0), ef("USD", 100)])).toEqual({ USD: 100 });
  });

  it("no arrastra error de redondeo entre patas", () => {
    // Tres patas que a 4 decimales dan 0,0033 cada una: la suma redondeada
    // a 2 es 0,01. Redondeando cada paso a 2 daría 0.
    const r = impactoPorMoneda([ef("ARS", 0.0033), ef("ARS", 0.0033), ef("ARS", 0.0034)]);
    expect(r.ARS).toBe(0.01);
  });
});

describe("validarPartida", () => {
  const campos = (p: Parameters<typeof validarPartida>[0]) => validarPartida(p).map((e) => e.campo);

  it("acepta una pata bien formada", () => {
    expect(validarPartida(tr("ARS", 50000, 1485, 0.02))).toHaveLength(0);
  });

  it("rechaza monto cero: una pata vacía no debe existir", () => {
    expect(campos(ef("ARS", 0))).toContain("monto_nominal");
  });

  it("rechaza monto no numérico", () => {
    expect(campos(ef("ARS", NaN))).toContain("monto_nominal");
  });

  it("rechaza tipo de cambio negativo o cero explícito", () => {
    expect(campos(ef("ARS", 100, -5))).toContain("tipo_cambio");
    expect(campos(ef("ARS", 100, 0))).toContain("tipo_cambio");
  });

  it("rechaza tipo de cambio sobre una pata en dólares", () => {
    expect(campos(ef("USD", 100, 1485))).toContain("tipo_cambio");
  });

  it("rechaza comisión sobre efectivo y sobre pago fácil", () => {
    expect(campos(pata_con_comision("efectivo"))).toContain("comision_pct");
    expect(campos(pata_con_comision("pago_facil"))).toContain("comision_pct");
  });

  it("acepta comisión sobre transferencia y transferencia a móvil", () => {
    expect(campos(pata_con_comision("transferencia"))).not.toContain("comision_pct");
    expect(campos(pata_con_comision("transf_movil"))).not.toContain("comision_pct");
  });

  it("rechaza comisión fuera de rango: 15 en lugar de 0,15 es un error de carga", () => {
    expect(campos(tr("ARS", 100, null, 15))).toContain("comision_pct");
    expect(campos(tr("ARS", 100, null, -0.1))).toContain("comision_pct");
    expect(campos(tr("ARS", 100, null, COMISION_MAXIMA))).not.toContain("comision_pct");
  });

  it("rechaza moneda y medio de pago inválidos", () => {
    const malo = { ...ef("ARS", 100), moneda_nominal: "GBP" as never, medio_pago: "trueque" as never };
    const c = campos(malo);
    expect(c).toContain("moneda_nominal");
    expect(c).toContain("medio_pago");
  });
});

function pata_con_comision(medio: "efectivo" | "pago_facil" | "transferencia" | "transf_movil") {
  return { ...tr("ARS", 100, null, 0.02), medio_pago: medio };
}
