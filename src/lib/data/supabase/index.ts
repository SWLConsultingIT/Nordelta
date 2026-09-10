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
export function repositoriosSupabase(sb: SupabaseClient): Repositorios {
  return {
    clientes: repositorioClientes(sb),
    planillas: repositorioPlanillas(sb),
    transferencias: repositorioTransferencias(sb),
    informes: repositorioInformes(sb),
    acreditaciones: repositorioAcreditaciones(sb),
    conciliacion: repositorioConciliacion(sb),
  };
}
