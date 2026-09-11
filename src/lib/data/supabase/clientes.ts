import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ErrorDatos, ErrorNoEncontrado, ErrorValidacion } from "../../domain/errors";
import type { Cliente } from "../../operaciones/tipos";
import type { ClienteNuevo, RepositorioClientes } from "../puertos";

/**
 * Clientes de NORD, contra Postgres.
 *
 * El cliente de NORD es **quien manda planillas**. No se confunde con la
 * contraparte del libro financiero: un mismo cliente recibe transferencias
 * de decenas de depositantes distintos, así que meterlos en la misma tabla
 * obligaría a inventar una jerarquía que el negocio no tiene. La relación
 * entre los dos existe como columna opcional y **la aporta una persona**.
 *
 * Acá no se filtra por organización a mano y es deliberado: lo hace la
 * seguridad por fila. Si el aislamiento dependiera de que cada consulta se
 * acuerde de poner un `where`, alcanzaría con un olvido para filtrar datos
 * de otro inquilino.
 */

/** La fila tal como vive en la base. */
interface FilaCliente {
  id: string;
  nombre: string;
  alias: string;
  activo: boolean;
}

const aCliente = (f: FilaCliente): Cliente => ({
  id: f.id,
  nombre: f.nombre,
  alias: f.alias,
});

/** Traduce cualquier fallo del driver a un error de dominio. */
function fallo(descripcion: string, e: { message: string } | null): never {
  throw new ErrorDatos(`Falló ${descripcion}`, { causa: e?.message ?? "desconocido" });
}

const ALIAS = /^[A-Z0-9][A-Z0-9-]{0,15}$/;

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

export function repositorioClientes(
  sb: SupabaseClient,
  organizacionId?: string,
): RepositorioClientes {
  return {
    async listar() {
      const { data, error } = await sb
        .from("clientes")
        .select("id, nombre, alias, activo")
        .eq("activo", true)
        .order("nombre");
      if (error) fallo("la consulta de clientes", error);
      return (data as FilaCliente[]).map(aCliente);
    },

    async obtener(id) {
      const { data, error } = await sb
        .from("clientes")
        .select("id, nombre, alias, activo")
        .eq("id", id)
        .maybeSingle();
      if (error) fallo("la consulta del cliente", error);
      return data ? aCliente(data as FilaCliente) : null;
    },

    async crear(datos: ClienteNuevo) {
      const nombre = datos.nombre.trim();
      const alias = datos.alias.trim().toUpperCase();
      if (nombre === "") {
        throw new ErrorValidacion("El cliente necesita un nombre", "nombre");
      }
      if (!ALIAS.test(alias)) {
        throw new ErrorValidacion(
          "El alias va en mayúsculas, sin espacios, hasta 16 caracteres",
          "alias",
        );
      }

      // Desde la aplicación no se manda la organización: la pone el valor
      // por defecto de la columna a partir del perfil, y la política lo
      // verifica. Solo las tareas de administración —que corren sin
      // sesión— la declaran.
      const { data, error } = await sb
        .from("clientes")
        .insert({ ...(organizacionId ? { organizacion_id: organizacionId } : {}), nombre, alias })
        .select("id, nombre, alias, activo")
        .single();
      if (error) {
        // 23505 es violación de unicidad. El alias es lo único único que
        // el usuario elige, así que el mensaje puede ser preciso.
        if (error.code === "23505") {
          throw new ErrorValidacion(`Ya existe un cliente con el alias ${alias}`, "alias");
        }
        fallo("el alta del cliente", error);
      }
      return aCliente(data as FilaCliente);
    },

    async renombrar(id, nombre) {
      const limpio = nombre.trim();
      if (limpio === "") throw new ErrorValidacion("El nombre no puede quedar vacío", "nombre");
      const { data, error } = await sb
        .from("clientes")
        .update({ nombre: limpio })
        .eq("id", id)
        .select("id, nombre, alias, activo")
        .maybeSingle();
      if (error) fallo("la edición del cliente", error);
      if (!data) throw new ErrorNoEncontrado(`No existe el cliente ${id}`, { id });
      return aCliente(data as FilaCliente);
    },

    async desactivar(id) {
      // Baja lógica. Un cliente con planillas históricas no se puede borrar
      // sin dejar huérfana toda su operación.
      const { error } = await sb.from("clientes").update({ activo: false }).eq("id", id);
      if (error) fallo("la baja del cliente", error);
    },

    async emails(clienteId) {
      const { data, error } = await sb
        .from("cliente_emails")
        .select("email, principal")
        .eq("cliente_id", clienteId)
        .order("principal", { ascending: false });
      if (error) fallo("la consulta de correos del cliente", error);
      return (data as { email: string }[]).map((f) => f.email);
    },

    async agregarEmail(clienteId, email, principal = false) {
      const limpio = email.trim().toLowerCase();
      if (!limpio.includes("@")) {
        throw new ErrorValidacion("El correo no es válido", "email", { email: limpio });
      }
      const { error } = await sb
        .from("cliente_emails")
        .insert({
          ...(organizacionId ? { organizacion_id: organizacionId } : {}),
          cliente_id: clienteId, email: limpio, principal,
        }, DEFECTOS);
      if (error) {
        if (error.code === "23505") {
          throw new ErrorValidacion(
            "Ese correo ya está asociado a un cliente",
            "email",
            { email: limpio },
          );
        }
        fallo("el alta del correo", error);
      }
    },
  };
}
