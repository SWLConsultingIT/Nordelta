/**
 * Re-evaluación: lo que convierte al matcher en un producto.
 *
 * El matcher es una función pura y por eso es testeable. Pero un producto
 * tiene que **recordar**: si Mati resuelve una excepción hoy, mañana no
 * puede reaparecer como si nada hubiera pasado. Eso es lo que se prueba acá.
 *
 * Datos inventados. Los CUIT están construidos con el algoritmo de la AFIP
 * para que el verificador cierre de verdad: uno inválido cambiaría el estado
 * y el test probaría otra cosa.
 */

import { describe, expect, it } from "vitest";
import { reevaluar } from "../../src/lib/operaciones/motor";
import type {
  AcreditacionGuardada, MapeoIdentidad, Operacion, Resolucion,
} from "../../src/lib/operaciones/tipos";

const MOMENTO = "2026-09-10T10:00:00";

/** `20-30555555-0`: verificador calculado, no inventado. */
const CUIT_A = "20305555550";
const CUIT_B = "27305555555";
const DNI_A = "30555555";

function operacion(over: Partial<Operacion> = {}): Operacion {
  return {
    id: "op1",
    planillaId: "pl1",
    clienteId: "cl1",
    fila: 1,
    fechaDeposito: "2026-09-08",
    banco: "BANCO GALICIA",
    nombreDepositante: "Persona Inventada",
    identificacionOriginal: CUIT_A,
    identificacionNormalizada: CUIT_A,
    tipoIdentificacion: "CUIT_VALIDO",
    importe: 100_000,
    numeroDeposito: "4123456",
    estado: "PENDIENTE_NO_ENCONTRADA_EN_RANGO",
    motivo: "",
    acreditacionId: null,
    candidatoIds: [],
    duplicadoDe: [],
    automatico: false,
    viaMapeo: false,
    fechaAcreditacion: null,
    evaluadaEn: "2026-09-09T10:00:00",
    intentos: 1,
    ...over,
  };
}

function acreditacion(over: Partial<AcreditacionGuardada> = {}): AcreditacionGuardada {
  const row = over.row ?? 1;
  return {
    id: `inf1|${row}`,
    informeId: "inf1",
    cuit: CUIT_A,
    fecha: "2026-09-08",
    importe: 100_000,
    banco: "BANCO GALICIA",
    descripcion: null,
    ...over,
    row,
  };
}

const correr = (
  operaciones: Operacion[],
  acreditaciones: AcreditacionGuardada[] = [],
  extra: { mapeos?: MapeoIdentidad[]; resoluciones?: Resolucion[] } = {},
) =>
  reevaluar({
    operaciones,
    acreditaciones,
    mapeos: extra.mapeos ?? [],
    resoluciones: extra.resoluciones ?? [],
    momento: MOMENTO,
    disparador: "MANUAL",
  });

describe("una pendiente puede acreditarse después", () => {
  it("sin acreditación sigue pendiente", () => {
    const { operaciones } = correr([operacion()]);
    expect(operaciones[0].estado).toBe("PENDIENTE_NO_ENCONTRADA_EN_RANGO");
    expect(operaciones[0].intentos).toBe(2);
  });

  it("cuando aparece el registro, acredita sola y queda registrado el cambio", () => {
    const { operaciones, eventos, corrida } = correr([operacion()], [acreditacion()]);
    expect(operaciones[0].estado).toBe("ACREDITADA_EXACTA_CUIT");
    expect(operaciones[0].acreditacionId).toBe("inf1|1");
    expect(operaciones[0].fechaAcreditacion).toBe("2026-09-08");
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({
      de: "PENDIENTE_NO_ENCONTRADA_EN_RANGO",
      a: "ACREDITADA_EXACTA_CUIT",
      origen: "CONCILIACION",
      actor: "sistema",
    });
    expect(corrida.nuevasAcreditadas).toBe(1);
  });

  it("no vuelve a evaluar lo que ya está cerrado", () => {
    const cerrada = operacion({ estado: "ACREDITADA_EXACTA_CUIT", acreditacionId: "inf1|1", intentos: 3 });
    const { operaciones, corrida } = correr([cerrada], [acreditacion()]);
    expect(operaciones[0].intentos).toBe(3);
    expect(corrida.operacionesEvaluadas).toBe(0);
  });

  it("una acreditación ya consumida no se le ofrece a otra operación", () => {
    // Es la garantía del uno a uno **entre corridas**, no solo dentro de una.
    const cerrada = operacion({ id: "op1", estado: "ACREDITADA_EXACTA_CUIT", acreditacionId: "inf1|1" });
    const abierta = operacion({ id: "op2", fila: 2 });
    const { operaciones } = correr([cerrada, abierta], [acreditacion()]);
    expect(operaciones[1].estado).toBe("PENDIENTE_NO_ENCONTRADA_EN_RANGO");
  });
});

