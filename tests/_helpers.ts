import type { Categoria, MedioPago, Moneda, Movimiento, Partida } from "@/lib/domain/types";

let n = 0;
const id = () => `p${++n}`;

/** Construye una pata con lo mínimo necesario. */
export function pata(
  medio: MedioPago,
  moneda: Moneda,
  monto: number,
  tc: number | null = null,
  comision: number | null = null,
): Partida {
  return {
    id: id(),
    medio_pago: medio,
    moneda_nominal: moneda,
    monto_nominal: monto,
    tipo_cambio: tc,
    comision_pct: comision,
  };
}

export const ef = (m: Moneda, monto: number, tc: number | null = null) => pata("efectivo", m, monto, tc);
export const tr = (m: Moneda, monto: number, tc: number | null = null, com: number | null = null) =>
  pata("transferencia", m, monto, tc, com);
export const pf = (m: Moneda, monto: number, tc: number | null = null) => pata("pago_facil", m, monto, tc);
export const chq = (m: Moneda, monto: number, tc: number | null = null) => pata("cheque", m, monto, tc);

let mv = 0;
/** Construye un movimiento. */
export function mov(
  fecha: string,
  partidas: Partida[],
  opciones: Partial<Pick<Movimiento, "id" | "categoria" | "orden" | "contraparte_id" | "concepto" | "oficina_id" | "afecta_cta_cte">> = {},
): Movimiento {
  return {
    id: opciones.id ?? String(++mv),
    fecha,
    oficina_id: opciones.oficina_id ?? 1,
    contraparte_id: opciones.contraparte_id ?? 1,
    concepto: opciones.concepto ?? "movimiento de prueba",
    categoria: (opciones.categoria ?? "ingreso") as Categoria,
    afecta_cta_cte: opciones.afecta_cta_cte,
    orden: opciones.orden ?? 1,
    partidas,
  };
}

/** Mezcla determinística, para probar que el orden de entrada no importa. */
export function mezclar<T>(xs: readonly T[], semilla = 7): T[] {
  const a = xs.slice();
  let s = semilla;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
