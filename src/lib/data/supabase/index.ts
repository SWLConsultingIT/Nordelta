import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Repositorios } from "../puertos";
import { repositorioClientes } from "./clientes";
import { repositorioPlanillas } from "./planillas";
import {
  repositorioAcreditaciones, repositorioConciliacion,
  repositorioInformes, repositorioTransferencias,
} from "./operativo";

/**
 * Los repositorios del dominio operativo contra Postgres.
 *
 * Se arman a partir de un cliente ya autenticado: la sesión determina la
 * organización, y de ahí sale el aislamiento. Nada acá recibe un
 * `organizacion_id` por parámetro, y es deliberado.
 */
export function repositoriosSupabase(
  sb: SupabaseClient,
  /**
   * Solo para tareas de administración que corren sin sesión, donde el
   * valor por defecto de la columna —`fn_org()`— es nulo. Desde la
   * aplicación se omite: lo resuelve la base a partir del perfil.
   */
  organizacionId?: string,
): Repositorios {
  return {
    clientes: repositorioClientes(sb, organizacionId),
    planillas: repositorioPlanillas(sb, organizacionId),
    transferencias: repositorioTransferencias(sb, organizacionId),
    informes: repositorioInformes(sb, organizacionId),
    acreditaciones: repositorioAcreditaciones(sb, organizacionId),
    conciliacion: repositorioConciliacion(sb, organizacionId),
  };
}
