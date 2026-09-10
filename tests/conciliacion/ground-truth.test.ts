/**
 * Arnés de validación contra el resultado humano.
 *
 * Datos inventados. Lo que se prueba es la aritmética de las métricas y la
 * tolerancia del lector de respuestas, no ningún caso real.
 */

import { describe, expect, it } from "vitest";
import {
  acreditaAutomaticamente,
  campoCsv,
  filasACsv,
  idDeFila,
  leerRespuestas,
  medir,
  type ResultadoHumano,
} from "../../src/lib/conciliacion/ground-truth";
import type { EstadoConciliacion, ResultadoFila } from "../../src/lib/conciliacion";
import type { ClientTransfer } from "../../src/lib/planillas/cliente";

function resultado(estado: EstadoConciliacion, importe = 1000): ResultadoFila {
  const transfer = { importe, sourceRow: 1, identificacionNormalizada: "20111111112" } as ClientTransfer;
  return {
    transfer,
    estado,
    motivo: "",
    acreditacion: null,
    candidatos: [],
    duplicadoDe: [],
    automatico: estado === "ACREDITADA_EXACTA_CUIT",
  };
}

const respuestas = (...vs: ResultadoHumano[]) =>
  new Map(vs.map((v, i) => [idDeFila(i), v]));

describe("identificadores de fila", () => {
  it("son neutros y ordenables", () => {
    expect(idDeFila(0)).toBe("ROW_01");
    expect(idDeFila(11)).toBe("ROW_12");
    // Rellenados para que ordenen bien como texto.
    expect([idDeFila(9), idDeFila(1)].sort()).toEqual(["ROW_02", "ROW_10"]);
  });
});

describe("qué acredita cada reglamento", () => {
  it("el actual solo acredita el match exacto", () => {
    expect(acreditaAutomaticamente("ACREDITADA_EXACTA_CUIT", "SOLO_CUIT")).toBe(true);
    expect(acreditaAutomaticamente("ACREDITADA_EXACTA_DNI", "SOLO_CUIT")).toBe(false);
    expect(acreditaAutomaticamente("IDENTITY_MAPPING_REQUIRED", "SOLO_CUIT")).toBe(false);
  });

  it("el propuesto agrega el candidato único por DNI", () => {
    expect(acreditaAutomaticamente("ACREDITADA_EXACTA_DNI", "CONFIRMADO")).toBe(true);
    // Y nada más: un DNI sin candidato sigue sin acreditarse.
    expect(acreditaAutomaticamente("IDENTITY_MAPPING_REQUIRED", "CONFIRMADO")).toBe(false);
    expect(acreditaAutomaticamente("MATCH_AMBIGUO", "CONFIRMADO")).toBe(false);
    expect(acreditaAutomaticamente("POSIBLE_MATCH", "CONFIRMADO")).toBe(false);
  });
});

describe("métricas", () => {
  it("cuenta un acierto como verdadero positivo", () => {
    const m = medir([resultado("ACREDITADA_EXACTA_CUIT")], respuestas("ACREDITADA"), "SOLO_CUIT");
    expect(m.verdaderosPositivos).toBe(1);
    expect(m.precision).toBe(100);
    expect(m.recall).toBe(100);
    expect(m.aptoParaAutomatizar).toBe(true);
  });

  it("detecta el falso positivo, que es lo que más importa", () => {
    const m = medir([resultado("ACREDITADA_EXACTA_CUIT")], respuestas("NO_ACREDITADA"), "SOLO_CUIT");
    expect(m.falsosPositivos).toBe(1);
    expect(m.precision).toBe(0);
    expect(m.aptoParaAutomatizar).toBe(false);
  });

  it("un ERROR o una DUPLICADA de Mati también hacen falso positivo", () => {
    // Si el sistema acreditó algo que Mati marcó como error, es plata dada
    // por cobrada: no puede contar como acierto.
    for (const r of ["ERROR", "DUPLICADA", "OTRO"] as ResultadoHumano[]) {
      const m = medir([resultado("ACREDITADA_EXACTA_CUIT")], respuestas(r), "SOLO_CUIT");
      expect(m.falsosPositivos).toBe(1);
    }
  });

  it("cuenta el falso negativo sin castigar la precisión", () => {
    const m = medir([resultado("IDENTITY_MAPPING_REQUIRED")], respuestas("ACREDITADA"), "SOLO_CUIT");
    expect(m.falsosNegativos).toBe(1);
    expect(m.precision).toBeNull(); // no acreditó nada: no hay precisión que medir
    expect(m.recall).toBe(0);
  });

  it("cuenta la abstención correcta", () => {
    const m = medir([resultado("MATCH_AMBIGUO")], respuestas("NO_ACREDITADA"), "SOLO_CUIT");
    expect(m.verdaderosNegativos).toBe(1);
    expect(m.falsosPositivos).toBe(0);
    // Sin acreditaciones, «apto» es falso: precisión perfecta sobre cero
    // casos no significa nada.
    expect(m.aptoParaAutomatizar).toBe(false);
  });

  it("el reglamento con DNI sube la cobertura sin tocar el otro", () => {
    const filas = [resultado("ACREDITADA_EXACTA_CUIT"), resultado("ACREDITADA_EXACTA_DNI")];
    const r = respuestas("ACREDITADA", "ACREDITADA");
    const actual = medir(filas, r, "SOLO_CUIT");
    const conDni = medir(filas, r, "CONFIRMADO");

    expect(actual.tasaAutomatica).toBe(50);
    expect(actual.falsosNegativos).toBe(1);
    expect(conDni.tasaAutomatica).toBe(100);
    expect(conDni.falsosNegativos).toBe(0);
    expect(conDni.precision).toBe(100);
  });

  it("si el candidato por DNI estaba mal, el reglamento propuesto lo paga", () => {
    const filas = [resultado("ACREDITADA_EXACTA_CUIT"), resultado("ACREDITADA_EXACTA_DNI")];
    const r = respuestas("ACREDITADA", "NO_ACREDITADA");
    expect(medir(filas, r, "SOLO_CUIT").falsosPositivos).toBe(0);
    expect(medir(filas, r, "CONFIRMADO").falsosPositivos).toBe(1);
    expect(medir(filas, r, "CONFIRMADO").aptoParaAutomatizar).toBe(false);
  });

  it("ignora las filas que Mati no respondió", () => {
    const filas = [resultado("ACREDITADA_EXACTA_CUIT"), resultado("ACREDITADA_EXACTA_CUIT")];
    const m = medir(filas, new Map([[idDeFila(0), "ACREDITADA" as ResultadoHumano]]), "SOLO_CUIT");
    expect(m.filas).toBe(1);
  });
});