describe("lo que decidió una persona se respeta", () => {
  const resolucion = (over: Partial<Resolucion> = {}): Resolucion => ({
    id: "re1",
    operacionId: "op1",
    decision: "CONFIRMAR_MATCH",
    origen: "HUMANA",
    acreditacionId: "inf1|1",
    estadoPrevio: "MATCH_AMBIGUO",
    actor: "mati@nordelta.com",
    momento: "2026-09-10T09:00:00",
    motivo: null,
    mapeoId: null,
    ...over,
  });

  it("un match confirmado queda acreditado a mano, no automático", () => {
    const { operaciones } = correr(
      [operacion({ estado: "MATCH_AMBIGUO" })],
      [acreditacion()],
      { resoluciones: [resolucion()] },
    );
    expect(operaciones[0].estado).toBe("ACREDITADA_MANUAL");
    expect(operaciones[0].automatico).toBe(false);
    expect(operaciones[0].motivo).toContain("mati@nordelta.com");
  });

  it("la decisión sobrevive a correr de nuevo: no reaparece la excepción", () => {
    const r = [resolucion()];
    const a = [acreditacion()];
    const primera = correr([operacion({ estado: "MATCH_AMBIGUO" })], a, { resoluciones: r });
    const segunda = correr(primera.operaciones, a, { resoluciones: r });
    expect(segunda.operaciones[0].estado).toBe("ACREDITADA_MANUAL");
    // Y no genera un evento nuevo: nada cambió.
    expect(segunda.eventos).toHaveLength(0);
  });

  it("marcar duplicado la descarta sin acreditar plata", () => {
    const { operaciones } = correr(
      [operacion({ estado: "POSIBLE_DUPLICADO" })],
      [acreditacion()],
      { resoluciones: [resolucion({ decision: "MARCAR_DUPLICADO", acreditacionId: null })] },
    );
    expect(operaciones[0].estado).toBe("DESCARTADA_DUPLICADO");
    expect(operaciones[0].acreditacionId).toBeNull();
  });

  it("rechazar los candidatos no los vuelve a proponer", () => {
    const op = operacion({ estado: "MATCH_AMBIGUO", candidatoIds: ["inf1|1"] });
    const { operaciones } = correr([op], [acreditacion()], {
      resoluciones: [resolucion({ decision: "RECHAZAR_CANDIDATOS", acreditacionId: null })],
    });
    expect(operaciones[0].estado).toBe("PENDIENTE_NO_ENCONTRADA_EN_RANGO");
    expect(operaciones[0].acreditacionId).toBeNull();
  });

  it("pero sí puede acreditar contra un registro distinto que aparezca después", () => {
    const op = operacion({ estado: "MATCH_AMBIGUO", candidatoIds: ["inf1|1"] });
    const nueva = acreditacion({ row: 2, id: "inf1|2" });
    const { operaciones } = correr([op], [acreditacion(), nueva], {
      resoluciones: [resolucion({ decision: "RECHAZAR_CANDIDATOS", acreditacionId: null })],
    });
    expect(operaciones[0].estado).toBe("ACREDITADA_EXACTA_CUIT");
    expect(operaciones[0].acreditacionId).toBe("inf1|2");
  });

  it("no se confirma un registro que ya se llevó otra operación", () => {
    // Antes que romper el uno a uno, la operación queda abierta.
    const cerrada = operacion({ id: "op0", estado: "ACREDITADA_EXACTA_CUIT", acreditacionId: "inf1|1" });
    const conflictiva = operacion({ id: "op1", estado: "MATCH_AMBIGUO" });
    const { operaciones } = correr([cerrada, conflictiva], [acreditacion()], {
      resoluciones: [resolucion()],
    });
    expect(operaciones[1].estado).not.toBe("ACREDITADA_MANUAL");
  });

  it("la última resolución es la que vale", () => {
    const { operaciones } = correr(
      [operacion({ estado: "MATCH_AMBIGUO" })],
      [acreditacion()],
      {
        resoluciones: [
          resolucion({ id: "re1", momento: "2026-09-10T09:00:00", decision: "MARCAR_DUPLICADO", acreditacionId: null }),
          resolucion({ id: "re2", momento: "2026-09-10T09:30:00" }),
        ],
      },
    );
    expect(operaciones[0].estado).toBe("ACREDITADA_MANUAL");
  });
});

