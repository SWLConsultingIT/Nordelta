import type { Moneda, Movimiento } from "./types";
import { MONEDAS, CATEGORIAS_QUE_IMPACTAN } from "./types";
import { impactoPorMoneda, redondear } from "./fx";

export interface FilaCtaCte {
  movimiento: Movimiento;
  /** Impacto de este movimiento, por moneda. */
  delta: Partial<Record<Moneda, number>>;
  /** Saldo acumulado después de este movimiento, por moneda. */
  saldo: Record<Moneda, number>;
  /** True cuando las cuatro monedas quedan en cero y la fila anterior
   *  tenía al menos una distinta de cero. */
  esCierre: boolean;
}

/**
 * Saldo corrido y detección de cierre de cuenta.
 *
 * Replica la función de ventana del consolidado global:
 *   ORDER BY fecha, (cierres al final), y desempate estable
 *   cierre  ⟺  las 4 monedas en 0 (redondeadas a 2 decimales)
 *              Y la fila anterior con al menos una ≠ 0
 *
 * Nótese que el cierre exige las cuatro monedas simultáneamente — no es
 * por moneda. Eso está confirmado en el SQL de producción.
 */
export function construirCtaCte(movimientos: Movimiento[]): FilaCtaCte[] {
  const relevantes = movimientos.filter((m) => CATEGORIAS_QUE_IMPACTAN.has(m.categoria));

  const ordenados = [...relevantes].sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1;
    // Los ajustes de cierre van al final del día, igual que en producción.
    const ca = a.categoria === "ajuste_cierre" ? 1 : 0;
    const cb = b.categoria === "ajuste_cierre" ? 1 : 0;
    if (ca !== cb) return ca - cb;
    if (a.orden !== b.orden) return a.orden - b.orden;
    return a.id < b.id ? -1 : 1;
  });

  const acum: Record<Moneda, number> = { ARS: 0, USD: 0, EUR: 0, BRL: 0 };
  const filas: FilaCtaCte[] = [];

  for (const m of ordenados) {
    const previo = { ...acum };
    const delta = impactoPorMoneda(m.partidas);

    for (const mon of MONEDAS) {
      acum[mon] = redondear(acum[mon] + (delta[mon] ?? 0), 2);
    }

    const todoEnCero = MONEDAS.every((mon) => acum[mon] === 0);
    const habiaAlgo = MONEDAS.some((mon) => previo[mon] !== 0);

    filas.push({
      movimiento: m,
      delta,
      saldo: { ...acum },
      esCierre: todoEnCero && habiaAlgo,
    });
  }

  return filas;
}

/** Índice de la última fila que cerró la cuenta, o -1. */
export function indiceUltimoCierre(filas: FilaCtaCte[]): number {
  for (let i = filas.length - 1; i >= 0; i--) if (filas[i].esCierre) return i;
  return -1;
}

/** Saldo final por moneda. */
export function saldoFinal(filas: FilaCtaCte[]): Record<Moneda, number> {
  return filas.length > 0 ? filas[filas.length - 1].saldo : { ARS: 0, USD: 0, EUR: 0, BRL: 0 };
}
