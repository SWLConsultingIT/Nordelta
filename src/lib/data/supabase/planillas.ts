import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ErrorDatos, ErrorValidacion } from "../../domain/errors";
import { esFechaCalendario } from "../../fullcarga/fechas";
import type { Planilla } from "../../operaciones/tipos";
import type { PlanillaNueva, RepositorioPlanillas } from "../puertos";

/**
 * Planillas, contra Postgres.
 *
 * La planilla es **la unidad contable**: NORD lo confirmó. Una
 * transferencia suelta no genera asiento; lo que llega a la cuenta
 * corriente es el total de la planilla una vez que acreditó todo. Por eso
 * la entidad existe con peso propio y no como una etiqueta sobre las filas.
 *
 * El estado es **derivado** de sus transferencias y lo recalcula el
 * servicio. No se acepta que lo fije quien llama: dos fuentes de verdad
 * para el mismo dato terminan siempre en desacuerdo.
 */

interface FilaPlanilla {
  id: string;
  cliente_id: string;
  archivo: string;
  fecha: string;
  recibida_en: string;
  estado: Planilla["estado"];
  sha256: string | null;
  storage_path: string | null;
  filas: number;
  total_centavos: number;
}

const aPlanilla = (f: FilaPlanilla): Planilla => ({
  id: f.id,
  clienteId: f.cliente_id,
  archivo: f.archivo,
  fecha: f.fecha,
  importadaEn: f.recibida_en,
  estado: f.estado,
  // Sin estos dos no se puede ir de la fila al archivo original, que es
  // toda la razón por la que se guarda el original.
  sha256: f.sha256,
  storagePath: f.storage_path,
  filas: f.filas,
  totalCentavos: f.total_centavos,
});

const CAMPOS =
  "id, cliente_id, archivo, fecha, recibida_en, estado, sha256, storage_path, " +
  "filas, total_centavos";

function fallo(descripcion: string, e: { message: string } | null): never {
  throw new ErrorDatos(`Falló ${descripcion}`, { causa: e?.message ?? "desconocido" });
}

/**
 * Por qué todos los `insert` llevan `defaultToNull: false`.
 *
 * PostgREST arma la inserción con `json_populate_recordset`, y eso
 * convierte **toda columna omitida en NULL**, no en su valor por defecto.
 * El resultado era que `organizacion_id`, cuyo default es `fn_org()`,
 * llegaba nula y la política de seguridad rechazaba la fila.
 *
 * La opción equivale a la cabecera `Prefer: missing=default`: lo que no
 * se manda lo decide la base. Es justo lo que se quiere acá, porque
 * significa que **la aplicación nunca declara a qué organización
 * pertenece lo que escribe** —lo deduce el perfil de la sesión— y por lo
 * tanto no hay nada que falsificar.
 */
const DEFECTOS = { defaultToNull: false } as const;

export function repositorioPlanillas(
  sb: SupabaseClient,
  organizacionId?: string,
): RepositorioPlanillas {
  return {
    async listar(clienteId) {
      let q = sb.from("planillas").select(CAMPOS).order("fecha", { ascending: false });
      if (clienteId) q = q.eq("cliente_id", clienteId);
      const { data, error } = await q;
      if (error) fallo("la consulta de planillas", error);
      return (data as unknown as FilaPlanilla[]).map(aPlanilla);
    },

    async obtener(id) {
      const { data, error } = await sb.from("planillas").select(CAMPOS).eq("id", id).maybeSingle();
      if (error) fallo("la consulta de la planilla", error);
      return data ? aPlanilla(data as unknown as FilaPlanilla) : null;
    },

    async crear(datos: PlanillaNueva) {
      if (!esFechaCalendario(datos.fecha)) {
        throw new ErrorValidacion("La fecha de la planilla no es válida", "fecha", {
          fecha: datos.fecha,
        });
      }
      if (datos.archivo.trim() === "") {
        throw new ErrorValidacion("Falta el nombre del archivo", "archivo");
      }

      const { data, error } = await sb
        .from("planillas")
        .insert({
          ...(organizacionId ? { organizacion_id: organizacionId } : {}),
          cliente_id: datos.clienteId,
          archivo: datos.archivo.trim(),
          fecha: datos.fecha,
          sha256: datos.sha256 ?? null,
          storage_path: datos.storagePath ?? null,
        }, DEFECTOS)
        .select(CAMPOS)
        .single();
      if (error) {
        if (error.code === "23505") {
          throw new ErrorValidacion(
            "Esa planilla ya se importó para este cliente",
            "sha256",
          );
        }
        fallo("el alta de la planilla", error);
      }
      return aPlanilla(data as unknown as FilaPlanilla);
    },

    async actualizarEstado(id, estado) {
      const { error } = await sb.from("planillas").update({ estado }).eq("id", id);
      if (error) fallo("la actualización del estado de la planilla", error);
    },

    async buscarPorHuella(clienteId, sha256) {
      const { data, error } = await sb
        .from("planillas")
        .select(CAMPOS)
        .eq("cliente_id", clienteId)
        .eq("sha256", sha256)
        .maybeSingle();
      if (error) fallo("la búsqueda de la planilla por huella", error);
      return data ? aPlanilla(data as unknown as FilaPlanilla) : null;
    },
  };
}
