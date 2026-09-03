"use server";

import { revalidatePath } from "next/cache";
import { exigirSesion } from "@/lib/auth";
import { crearMovimientos, type MovimientoNuevo } from "@/lib/data";
import { aResultadoError, type Resultado } from "@/lib/domain/errors";
import { CATEGORIAS, MEDIOS_PAGO, MONEDAS } from "@/lib/domain/types";
import { conObservabilidad } from "@/lib/observabilidad";
import type { Categoria, MedioPago, Moneda } from "@/lib/domain/types";

/** Forma cruda que envía la grilla. Todo llega como texto: es lo que el
 *  operador tipeó o pegó, y no se confía en nada de eso. */
export interface FilaParaGuardar {
  contraparte: string;
  concepto: string;
  categoria: string;
  medio_pago: string;
  moneda: string;
  monto: number;
  tipo_cambio: number | null;
  comision_pct: number | null;
}

/**
 * Guarda las filas cargadas del día.
 *
 * `exigirSesion()` va primero y no es negociable: una Server Action es un
 * POST alcanzable por cualquiera que pueda armar el request, así que no
 * renderizar la grilla no protege nada. Lo dice la documentación de Next.
 *
 * Cada fila de la grilla es un movimiento con una partida. Los movimientos
 * de varias patas —el caso de la operación mixta— se cargan agrupando filas
 * por `grupo`, y la validación completa corre antes de escribir la primera.
 */
export async function guardarFilas(
  fecha: string,
  oficinaId: number,
  filas: FilaParaGuardar[],
): Promise<Resultado<{ creados: number }>> {
  try {
    const sesion = await exigirSesion();

    if (filas.length === 0) return { ok: true, datos: { creados: 0 } };

    return await conObservabilidad(
      "carga.guardar",
      { usuario: sesion.userId, contexto: { oficina_id: oficinaId, filas: filas.length } },
      async () => await guardar(fecha, oficinaId, filas),
    );
  } catch (e) {
    return aResultadoError(e);
  }
}

/** El guardado en sí, separado para que la observabilidad lo envuelva. */
async function guardar(
  fecha: string,
  oficinaId: number,
  filas: FilaParaGuardar[],
): Promise<Resultado<{ creados: number }>> {
  {

    const entradas: MovimientoNuevo[] = filas.map((f) => {
      // Se revalida el enum del lado del servidor: el cliente pudo mandar
      // cualquier cosa, y una categoría inventada rompería la regla de
      // afectación a cuenta corriente.
      const categoria = CATEGORIAS.includes(f.categoria as Categoria)
        ? (f.categoria as Categoria) : null;
      const medio = MEDIOS_PAGO.includes(f.medio_pago as MedioPago)
        ? (f.medio_pago as MedioPago) : null;
      const moneda = MONEDAS.includes(f.moneda as Moneda)
        ? (f.moneda as Moneda) : null;

      if (!categoria || !medio || !moneda) {
        throw Object.assign(new Error("Valor fuera del dominio"), { fila: f });
      }

      return {
        fecha,
        oficina_id: oficinaId,
        contraparte: f.contraparte,
        concepto: f.concepto,
        categoria,
        partidas: [{
          medio_pago: medio,
          moneda_nominal: moneda,
          monto_nominal: f.monto,
          tipo_cambio: f.tipo_cambio,
          comision_pct: f.comision_pct,
        }],
      };
    });

    const creados = await crearMovimientos(entradas);
    revalidatePath("/carga");
    revalidatePath("/balance");
    revalidatePath("/inicio");

    return { ok: true, datos: { creados: creados.length } };
  }
}