describe("lectura de la respuesta de Mati", () => {
  it("lee un CSV con punto y coma", () => {
    const { respuestas: r } = leerRespuestas("row_id;resultado\r\nROW_01;ACREDITADA\r\n");
    expect(r.get("ROW_01")).toBe("ACREDITADA");
  });

  it("acepta coma como separador", () => {
    const { respuestas: r } = leerRespuestas("row_id,resultado\nROW_01,ACREDITADA\n");
    expect(r.get("ROW_01")).toBe("ACREDITADA");
  });

  it("tolera BOM, minúsculas, acentos y espacios", () => {
    const { respuestas: r } = leerRespuestas("﻿row_id;resultado\nrow_01; acreditada \nROW_02;no acreditada\n");
    expect(r.get("ROW_01")).toBe("ACREDITADA");
    expect(r.get("ROW_02")).toBe("NO_ACREDITADA");
  });

  it("separa lo que no reconoce en vez de adivinar", () => {
    const { respuestas: r, desconocidos } = leerRespuestas("row_id;resultado\nROW_01;quizás\n");
    expect(r.size).toBe(0);
    expect(desconocidos).toEqual([{ rowId: "ROW_01", valor: "quizás" }]);
  });

  it("lista las filas sin responder en lugar de inventarles un valor", () => {
    const { respuestas: r, sinResponder } = leerRespuestas("row_id;resultado\nROW_01;\nROW_02;ACREDITADA\n");
    expect(r.size).toBe(1);
    expect(sinResponder).toEqual(["ROW_01"]);
  });

  it("falla claro si faltan las columnas", () => {
    expect(() => leerRespuestas("a;b\n1;2\n")).toThrow(/row.*resultado|resultado.*row/i);
  });

  it("sobrevive a columnas de más, que Excel suele agregar", () => {
    const { respuestas: r } = leerRespuestas(
      "row_id;fecha;importe;resultado;notas\nROW_01;2026-08-25;100;ACREDITADA;ok\n",
    );
    expect(r.get("ROW_01")).toBe("ACREDITADA");
  });
});

describe("CSV de salida", () => {
  it("escapa el punto y coma y las comillas", () => {
    expect(campoCsv("a;b")).toBe('"a;b"');
    expect(campoCsv('di "hola"')).toBe('"di ""hola"""');
    expect(campoCsv(null)).toBe("");
  });

  it("lleva BOM y fin de línea de Windows, para Excel argentino", () => {
    const csv = filasACsv(["a", "b"], [[1, 2]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("\r\n");
    expect(csv).toContain("a;b");
  });

  it("lo que se genera se puede volver a leer", () => {
    const csv = filasACsv(["row_id", "resultado"], [["ROW_01", "ACREDITADA"]]);
    expect(leerRespuestas(csv).respuestas.get("ROW_01")).toBe("ACREDITADA");
  });
});
