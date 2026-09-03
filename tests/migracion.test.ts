import { describe, expect, it } from "vitest";
import {
  filaDesdeCeldas, filaVaciaLegacy, transformarFila, conciliarFila, consolidadoLegacy,
  type FilaLegacy,
} from "@/lib/migracion/legacy";
import { calcularImpacto } from "@/lib/domain/fx";
import { redondear } from "@/lib/domain/dinero";

const ORIGEN = {
  source_system: "sheets-caja-diaria",
  source_file: "Caja diaria 1 09 2026",
  source_sheet: "Nordelta 03/09/26",
  source_row: 12,
};

/** Fila ancha con solo los campos que interesan. */
function fila(p: Partial<FilaLegacy> = {}): FilaLegacy {
  return filaDesdeCeldas([
    p.fecha ?? "03/09/2026",
    p.contraparte ?? "Comercial del Plata SA",
    p.detalle ?? "Ingreso",
    p.tipoMovimiento ?? "Ingresos",
    p.pesos ?? "", p.tc ?? "", p.dolares ?? "", p.euros ?? "", p.reales ?? "",
    p.pagoFacil ?? "", p.comision ?? "", p.tcTransferencia ?? "",
    p.transfPesos ?? "", p.transfDolares ?? "", p.transfEuros ?? "", p.transfReales ?? "",
  ]);
}

describe("transformarFila · abre la fila ancha en partidas", () => {
  it("una sola pata en efectivo", () => {
    const { movimiento, errores } = transformarFila(fila({ pesos: "2.400.000" }), ORIGEN);
    expect(errores).toHaveLength(0);
    expect(movimiento!.partidas).toEqual([
      { medio_pago: "efectivo", moneda_nominal: "ARS", monto_nominal: 2400000, tipo_cambio: null, comision_pct: null },
    ]);
    expect(movimiento!.categoria).toBe("ingreso");
    expect(movimiento!.fecha).toBe("2026-09-03");
  });

  it("PESOS y Pago Facil comparten el tipo de cambio general", () => {
    const { movimiento } = transformarFila(
      fila({ pesos: "100.000", pagoFacil: "50.000", tc: "1.485" }), ORIGEN,
    );
    expect(movimiento!.partidas).toHaveLength(2);
    expect(movimiento!.partidas.every((p) => p.tipo_cambio === 1485)).toBe(true);
    expect(movimiento!.partidas.map((p) => p.medio_pago)).toEqual(["efectivo", "pago_facil"]);
  });

  it("las patas de transferencia llevan comisión y las de efectivo no", () => {
    const { movimiento } = transformarFila(
      fila({ pesos: "100.000", transfPesos: "50.000", tcTransferencia: "1.485", comision: "0,02" }),
      ORIGEN,
    );
    const efectivo = movimiento!.partidas.find((p) => p.medio_pago === "efectivo")!;
    const transf = movimiento!.partidas.find((p) => p.medio_pago === "transferencia")!;
    expect(efectivo.comision_pct).toBeNull();
    expect(transf.comision_pct).toBe(0.02);
    expect(transf.tipo_cambio).toBe(1485);
  });

  it("abre las nueve patas cuando están todas cargadas", () => {
    const { movimiento } = transformarFila(fila({
      pesos: "100", pagoFacil: "50", dolares: "10", euros: "5", reales: "2",
      tc: "1.485", comision: "0,02", tcTransferencia: "1.480",
      transfPesos: "200", transfDolares: "20", transfEuros: "8", transfReales: "3",
    }), ORIGEN);
    expect(movimiento!.partidas).toHaveLength(9);
  });

  it("descarta las patas en cero o vacías", () => {
    const { movimiento } = transformarFila(
      fila({ pesos: "2.400.000", dolares: "0", euros: "" }), ORIGEN,
    );
    expect(movimiento!.partidas).toHaveLength(1);
  });

  it("no le pone tipo de cambio a una pata ya en dólares", () => {
    const { movimiento } = transformarFila(fila({ dolares: "500", tc: "1.485" }), ORIGEN);
    expect(movimiento!.partidas[0].tipo_cambio).toBeNull();
  });

  it("conserva la identidad de origen para la idempotencia", () => {
    const { movimiento } = transformarFila(fila({ pesos: "100" }), ORIGEN);
    expect(movimiento!.origen).toEqual({ ...ORIGEN, legacy_id: "Nordelta 03/09/26:12" });
  });

  it("dos filas distintas del mismo día tienen identidades distintas", () => {
    const a = transformarFila(fila({ pesos: "100" }), { ...ORIGEN, source_row: 12 });
    const b = transformarFila(fila({ pesos: "100" }), { ...ORIGEN, source_row: 13 });
    expect(a.movimiento!.origen.legacy_id).not.toBe(b.movimiento!.origen.legacy_id);
  });
});

