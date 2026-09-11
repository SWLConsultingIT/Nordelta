"use server";

import { revalidatePath } from "next/cache";
import { exigirSesion } from "@/lib/auth";
import { aResultadoError, ErrorValidacion, type Resultado } from "@/lib/domain/errors";
import { importarInforme, type AcreditacionNueva } from "@/lib/data/operaciones";
import { acreditacionesConciliables, parsearInforme } from "@/lib/fullcarga/informe";
import { hayCredenciales, leerConfiguracion } from "@/lib/fullcarga/config";
import { esFechaCalendario } from "@/lib/fullcarga/fechas";
import { almacenDeArchivos, validarArchivo } from "@/lib/data/almacenamiento";
import type { Informe } from "@/lib/operaciones/tipos";

/**
 * Entrada de informes de Fullcarga.
 *
 * Hay dos caminos —el descargador automático y el archivo subido a mano— y
 * **desembocan en el mismo lugar**: los dos parsean con el mismo código y
 * entran por `importarInforme`. Que el fallback manual recorriera otro
 * camino sería garantizar que se comporte distinto justo el día que hace
 * falta.
 */

export interface ResultadoImporte {
  informe: Informe;
  acreditacionesLeidas: number;
  nuevas: number;
  nuevasAcreditadas: number;
  pendientes: number;
}

function aFilas(bytes: Buffer, archivo: string): { filas: AcreditacionNueva[]; leidas: number } {
  const informe = parsearInforme(bytes, { sourceFile: archivo });
  const conciliables = acreditacionesConciliables(informe);
  return {
    leidas: informe.filas.length,
    filas: conciliables.map((a) => ({
      cuit: a.cuit,
      fecha: a.fecha,
      importe: a.importe,
      banco: a.banco,
      descripcion: a.descripcion,
      row: a.row,
    })),
  };
}

async function guardar(
  archivo: string, bytes: Buffer, desde: string, hasta: string, origen: Informe["origen"],
): Promise<Resultado<ResultadoImporte>> {
  const { filas, leidas } = aFilas(bytes, archivo);
  if (filas.length === 0) {
    throw new ErrorValidacion(
      `Se leyeron ${leidas} filas pero ninguna es una acreditación conciliable. ¿Es el informe de Ingresos y Créditos?`,
      "archivo",
    );
  }

  // El informe original se conserva igual que la planilla del cliente.
  const almacen = await almacenDeArchivos();
  const original = await almacen.guardar("fullcarga", archivo, bytes);

  const { informe, corrida, nuevas } = await importarInforme(
    archivo, desde, hasta, origen, filas, original.sha256, original.ruta,
  );
  for (const ruta of ["/conciliacion", "/planillas", "/clientes", "/inicio", "/fullcarga"]) {
    revalidatePath(ruta, "layout");
  }
  return {
    ok: true,
    datos: {
      informe,
      acreditacionesLeidas: filas.length,
      nuevas,
      nuevasAcreditadas: corrida.nuevasAcreditadas,
      pendientes: corrida.pendientesAlCierre,
    },
  };
}

/** ¿Están las credenciales en el entorno? Nunca se devuelve el valor. */
export async function accionHayCredenciales(): Promise<boolean> {
  await exigirSesion();
  return hayCredenciales();
}

/**
 * Descarga el informe de Fullcarga por HTTP.
 *
 * Las credenciales salen **solo** del entorno —`FULLCARGA_USERNAME` y
 * `FULLCARGA_PASSWORD`— y no pasan nunca por el navegador, ni por el
 * formulario, ni por un log. Si no están configuradas, no se intenta ningún
 * tráfico real.
 */
export async function accionDescargar(
  desde: string,
  hasta: string,
): Promise<Resultado<ResultadoImporte>> {
  try {
    await exigirSesion();
    if (!esFechaCalendario(desde) || !esFechaCalendario(hasta)) {
      throw new ErrorValidacion("Las fechas no son válidas", "desde");
    }
    if (!hayCredenciales()) {
      throw new ErrorValidacion(
        "No hay credenciales de Fullcarga en el entorno. Subí el informe a mano.",
        "credenciales",
      );
    }

    const { DescargadorHTTP } = await import("@/lib/fullcarga/descargador");
    const descargador = new DescargadorHTTP(leerConfiguracion());
    const informe = await descargador.descargarInforme({ desde, hasta });
    return await guardar(informe.filename, informe.bytes, desde, hasta, "AUTOMATICO");
  } catch (e) {
    return aResultadoError(e);
  }
}

/** Sube un informe descargado a mano. Mismo pipeline que el automático. */
export async function accionSubirInforme(datos: FormData): Promise<Resultado<ResultadoImporte>> {
  try {
    await exigirSesion();
    const archivo = datos.get("archivo");
    if (!(archivo instanceof File) || archivo.size === 0) {
      throw new ErrorValidacion("Elegí el archivo del informe", "archivo");
    }
    const desde = String(datos.get("desde") ?? "");
    const hasta = String(datos.get("hasta") ?? "");
    if (!esFechaCalendario(desde) || !esFechaCalendario(hasta)) {
      throw new ErrorValidacion("Indicá el rango de fechas del informe", "desde");
    }
    const bytes = Buffer.from(await archivo.arrayBuffer());
    // El informe de Fullcarga es un .xls clásico; también se verifica por
    // contenido y no por el nombre.
    validarArchivo(archivo.name, bytes, archivo.type);
    return await guardar(archivo.name, bytes, desde, hasta, "MANUAL");
  } catch (e) {
    return aResultadoError(e);
  }
}
