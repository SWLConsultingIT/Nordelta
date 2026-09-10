"use server";

import { revalidatePath } from "next/cache";
import { exigirSesion } from "@/lib/auth";
import { aResultadoError, type Resultado } from "@/lib/domain/errors";
import {
  getInformes, importarInforme, reevaluarTodo, resolverExcepcion,
  type EntradaResolucion,
} from "@/lib/data/operaciones";
import type { Corrida } from "@/lib/operaciones/tipos";
import { hayCredenciales, leerConfiguracion } from "@/lib/fullcarga/config";
import { acreditacionesConciliables, parsearInforme } from "@/lib/fullcarga/informe";
import { almacenDeArchivos, sha256 } from "@/lib/data/almacenamiento";
import { sumarDias } from "@/lib/operaciones/fechas";
import { hoyISO } from "@/lib/format";

/**
 * Acciones del módulo operativo.
 *
 * `exigirSesion()` va primero en todas y no es negociable: una Server Action
 * es un POST alcanzable por cualquiera que arme el request, así que no
 * renderizar el botón no protege nada.
 */

/** Todo lo que cambia el estado invalida las mismas pantallas. */
function refrescar() {
  for (const ruta of ["/conciliacion", "/planillas", "/clientes", "/inicio", "/fullcarga"]) {
    revalidatePath(ruta, "layout");
  }
}

/** Qué pasó con Fullcarga durante la actualización. */
export type EstadoFullcarga = "ACTUALIZADO" | "SIN_NOVEDADES" | "SIN_CREDENCIALES" | "FALLO";

export interface ResultadoActualizacion {
  corrida: Corrida;
  fullcarga: EstadoFullcarga;
  /** Explicación para mostrar, sin detalles técnicos. */
  detalle: string | null;
  acreditacionesNuevas: number;
}

/**
 * Cuánto se pide hacia atrás cuando ya hay informes cargados.
 *
 * Los informes de Fullcarga se superponen por diseño: el de un día sigue
 * creciendo mientras el día está abierto. Pedir una semana hacia atrás
 * cuesta lo mismo y evita perder registros que entraron tarde. Los
 * repetidos no se cargan dos veces.
 */
const SOLAPE_DIAS = 7;

/**
 * «Actualizar conciliación».
 *
 * Un solo botón que hace todo el trabajo: trae el informe de Fullcarga si
 * hay credenciales, lo parsea, incorpora las acreditaciones nuevas y
 * vuelve a conciliar todo lo que sigue abierto.
 *
 * Antes eran cuatro pasos en dos pantallas, y no había ninguna razón de
 * producto para que lo fueran: son cuatro pasos **del sistema**, no de
 * quien concilia.
 *
 * Si Fullcarga no está configurado o no responde, **la acción no falla**:
 * vuelve a conciliar igual contra lo que ya está en el pozo y lo informa.
 * Que un sistema del que dependemos y que no controlamos se caiga no
 * puede dejar a nadie sin poder trabajar.
 */
export async function accionActualizar(): Promise<Resultado<ResultadoActualizacion>> {
  try {
    await exigirSesion();

    let fullcarga: EstadoFullcarga = "SIN_CREDENCIALES";
    let detalle: string | null = null;
    let nuevas = 0;

    if (hayCredenciales()) {
      try {
        const informes = await getInformes();
        const hoy = hoyISO();
        // Desde donde llegó el último informe, con solape; o la última
        // semana si es la primera vez.
        const desde = informes[0]
          ? sumarDias(informes[0].hasta, -SOLAPE_DIAS)
          : sumarDias(hoy, -SOLAPE_DIAS);

        const { DescargadorHTTP } = await import("@/lib/fullcarga/descargador");
        const descarga = await new DescargadorHTTP(leerConfiguracion())
          .descargarInforme({ desde, hasta: hoy });

        const parseado = parsearInforme(descarga.bytes, { sourceFile: descarga.filename });
        const filas = acreditacionesConciliables(parseado).map((a) => ({
          cuit: a.cuit, fecha: a.fecha, importe: a.importe,
          banco: a.banco, descripcion: a.descripcion, row: a.row,
        }));

        // El original se conserva: es la prueba de qué devolvió Fullcarga.
        const almacen = await almacenDeArchivos();
        await almacen.guardar("informes", descarga.filename, descarga.bytes);

        const r = await importarInforme(
          descarga.filename, desde, hoy, "AUTOMATICO", filas, sha256(descarga.bytes),
        );
        nuevas = r.nuevas;
        fullcarga = r.nuevas > 0 ? "ACTUALIZADO" : "SIN_NOVEDADES";
        refrescar();
        return {
          ok: true,
          datos: { corrida: r.corrida, fullcarga, detalle, acreditacionesNuevas: nuevas },
        };
      } catch (e) {
        // No se propaga: se concilia igual con lo que ya hay.
        fullcarga = "FALLO";
        detalle = e instanceof Error ? e.message : "No se pudo consultar Fullcarga";
      }
    }

    const corrida = await reevaluarTodo("MANUAL");
    refrescar();
    return { ok: true, datos: { corrida, fullcarga, detalle, acreditacionesNuevas: nuevas } };
  } catch (e) {
    return aResultadoError(e);
  }
}

export async function accionResolver(entrada: EntradaResolucion): Promise<Resultado<Corrida>> {
  try {
    const sesion = await exigirSesion();
    const corrida = await resolverExcepcion({ ...entrada, actor: sesion?.email ?? entrada.actor });
    refrescar();
    return { ok: true, datos: corrida };
  } catch (e) {
    return aResultadoError(e);
  }
}
