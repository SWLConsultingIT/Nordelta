import { describe, expect, it } from "vitest";
import {
  interpretarCategoria, interpretarMedioPago, interpretarMoneda,
  interpretarFecha, separarBloquePegado,
} from "@/lib/domain/parseo";

describe("interpretarCategoria", () => {
  it("acepta el valor del enum tal cual", () => {
    expect(interpretarCategoria("ingreso")).toBe("ingreso");
    expect(interpretarCategoria("pago_proveedor")).toBe("pago_proveedor");
  });

  it("acepta la etiqueta que muestra la interfaz", () => {
    expect(interpretarCategoria("Ingreso")).toBe("ingreso");
    expect(interpretarCategoria("Pago proveedor")).toBe("pago_proveedor");
    expect(interpretarCategoria("Full pago")).toBe("full_pago");
  });

  it("acepta los encabezados de sección del legacy", () => {
    expect(interpretarCategoria("Ingresos")).toBe("ingreso");
    expect(interpretarCategoria("Pagos a proveedores")).toBe("pago_proveedor");
    expect(interpretarCategoria("Full Pagos")).toBe("full_pago");
  });

  it("mapea Egresos y Gastos a pago a proveedor, como el script legacy", () => {
    expect(interpretarCategoria("Egresos")).toBe("pago_proveedor");
    expect(interpretarCategoria("Gastos")).toBe("pago_proveedor");
  });

  it("tolera acentos y mayúsculas", () => {
    expect(interpretarCategoria("  IMPUESTOS  ")).toBe("impuesto");
  });

  it("devuelve null en lugar de adivinar", () => {
    expect(interpretarCategoria("cualquier cosa")).toBeNull();
    expect(interpretarCategoria("")).toBeNull();
  });
});

describe("interpretarMedioPago", () => {
  it("acepta enum, etiqueta y sinónimos", () => {
    expect(interpretarMedioPago("efectivo")).toBe("efectivo");
    expect(interpretarMedioPago("Pago fácil")).toBe("pago_facil");
    expect(interpretarMedioPago("pago facil")).toBe("pago_facil");
    expect(interpretarMedioPago("Transf. móvil")).toBe("transf_movil");
    expect(interpretarMedioPago("Transferencias a Movil")).toBe("transf_movil");
    expect(interpretarMedioPago("Cheques")).toBe("cheque");
  });
  it("no adivina", () => {
    expect(interpretarMedioPago("bitcoin")).toBeNull();
  });
});

describe("interpretarMoneda", () => {
  it("acepta el código y las formas escritas", () => {
    expect(interpretarMoneda("ARS")).toBe("ARS");
    expect(interpretarMoneda("pesos")).toBe("ARS");
    expect(interpretarMoneda("Dólares")).toBe("USD");
    expect(interpretarMoneda("u$s")).toBe("USD");
    expect(interpretarMoneda("euros")).toBe("EUR");
    expect(interpretarMoneda("Reales")).toBe("BRL");
    expect(interpretarMoneda("R$")).toBe("BRL");
  });
  it("no adivina", () => {
    expect(interpretarMoneda("libras")).toBeNull();
    expect(interpretarMoneda("XYZ")).toBeNull();
  });
});

describe("interpretarFecha", () => {
  it("acepta el formato de las planillas", () => {
    expect(interpretarFecha("13/08/2026")).toBe("2026-08-13");
    expect(interpretarFecha("1/8/26")).toBe("2026-08-01");
    expect(interpretarFecha("13-08-2026")).toBe("2026-08-13");
    expect(interpretarFecha("13.08.2026")).toBe("2026-08-13");
  });
  it("acepta ISO", () => {
    expect(interpretarFecha("2026-08-13")).toBe("2026-08-13");
  });
  it("rechaza fechas que no existen", () => {
    expect(interpretarFecha("31/02/2026")).toBeNull();
    expect(interpretarFecha("2026-02-31")).toBeNull();
    expect(interpretarFecha("99/99/9999")).toBeNull();
  });
  it("rechaza basura", () => {
    expect(interpretarFecha("ayer")).toBeNull();
    expect(interpretarFecha("")).toBeNull();
  });
});

describe("separarBloquePegado", () => {
  it("separa el TSV que produce Excel", () => {
    expect(separarBloquePegado("a\tb\nc\td")).toEqual([["a", "b"], ["c", "d"]]);
  });
  it("tolera saltos de Windows y de Mac clásico", () => {
    expect(separarBloquePegado("a\tb\r\nc\td")).toEqual([["a", "b"], ["c", "d"]]);
    expect(separarBloquePegado("a\tb\rc\td")).toEqual([["a", "b"], ["c", "d"]]);
  });
  it("ignora el salto final que Excel agrega", () => {
    expect(separarBloquePegado("a\tb\n")).toEqual([["a", "b"]]);
  });
  it("conserva celdas vacías: una columna en blanco es información", () => {
    expect(separarBloquePegado("a\t\tc")).toEqual([["a", "", "c"]]);
  });
  it("tolera filas con distinta cantidad de columnas", () => {
    expect(separarBloquePegado("a\tb\tc\nd\te")).toEqual([["a", "b", "c"], ["d", "e"]]);
  });
});
