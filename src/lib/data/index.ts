import "server-only";
import type {
  Contraparte, Movimiento, Oficina, EntradaAuditoria, Categoria, Moneda, Partida,
} from "../domain/types";
import { ErrorDatos, ErrorNoEncontrado, ErrorValidacion } from "../domain/errors";
import { validarPartida } from "../domain/fx";
import { validarNombreContraparte } from "../domain/contrapartes";
import { esFechaISOValida } from "../format";
import { almacen } from "./memoria";

/**
 * Capa de acceso a datos: el ÚNICO lugar que habla con el almacén.
 *
 * Ningún componente ni pantalla importa Supabase directamente. La regla
 * existe para que cambiar de backend, agregar caché o instrumentar consultas
 * sea un cambio en un archivo y no una cacería por todo el árbol.
 *
 * Mientras no haya credenciales de Supabase se sirve el almacén en memoria,
 * ejercitando los mismos caminos de código.
 */
export const usaSupabase = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

/** Envoltura común: traduce cualquier fallo del almacén a un error de dominio. */
async function consultar<T>(descripcion: string, fn: () => Promise<T> | T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ErrorValidacion || e instanceof ErrorNoEncontrado) throw e;
    // Nunca devolver una lista vacía ante un fallo: un saldo en blanco por
    // error silencioso es peor que una pantalla de error.
    throw new ErrorDatos(`Falló ${descripcion}`, { causa: (e as Error).message });
  }
}

/* ── Maestros ───────────────────────────────────────────────── */

export async function getOficinas(): Promise<Oficina[]> {
  return consultar("la consulta de oficinas", () => almacen.oficinas);
}

export async function getOficina(id: number): Promise<Oficina> {
  const o = (await getOficinas()).find((x) => x.id === id);
  if (!o) throw new ErrorNoEncontrado(`No existe la oficina ${id}`, { id });
  return o;
}

export async function getContrapartes(): Promise<Contraparte[]> {
  return consultar("la consulta de contrapartes", () =>
    almacen.contrapartes
      .filter((c) => c.activo)
      .slice()
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
  );
}

export async function getContraparte(id: number): Promise<Contraparte> {
  const c = (await consultar("la consulta de contraparte", () =>
    almacen.contrapartes.find((x) => x.id === id),
  ));
  if (!c) throw new ErrorNoEncontrado(`No existe la contraparte ${id}`, { id });
  return c;
}

export async function buscarContrapartes(texto: string): Promise<Contraparte[]> {
  const t = texto.trim().toLowerCase();
  const todas = await getContrapartes();
  return t === "" ? todas : todas.filter((c) => c.nombre.toLowerCase().includes(t));
}

export async function crearContraparte(nombre: string): Promise<Contraparte> {
  const errores = validarNombreContraparte(nombre);
  if (errores.length > 0) throw errores[0];
  const id = await consultar("el alta de contraparte", () =>
    almacen.obtenerOCrearContraparte(nombre),
  );
  return getContraparte(id);
}

/* ── Movimientos ────────────────────────────────────────────── */

export async function getMovimientosDelDia(fecha: string, oficinaId: number): Promise<Movimiento[]> {
  if (!esFechaISOValida(fecha)) {
    throw new ErrorValidacion("La fecha no es válida", "fecha", { fecha });
  }
  return consultar("la consulta del día", () =>
    almacen.movimientos
      .filter((m) => m.fecha === fecha && m.oficina_id === oficinaId)
      .slice()
      .sort((a, b) => a.orden - b.orden),
  );
}

export async function getMovimientosDeContraparte(id: number): Promise<Movimiento[]> {
  return consultar("la consulta de la cuenta corriente", () =>
    almacen.movimientos.filter((m) => m.contraparte_id === id),
  );
}

export async function getTodosLosMovimientos(): Promise<Movimiento[]> {
  return consultar("la consulta del libro mayor", () => almacen.movimientos);
}