describe("lo que una persona enseñó se aplica solo", () => {
  const mapeo = (over: Partial<MapeoIdentidad> = {}): MapeoIdentidad => ({
    id: "mp1",
    clienteId: "cl1",
    identificacion: "12345678",
    cuit: CUIT_A,
    actor: "mati@nordelta.com",
    momento: "2026-09-09T10:00:00",
    origen: "RESOLUCION",
    usos: 0,
    ...over,
  });

  const conIdentificacionRara = () =>
    operacion({
      identificacionOriginal: "12345678",
      identificacionNormalizada: "12345678",
      tipoIdentificacion: "DNI_PROBABLE",
    });

  it("sin el mapeo, la operación no encuentra nada", () => {
    const { operaciones } = correr([conIdentificacionRara()], [acreditacion()]);
    expect(operaciones[0].estado).toBe("PENDIENTE_NO_ENCONTRADA_EN_RANGO");
  });

  it("con el mapeo confirmado, acredita sola", () => {
    const { operaciones, corrida, usosDeMapeo } = correr(
      [conIdentificacionRara()], [acreditacion()], { mapeos: [mapeo()] },
    );
    expect(operaciones[0].estado).toBe("ACREDITADA_EXACTA_CUIT");
    expect(operaciones[0].viaMapeo).toBe(true);
    // Es el efecto compuesto: cada identidad confirmada sube la tasa
    // automática de las conciliaciones siguientes.
    expect(corrida.porMapeo).toBe(1);
    expect(usosDeMapeo.get("mp1")).toBe(1);
  });

  it("el mapeo de un cliente no se aplica a otro", () => {
    // Alcance angosto a propósito. TO VALIDATE — F-3.
    const otro = operacion({ ...conIdentificacionRara(), clienteId: "cl2" });
    const { operaciones } = correr([otro], [acreditacion()], { mapeos: [mapeo()] });
    expect(operaciones[0].estado).toBe("PENDIENTE_NO_ENCONTRADA_EN_RANGO");
    expect(operaciones[0].viaMapeo).toBe(false);
  });

  it("nunca se fabrica un CUIT: sin acreditación real, no pasa nada", () => {
    const { operaciones } = correr([conIdentificacionRara()], [], { mapeos: [mapeo()] });
    expect(operaciones[0].estado).toBe("PENDIENTE_NO_ENCONTRADA_EN_RANGO");
    expect(operaciones[0].acreditacionId).toBeNull();
  });
});

describe("la regla de DNI confirmada por NORD sigue en pie", () => {
  it("un DNI acredita contra el CUIT de persona física que lo contiene", () => {
    const op = operacion({
      identificacionOriginal: DNI_A,
      identificacionNormalizada: DNI_A,
      tipoIdentificacion: "DNI_PROBABLE",
    });
    const { operaciones } = correr([op], [acreditacion()]);
    expect(operaciones[0].estado).toBe("ACREDITADA_EXACTA_DNI");
  });

  it("dos candidatos por documento no eligen ninguno", () => {
    const op = operacion({
      identificacionOriginal: DNI_A,
      identificacionNormalizada: DNI_A,
      tipoIdentificacion: "DNI_PROBABLE",
    });
    const otro = acreditacion({ row: 2, id: "inf1|2", cuit: CUIT_B });
    const { operaciones } = correr([op], [acreditacion(), otro]);
    expect(operaciones[0].estado).toBe("MATCH_AMBIGUO");
    expect(operaciones[0].acreditacionId).toBeNull();
  });
});

