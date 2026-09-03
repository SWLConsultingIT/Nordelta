import type { Moneda, MedioPago } from "./types";
import { MONEDAS, MEDIOS_PAGO, MEDIOS_CON_COMISION } from "./types";
import { ErrorDominio, ErrorValidacion } from "./errors";
import { redondear, sumarYRedondear, MONTO_MAXIMO, DECIMALES_IMPACTO, DECIMALES_SALDO } from "./dinero";

/** Datos mínimos de una pata para poder resolver su impacto. */
export interface PartidaCalculable {
  medio_pago: MedioPago;
  moneda_nominal: Moneda;
  monto_nominal: number;
  tipo_cambio: number | null;
  comision_pct: number | null;
}

export interface Impacto {
  moneda: Moneda;
  monto: number;
}

/** Comisión máxima aceptada: 100 %. Más que eso es un error de carga
 *  (típicamente alguien escribió 15 en lugar de 0,15). */
export const COMISION_MAXIMA = 1;

/**
 * Impacto de una pata en la cuenta corriente.
 *
 * Espejo **exacto** de las columnas generadas `partidas.moneda_impacto` y
 * `partidas.monto_impacto`. Verificado contra el consolidado de BigQuery:
 *
 *   la comisión se aplica ANTES de dividir por el tipo de cambio.
 *
 * Cada pata resuelve su moneda de impacto por su cuenta. Esa independencia
 * es lo que hace estructuralmente imposible el bug 5 del sistema legacy,
 * donde una pata sin convertir desaparecía porque otra pata de la misma
 * fila tenía tipo de cambio.
 *
 * La autoridad es Postgres. Esta función existe para que la grilla pueda
 * mostrar el resultado sin esperar a la red.
 */
export function calcularImpacto(p: PartidaCalculable): Impacto {
  if (!Number.isFinite(p.monto_nominal)) {
    throw new ErrorDominio("monto_nominal no es finito", { partida: p });
  }
  if (p.tipo_cambio !== null && !Number.isFinite(p.tipo_cambio)) {
    throw new ErrorDominio("tipo_cambio no es finito", { partida: p });
  }
  if (p.comision_pct !== null && !Number.isFinite(p.comision_pct)) {
    throw new ErrorDominio("comision_pct no es finito", { partida: p });
  }

  // `coalesce(comision_pct, 0)`, igual que la columna generada. La restricción
  // que impide comisión sobre efectivo vive en `validarPartida` y en un CHECK
  // de la base, no acá: así el cálculo del front y el de Postgres no pueden
  // divergir para ningún dato que la base acepte.
  const conComision = p.monto_nominal * (1 + (p.comision_pct ?? 0));

  const convierte =
    p.tipo_cambio !== null && p.tipo_cambio > 0 && p.moneda_nominal !== "USD";

  return convierte
    ? { moneda: "USD", monto: redondear(conComision / p.tipo_cambio!, DECIMALES_IMPACTO) }
    : { moneda: p.moneda_nominal, monto: redondear(conComision, DECIMALES_IMPACTO) };
}

/**
 * Suma los impactos de un conjunto de patas, agrupados por moneda.
 *
 * Suma con precisión completa y redondea **una sola vez** por moneda, que es
 * lo que hace `round(sum(monto_impacto), 2)` en la base. Redondear en cada
 * paso arrastra el error y hace divergir el saldo del front del de Postgres.
 */
export function impactoPorMoneda(
  partidas: readonly PartidaCalculable[],
  decimales = DECIMALES_SALDO,
): Partial<Record<Moneda, number>> {
  const crudos = new Map<Moneda, number[]>();

  for (const p of partidas) {
    if (p.monto_nominal === 0) continue; // una pata en cero no impacta nada
    const { moneda, monto } = calcularImpacto(p);
    const lista = crudos.get(moneda);
    if (lista) lista.push(monto);
    else crudos.set(moneda, [monto]);
  }

  const out: Partial<Record<Moneda, number>> = {};
  for (const [moneda, valores] of crudos) {
    out[moneda] = sumarYRedondear(valores, decimales);
  }
  return out;
}

/** Impactos sin agrupar ni redondear: para acumular saldos corridos. */
export function impactosCrudos(partidas: readonly PartidaCalculable[]): Impacto[] {
  return partidas.filter((p) => p.monto_nominal !== 0).map(calcularImpacto);
}

/* ── Validación ──────────────────────────────────────────────────
   Separada del cálculo a propósito: el cálculo es puro y tolerante para
   poder mostrar un resultado mientras el operador tipea; la validación es
   estricta y es la que decide si algo puede llegar a la base.
   Cada regla de acá tiene su CHECK equivalente en `0001_schema.sql`. */

export function validarPartida(p: Partial<PartidaCalculable>, indice?: number): ErrorValidacion[] {
  const errores: ErrorValidacion[] = [];
  const donde = indice === undefined ? "" : ` (partida ${indice + 1})`;
  const err = (msg: string, campo: string) =>
    errores.push(new ErrorValidacion(msg + donde, campo, { indice }));

  if (!p.medio_pago || !MEDIOS_PAGO.includes(p.medio_pago)) {
    err("Elegí un medio de pago válido", "medio_pago");
  }
  if (!p.moneda_nominal || !MONEDAS.includes(p.moneda_nominal)) {
    err("Elegí una moneda válida", "moneda_nominal");
  }

  if (typeof p.monto_nominal !== "number" || !Number.isFinite(p.monto_nominal)) {
    err("El monto tiene que ser un número", "monto_nominal");
  } else if (p.monto_nominal === 0) {
    err("El monto no puede ser cero", "monto_nominal");
  } else if (Math.abs(p.monto_nominal) > MONTO_MAXIMO) {
    err(
      `El monto no puede pasar de ${MONTO_MAXIMO.toLocaleString("es-AR")}. ` +
      "Revisá si sobran dígitos.",
      "monto_nominal",
    );
  }

  if (p.tipo_cambio !== null && p.tipo_cambio !== undefined) {
    if (!Number.isFinite(p.tipo_cambio) || p.tipo_cambio <= 0) {
      err("El tipo de cambio tiene que ser mayor a cero, o quedar vacío", "tipo_cambio");
    } else if (p.moneda_nominal === "USD") {
      err("Una pata en dólares no lleva tipo de cambio", "tipo_cambio");
    }
  }

  if (p.comision_pct !== null && p.comision_pct !== undefined && p.comision_pct !== 0) {
    if (!Number.isFinite(p.comision_pct)) {
      err("La comisión tiene que ser un número", "comision_pct");
    } else if (p.comision_pct < 0 || p.comision_pct > COMISION_MAXIMA) {
      err(`La comisión tiene que estar entre 0 % y ${COMISION_MAXIMA * 100} %`, "comision_pct");
    } else if (p.medio_pago && !MEDIOS_CON_COMISION.has(p.medio_pago)) {
      err("La comisión solo aplica a transferencias", "comision_pct");
    }
  }

  return errores;
}
