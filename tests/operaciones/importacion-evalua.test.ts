/**
 * Una planilla recién importada queda **evaluada**, no a la espera.
 *
 * El caso que lo motiva pasó de verdad: se importó una planilla con un
 * CUIT al que no le cierra el verificador y la fila quedó como «Pendiente
 * de acreditación · Monitorear». Es la peor clasificación posible para ese
 * dato, porque un CUIT inválido **no va a acreditar nunca**: la fila se
 * queda en la cola de espera para siempre y nadie le avisa al cliente, que
 * es justo lo único que había que hacer.
 *
 * Lo que se comprueba acá es el contrato del importador: cuando responde,
 * los estados ya son los definitivos. Sin «se arregla en la próxima
 * corrida», sin consistencia eventual que el operador no puede ver.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const DIR = mkdtempSync(join(tmpdir(), "nord-import-"));
process.env.NORD_DATA_DIR = DIR;

type Datos = typeof import("../../src/lib/data/operaciones");
let d: Datos;

/** CUIT de persona física con verificador correcto. */
const CUIT_OK = "20314456786";
/** Once dígitos, verificador mal: error de tipeo, no un CUIT. */
const CUIT_MAL = "23351129043";
const DNI_OK = "31445678";

const fila = (
  n: number,
  identificacion: string,
  tipo: "CUIT_VALIDO" | "DNI_PROBABLE" | "IDENTIFICACION_INVALIDA",
) => ({
  fila: n,
  fechaDeposito: "2026-09-13",
  banco: "BANCO NACION",
  nombreDepositante: `Depositante ${n}`,
  identificacionOriginal: identificacion,
  identificacionNormalizada: identificacion,
  tipoIdentificacion: tipo,
  importe: 100_000 + n,
  numeroDeposito: `900000${n}`,
});

beforeAll(async () => {
  d = await import("../../src/lib/data/operaciones");
  await d.restablecerOperaciones();
});

afterAll(() => rmSync(DIR, { recursive: true, force: true }));

describe("la importación evalúa lo que acaba de crear", () => {
  it("el CUIT inválido queda como error de datos, no como pendiente", async () => {
    const [cliente] = await d.getClientes();
    const { planilla } = await d.crearPlanilla(cliente.id, "mixta.xlsx", "2026-09-13", [
      fila(1, CUIT_OK, "CUIT_VALIDO"),
      fila(2, DNI_OK, "DNI_PROBABLE"),
      fila(3, CUIT_MAL, "IDENTIFICACION_INVALIDA"),
    ]);

    const ops = await d.getOperaciones({ planillaId: planilla.id });
    const mala = ops.find((o) => o.identificacionNormalizada === CUIT_MAL)!;

    expect(mala.estado, "un CUIT con el verificador mal no es un pendiente").toBe("ERROR_CUIT");
  });

  it("ninguna fila queda sin evaluar", async () => {
    const [cliente] = await d.getClientes();
    const { planilla } = await d.crearPlanilla(cliente.id, "otra.xlsx", "2026-09-13", [
      fila(4, CUIT_OK, "CUIT_VALIDO"),
      fila(5, DNI_OK, "DNI_PROBABLE"),
      fila(6, CUIT_MAL, "IDENTIFICACION_INVALIDA"),
    ]);

    const ops = await d.getOperaciones({ planillaId: planilla.id });
    expect(ops).toHaveLength(3);

    for (const o of ops) {
      // `intentos` es el contador del motor: en cero significa que la fila
      // nunca pasó por el matcher, por más que tenga un estado escrito.
      expect(o.intentos, `la fila ${o.fila} no se evaluó`).toBeGreaterThan(0);
      expect(o.motivo, `la fila ${o.fila} no tiene explicación`).not.toBe("");
    }
  });

  it("la corrida que devuelve incluye a las filas nuevas", async () => {
    const [cliente] = await d.getClientes();
    const antes = await d.getResumenOperativo();
    const { corrida } = await d.crearPlanilla(cliente.id, "tercera.xlsx", "2026-09-13", [
      fila(7, CUIT_MAL, "IDENTIFICACION_INVALIDA"),
    ]);
    const despues = await d.getResumenOperativo();

    expect(despues.total).toBe(antes.total + 1);
    expect(despues.errores, "el error nuevo tiene que contarse").toBe(antes.errores + 1);
    // `operacionesEvaluadas` cuenta las abiertas, no el total: lo cerrado no
    // se vuelve a mirar. Lo que importa es que la fila nueva estuvo entre
    // ellas, y eso ya lo dice el conteo de errores de arriba.
    expect(corrida.operacionesEvaluadas).toBeGreaterThan(0);
  });
});
