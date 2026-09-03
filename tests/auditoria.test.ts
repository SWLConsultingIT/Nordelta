import { describe, expect, it } from "vitest";
import { diferencias } from "../src/lib/auditoria/diff";

/**
 * El panel de auditoría promete mostrar SOLO lo que cambió. Si listara un
 * campo que quedó igual, el auditor buscaría una diferencia que no existe.
 */
describe("diferencias", () => {
  it("con valores planos devuelve un único cambio con el nombre del campo", () => {
    expect(
      diferencias({ campo: "concepto", valor_anterior: "Cobro", valor_nuevo: "Cobro de factura" }),
    ).toEqual([{ campo: "concepto", antes: "Cobro", despues: "Cobro de factura" }]);
  });

  it("sin campo declarado usa un rótulo genérico", () => {
    expect(diferencias({ campo: null, valor_anterior: "a", valor_nuevo: "b" })).toEqual([
      { campo: "valor", antes: "a", despues: "b" },
    ]);
  });

  it("no devuelve nada cuando la entrada no registró valores", () => {
    expect(diferencias({ campo: "concepto", valor_anterior: null, valor_nuevo: null })).toEqual([]);
  });

  it("con objetos deja solo las claves que cambiaron", () => {
    const cambios = diferencias({
      campo: "partidas",
      valor_anterior: JSON.stringify({ monto: 1000, moneda: "ARS", medio: "efectivo" }),
      valor_nuevo: JSON.stringify({ monto: 1500, moneda: "ARS", medio: "efectivo" }),
    });
    expect(cambios).toEqual([{ campo: "monto", antes: "1000", despues: "1500" }]);
  });

  it("incluye una clave que aparece o desaparece", () => {
    const cambios = diferencias({
      campo: "partidas",
      valor_anterior: JSON.stringify({ monto: 1000 }),
      valor_nuevo: JSON.stringify({ monto: 1000, tipo_cambio: 1160 }),
    });
    expect(cambios).toEqual([{ campo: "tipo_cambio", antes: null, despues: "1160" }]);
  });

  it("trata el vacío y el nulo como ausencia de dato, no como un cambio", () => {
    expect(
      diferencias({
        campo: "partidas",
        valor_anterior: JSON.stringify({ comision: null }),
        valor_nuevo: JSON.stringify({ comision: "" }),
      }),
    ).toEqual([]);
  });

  it("no confunde un cero con un valor ausente", () => {
    expect(
      diferencias({
        campo: "partidas",
        valor_anterior: JSON.stringify({ comision: 0 }),
        valor_nuevo: JSON.stringify({ comision: null }),
      }),
    ).toEqual([{ campo: "comision", antes: "0", despues: null }]);
  });

  it("si el texto no es JSON lo compara como texto plano", () => {
    expect(
      diferencias({ campo: "partidas", valor_anterior: "2 partidas", valor_nuevo: "3 partidas" }),
    ).toEqual([{ campo: "partidas", antes: "2 partidas", despues: "3 partidas" }]);
  });

  it("ignora un arreglo JSON: no tiene claves que comparar", () => {
    expect(
      diferencias({ campo: "partidas", valor_anterior: "[1,2]", valor_nuevo: "[1,2,3]" }),
    ).toEqual([{ campo: "partidas", antes: "[1,2]", despues: "[1,2,3]" }]);
  });
});