/** Datos de un movimiento nuevo. `afecta_cta_cte` y `orden` los resuelve el almacén. */
export interface MovimientoNuevo {
  fecha: string;
  oficina_id: number;
  /** Por id, o por nombre para que un pegado desde Excel no tenga que resolverlo. */
  contraparte_id?: number | null;
  contraparte?: string;
  concepto: string;
  categoria: Categoria;
  partidas: Omit<Partida, "id">[];
  orden?: number;
  origen?: Record<string, unknown>;
}

/**
 * Crea varios movimientos de una vez, de forma atómica.
 *
 * Contra Supabase invoca la función `crear_movimientos_lote`, que corre
 * dentro de una transacción: o entran todos o no entra ninguno. Un pegado a
 * medias deja el día en un estado que nadie sabe interpretar.
 */
export async function crearMovimientos(entradas: MovimientoNuevo[]): Promise<Movimiento[]> {
  if (entradas.length === 0) return [];

  // Validación completa ANTES de escribir nada: si una fila está mal, no se
  // escribe ninguna.
  const errores: ErrorValidacion[] = [];
  entradas.forEach((e, i) => {
    const donde = ` (fila ${i + 1})`;
    if (!esFechaISOValida(e.fecha)) {
      errores.push(new ErrorValidacion("La fecha no es válida" + donde, "fecha", { fila: i }));
    }
    if (!e.contraparte_id && !e.contraparte?.trim()) {
      errores.push(new ErrorValidacion("Falta la contraparte" + donde, "contraparte", { fila: i }));
    }
    if (e.partidas.length === 0) {
      errores.push(new ErrorValidacion("El movimiento no tiene ninguna partida" + donde, "partidas", { fila: i }));
    }
    e.partidas.forEach((p, j) => {
      for (const err of validarPartida(p, j)) {
        errores.push(new ErrorValidacion(err.message + donde, err.campo, { fila: i }));
      }
    });
  });
  if (errores.length > 0) throw errores[0];

  return consultar("el guardado de movimientos", () =>
    entradas.map((e) => {
      const contraparte_id =
        e.contraparte_id ?? almacen.obtenerOCrearContraparte(e.contraparte!);
      return almacen.crearMovimiento({
        fecha: e.fecha,
        oficina_id: e.oficina_id,
        contraparte_id,
        concepto: e.concepto,
        categoria: e.categoria,
        orden: e.orden,
        partidas: e.partidas as Partida[],
      });
    }),
  );
}

export async function eliminarMovimiento(id: string, motivo?: string): Promise<void> {
  const ok = await consultar("la baja del movimiento", () => almacen.eliminarMovimiento(id, motivo));
  if (!ok) throw new ErrorNoEncontrado(`No existe el movimiento ${id}`, { id });
}

/**
 * Ajuste que lleva la cuenta corriente de una contraparte a cero.
 *
 * No toca ningún saldo: genera un movimiento contable explícito con
 * categoría `ajuste_cierre` y una partida por moneda con saldo distinto de
 * cero. Devuelve null si la cuenta ya estaba en cero.
 */
export async function ajustarCuentaACero(
  contraparteId: number,
  oficinaId: number,
  fecha: string,
  concepto: string,
  saldos: Partial<Record<Moneda, number>>,
): Promise<Movimiento | null> {
  const partidas = (Object.entries(saldos) as [Moneda, number][])
    .filter(([, v]) => v !== 0)
    .map(([moneda, v]) => ({
      medio_pago: "efectivo" as const,
      moneda_nominal: moneda,
      monto_nominal: -v,
      tipo_cambio: null,
      comision_pct: null,
    }));

  if (partidas.length === 0) return null;

  const [mov] = await crearMovimientos([
    { fecha, oficina_id: oficinaId, contraparte_id: contraparteId,
      concepto, categoria: "ajuste_cierre", partidas },
  ]);
  return mov;
}

/* ── Auditoría ──────────────────────────────────────────────── */

export async function getAuditoria(limite = 200): Promise<EntradaAuditoria[]> {
  return consultar("la consulta de auditoría", () =>
    almacen.auditoria
      .slice()
      .sort((a, b) => (a.ocurrido_en < b.ocurrido_en ? 1 : -1))
      .slice(0, limite),
  );
}
