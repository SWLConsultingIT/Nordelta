/**
 * Tests de contrato de los repositorios.
 *
 * El problema que evitan es concreto y clásico: dos implementaciones del
 * mismo puerto que interpretan el dominio distinto, y la diferencia
 * aparece en producción. Acá el **mismo** conjunto de pruebas se ejecuta
 * contra cualquier implementación que se le pase.
 *
 * Hoy corre contra la local. Cuando la base esté aplicada, la de Postgres
 * entra por la misma puerta —`suiteDeContrato(() => repositoriosSupabase(sb))`—
 * y si difiere en algo, se ve acá y no en la operación de Mati.
 *
 * Lo que estos tests **no** cubren, y hay que decirlo: transacciones,
 * concurrencia y aislamiento entre organizaciones. Son garantías de la
 * base, y probarlas contra la implementación local daría una confianza
 * falsa.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Repositorios } from "../../src/lib/data/puertos";
import { ErrorValidacion } from "../../src/lib/domain/errors";
import type { Operacion } from "../../src/lib/operaciones/tipos";

const DIR = mkdtempSync(join(tmpdir(), "nord-contrato-"));
process.env.NORD_DATA_DIR = DIR;

/** Una transferencia mínima, con lo que el alta exige y nada más. */
const filaNueva = (over: Partial<Operacion> = {}) => ({
  fila: 1,
  fechaDeposito: "2026-09-08",
  banco: "BANCO GALICIA",
  nombreDepositante: "Persona Inventada",
  identificacionOriginal: "20305555550",
  identificacionNormalizada: "20305555550",
  tipoIdentificacion: "CUIT_VALIDO" as const,
  importe: 100_000,
  numeroDeposito: "4123456",
  ...over,
});

/**
 * La suite. Recibe una fábrica para que cada implementación arranque
 * limpia y no herede el estado de la anterior.
 */
