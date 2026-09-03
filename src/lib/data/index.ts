import "server-only";
import type { Contraparte, Movimiento, Oficina } from "../domain/types";
import { CONTRAPARTES, MOVIMIENTOS, OFICINAS } from "./fixtures";

/**
 * Capa de acceso a datos.
 *
 * Mientras no haya credenciales de Supabase, sirve las fixtures para que la
 * aplicación corra y se pueda demostrar. En cuanto se configuren las
 * variables de entorno, cada función pasa a consultar Postgres sin que
 * ningún componente cambie: la costura está acá y solo acá.
 */
export const usaSupabase = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export async function getOficinas(): Promise<Oficina[]> {
  return OFICINAS;
}

export async function getContrapartes(): Promise<Contraparte[]> {
  return CONTRAPARTES.filter((c) => c.activo).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export async function getContraparte(id: number): Promise<Contraparte | null> {
  return CONTRAPARTES.find((c) => c.id === id) ?? null;
}

export async function getMovimientosDelDia(fecha: string, oficinaId: number): Promise<Movimiento[]> {
  return MOVIMIENTOS.filter((m) => m.fecha === fecha && m.oficina_id === oficinaId).sort(
    (a, b) => a.orden - b.orden,
  );
}

export async function getMovimientosDeContraparte(id: number): Promise<Movimiento[]> {
  return MOVIMIENTOS.filter((m) => m.contraparte_id === id);
}

export async function getTodosLosMovimientos(): Promise<Movimiento[]> {
  return MOVIMIENTOS;
}
