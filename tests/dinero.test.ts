import { describe, expect, it } from "vitest";
import { redondear, sumarYRedondear, esCero, parsearNumero } from "@/lib/domain/dinero";
import { ErrorDominio } from "@/lib/domain/errors";

const NBSP = " ";
const ESPACIO_FINO = " ";

describe("redondear · misma semántica que round(numeric,n) de Postgres", () => {
  // Postgres redondea la mitad ALEJÁNDOSE del cero. Math.round redondea
  // hacia +∞, así que difiere en todos los negativos que caen al medio.
  // En un libro donde los egresos van en negativo, esa diferencia es plata.
  const casos: [number, number][] = [
    [1.005, 1.01],   [-1.005, -1.01],
    [2.675, 2.68],   [-2.675, -2.68],
    [0.145, 0.15],   [-0.145, -0.15],
    [0.005, 0.01],   [-0.005, -0.01],
    [1.004, 1.0],    [-1.004, -1.0],
    [0, 0],
  ];
  for (const [entrada, esperado] of casos) {
    it(`round(${entrada}, 2) = ${esperado}`, () => {
      expect(redondear(entrada, 2)).toBe(esperado);
    });
  }

  it("no altera valores grandes por la corrección de epsilon", () => {
    expect(redondear(4455000, 2)).toBe(4455000);
    expect(redondear(2400000.005, 2)).toBe(2400000.01);
  });

  it("redondea a 4 decimales para monto_impacto", () => {
    expect(redondear(34.34343434, 4)).toBe(34.3434);
    expect(redondear(-34.34345, 4)).toBe(-34.3435);
  });

  it("rechaza valores no finitos en lugar de propagar NaN a un saldo", () => {
    expect(() => redondear(NaN)).toThrow(ErrorDominio);
    expect(() => redondear(Infinity)).toThrow(ErrorDominio);
    expect(() => redondear(-Infinity)).toThrow(ErrorDominio);
  });
});

describe("sumarYRedondear · suma primero, redondea una sola vez", () => {
  it("no arrastra el error como el redondeo progresivo", () => {
    // Tres patas de 0,004: progresivo da 0 porque cada paso redondea a 0.
    // Postgres hace round(sum) = round(0,012) = 0,01.
    expect(sumarYRedondear([0.004, 0.004, 0.004])).toBe(0.01);
  });

  it("suma cientos de valores sin desviarse", () => {
    expect(sumarYRedondear(Array.from({ length: 300 }, () => 0.01))).toBe(3);
  });

  it("mantiene la exactitud mezclando montos grandes y chicos", () => {
    expect(sumarYRedondear([2400000, 0.005, -0.004])).toBe(2400000);
  });

  it("rechaza no finitos", () => {
    expect(() => sumarYRedondear([1, NaN])).toThrow(ErrorDominio);
  });
});

describe("esCero", () => {
  it("trata como cero lo que redondea a cero a dos decimales", () => {
    expect(esCero(0)).toBe(true);
    expect(esCero(0.004)).toBe(true);
    expect(esCero(-0.004)).toBe(true);
    expect(esCero(0.005)).toBe(false);
    expect(esCero(-0.01)).toBe(false);
  });
});

describe("parsearNumero · lo que Excel argentino realmente exporta", () => {
  const validos: [string, number][] = [
    ["1234,56", 1234.56],
    ["1.234,56", 1234.56],          // miles con punto, decimal con coma
    ["2.400.000,00", 2400000],
    ["2.400.000", 2400000],
    ["-1.200.000", -1200000],
    ["-1.200.000,50", -1200000.5],
    ["1,234.56", 1234.56],          // formato anglosajón
    ["1234.56", 1234.56],
    ["0,5", 0.5],
    ["1485", 1485],
    ["", 0],
    ["  1.485  ", 1485],
    ["$ 1.500", 1500],
    ["$1.500,25", 1500.25],
    ["(1.500)", -1500],             // negativo en notación contable
    ["(1.500,50)", -1500.5],
    ["2%", 2],
    [`1${NBSP}234,56`, 1234.56],
    [`1${ESPACIO_FINO}234,56`, 1234.56],
    ["+1.485", 1485],
    ["-0,004", -0.004],
  ];
  for (const [texto, esperado] of validos) {
    it(`${JSON.stringify(texto)} → ${esperado}`, () => {
      expect(parsearNumero(texto)).toBe(esperado);
    });
  }

  const invalidos = ["abc", "1.2.3,4,5", "12a", "--5", ".", ",", "1,2,3.4.5", "N/A", "-"];
  for (const texto of invalidos) {
    it(`${JSON.stringify(texto)} se rechaza`, () => {
      expect(parsearNumero(texto)).toBeNull();
    });
  }

  it("nunca devuelve NaN ni Infinity para ninguna entrada probada", () => {
    for (const t of [...validos.map((v) => v[0]), ...invalidos]) {
      const r = parsearNumero(t);
      if (r !== null) expect(Number.isFinite(r)).toBe(true);
    }
  });
});
