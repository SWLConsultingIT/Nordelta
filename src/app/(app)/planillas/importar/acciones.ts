"use server";

import { revalidatePath } from "next/cache";
import { exigirSesion } from "@/lib/auth";
import { aResultadoError, ErrorValidacion, type Resultado } from "@/lib/domain/errors";
import { crearPlanilla, type OperacionNueva } from "@/lib/data/operaciones";
import { parsearPlanillaCliente } from "@/lib/planillas/cliente";
import { almacenDeArchivos, validarArchivo } from "@/lib/data/almacenamiento";
import type { ClientTransfer } from "@/lib/planillas/cliente";

/**
 * Importación de la planilla de un cliente.
 *
 * El principio es que **el usuario no tiene que limpiar el Excel**. Se lee lo
 * que mandó el cliente tal cual llegó: se ubica el encabezado aunque no esté
 * en la primera fila, se aceptan columnas de más, se normalizan CUIT con
 * guiones e importes con formato argentino, y **ninguna fila se descarta en
 * silencio** —las que no sirven salen marcadas—.
 *
 * La previsualización y la importación parsean el mismo archivo con el mismo
 * código. El archivo se vuelve a subir al confirmar en lugar de guardar el
 * resultado del paso anterior: así lo que se importa es exactamente lo que se
 * mostró, y no hay estado temporal que pueda quedar viejo.
 */

export interface FilaPrevia {
  fila: number;
  fecha: string | null;
  nombre: string | null;
  identificacion: string;
  tipo: ClientTransfer["tipoIdentificacion"];
  importe: number | null;
  estado: ClientTransfer["validationStatus"];
  errores: string[];
}

export interface Previsualizacion {
  archivo: string;
  hoja: string;
  filaEncabezado: number;
  columnasFaltantes: string[];
  columnasDesconocidas: string[];
  filasOcultas: number;
  celdasCombinadas: number;
  celdasConFormula: number;
  total: number;
  listas: number;
  conProblema: number;
  /** Sugerida: la fecha de depósito más reciente del archivo. */
  fecha: string;
  totalImporte: number;
  filas: FilaPrevia[];
}

/**
 * Lee y **verifica** el archivo subido.
 *
 * La extensión y el tipo declarado los elige quien sube el archivo, así
 * que no deciden nada: lo que decide es la firma en los primeros bytes.
 * `validarArchivo` también acota el tamaño y rechaza un nombre con ruta.
 */
async function leerArchivo(datos: FormData): Promise<{ nombre: string; bytes: Buffer }> {
  const archivo = datos.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    throw new ErrorValidacion("Elegí un archivo .xlsx", "archivo");
  }
  const bytes = Buffer.from(await archivo.arrayBuffer());
  const { extension } = validarArchivo(archivo.name, bytes, archivo.type);
  if (extension !== ".xlsx") {
    throw new ErrorValidacion(
      "La planilla del cliente tiene que ser .xlsx. Guardala de nuevo con ese formato.",
      "archivo",
    );
  }
  return { nombre: archivo.name, bytes };
}

function analizar(nombre: string, bytes: Buffer, alias: string): Previsualizacion {
  const p = parsearPlanillaCliente(bytes, { sourceFile: nombre, clientAlias: alias });

  const filas: FilaPrevia[] = p.transferencias.map((t) => ({
    fila: t.sourceRow + 1,
    fecha: t.fechaDeposito,
    nombre: t.nombreDepositante,
    identificacion: t.identificacionOriginal,
    tipo: t.tipoIdentificacion,
    importe: t.importe,
    estado: t.validationStatus,
    errores: t.validationErrors,
  }));

  const fechas = p.transferencias.map((t) => t.fechaDeposito).filter((f): f is string => Boolean(f));
  return {
    archivo: nombre,
    hoja: p.sourceSheet,
    filaEncabezado: p.filaEncabezado + 1,
    columnasFaltantes: p.columnasFaltantes,
    columnasDesconocidas: p.columnasDesconocidas,
    filasOcultas: p.filasOcultas.length,
    celdasCombinadas: p.celdasCombinadas.length,
    celdasConFormula: p.celdasConFormula,
    total: filas.length,
    listas: filas.filter((f) => f.estado !== "INVALIDA").length,
    conProblema: filas.filter((f) => f.estado !== "VALIDA").length,
    fecha: fechas.length ? fechas.sort()[fechas.length - 1] : new Date().toISOString().slice(0, 10),
    totalImporte: p.transferencias.reduce((a, t) => a + (t.importe ?? 0), 0),
    filas,
  };
}

export async function accionPrevisualizar(datos: FormData): Promise<Resultado<Previsualizacion>> {
  try {
    await exigirSesion();
    const { nombre, bytes } = await leerArchivo(datos);
    const alias = String(datos.get("clienteId") ?? "");
    return { ok: true, datos: analizar(nombre, bytes, alias) };
  } catch (e) {
    return aResultadoError(e);
  }
}

export async function accionImportar(
  datos: FormData,
): Promise<Resultado<{ planillaId: string; operaciones: number; acreditadas: number }>> {
  try {
    await exigirSesion();
    const clienteId = String(datos.get("clienteId") ?? "");
    if (clienteId === "") throw new ErrorValidacion("Elegí el cliente", "clienteId");

    const { nombre, bytes } = await leerArchivo(datos);
    const p = parsearPlanillaCliente(bytes, { sourceFile: nombre, clientAlias: clienteId });

    // Se importa **todo**, también lo que está mal: una fila con el CUIT
    // equivocado tiene que quedar registrada y visible como error, no
    // desaparecer en la importación. Lo único que se exige es que la fila
    // tenga algún dato.
    const filas: OperacionNueva[] = p.transferencias.map((t) => ({
      fila: t.sourceRow + 1,
      fechaDeposito: t.fechaDeposito ?? "",
      banco: t.banco,
      nombreDepositante: t.nombreDepositante,
      identificacionOriginal: t.identificacionOriginal,
      identificacionNormalizada: t.identificacionNormalizada,
      tipoIdentificacion: t.tipoIdentificacion,
      importe: t.importe ?? 0,
      numeroDeposito: t.numeroDeposito,
    }));
    if (filas.length === 0) {
      throw new ErrorValidacion("El archivo no tiene ninguna fila con datos", "archivo");
    }

    // El original se conserva: es la única prueba de qué mandó el cliente
    // el día que discuta un importe o una fecha. Lo parseado es una
    // interpretación; el archivo es el hecho.
    const almacen = await almacenDeArchivos();
    const original = await almacen.guardar("planillas", nombre, bytes);

    const fechas = filas.map((f) => f.fechaDeposito).filter(Boolean).sort();
    const { planilla } = await crearPlanilla(
      clienteId,
      nombre,
      fechas[fechas.length - 1] ?? new Date().toISOString().slice(0, 10),
      filas,
      original.sha256,
      original.ruta,
    );

    for (const ruta of ["/planillas", "/conciliacion", "/clientes", "/inicio"]) {
      revalidatePath(ruta, "layout");
    }

    const { getOperaciones } = await import("@/lib/data/operaciones");
    const creadas = await getOperaciones({ planillaId: planilla.id });
    return {
      ok: true,
      datos: {
        planillaId: planilla.id,
        operaciones: creadas.length,
        acreditadas: creadas.filter((o) => o.bucket === "CONCILIADA").length,
      },
    };
  } catch (e) {
    return aResultadoError(e);
  }
}