describe("transformarFila · nunca descarta una fila en silencio", () => {
  it("reporta una fecha que no se puede interpretar", () => {
    const { movimiento, errores } = transformarFila(fila({ fecha: "ayer", pesos: "100" }), ORIGEN);
    expect(movimiento).toBeNull();
    expect(errores.some((e) => e.campo === "Fecha")).toBe(true);
  });

  it("reporta una categoría desconocida en lugar de inventarla", () => {
    const { movimiento, errores } = transformarFila(
      fila({ tipoMovimiento: "Cosa rara", pesos: "100" }), ORIGEN,
    );
    expect(movimiento).toBeNull();
    expect(errores.some((e) => e.campo === "Tipo de Movimiento")).toBe(true);
  });

  it("reporta un monto que no es número", () => {
    const { movimiento, errores } = transformarFila(fila({ pesos: "s/d" }), ORIGEN);
    expect(movimiento).toBeNull();
    expect(errores.some((e) => e.motivo === "No es un número")).toBe(true);
  });

  it("reporta la falta de contraparte", () => {
    const { errores } = transformarFila(fila({ contraparte: "", pesos: "100" }), ORIGEN);
    expect(errores.some((e) => e.campo === "Cliente/Proveedor")).toBe(true);
  });

  it("reporta una fila sin ningún importe", () => {
    const { movimiento, errores } = transformarFila(fila(), ORIGEN);
    expect(movimiento).toBeNull();
    expect(errores.some((e) => e.campo === "montos")).toBe(true);
  });

  it("reconoce las filas totalmente vacías de la plantilla", () => {
    expect(filaVaciaLegacy(filaDesdeCeldas([]))).toBe(true);
    expect(filaVaciaLegacy(fila({ pesos: "1" }))).toBe(false);
  });

  it("mapea los encabezados de sección del legacy", () => {
    for (const [texto, esperado] of [
      ["Ingresos", "ingreso"], ["Pagos a proveedores", "pago_proveedor"],
      ["Full Pagos", "full_pago"], ["Compras", "compra"], ["Egresos", "pago_proveedor"],
    ] as const) {
      const { movimiento } = transformarFila(fila({ tipoMovimiento: texto, pesos: "100" }), ORIGEN);
      expect(movimiento!.categoria).toBe(esperado);
    }
  });
});

