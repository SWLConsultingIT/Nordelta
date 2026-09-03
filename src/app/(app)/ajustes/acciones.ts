"use server";

import { revalidatePath } from "next/cache";
import { exigirSesion } from "@/lib/auth";
import { ajustarCuentaACero, getContraparte } from "@/lib/data";
import { aResultadoError, ErrorValidacion, type Resultado } from "@/lib/domain/errors";
import { MONEDAS, type Moneda } from "@/lib/domain/types";
import { esFechaISOValida } from "@/lib/format";
import { registrar, nuevaCorrelacion } from "@/lib/observabilidad";

/**
 * Registra un ajuste que lleva una cuenta corriente a cero.
 *
 * No toca ningún saldo: **genera un movimiento contable explícito** con
 * categoría `ajuste_cierre` y una partida por moneda. Después, la vista
 * detecta el cierre por sí sola porque las cuatro monedas quedan en cero.
 *
 * Los montos vienen del cliente pero se validan acá igual: el signo, el
 * rango y las monedas. Y el movimiento queda auditado como cualquier otro.
 */
export async function registrarAjuste(entrada: {
  contraparteId: number;
  oficinaId: number;
  fecha: string;
  concepto: string;
  montos: Partial<Record<Moneda, number>>;
}): Promise<Resultado<{ movimientoId: string | null; patas: number }>> {
  const correlacion = nuevaCorrelacion();
  try {
    const sesion = await exigirSesion();

    if (!esFechaISOValida(entrada.fecha)) {
      throw new ErrorValidacion("La fecha no es válida", "fecha");
    }
    await getContraparte(entrada.contraparteId); // 404 si no existe

    const limpios: Partial<Record<Moneda, number>> = {};
    for (const m of MONEDAS) {
      const v = entrada.montos[m];
      if (v === undefined || v === 0) continue;
      if (!Number.isFinite(v)) {
        throw new ErrorValidacion(`El monto en ${m} no es un número`, "montos");
      }
      // `ajustarCuentaACero` invierte el signo, así que acá se recibe el
      // saldo a cancelar y no el ajuste ya invertido.
      limpios[m] = v;
    }

    if (Object.keys(limpios).length === 0) {
      throw new ErrorValidacion("No hay ninguna moneda con saldo para ajustar", "montos");
    }

    const mov = await ajustarCuentaACero(
      entrada.contraparteId,
      entrada.oficinaId,
      entrada.fecha,
      entrada.concepto.trim() || "Cierre de cuenta corriente",
      limpios,
    );

    revalidatePath("/ajustes");
    revalidatePath("/balance");
    revalidatePath(`/cuentas/${entrada.contraparteId}`);

    registrar("info", "ajuste.registrar", {
      correlacion,
      usuario: sesion.userId,
      contexto: {
        contraparte_id: entrada.contraparteId,
        oficina_id: entrada.oficinaId,
        movimiento_id: mov?.id ?? null,
        patas: Object.keys(limpios).length,
      },
    });

    return {
      ok: true,
      datos: { movimientoId: mov?.id ?? null, patas: Object.keys(limpios).length },
    };
  } catch (e) {
    registrar("error", "ajuste.registrar", {
      correlacion,
      contexto: { contraparte_id: entrada.contraparteId, oficina_id: entrada.oficinaId },
      error: e,
    });
    return aResultadoError(e);
  }
}
