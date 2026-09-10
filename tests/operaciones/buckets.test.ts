/**
 * El mapeo de estados a grupos.
 *
 * Lo que se prueba acá no es aritmética: es **la regla de negocio que
 * confirmó NORD**. Todo lo que el sistema no cerró solo es un problema
 * visible desde el día cero, y no existe ninguna categoría intermedia donde
 * esconder pendientes. Si alguien agrega una, estos tests se caen.
 */

import { describe, expect, it } from "vitest";
import {
  BUCKETS, BUCKETS_ATENCION, ESTADOS, bucketDe, estaAcreditada, requiereAtencion, tonoDe,
} from "../../src/lib/operaciones/buckets";
import type { EstadoOperacional } from "../../src/lib/operaciones/tipos";

const TODOS = Object.keys(ESTADOS) as EstadoOperacional[];

describe("la partición", () => {
  it("cubre los trece estados sin dejar ninguno afuera", () => {
    expect(TODOS).toHaveLength(13);
    for (const e of TODOS) expect(bucketDe(e)).toBeDefined();
  });

  it("cada estado cae en exactamente un grupo", () => {
    const cuenta = new Map<string, number>();
    for (const e of TODOS) {
      const b = bucketDe(e);
      cuenta.set(b, (cuenta.get(b) ?? 0) + 1);
    }
    // La suma tiene que dar el total: si un estado cayera en dos grupos, la
    // pantalla mostraría 497 operaciones repartidas en 498 casilleros.
    expect([...cuenta.values()].reduce((a, b) => a + b, 0)).toBe(TODOS.length);
  });

  it("solo los dos automáticos y los dos resueltos quedan cerrados", () => {
    const cerrados = TODOS.filter((e) => !requiereAtencion(e));
    expect(cerrados.sort()).toEqual([
      "ACREDITADA_EXACTA_CUIT",
      "ACREDITADA_EXACTA_DNI",
      "ACREDITADA_MANUAL",
      "DESCARTADA_DUPLICADO",
    ]);
  });
});

describe("la regla confirmada por NORD", () => {
  it("pendiente requiere atención desde el día cero", () => {
    // Sin período de gracia. Es la corrección que reemplazó al diseño
    // anterior, donde el pendiente vivía en «en curso, sin acción».
    expect(requiereAtencion("PENDIENTE_NO_ENCONTRADA_EN_RANGO")).toBe(true);
    expect(bucketDe("PENDIENTE_NO_ENCONTRADA_EN_RANGO")).toBe("PENDIENTE");
  });

  it("los errores de dato también son problema desde que se detectan", () => {
    for (const e of ["ERROR_CUIT", "ERROR_IDENTIFICACION", "COMPROBANTE_INVALIDO", "DATOS_INVALIDOS"] as const) {
      expect(bucketDe(e)).toBe("ERROR");
      expect(requiereAtencion(e)).toBe(true);
    }
  });

  it("las cuatro que decide una persona van a revisión", () => {
    for (const e of ["MATCH_AMBIGUO", "POSIBLE_MATCH", "IDENTITY_MAPPING_REQUIRED", "POSIBLE_DUPLICADO"] as const) {
      expect(bucketDe(e)).toBe("REVISION");
    }
  });

  it("no hay ningún grupo que no requiera atención y tampoco esté cerrado", () => {
    // Es la garantía de que nadie inventó un «en curso» por la ventana.
    for (const e of TODOS) {
      const abierto = requiereAtencion(e);
      const cerrado = estaAcreditada(e) || e === "DESCARTADA_DUPLICADO";
      expect(abierto !== cerrado).toBe(true);
    }
  });

  it("los tres grupos de atención son exactamente pendiente, revisión y error", () => {
    expect([...BUCKETS_ATENCION]).toEqual(["PENDIENTE", "REVISION", "ERROR"]);
  });
});

describe("lo que ve una persona", () => {
  it("ningún estado se muestra con su código técnico", () => {
    for (const e of TODOS) {
      expect(ESTADOS[e].etiqueta).not.toContain("_");
      expect(ESTADOS[e].etiqueta).not.toBe(e);
    }
  });

  it("todos explican qué pasó y qué hacer", () => {
    for (const e of TODOS) {
      expect(ESTADOS[e].quePaso.length).toBeGreaterThan(10);
      expect(ESTADOS[e].queHacer.length).toBeGreaterThan(0);
    }
  });

  it("un CUIT incorrecto le dice a Mati que hable con el cliente", () => {
    expect(ESTADOS.ERROR_CUIT.queHacer).toMatch(/cliente/i);
    expect(ESTADOS.COMPROBANTE_INVALIDO.queHacer).toMatch(/cliente/i);
  });

  it("un pendiente le dice que monitoree, no que lo resuelva", () => {
    expect(ESTADOS.PENDIENTE_NO_ENCONTRADA_EN_RANGO.queHacer).toMatch(/monitorear/i);
  });
});

describe("el color significa una cosa sola", () => {
  it("el tono sale del grupo, no del estado", () => {
    for (const e of TODOS) expect(tonoDe(e)).toBe(BUCKETS[bucketDe(e)].tono);
  });

  it("verde es cerrado, rojo es dato incorrecto", () => {
    expect(BUCKETS.CONCILIADA.tono).toBe("pos");
    expect(BUCKETS.ERROR.tono).toBe("neg");
    expect(BUCKETS.PENDIENTE.tono).toBe("warn");
    expect(BUCKETS.REVISION.tono).toBe("warn");
  });
});
