/**
 * El dataset de demostración.
 *
 * Lo que importa no es que los números sean bonitos: es que **los produce el
 * matcher de verdad**. Si alguien cambia una regla del motor y la
 * demostración deja de dar lo que muestra, estos tests lo dicen antes que el
 * cliente.
 */

import { describe, expect, it } from "vitest";
import { generarOperaciones, estadoDePlanilla } from "../../src/lib/data/dataset-operaciones";
import { bucketDe, estaAcreditada } from "../../src/lib/operaciones/buckets";
import { verificaDigito } from "../../src/lib/fullcarga/cuit";

const datos = generarOperaciones("2026-09-10");

describe("escala y forma", () => {
  it("tiene 497 operaciones, como el volumen diario real de NORD", () => {
    expect(datos.operaciones).toHaveLength(497);
  });

  it("reparte entre varios clientes y varias planillas", () => {
    expect(datos.clientes.length).toBeGreaterThanOrEqual(4);
    expect(datos.planillas.length).toBeGreaterThanOrEqual(8);
    expect(new Set(datos.operaciones.map((o) => o.clienteId)).size).toBe(datos.clientes.length);
  });

  it("la mitad del volumen llega con DNI, como en el archivo real", () => {
    const dni = datos.operaciones.filter((o) => o.tipoIdentificacion === "DNI_PROBABLE").length;
    expect(dni / datos.operaciones.length).toBeGreaterThan(0.3);
    expect(dni / datos.operaciones.length).toBeLessThan(0.6);
  });

  it("hay pendientes de antigüedades distintas, no todas de ayer", () => {
    const fechas = new Set(
      datos.operaciones
        .filter((o) => o.estado === "PENDIENTE_NO_ENCONTRADA_EN_RANGO")
        .map((o) => o.fechaDeposito),
    );
    expect(fechas.size).toBeGreaterThan(4);
  });
});

describe("los buckets son los que muestra la pantalla", () => {
  const cuenta = (b: string) =>
    datos.operaciones.filter((o) => bucketDe(o.estado) === b).length;

  it("455 conciliadas, 24 pendientes, 11 en revisión, 7 con error", () => {
    expect(cuenta("CONCILIADA")).toBe(455);
    expect(cuenta("PENDIENTE")).toBe(24);
    expect(cuenta("REVISION")).toBe(11);
    expect(cuenta("ERROR")).toBe(7);
  });

  it("los buckets suman el total: ninguna operación se pierde", () => {
    const suma = ["CONCILIADA", "RESUELTA", "PENDIENTE", "REVISION", "ERROR"]
      .map(cuenta)
      .reduce((a, b) => a + b, 0);
    expect(suma).toBe(datos.operaciones.length);
  });

  it("los 42 que requieren atención son la suma de los tres grupos", () => {
    expect(cuenta("PENDIENTE") + cuenta("REVISION") + cuenta("ERROR")).toBe(42);
  });

  it("ejercita las cuatro clases de excepción, no una sola", () => {
    const estados = new Set(datos.operaciones.map((o) => o.estado));
    for (const e of ["MATCH_AMBIGUO", "POSIBLE_MATCH", "IDENTITY_MAPPING_REQUIRED", "POSIBLE_DUPLICADO"]) {
      expect(estados.has(e as never)).toBe(true);
    }
  });
});

describe("los datos son sintéticos pero válidos", () => {
  it("los CUIT tienen el verificador correcto", () => {
    const cuits = datos.acreditaciones.map((a) => a.cuit);
    const validos = cuits.filter(verificaDigito).length;
    // Los inválidos son los que se alteraron a propósito para el caso de
    // «CUIT parecido»: tienen que ser pocos.
    expect(validos / cuits.length).toBeGreaterThan(0.98);
  });

  it("ninguna operación acreditada quedó sin registro asociado", () => {
    const ids = new Set(datos.acreditaciones.map((a) => a.id));
    for (const o of datos.operaciones) {
      if (!estaAcreditada(o.estado)) continue;
      expect(o.acreditacionId).not.toBeNull();
      expect(ids.has(o.acreditacionId!)).toBe(true);
    }
  });

  it("ninguna acreditación se cobró dos veces", () => {
    const usadas = datos.operaciones.map((o) => o.acreditacionId).filter(Boolean);
    expect(new Set(usadas).size).toBe(usadas.length);
  });

  it("el importe acreditado coincide con el de la acreditación", () => {
    const porId = new Map(datos.acreditaciones.map((a) => [a.id, a]));
    for (const o of datos.operaciones) {
      if (!o.acreditacionId) continue;
      expect(porId.get(o.acreditacionId)!.importe).toBe(o.importe);
    }
  });
});

describe("estado derivado de la planilla", () => {
  it("todas acreditadas es ACREDITADA", () => {
    const ops = [
      { planillaId: "p", estado: "ACREDITADA_EXACTA_CUIT" },
      { planillaId: "p", estado: "ACREDITADA_MANUAL" },
    ] as never;
    expect(estadoDePlanilla("p", ops)).toBe("ACREDITADA");
  });

  it("con un error es CON_ERRORES, aunque el resto esté bien", () => {
    const ops = [
      { planillaId: "p", estado: "ACREDITADA_EXACTA_CUIT" },
      { planillaId: "p", estado: "ERROR_CUIT" },
    ] as never;
    expect(estadoDePlanilla("p", ops)).toBe("CON_ERRORES");
  });

  it("sin operaciones es RECIBIDA", () => {
    expect(estadoDePlanilla("p", [])).toBe("RECIBIDA");
  });
});

describe("coherencia de cada fila", () => {
  it("el tipo de identificación coincide con lo que dice el número", () => {
    // Una fila que se declara CUIT y trae ocho dígitos no existe en ningún
    // archivo real, y hacía que el informe de ejemplo saliera mal armado.
    for (const o of datos.operaciones) {
      if (o.tipoIdentificacion === "CUIT_VALIDO") {
        expect(o.identificacionNormalizada, o.id).toHaveLength(11);
        expect(verificaDigito(o.identificacionNormalizada), o.id).toBe(true);
      }
      if (o.tipoIdentificacion === "DNI_PROBABLE") {
        expect(o.identificacionNormalizada.length, o.id).toBeGreaterThanOrEqual(7);
        expect(o.identificacionNormalizada.length, o.id).toBeLessThanOrEqual(8);
      }
      // Lo que se muestra y lo que se compara son el mismo número.
      expect(o.identificacionNormalizada, o.id).toBe(o.identificacionOriginal.replace(/\D/g, ""));
    }
  });
});