describe("los duplicados se miran por planilla, no entre clientes", () => {
  it("dos filas iguales de la misma planilla quedan las dos marcadas", () => {
    const a = operacion({ id: "op1", fila: 1 });
    const b = operacion({ id: "op2", fila: 2 });
    const { operaciones } = correr([a, b], [acreditacion()]);
    expect(operaciones.map((o) => o.estado)).toEqual(["POSIBLE_DUPLICADO", "POSIBLE_DUPLICADO"]);
  });

  it("lo mismo en planillas distintas NO se marca como duplicado", () => {
    // Dos clientes pueden recibir del mismo depositante, el mismo día, el
    // mismo importe. Llamar a eso «duplicado» sería ruido puro, y con 497
    // operaciones diarias el ruido entierra las excepciones que importan.
    const a = operacion({ id: "op1", planillaId: "pl1", clienteId: "cl1" });
    const b = operacion({ id: "op2", planillaId: "pl2", clienteId: "cl2" });
    const { operaciones } = correr([a, b], []);
    expect(operaciones.map((o) => o.estado)).toEqual([
      "PENDIENTE_NO_ENCONTRADA_EN_RANGO",
      "PENDIENTE_NO_ENCONTRADA_EN_RANGO",
    ]);
    expect(operaciones.every((o) => o.duplicadoDe.length === 0)).toBe(true);
  });

  it("en la misma planilla, sin acreditación, sí se marcan", () => {
    const a = operacion({ id: "op1", fila: 1 });
    const b = operacion({ id: "op2", fila: 2 });
    const { operaciones } = correr([a, b], []);
    expect(operaciones.map((o) => o.estado)).toEqual(["POSIBLE_DUPLICADO", "POSIBLE_DUPLICADO"]);
  });

  it("dos acreditaciones idénticas para una sola fila no eligen ninguna", () => {
    // Conservador a propósito: entre dos registros intercambiables el
    // sistema no inventa un criterio de desempate.
    const { operaciones } = correr(
      [operacion()],
      [acreditacion(), acreditacion({ row: 2, id: "inf1|2" })],
    );
    expect(operaciones[0].estado).toBe("MATCH_AMBIGUO");
    expect(operaciones[0].candidatoIds).toHaveLength(2);
  });
});

describe("la corrida informa si la cola drena", () => {
  it("cuenta lo evaluado, lo nuevo y lo que sigue abierto", () => {
    const ops = [operacion({ id: "op1" }), operacion({ id: "op2", fila: 2, importe: 999 })];
    const { corrida } = correr(ops, [acreditacion()]);
    expect(corrida.operacionesEvaluadas).toBe(2);
    expect(corrida.nuevasAcreditadas).toBe(1);
    expect(corrida.pendientesAlCierre).toBe(1);
    expect(corrida.disparador).toBe("MANUAL");
  });
});

describe("una decisión humana llega aunque la operación ya esté cerrada", () => {
  it("marcar duplicada algo que el sistema ya había acreditado, lo revierte", () => {
    // El caso real: el matcher acredita una fila y después Mati descubre
    // que el cliente la había cargado dos veces. Si la resolución se
    // ignorara por estar «cerrada», no habría forma de corregirlo.
    const cerrada = operacion({ estado: "ACREDITADA_EXACTA_CUIT", acreditacionId: "inf1|1" });
    const { operaciones } = correr([cerrada], [acreditacion()], {
      resoluciones: [{
        id: "re1", operacionId: "op1", decision: "MARCAR_DUPLICADO", origen: "HUMANA",
        estadoPrevio: "ACREDITADA_EXACTA_CUIT", acreditacionId: null,
        actor: "mati@nordelta.com", momento: "2026-09-10T09:00:00",
        motivo: "cargada dos veces", mapeoId: null,
      }],
    });
    expect(operaciones[0].estado).toBe("DESCARTADA_DUPLICADO");
    expect(operaciones[0].acreditacionId).toBeNull();
  });

  it("y la acreditación liberada queda disponible para otra operación", () => {
    const cerrada = operacion({ id: "op1", estado: "ACREDITADA_EXACTA_CUIT", acreditacionId: "inf1|1" });
    const otra = operacion({ id: "op2", planillaId: "pl2", fila: 1 });
    const { operaciones } = correr([cerrada, otra], [acreditacion()], {
      resoluciones: [{
        id: "re1", operacionId: "op1", decision: "MARCAR_DUPLICADO", origen: "HUMANA",
        estadoPrevio: "ACREDITADA_EXACTA_CUIT", acreditacionId: null,
        actor: "mati@nordelta.com", momento: "2026-09-10T09:00:00",
        motivo: null, mapeoId: null,
      }],
    });
    expect(operaciones[0].estado).toBe("DESCARTADA_DUPLICADO");
    expect(operaciones[1].estado).toBe("ACREDITADA_EXACTA_CUIT");
    expect(operaciones[1].acreditacionId).toBe("inf1|1");
  });
});
