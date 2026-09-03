"use server";

import { revalidatePath } from "next/cache";
import { exigirSesion } from "@/lib/auth";
import { actualizarMovimiento } from "@/lib/data";
import { aResultadoError, type Resultado } from "@/lib/domain/errors";
import { CATEGORIAS, type Categoria } from "@/lib/domain/types";
import { registrar, nuevaCorrelacion } from "@/lib/observabilidad";

/**
 * Edita la cabecera de un movimiento.
 *
 * Las partidas no se tocan acá: cambiar importes es una operación distinta y
 * de más riesgo. Editar el concepto o la categoría es lo que se necesita a
 * diario, y el cambio se refleja en el saldo, el balance y la auditoría.
 */
export async function editarMovimiento(
  id: string,
  cambios: { concepto?: string; categoria?: string },
  motivo?: string,
): Promise<Resultado<{ id: string }>> {
  const correlacion = nuevaCorrelacion();
  try {
    const sesion = await exigirSesion();

    const categoria = cambios.categoria
      ? CATEGORIAS.includes(cambios.categoria as Categoria)
        ? (cambios.categoria as Categoria)
        : undefined
      : undefined;

    const m = await actualizarMovimiento(
      id,
      { concepto: cambios.concepto?.trim(), categoria },
      motivo,
    );

    registrar("info", "movimiento.editar", {
      correlacion,
      usuario: sesion.userId,
      contexto: { movimiento_id: id, cambio_categoria: categoria ?? null },
    });

    revalidatePath("/cuentas", "layout");
    revalidatePath("/balance");
    revalidatePath("/auditoria");
    revalidatePath("/inicio");

    return { ok: true, datos: { id: m.id } };
  } catch (e) {
    registrar("error", "movimiento.editar", {
      correlacion, contexto: { movimiento_id: id }, error: e,
    });
    return aResultadoError(e);
  }
}