export function suiteDeContrato(nombre: string, crear: () => Promise<Repositorios>) {
  describe(`contrato · ${nombre}`, () => {
    let r: Repositorios;
    let clienteId: string;

    beforeAll(async () => {
      r = await crear();
      const c = await r.clientes.crear({ nombre: "Cliente de Contrato", alias: "CTR" });
      clienteId = c.id;
    });

    describe("clientes", () => {
      it("lo que se crea se puede volver a leer igual", async () => {
        const leido = await r.clientes.obtener(clienteId);
        expect(leido).toMatchObject({ nombre: "Cliente de Contrato", alias: "CTR" });
      });

      it("aparece en el listado", async () => {
        expect((await r.clientes.listar()).some((c) => c.id === clienteId)).toBe(true);
      });

      it("un id que no existe devuelve null, no rompe", async () => {
        expect(await r.clientes.obtener("00000000-0000-0000-0000-000000000000")).toBeNull();
      });

      it("el alias no se repite", async () => {
        await expect(r.clientes.crear({ nombre: "Otro", alias: "CTR" }))
          .rejects.toBeInstanceOf(ErrorValidacion);
      });

      it("el alias se normaliza a mayúsculas", async () => {
        const c = await r.clientes.crear({ nombre: "Minúsculas", alias: "abc" });
        expect(c.alias).toBe("ABC");
      });

      it("los correos se guardan y se leen", async () => {
        await r.clientes.agregarEmail(clienteId, "Pagos@Contrato.COM", true);
        expect(await r.clientes.emails(clienteId)).toContain("pagos@contrato.com");
      });
    });

    describe("planillas", () => {
      it("se crea con estado inicial y se recupera", async () => {
        const p = await r.planillas.crear({
          clienteId, archivo: "uno.xlsx", fecha: "2026-09-08",
        });
        expect(p.estado).toBe("RECIBIDA");
        expect((await r.planillas.obtener(p.id))?.archivo).toBe("uno.xlsx");
      });

      it("el estado se puede actualizar a uno válido", async () => {
        const p = await r.planillas.crear({
          clienteId, archivo: "dos.xlsx", fecha: "2026-09-08",
        });
        await r.planillas.actualizarEstado(p.id, "ACREDITADA");
        expect((await r.planillas.obtener(p.id))?.estado).toBe("ACREDITADA");
      });

      it("rechaza una fecha que no existe", async () => {
        await expect(
          r.planillas.crear({ clienteId, archivo: "x.xlsx", fecha: "2026-02-30" }),
        ).rejects.toBeInstanceOf(ErrorValidacion);
      });

      it("el mismo archivo del mismo cliente no entra dos veces", async () => {
        const huella = "a".repeat(64);
        await r.planillas.crear({
          clienteId, archivo: "repe.xlsx", fecha: "2026-09-08", sha256: huella,
        });
        await expect(
          r.planillas.crear({
            clienteId, archivo: "repe.xlsx", fecha: "2026-09-08", sha256: huella,
          }),
        ).rejects.toBeInstanceOf(ErrorValidacion);
        expect(await r.planillas.buscarPorHuella(clienteId, huella)).not.toBeNull();
      });
    });

    describe("transferencias", () => {
      it("el alta en lote devuelve las filas creadas, con cliente heredado", async () => {
        const p = await r.planillas.crear({
          clienteId, archivo: "lote.xlsx", fecha: "2026-09-08",
        });
        const creadas = await r.transferencias.crearLote(p.id, [
          filaNueva({ fila: 1 }), filaNueva({ fila: 2, importe: 250_000 }),
        ]);
        expect(creadas).toHaveLength(2);
        expect(creadas.every((o) => o.clienteId === clienteId)).toBe(true);
        // Nace abierta: es problema desde el día cero.
        expect(creadas[0].estado).toBe("PENDIENTE_NO_ENCONTRADA_EN_RANGO");
        expect(await r.transferencias.listar({ planillaId: p.id })).toHaveLength(2);
      });

      it("el filtro de abiertas deja afuera lo cerrado", async () => {
        const abiertas = await r.transferencias.listar({ soloAbiertas: true });
        expect(abiertas.every((o) => o.estado !== "ACREDITADA_EXACTA_CUIT")).toBe(true);
      });

      it("el importe sobrevive al viaje sin perder centavos", async () => {
        const p = await r.planillas.crear({
          clienteId, archivo: "centavos.xlsx", fecha: "2026-09-08",
        });
        const [o] = await r.transferencias.crearLote(p.id, [filaNueva({ importe: 153_500.55 })]);
        expect((await r.transferencias.obtener(o.id))?.importe).toBe(153_500.55);
      });
    });

    describe("informes y acreditaciones", () => {
      it("incorporar el mismo informe dos veces no duplica el pozo", async () => {
        const filas = [{
          cuit: "20305555550", fecha: "2026-09-08", importe: 100_000,
          banco: "X", descripcion: "Transf Recibida", row: 1,
        }];
        const i1 = await r.informes.registrar({
          archivo: "inf.xls", desde: "2026-09-08", hasta: "2026-09-08", origen: "MANUAL",
        });
        const primera = await r.acreditaciones.incorporar(i1.id, filas);

        const i2 = await r.informes.registrar({
          archivo: "inf.xls", desde: "2026-09-08", hasta: "2026-09-08", origen: "MANUAL",
        });
        const segunda = await r.acreditaciones.incorporar(i2.id, filas);

        expect(primera.nuevas).toBe(1);
        // Los informes se superponen por diseño: el mismo registro llega
        // varias veces y no puede cargarse dos veces.
        expect(segunda.nuevas).toBe(0);
      });

      it("rechaza un rango que termina antes de empezar", async () => {
        await expect(
          r.informes.registrar({
            archivo: "x.xls", desde: "2026-09-10", hasta: "2026-09-01", origen: "MANUAL",
          }),
        ).rejects.toBeInstanceOf(ErrorValidacion);
      });
    });

    describe("resoluciones e identidades", () => {
      it("una resolución se guarda con actor, momento y estado previo", async () => {
        const p = await r.planillas.crear({
          clienteId, archivo: "res.xlsx", fecha: "2026-09-08",
        });
        const [o] = await r.transferencias.crearLote(p.id, [filaNueva()]);

        await r.conciliacion.registrarResolucion({
          operacionId: o.id,
          decision: "MANTENER_PENDIENTE",
          origen: "HUMANA",
          estadoPrevio: o.estado,
          acreditacionId: null,
          actor: "mati@nordelta.com",
          momento: "2026-09-10T10:00:00",
          motivo: "espero al cliente",
          mapeoId: null,
        });

        const guardadas = (await r.conciliacion.resoluciones())
          .filter((x) => x.operacionId === o.id);
        expect(guardadas).toHaveLength(1);
        // No alcanza con «resuelto = true»: hace falta poder auditar quién,
        // cuándo y desde qué estado.
        expect(guardadas[0]).toMatchObject({
          actor: "mati@nordelta.com",
          origen: "HUMANA",
          estadoPrevio: "PENDIENTE_NO_ENCONTRADA_EN_RANGO",
          motivo: "espero al cliente",
        });
      });

      it("una identidad ya confirmada no se pisa en silencio", async () => {
        const base = {
          clienteId, identificacion: "30555555", cuit: "20305555550",
          actor: "mati@nordelta.com", momento: "2026-09-10T10:00:00",
          origen: "RESOLUCION" as const,
        };
        const a = await r.conciliacion.registrarMapeo(base);
        const b = await r.conciliacion.registrarMapeo({ ...base, cuit: "27305555555" });
        // Cambiar a qué CUIT apunta un depositante es una decisión
        // distinta y tiene que ser explícita, no un efecto secundario.
        expect(b.id).toBe(a.id);
        expect(b.cuit).toBe("20305555550");
      });

      it("los usos de una identidad se pueden actualizar", async () => {
        const [m] = await r.conciliacion.mapeos();
        await r.conciliacion.actualizarUsosDeMapeo(new Map([[m.id, 7]]));
        expect((await r.conciliacion.mapeos()).find((x) => x.id === m.id)?.usos).toBe(7);
      });
    });

    describe("corridas e historial", () => {
      it("una corrida se registra y se lee, la más nueva primero", async () => {
        await r.conciliacion.registrarCorrida({
          momento: "2026-09-10T10:00:00", disparador: "MANUAL",
          operacionesEvaluadas: 3, nuevasAcreditadas: 1, porMapeo: 0, pendientesAlCierre: 2,
        });
        await r.conciliacion.registrarCorrida({
          momento: "2026-09-10T11:00:00", disparador: "IMPORTACION_INFORME",
          operacionesEvaluadas: 3, nuevasAcreditadas: 0, porMapeo: 0, pendientesAlCierre: 2,
        });
        const corridas = await r.conciliacion.corridas(2);
        expect(corridas[0].disparador).toBe("IMPORTACION_INFORME");
      });

      it("los eventos quedan asociados a su transferencia", async () => {
        const p = await r.planillas.crear({
          clienteId, archivo: "hist.xlsx", fecha: "2026-09-08",
        });
        const [o] = await r.transferencias.crearLote(p.id, [filaNueva()]);
        await r.conciliacion.registrarEventos([{
          operacionId: o.id, momento: "2026-09-10T12:00:00",
          de: "PENDIENTE_NO_ENCONTRADA_EN_RANGO", a: "ACREDITADA_MANUAL",
          motivo: "confirmada", actor: "mati@nordelta.com", origen: "RESOLUCION",
        }]);
        const historial = await r.conciliacion.eventos(o.id);
        expect(historial).toHaveLength(1);
        expect(historial[0].a).toBe("ACREDITADA_MANUAL");
      });
    });
  });
}

/* ── Implementación local ───────────────────────────────────── */

const { repositoriosLocales } = await import("../../src/lib/data/local");
const { almacenOps } = await import("../../src/lib/data/almacen-operaciones");

suiteDeContrato("almacén local", async () => {
  // Se arranca de un estado conocido: el contrato no puede depender de lo
  // que haya dejado el dataset de demostración.
  almacenOps.estado.clientes = [];
  almacenOps.estado.planillas = [];
  almacenOps.estado.operaciones = [];
  almacenOps.estado.informes = [];
  almacenOps.estado.acreditaciones = [];
  almacenOps.estado.resoluciones = [];
  almacenOps.estado.mapeos = [];
  almacenOps.estado.eventos = [];
  almacenOps.estado.corridas = [];
  almacenOps.estado.clienteEmails = [];
  almacenOps.guardar();
  return repositoriosLocales();
});

afterAll(() => rmSync(DIR, { recursive: true, force: true }));
