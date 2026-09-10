/**
 * El recorrido completo, contra la capa de datos real.
 *
 * No es un test de unidad: es la demostración escrita como código. Recorre
 * lo mismo que se le muestra al cliente —entrar, filtrar, resolver, volver a
 * conciliar, importar— y verifica que **el sistema recuerda**. Si algún día
 * una resolución deja de persistir, el recorrido se cae acá y no delante de
 * Mati.
 *
 * Escribe en un directorio temporal propio: no toca el estado de la
 * demostración.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const DIR = mkdtempSync(join(tmpdir(), "nord-ops-"));
process.env.NORD_DATA_DIR = DIR;

type Datos = typeof import("../../src/lib/data/operaciones");
let d: Datos;

beforeAll(async () => {
  d = await import("../../src/lib/data/operaciones");
  await d.restablecerOperaciones();
});

afterAll(() => rmSync(DIR, { recursive: true, force: true }));

describe("1 · Mati entra y ve el estado", () => {
  it("los buckets suman el total, sin perder ni duplicar", async () => {
    const r = await d.getResumenOperativo();
    expect(r.conciliadas + r.resueltas + r.pendientes + r.revision + r.errores).toBe(r.total);
    expect(r.requierenAtencion).toBe(r.pendientes + r.revision + r.errores);
  });

  it("arranca en 497 / 455 / 42", async () => {
    const r = await d.getResumenOperativo();
    expect(r.total).toBe(497);
    expect(r.conciliadas).toBe(455);
    expect(r.requierenAtencion).toBe(42);
  });

  it("el monto acreditado más el que falta da el enviado", async () => {
    const r = await d.getResumenOperativo();
    expect(r.montoAcreditado + r.montoEnRiesgo).toBeCloseTo(r.montoEnviado, 2);
  });
});

describe("2 · Filtra la cola", () => {
  it("por bucket, por cliente y por antigüedad", async () => {
    const clientes = await d.getClientes();
    const todas = await d.getOperaciones();
    const pendientes = await d.getOperaciones({ bucket: "PENDIENTE" });
    const deUno = await d.getOperaciones({ bucket: "PENDIENTE", clienteId: clientes[0].id });
    expect(pendientes.length).toBeLessThan(todas.length);
    expect(deUno.every((o) => o.clienteId === clientes[0].id)).toBe(true);

    const viejas = await d.getOperaciones({ desdeDias: 15 });
    expect(viejas.every((o) => o.diasPendiente >= 15)).toBe(true);
  });

  it("ordena por antigüedad de mayor a menor", async () => {
    const filas = await d.getOperaciones({ bucket: "PENDIENTE" });
    for (let i = 1; i < filas.length; i++) {
      expect(filas[i - 1].diasPendiente).toBeGreaterThanOrEqual(filas[i].diasPendiente);
    }
  });

  it("busca por nombre y por identificación", async () => {
    const [alguna] = await d.getOperaciones({ bucket: "REVISION" });
    const porNombre = await d.getOperaciones({ texto: alguna.nombreDepositante!.split(" ")[0] });
    expect(porNombre.length).toBeGreaterThan(0);
    const porId = await d.getOperaciones({ texto: alguna.identificacionNormalizada });
    expect(porId.some((o) => o.id === alguna.id)).toBe(true);
  });
});

describe("3 · Resuelve una excepción y el sistema la recuerda", () => {
  let operacionId: string;

  it("confirmar un match ambiguo lo cierra como resuelto por una persona", async () => {
    const revision = await d.getOperaciones({ bucket: "REVISION" });
    const ambigua = revision.find((o) => o.estado === "MATCH_AMBIGUO" && o.candidatos.length > 0);
    expect(ambigua, "el dataset tiene que traer un match ambiguo").toBeDefined();
    operacionId = ambigua!.id;

    await d.resolverExcepcion({
      operacionId,
      decision: "CONFIRMAR_MATCH",
      acreditacionId: ambigua!.candidatos[0].id,
      actor: "mati@nordelta.com",
    });

    const despues = await d.getOperacion(operacionId);
    expect(despues.estado).toBe("ACREDITADA_MANUAL");
    expect(despues.bucket).toBe("RESUELTA");
    expect(despues.automatico).toBe(false);
  });

  it("volver a conciliar no la resucita como excepción", async () => {
    await d.reevaluarTodo("MANUAL");
    expect((await d.getOperacion(operacionId)).estado).toBe("ACREDITADA_MANUAL");
  });

  it("queda el historial de lo que pasó, cuándo y quién", async () => {
    const historial = await d.getHistorial(operacionId);
    const resolucion = historial.find((e) => e.origen === "RESOLUCION");
    expect(resolucion).toBeDefined();
    expect(resolucion!.a).toBe("ACREDITADA_MANUAL");
    expect(resolucion!.actor).toBe("mati@nordelta.com");
  });

  it("los buckets siguen sumando el total después de resolver", async () => {
    const r = await d.getResumenOperativo();
    expect(r.conciliadas + r.resueltas + r.pendientes + r.revision + r.errores).toBe(r.total);
    expect(r.resueltas).toBeGreaterThan(0);
  });
});

describe("4 · Aprende una identidad y la aplica sola después", () => {
  it("confirmar con «recordar» deja un mapeo acotado al cliente", async () => {
    const revision = await d.getOperaciones({ bucket: "REVISION" });
    const identidad = revision.find(
      (o) => o.estado === "IDENTITY_MAPPING_REQUIRED" && o.candidatos.length > 0,
    );
    expect(identidad, "el dataset tiene que traer un caso de identidad").toBeDefined();

    await d.resolverExcepcion({
      operacionId: identidad!.id,
      decision: "CONFIRMAR_MATCH",
      acreditacionId: identidad!.candidatos[0].id,
      aprenderIdentidad: true,
      actor: "mati@nordelta.com",
    });

    const mapeos = await d.getMapeos();
    expect(mapeos).toHaveLength(1);
    expect(mapeos[0].clienteId).toBe(identidad!.clienteId);
    expect(mapeos[0].identificacion).toBe(identidad!.identificacionNormalizada);
    // El CUIT guardado es uno **real**, que vino de Fullcarga. No se fabrica.
    expect(mapeos[0].cuit).toBe(identidad!.candidatos[0].cuit);
  });

  it("una operación nueva con esa identificación acredita sola", async () => {
    const [mapeo] = await d.getMapeos();
    const cliente = mapeo.clienteId;

    // Llega una transferencia nueva del mismo depositante, y el informe la
    // trae con el CUIT real. Sin el mapeo quedaría en revisión; con él,
    // cierra sola. Ese es el efecto compuesto.
    await d.importarInforme("informe-posterior.xls", "2026-09-10", "2026-09-10", "MANUAL", [
      { cuit: mapeo.cuit, fecha: "2026-09-10", importe: 777_777, banco: "BANCO CIUDAD",
        descripcion: "Transf Recibida", row: 9001 },
    ]);

    const { planilla } = await d.crearPlanilla(cliente, "posterior.xlsx", "2026-09-10", [
      { fila: 1, fechaDeposito: "2026-09-10", banco: "BANCO CIUDAD",
        nombreDepositante: "Depositante Conocido",
        identificacionOriginal: mapeo.identificacion,
        identificacionNormalizada: mapeo.identificacion,
        tipoIdentificacion: "DNI_PROBABLE", importe: 777_777, numeroDeposito: "9000001" },
    ]);

    const [op] = await d.getOperaciones({ planillaId: planilla.id });
    expect(op.estado).toBe("ACREDITADA_EXACTA_CUIT");
    expect(op.viaMapeo).toBe(true);

    const mapeos = await d.getMapeos();
    expect(mapeos[0].usos).toBeGreaterThan(0);
  });
});

describe("5 · Un pendiente encuentra acreditación con el informe siguiente", () => {
  it("cambia de estado sin que nadie lo vuelva a cargar", async () => {
    const antes = await d.getResumenOperativo();
    const pendiente = (await d.getOperaciones({ bucket: "PENDIENTE" }))
      .find((o) => o.tipoIdentificacion === "CUIT_VALIDO");
    expect(pendiente).toBeDefined();

    const { corrida } = await d.importarInforme(
      "informe-nuevo.xls", pendiente!.fechaDeposito, pendiente!.fechaDeposito, "AUTOMATICO",
      [{ cuit: pendiente!.identificacionNormalizada, fecha: pendiente!.fechaDeposito,
         importe: pendiente!.importe, banco: "BANCO GALICIA",
         descripcion: "Transf Recibida", row: 9101 }],
    );

    expect(corrida.nuevasAcreditadas).toBeGreaterThan(0);
    expect((await d.getOperacion(pendiente!.id)).estado).toBe("ACREDITADA_EXACTA_CUIT");

    const despues = await d.getResumenOperativo();
    expect(despues.pendientes).toBeLessThan(antes.pendientes);
  });

  it("el mismo informe cargado dos veces no duplica registros", async () => {
    const fila = { cuit: "20305555550", fecha: "2026-09-07", importe: 12_345,
      banco: "X", descripcion: "Transf Recibida", row: 9201 };
    const a = await d.importarInforme("repetido.xls", "2026-09-07", "2026-09-07", "MANUAL", [fila]);
    const b = await d.importarInforme("repetido.xls", "2026-09-07", "2026-09-07", "MANUAL", [fila]);
    expect(a.nuevas).toBe(1);
    expect(b.nuevas).toBe(0);
  });
});

describe("6 · Importar una planilla nueva", () => {
  it("registra también lo que está mal, en vez de descartarlo", async () => {
    const clientes = await d.getClientes();
    const { planilla } = await d.crearPlanilla(clientes[1].id, "con-error.xlsx", "2026-09-10", [
      { fila: 1, fechaDeposito: "2026-09-10", banco: "BANCO NACION", nombreDepositante: "Alguien",
        // Verificador cambiado: tiene que salir marcado, no corregido.
        identificacionOriginal: "20305555551", identificacionNormalizada: "20305555551",
        tipoIdentificacion: "IDENTIFICACION_INVALIDA", importe: 500_000, numeroDeposito: "7000001" },
      { fila: 2, fechaDeposito: "2026-09-10", banco: "BANCO NACION", nombreDepositante: "Otra",
        identificacionOriginal: "27305555555", identificacionNormalizada: "27305555555",
        tipoIdentificacion: "CUIT_VALIDO", importe: 250_000, numeroDeposito: "7000002" },
    ]);

    const ops = await d.getOperaciones({ planillaId: planilla.id });
    expect(ops).toHaveLength(2);
    const conError = ops.find((o) => o.bucket === "ERROR")!;
    expect(conError.estado).toBe("ERROR_CUIT");
    // Lo que mandó el cliente se conserva tal cual.
    expect(conError.identificacionOriginal).toBe("20305555551");
  });

  it("la planilla con un error no pasa a cuenta corriente", async () => {
    const clientes = await d.getClientes();
    const planillas = await d.getPlanillas(clientes[1].id);
    const p = planillas.find((x) => x.archivo === "con-error.xlsx")!;
    expect(p.estado).toBe("CON_ERRORES");
    expect(p.listaParaCtaCte).toBe(false);
  });
});

describe("7 · Estado por cliente", () => {
  it("enviado = acreditado + pendiente + error, sin plata que se pierda", async () => {
    // La plata parada en una fila con el CUIT mal sigue siendo plata que el
    // cliente dice haber mandado. Si no cierra la suma, hay un importe que
    // no está en ninguna columna y nadie lo va a buscar.
    const clientes = await d.getClientesConEstado();
    for (const c of clientes) {
      expect(c.acreditado + c.pendiente + c.montoError).toBeCloseTo(c.enviado, 2);
    }
  });

  it("los totales por cliente suman el total general", async () => {
    const clientes = await d.getClientesConEstado();
    const resumen = await d.getResumenOperativo();
    const suma = clientes.reduce((a, c) => a + c.operaciones, 0);
    expect(suma).toBe(resumen.total);
  });
});

describe("8 · Persistencia entre reinicios", () => {
  it("el estado sobrevive a que se vuelva a instanciar el almacén", async () => {
    const antes = await d.getResumenOperativo();
    const mapeosAntes = await d.getMapeos();

    // Se descarta la instancia en memoria: es lo que pasa al reiniciar el
    // servidor. Si la resolución de Mati viviera solo en RAM, se perdería.
    const clave = Symbol.for("nordelta.almacen.operaciones");
    delete (globalThis as unknown as Record<symbol, unknown>)[clave];
    vi.resetModules();
    const recargado: Datos = await import("../../src/lib/data/operaciones");

    const despues = await recargado.getResumenOperativo();
    expect(despues.total).toBe(antes.total);
    expect(despues.resueltas).toBe(antes.resueltas);
    expect((await recargado.getMapeos()).length).toBe(mapeosAntes.length);
  });
});

describe("9 · No se puede acreditar contra un registro arbitrario", () => {
  it("rechaza confirmar una acreditación que no es candidata de esa operación", async () => {
    // Una Server Action es un POST alcanzable por cualquiera. Si el
    // identificador que llega se aceptara sin más, se podría acreditar una
    // operación contra cualquier registro del pozo.
    const [pendiente] = await d.getOperaciones({ bucket: "PENDIENTE" });
    const otra = (await d.getOperaciones({ bucket: "CONCILIADA" }))
      .find((o) => o.acreditacionId)!;

    await expect(
      d.resolverExcepcion({
        operacionId: pendiente.id,
        decision: "CONFIRMAR_MATCH",
        acreditacionId: otra.acreditacionId!,
      }),
    ).rejects.toThrow(/candidata/i);

    expect((await d.getOperacion(pendiente.id)).estado)
      .toBe("PENDIENTE_NO_ENCONTRADA_EN_RANGO");
  });

  it("y confirmar sin elegir nada tampoco pasa", async () => {
    const [alguna] = await d.getOperaciones({ bucket: "REVISION" });
    await expect(
      d.resolverExcepcion({ operacionId: alguna.id, decision: "CONFIRMAR_MATCH" }),
    ).rejects.toThrow(/elegir/i);
  });
});
