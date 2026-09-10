/**
 * Aritmética de fechas del módulo operativo.
 *
 * Sin `Date` y sin husos: una transferencia depositada el 1 de septiembre lo
 * fue el 1 de septiembre, y ningún servidor en otro huso puede correrla al
 * 31 de agosto.
 */

import { describe, expect, it } from "vitest";
import { diasEntreFechas, diasPendiente, fechaCorta, sumarDias } from "../../src/lib/operaciones/fechas";

describe("sumar y restar días", () => {
  it("cruza el fin de mes", () => {
    expect(sumarDias("2026-08-31", 1)).toBe("2026-09-01");
    expect(sumarDias("2026-09-01", -1)).toBe("2026-08-31");
  });

  it("cruza el fin de año", () => {
    expect(sumarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(sumarDias("2027-01-01", -1)).toBe("2026-12-31");
  });

  it("respeta los años bisiestos", () => {
    expect(sumarDias("2028-02-28", 1)).toBe("2028-02-29");
    expect(sumarDias("2026-02-28", 1)).toBe("2026-03-01");
    // 2100 no es bisiesto aunque sea divisible por 4.
    expect(sumarDias("2100-02-28", 1)).toBe("2100-03-01");
  });

  it("sumar cero no mueve nada", () => {
    expect(sumarDias("2026-09-10", 0)).toBe("2026-09-10");
  });

  it("ida y vuelta devuelve el original", () => {
    for (const d of [1, 7, 30, 113, 400]) {
      expect(sumarDias(sumarDias("2026-05-18", d), -d)).toBe("2026-05-18");
    }
  });
});

describe("diferencia entre fechas", () => {
  it("cuenta los días con signo", () => {
    expect(diasEntreFechas("2026-09-01", "2026-09-10")).toBe(9);
    expect(diasEntreFechas("2026-09-10", "2026-09-01")).toBe(-9);
    expect(diasEntreFechas("2026-09-10", "2026-09-10")).toBe(0);
  });

  it("mide el atraso máximo que se observó en los datos reales", () => {
    expect(diasEntreFechas("2026-05-18", "2026-09-08")).toBe(113);
  });
});

describe("días pendiente", () => {
  it("es la distancia hasta hoy", () => {
    expect(diasPendiente("2026-09-01", "2026-09-10")).toBe(9);
  });

  it("una operación de hoy lleva cero días, no uno", () => {
    // Importa: cero días no significa «sin problema». Es problema desde el
    // día cero; el número solo sirve para ordenar.
    expect(diasPendiente("2026-09-10", "2026-09-10")).toBe(0);
  });

  it("nunca es negativo, aunque la fecha de envío sea futura", () => {
    expect(diasPendiente("2026-09-20", "2026-09-10")).toBe(0);
  });
});

describe("formato corto", () => {
  it("deja día y mes, que es lo que entra en una columna densa", () => {
    expect(fechaCorta("2026-09-08")).toBe("08/09");
  });
});
