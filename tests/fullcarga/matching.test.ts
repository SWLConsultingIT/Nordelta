/**
 * Emparejamiento entre lo enviado y lo acreditado.
 *
 * Datos inventados. Los CUIT son válidos por dígito verificador y no
 * corresponden a nadie.
 */

import { describe, expect, it } from "vitest";
import {
  diferenciaEnDias,
  emparejar,
  emparejarLote,
  type Enviada,
} from "../../src/lib/fullcarga/matching";
import type { Acreditacion } from "../../src/lib/fullcarga/informe";

const CUIT_A = "20111111112";
const CUIT_B = "27222222228";
const CUIT_C = "30123456781";
/** CUIT_A con un dígito cambiado. */
const CUIT_TIPEADO = "20111111113";

function acreditacion(p: Partial<Acreditacion> = {}): Acreditacion {
  return {
    sourceFile: "prueba.xls",
    sheet: "Hoja 1",
    row: 3,
    cuit: CUIT_A,
    fecha: "2026-09-05",
    importe: 1000,
    banco: "Banco de Prueba",
    clienteNord: "EMPRESA DE PRUEBA SRL",
    descripcion: null,
    ...p,
  };
}

const enviada = (p: Partial<Enviada> = {}): Enviada => ({
  id: "e1",
  cuit: CUIT_A,
  fecha: "2026-09-05",
  importe: 1000,
  ...p,
});

describe("diferencia en días", () => {
  it("cuenta días sin depender del huso horario", () => {
    const original = process.env.TZ;
    try {
      for (const tz of ["UTC", "Pacific/Kiritimati", "Pacific/Midway"]) {
        process.env.TZ = tz;
        expect(diferenciaEnDias("2026-09-05", "2026-09-05")).toBe(0);
        expect(diferenciaEnDias("2026-09-05", "2026-09-06")).toBe(1);
        expect(diferenciaEnDias("2026-08-31", "2026-09-01")).toBe(1);
        expect(diferenciaEnDias("2026-02-28", "2026-03-01")).toBe(1);
        expect(diferenciaEnDias("2028-02-28", "2028-03-01")).toBe(2); // bisiesto
      }
    } finally {
      process.env.TZ = original;
    }
  });
});

describe("veredictos", () => {
  it("MATCH_EXACTO cuando coinciden CUIT, fecha e importe", () => {
    const r = emparejar(acreditacion(), [enviada()]);
    expect(r.veredicto).toBe("MATCH_EXACTO");
    expect(r.automatico).toBe(true);
    expect(r.candidatos).toHaveLength(1);
  });

  it("MATCH_PROBABLE cuando el importe difiere", () => {
    const r = emparejar(acreditacion(), [enviada({ importe: 900 })]);
    expect(r.veredicto).toBe("MATCH_PROBABLE");
    expect(r.automatico).toBe(false);
    // Las acreditaciones son siempre totales: la diferencia es una anomalía.
    expect(r.motivo).toMatch(/totales/);
  });

  it("MATCH_PROBABLE cuando el CUIT coincide pero ninguna fecha", () => {
    const r = emparejar(acreditacion(), [enviada({ fecha: "2026-08-01" })]);
    expect(r.veredicto).toBe("MATCH_PROBABLE");
    expect(r.motivo).toMatch(/fecha/);
  });

  it("AMBIGUO cuando hay dos envíos idénticos", () => {
    const r = emparejar(acreditacion(), [enviada({ id: "e1" }), enviada({ id: "e2" })]);
    expect(r.veredicto).toBe("AMBIGUO");
    expect(r.automatico).toBe(false);
    expect(r.candidatos).toHaveLength(2);
  });

  it("AMBIGUO cuando hay varios del mismo CUIT y fecha sin importe exacto", () => {
    const r = emparejar(acreditacion(), [
      enviada({ id: "e1", importe: 900 }),
      enviada({ id: "e2", importe: 800 }),
    ]);
    expect(r.veredicto).toBe("AMBIGUO");
  });

  it("POSIBLE_MATCH ante un CUIT que difiere en un dígito, y nunca automático", () => {
    const r = emparejar(acreditacion({ cuit: CUIT_TIPEADO }), [enviada({ cuit: CUIT_A })]);
    expect(r.veredicto).toBe("POSIBLE_MATCH");
    expect(r.automatico).toBe(false);
    expect(r.parecido?.digitosDiferentes).toBe(1);
    expect(r.motivo).toMatch(/confirmaci[oó]n/i);
  });

  it("SIN_MATCH cuando no hay nada parecido", () => {
    const r = emparejar(acreditacion({ cuit: CUIT_C }), [enviada({ cuit: CUIT_B })]);
    expect(r.veredicto).toBe("SIN_MATCH");
    expect(r.candidatos).toEqual([]);
  });

  it("una coincidencia exacta le gana a un parecido", () => {
    // Si el parecido pudiera ganar, un dígito de más mandaría plata a otro.
    const r = emparejar(acreditacion({ cuit: CUIT_A }), [
      enviada({ id: "parecido", cuit: CUIT_TIPEADO }),
      enviada({ id: "exacto", cuit: CUIT_A }),
    ]);
    expect(r.veredicto).toBe("MATCH_EXACTO");
    expect(r.candidatos[0].id).toBe("exacto");
  });

  it("sin tolerancia de días por defecto, porque no hay evidencia que la justifique", () => {
    const r = emparejar(acreditacion(), [enviada({ fecha: "2026-09-06" })]);
    expect(r.veredicto).toBe("MATCH_PROBABLE");

    const conTolerancia = emparejar(acreditacion(), [enviada({ fecha: "2026-09-06" })], {
      toleranciaDias: 1,
    });
    expect(conTolerancia.veredicto).toBe("MATCH_EXACTO");
  });

  it("tolera la imprecisión de coma flotante en el importe", () => {
    const r = emparejar(acreditacion({ importe: 0.1 + 0.2 }), [enviada({ importe: 0.3 })]);
    expect(r.veredicto).toBe("MATCH_EXACTO");
  });
});

describe("lote", () => {
  it("resume cuánto se cierra solo y cuánto necesita a una persona", () => {
    const acreditaciones = [
      acreditacion({ row: 3, cuit: CUIT_A }),
      acreditacion({ row: 4, cuit: CUIT_B }),
      acreditacion({ row: 5, cuit: CUIT_C, importe: 500 }),
      acreditacion({ row: 6, cuit: CUIT_TIPEADO }),
    ];
    const enviadas: Enviada[] = [
      enviada({ id: "e1", cuit: CUIT_A }),
      enviada({ id: "e2", cuit: CUIT_B }),
      enviada({ id: "e3", cuit: CUIT_C, importe: 999 }),
    ];

    const { resumen } = emparejarLote(acreditaciones, enviadas);
    expect(resumen.total).toBe(4);
    expect(resumen.porVeredicto.MATCH_EXACTO).toBe(2);
    expect(resumen.porVeredicto.MATCH_PROBABLE).toBe(1);
    expect(resumen.porVeredicto.POSIBLE_MATCH).toBe(1);
    expect(resumen.automaticos).toBe(2);
    expect(resumen.requierenPersona).toBe(2);
    expect(resumen.automaticoPct).toBe(50);
  });

  it("con el lote vacío no divide por cero", () => {
    const { resumen } = emparejarLote([], []);
    expect(resumen.total).toBe(0);
    expect(resumen.automaticoPct).toBe(0);
  });
});
