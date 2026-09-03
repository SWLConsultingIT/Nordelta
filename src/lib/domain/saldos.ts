import type { Moneda, Movimiento } from "./types";
import { MONEDAS, CATEGORIAS_QUE_IMPACTAN } from "./types";
import { impactosCrudos, impactoPorMoneda } from "./fx";
import { redondear, esCero, DECIMALES_SALDO } from "./dinero";

export interface FilaCtaCte {
  movimiento: Movimiento;
  /** Impacto del movimiento por moneda, redondeado para mostrar. */
  delta: Partial<Record<Moneda, number>>;
  /** Saldo acumulado después del movimiento, redondeado para mostrar. */
  saldo: Record<Moneda, number>;
  /** Las cuatro monedas en cero y la posición anterior con alguna distinta. */
  esCierre: boolean;
}

const CERO = (): Record<Moneda, number> => ({ ARS: 0, USD: 0, EUR: 0, BRL: 0 });

/**
 * Orden canónico del libro mayor.
 *
 * Tiene que ser **idéntico** al de las vistas `v_cta_cte` y `v_cierres`:
 *
 *   fecha → los ajustes de cierre al final del día → orden → id
 *
 * El sistema legacy desempataba solo hasta el concepto, así que dos
 * movimientos iguales del mismo día podían intercambiarse entre corridas y
 * mover cuál fila disparaba el cierre de cuenta. `orden` existe para que eso
 * no pueda pasar.
 */
export function compararMovimientos(a: Movimiento, b: Movimiento): number {
  if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1;

  const ajusteA = a.categoria === "ajuste_cierre" ? 1 : 0;
  const ajusteB = b.categoria === "ajuste_cierre" ? 1 : 0;
  if (ajusteA !== ajusteB) return ajusteA - ajusteB;

  if (a.orden !== b.orden) return a.orden - b.orden;

  // Los ids de la base son bigint. Se comparan numéricamente cuando se puede,
  // porque el orden lexicográfico pondría "10" antes que "2".
  const na = Number(a.id);
  const nb = Number(b.id);
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Saldo corrido y detección de cierre de cuenta.
 *
 * Replica la función de ventana del consolidado, con dos correcciones sobre
 * el sistema legacy:
 *
 *   · el orden es determinístico (ver `compararMovimientos`);
 *   · la acumulación es a **precisión completa** y se redondea solo para
 *     mostrar y comparar, igual que `round(sum(x), 2)` en Postgres. Redondear
 *     en cada paso arrastra el error.
 *
 * Regla de cierre confirmada en producción: las **cuatro** monedas en cero
 * simultáneamente, y la posición anterior con al menos una distinta de cero.
 * No hay cierre por moneda.
 */
export function construirCtaCte(movimientos: readonly Movimiento[]): FilaCtaCte[] {
  const ordenados = movimientos
    .filter((m) => CATEGORIAS_QUE_IMPACTAN.has(m.categoria) && m.afecta_cta_cte !== false)
    .slice()
    .sort(compararMovimientos);

  const acumCrudo = CERO(); // sin redondear: es el acumulador real
  const filas: FilaCtaCte[] = [];

  for (const m of ordenados) {
    const previoRedondeado = MONEDAS.map((mon) => redondear(acumCrudo[mon], DECIMALES_SALDO));

    for (const imp of impactosCrudos(m.partidas)) {
      acumCrudo[imp.moneda] += imp.monto;
    }

    const saldo = CERO();
    for (const mon of MONEDAS) saldo[mon] = redondear(acumCrudo[mon], DECIMALES_SALDO);

    const todoEnCero = MONEDAS.every((mon) => esCero(acumCrudo[mon], DECIMALES_SALDO));
    const habiaAlgo = previoRedondeado.some((v) => v !== 0);

    filas.push({
      movimiento: m,
      delta: impactoPorMoneda(m.partidas, DECIMALES_SALDO),
      saldo,
      esCierre: todoEnCero && habiaAlgo,
    });
  }

  return filas;
}

/** Índice de la última fila que cerró la cuenta, o -1. */
export function indiceUltimoCierre(filas: readonly FilaCtaCte[]): number {
  for (let i = filas.length - 1; i >= 0; i--) if (filas[i].esCierre) return i;
  return -1;
}

/** Saldo final por moneda. */
export function saldoFinal(filas: readonly FilaCtaCte[]): Record<Moneda, number> {
  return filas.length > 0 ? { ...filas[filas.length - 1].saldo } : CERO();
}

/** Filas posteriores al último cierre; todas si nunca cerró. */
export function desdeUltimoCierre(filas: readonly FilaCtaCte[]): FilaCtaCte[] {
  const i = indiceUltimoCierre(filas);
  return i >= 0 ? filas.slice(i + 1) : filas.slice();
}
