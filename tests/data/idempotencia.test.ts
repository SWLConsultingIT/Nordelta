/**
 * Correr la conciliación dos veces no puede cambiar nada.
 *
 * Es la propiedad que hace que la acción «Actualizar conciliación» sea
 * segura de apretar. Sin ella, cada corrida sería una apuesta: podría
 * duplicar emparejamientos, pisar una decisión de Mati o inventar
 * historial de cosas que no pasaron.
 *
 * También se verifica la regla que gobierna la re-evaluación:
 * **una decisión humana no la pisa una corrida automática.**
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const DIR = mkdtempSync(join(tmpdir(), "nord-idem-"));
process.env.NORD_DATA_DIR = DIR;

const { repositoriosLocales } = await import("../../src/lib/data/local");
const { almacenOps } = await import("../../src/lib/data/almacen-operaciones");
const { correrConciliacion } = await import("../../src/lib/servicios/conciliacion");

const CUIT = "20305555550";

async function escenario() {
  almacenOps.restablecer();
  const r = repositoriosLocales();
  almacenOps.estado.clientes = [];
  almacenOps.estado.planillas = [];
  almacenOps.estado.operaciones = [];
  almacenOps.estado.acreditaciones = [];
  almacenOps.estado.informes = [];
  almacenOps.estado.resoluciones = [];
  almacenOps.estado.mapeos = [];
  almacenOps.estado.eventos = [];
  almacenOps.estado.corridas = [];

  const c = await r.clientes.crear({ nombre: "Cliente", alias: "CLI" });
  const p = await r.planillas.crear({
    clienteId: c.id, archivo: "p.xlsx", fecha: "2026-09-08",
  });
  const [op] = await r.transferencias.crearLote(p.id, [{
    fila: 1, fechaDeposito: "2026-09-08", banco: "X", nombreDepositante: "Alguien",
    identificacionOriginal: CUIT, identificacionNormalizada: CUIT,
    tipoIdentificacion: "CUIT_VALIDO", importe: 100_000, numeroDeposito: "1",
  }]);

  const inf = await r.informes.registrar({
    archivo: "i.xls", desde: "2026-09-08", hasta: "2026-09-08", origen: "MANUAL",
  });
  await r.acreditaciones.incorporar(inf.id, [{
    cuit: CUIT, fecha: "2026-09-08", importe: 100_000,
    banco: "X", descripcion: "Transf Recibida", row: 1,
  }]);

  return { r, op };
}

afterAll(() => rmSync(DIR, { recursive: true, force: true }));

describe("correr dos veces", () => {
  it("la segunda corrida no cambia ningún estado ni agrega historial", async () => {
    const { r, op } = await escenario();

    const primera = await correrConciliacion(r, "MANUAL");
    const trasUna = await r.transferencias.obtener(op.id);
    const historialUna = await r.conciliacion.eventos(op.id);

    const segunda = await correrConciliacion(r, "MANUAL");
    const trasDos = await r.transferencias.obtener(op.id);
    const historialDos = await r.conciliacion.eventos(op.id);

    expect(primera.corrida.nuevasAcreditadas).toBe(1);
    expect(segunda.corrida.nuevasAcreditadas).toBe(0);
    expect(trasDos!.estado).toBe(trasUna!.estado);
    expect(trasDos!.acreditacionId).toBe(trasUna!.acreditacionId);
    // Un evento por cambio real. La segunda corrida no cambió nada, así
    // que no puede haber inventado historia.
    expect(historialDos).toHaveLength(historialUna.length);
  });

  it("no duplica acreditaciones en el pozo", async () => {
    const { r } = await escenario();
    await correrConciliacion(r, "MANUAL");
    const antes = (await r.acreditaciones.listar()).length;
    await correrConciliacion(r, "MANUAL");
    expect((await r.acreditaciones.listar()).length).toBe(antes);
  });

  it("no rompe el uno a uno: la acreditación sigue siendo de una sola", async () => {
    const { r } = await escenario();
    await correrConciliacion(r, "MANUAL");
    await correrConciliacion(r, "MANUAL");
    const usadas = (await r.transferencias.listar())
      .map((o) => o.acreditacionId)
      .filter(Boolean);
    expect(new Set(usadas).size).toBe(usadas.length);
  });

  it("cada corrida sí queda registrada: eso pasó de verdad", async () => {
    const { r } = await escenario();
    await correrConciliacion(r, "MANUAL");
    await correrConciliacion(r, "MANUAL");
    expect((await r.conciliacion.corridas()).length).toBe(2);
  });
});

describe("una decisión humana gana", () => {
  it("una corrida automática no reemplaza el match que confirmó Mati", async () => {
    const { r, op } = await escenario();

    // Dos acreditaciones idénticas: el sistema no elige ninguna.
    const inf = await r.informes.registrar({
      archivo: "i2.xls", desde: "2026-09-08", hasta: "2026-09-08", origen: "MANUAL",
    });
    await r.acreditaciones.incorporar(inf.id, [{
      cuit: CUIT, fecha: "2026-09-08", importe: 100_000,
      banco: "Y", descripcion: "Otra distinta", row: 2,
    }]);

    await correrConciliacion(r, "MANUAL");
    const ambigua = await r.transferencias.obtener(op.id);
    expect(ambigua!.estado).toBe("MATCH_AMBIGUO");
    expect(ambigua!.candidatoIds.length).toBe(2);

    // Mati elige el segundo candidato, no el primero.
    const elegido = ambigua!.candidatoIds[1];
    await r.conciliacion.registrarResolucion({
      operacionId: op.id, decision: "CONFIRMAR_MATCH", origen: "HUMANA",
      estadoPrevio: ambigua!.estado, acreditacionId: elegido,
      actor: "mati@nordelta.com", momento: "2026-09-10T10:00:00",
      motivo: null, mapeoId: null,
    });

    await correrConciliacion(r, "MANUAL");
    const resuelta = await r.transferencias.obtener(op.id);
    expect(resuelta!.estado).toBe("ACREDITADA_MANUAL");
    expect(resuelta!.acreditacionId).toBe(elegido);

    // Y sigue ganando en corridas posteriores: el sistema no la
    // reemplaza por el otro candidato ni la vuelve a abrir.
    await correrConciliacion(r, "MANUAL");
    const despues = await r.transferencias.obtener(op.id);
    expect(despues!.acreditacionId).toBe(elegido);
    expect(despues!.automatico).toBe(false);
  });

  it("el actor y el motivo de la decisión no los toca ninguna corrida", async () => {
    const { r, op } = await escenario();
    await correrConciliacion(r, "MANUAL");
    await r.conciliacion.registrarResolucion({
      operacionId: op.id, decision: "MARCAR_DUPLICADO", origen: "HUMANA",
      estadoPrevio: "PENDIENTE_NO_ENCONTRADA_EN_RANGO", acreditacionId: null,
      actor: "mati@nordelta.com", momento: "2026-09-10T10:00:00",
      motivo: "cargada dos veces", mapeoId: null,
    });
    await correrConciliacion(r, "MANUAL");
    await correrConciliacion(r, "MANUAL");

    const [res] = await r.conciliacion.resoluciones();
    expect(res.actor).toBe("mati@nordelta.com");
    expect(res.motivo).toBe("cargada dos veces");
    expect(res.origen).toBe("HUMANA");
    expect((await r.transferencias.obtener(op.id))!.estado).toBe("DESCARTADA_DUPLICADO");
  });
});

describe("D0 pendiente, D5 acreditada, sin recrear la transferencia", () => {
  it("la misma fila cambia de estado cuando llega el informe", async () => {
    almacenOps.restablecer();
    const r = repositoriosLocales();
    almacenOps.estado.clientes = [];
    almacenOps.estado.planillas = [];
    almacenOps.estado.operaciones = [];
    almacenOps.estado.acreditaciones = [];
    almacenOps.estado.informes = [];
    almacenOps.estado.resoluciones = [];
    almacenOps.estado.mapeos = [];
    almacenOps.estado.eventos = [];
    almacenOps.estado.corridas = [];

    const c = await r.clientes.crear({ nombre: "Cliente", alias: "CLI2" });
    const p = await r.planillas.crear({
      clienteId: c.id, archivo: "d0.xlsx", fecha: "2026-09-08",
    });
    const [op] = await r.transferencias.crearLote(p.id, [{
      fila: 1, fechaDeposito: "2026-09-08", banco: "X", nombreDepositante: "Alguien",
      identificacionOriginal: CUIT, identificacionNormalizada: CUIT,
      tipoIdentificacion: "CUIT_VALIDO", importe: 100_000, numeroDeposito: "1",
    }]);

    // D0: no hay informe todavía.
    await correrConciliacion(r, "IMPORTACION_PLANILLA");
    expect((await r.transferencias.obtener(op.id))!.estado)
      .toBe("PENDIENTE_NO_ENCONTRADA_EN_RANGO");

    // D5: llega el informe que la contiene.
    const inf = await r.informes.registrar({
      archivo: "d5.xls", desde: "2026-09-08", hasta: "2026-09-13", origen: "AUTOMATICO",
    });
    await r.acreditaciones.incorporar(inf.id, [{
      cuit: CUIT, fecha: "2026-09-08", importe: 100_000,
      banco: "X", descripcion: "Transf Recibida", row: 1,
    }]);
    await correrConciliacion(r, "IMPORTACION_INFORME");

    const final = await r.transferencias.obtener(op.id);
    // **La misma fila.** No se recreó: cambió de estado.
    expect(final!.id).toBe(op.id);
    expect(final!.estado).toBe("ACREDITADA_EXACTA_CUIT");
    expect(final!.intentos).toBeGreaterThan(1);

    // Y el historial cuenta la transición completa.
    const historial = await r.conciliacion.eventos(op.id);
    expect(historial.some((e) => e.a === "ACREDITADA_EXACTA_CUIT")).toBe(true);
  });
});