describe("conciliación · las diferencias con el legacy son solo los bugs conocidos", () => {
  it("coincide exactamente cuando no hay mezcla de patas", () => {
    const f = fila({ pesos: "2.400.000" });
    const { movimiento } = transformarFila(f, ORIGEN);
    expect(conciliarFila(f, movimiento!)).toHaveLength(0);
  });

  it("coincide en una transferencia convertida con comisión", () => {
    const f = fila({ transfPesos: "50.000", tcTransferencia: "1.485", comision: "0,02" });
    const { movimiento } = transformarFila(f, ORIGEN);
    expect(conciliarFila(f, movimiento!)).toHaveLength(0);
  });

  it("coincide en euros y reales con comisión", () => {
    const f = fila({ euros: "2.200", transfEuros: "1.000", reales: "500", transfReales: "100", comision: "0,015" });
    const { movimiento } = transformarFila(f, ORIGEN);
    expect(conciliarFila(f, movimiento!)).toHaveLength(0);
  });

  it("marca el bug 5 en la fila mixta, y solo en pesos", () => {
    const f = fila({ pesos: "100.000", transfPesos: "50.000", tcTransferencia: "1.485", comision: "0,02" });
    const { movimiento } = transformarFila(f, ORIGEN);
    const difs = conciliarFila(f, movimiento!);
    expect(difs).toHaveLength(1);
    expect(difs[0]).toMatchObject({ moneda: "ARS", legacy: null, nuevo: 100000, motivo: "bug5_columna_anulada" });
    expect(difs[0].patasDescartadas).toEqual(["PESOS"]);
  });

  it("marca el caso simétrico: la transferencia sin convertir que el legacy pierde", () => {
    const f = fila({ pesos: "100.000", tc: "1.485", transfPesos: "50.000", comision: "0,02" });
    const { movimiento } = transformarFila(f, ORIGEN);
    const difs = conciliarFila(f, movimiento!);
    expect(difs.some((d) => d.moneda === "ARS" && d.motivo === "bug5_columna_anulada")).toBe(true);
    expect(difs.every((d) => d.motivo !== "sin_explicar")).toBe(true);
  });

  it("identifica el bug 6: el o-exclusivo que descarta la pata convertida", () => {
    // El legacy hace IF DOLARES<>0 THEN DOLARES ELSIF TC>0 THEN (PESOS+PF)/TC,
    // así que con un nominal en dólares presente pierde la pata convertida.
    const f = fila({ pesos: "100.000", tc: "1.485", dolares: "100.000" });
    const { movimiento } = transformarFila(f, ORIGEN);
    const difs = conciliarFila(f, movimiento!);
    const usd = difs.find((d) => d.moneda === "USD")!;
    expect(usd.motivo).toBe("bug6_pata_descartada");
    expect(usd.legacy).toBe(100000);
    expect(usd.nuevo).toBe(100067.34);
    expect(usd.patasDescartadas).toEqual(["PESOS convertido"]);
  });

  it("no produce ninguna diferencia sin explicar en un barrido amplio", () => {
    // Combinaciones de patas con y sin tipo de cambio, con y sin comisión.
    const montos = ["", "100.000", "-50.000"];
    const tcs = ["", "1.485"];
    let sinExplicar = 0;
    let bug5 = 0;

    for (const pesos of montos) for (const tc of tcs)
    for (const transfPesos of montos) for (const tcTransferencia of tcs)
    for (const comision of ["", "0,02"]) for (const dolares of montos) {
      const f = fila({ pesos, tc, transfPesos, tcTransferencia, comision, dolares });
      const { movimiento } = transformarFila(f, ORIGEN);
      if (!movimiento) continue;
      for (const d of conciliarFila(f, movimiento)) {
        if (d.motivo === "sin_explicar") sinExplicar++;
        else bug5++;
      }
    }
    expect(sinExplicar).toBe(0);
    // Y el bug aparece, así que el barrido efectivamente lo ejercita.
    expect(bug5).toBeGreaterThan(0);
  });
});

describe("consolidadoLegacy · reproduce la fórmula de producción", () => {
  it("anula pesos cuando existe cualquiera de los dos tipos de cambio", () => {
    expect(consolidadoLegacy(fila({ pesos: "100", tc: "1.485" })).ARS).toBeNull();
    expect(consolidadoLegacy(fila({ pesos: "100", tcTransferencia: "1.485" })).ARS).toBeNull();
    expect(consolidadoLegacy(fila({ pesos: "100" })).ARS).toBe(100);
  });

  it("suma la pata efectivo y la de transferencia en dólares", () => {
    const r = consolidadoLegacy(fila({
      pesos: "1.485", tc: "1.485", transfPesos: "1.485", tcTransferencia: "1.485",
    }));
    expect(r.USD).toBe(2);
  });

  it("coincide con el dominio en las patas que el legacy sí procesa", () => {
    const f = fila({ transfPesos: "50.000", tcTransferencia: "1.485", comision: "0,02" });
    const { movimiento } = transformarFila(f, ORIGEN);
    const nuevo = redondear(
      movimiento!.partidas.reduce((a, p) => a + calcularImpacto(p).monto, 0), 2);
    expect(consolidadoLegacy(f).USD).toBe(nuevo);
  });
});
