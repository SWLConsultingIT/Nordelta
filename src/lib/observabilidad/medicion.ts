"use client";

/**
 * Medición de la grilla de carga, solo en desarrollo.
 *
 * Existe para poder responder con números la única pregunta que decide el
 * proyecto: ¿cargar acá es más rápido que en el Sheet? Ver
 * docs/CARGA_USABILITY_TEST.md.
 *
 * No manda nada a ningún servicio: queda en la consola y en
 * `window.__nordeltaMediciones` para poder exportarlo al final de una sesión
 * de prueba. Sin analytics de terceros y sin datos financieros: solo
 * duraciones y cantidades.
 */

export interface Medicion {
  operacion: "pegado" | "validacion" | "guardado" | "edicion_celda";
  duracionMs: number;
  filas?: number;
  errores?: number;
  momento: number;
}

const activo = process.env.NODE_ENV !== "production";

declare global {
  interface Window {
    __nordeltaMediciones?: Medicion[];
  }
}

function guardar(m: Medicion) {
  if (!activo || typeof window === "undefined") return;
  (window.__nordeltaMediciones ??= []).push(m);
  console.debug(
    `[medición] ${m.operacion} ${m.duracionMs.toFixed(1)} ms` +
      (m.filas !== undefined ? ` · ${m.filas} filas` : "") +
      (m.errores ? ` · ${m.errores} errores` : ""),
  );
}

/** Mide una operación síncrona de la grilla. */
export function medir<T>(
  operacion: Medicion["operacion"],
  fn: () => T,
  detalle: { filas?: number; errores?: number } = {},
): T {
  if (!activo) return fn();
  const t0 = performance.now();
  try {
    return fn();
  } finally {
    guardar({ operacion, duracionMs: performance.now() - t0, ...detalle, momento: Date.now() });
  }
}

/** Mide una operación asíncrona, como el guardado. */
export async function medirAsync<T>(
  operacion: Medicion["operacion"],
  fn: () => Promise<T>,
  detalle: { filas?: number; errores?: number } = {},
): Promise<T> {
  if (!activo) return fn();
  const t0 = performance.now();
  try {
    return await fn();
  } finally {
    guardar({ operacion, duracionMs: performance.now() - t0, ...detalle, momento: Date.now() });
  }
}

/** Resumen de la sesión, para pegar en el protocolo de la prueba. */
export function resumenDeMediciones(): string {
  if (typeof window === "undefined") return "";
  const ms = window.__nordeltaMediciones ?? [];
  if (ms.length === 0) return "Sin mediciones en esta sesión.";

  const porOperacion = new Map<string, number[]>();
  for (const m of ms) {
    const lista = porOperacion.get(m.operacion) ?? [];
    lista.push(m.duracionMs);
    porOperacion.set(m.operacion, lista);
  }

  const lineas = [...porOperacion].map(([op, ds]) => {
    const orden = ds.slice().sort((a, b) => a - b);
    const p = (q: number) => orden[Math.min(orden.length - 1, Math.floor(orden.length * q))];
    return `${op}: n=${ds.length} · p50=${p(0.5).toFixed(1)}ms · p95=${p(0.95).toFixed(1)}ms · max=${orden.at(-1)!.toFixed(1)}ms`;
  });
  return lineas.join("\n");
}
