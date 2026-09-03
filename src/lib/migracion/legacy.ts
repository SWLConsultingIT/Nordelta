import type { Categoria, MedioPago, Moneda } from "../domain/types";
import { interpretarCategoria, interpretarFecha } from "../domain/parseo";
import { parsearNumero, redondear, MONTO_MAXIMO } from "../domain/dinero";
import { calcularImpacto, type PartidaCalculable } from "../domain/fx";

/**
 * Transformación de la planilla legacy al modelo normalizado.
 *
 * Una fila ancha de dieciséis columnas se abre en un movimiento con hasta
 * nueve partidas. Cada pata queda con su propio tipo de cambio y su propia
 * comisión, que es lo que conserva la plata que el consolidado 2026 pierde.
 *
 * El proceso es parse → validate → transform → load → reconcile. Ninguna
 * fila se descarta en silencio: lo que no se puede interpretar sale en el
 * reporte de errores.
 */

/** Las dieciséis columnas de la hoja diaria 2026, en orden. */
export const COLUMNAS_LEGACY = [
  "Fecha", "Cliente/Proveedor", "Detalle", "Tipo de Movimiento",
  "PESOS", "TC", "DOLARES", "EUROS", "REALES", "Pago Facil", "Comisión",
  "TC Transferencia", "Transferencia Pesos", "Transferencias en Dolares",
  "Transferencias EUROS", "Transferencia REALES",
] as const;

export interface FilaLegacy {
  fecha: string;
  contraparte: string;
  detalle: string;
  tipoMovimiento: string;
  pesos: string;
  tc: string;
  dolares: string;
  euros: string;
  reales: string;
  pagoFacil: string;
  comision: string;
  tcTransferencia: string;
  transfPesos: string;
  transfDolares: string;
  transfEuros: string;
  transfReales: string;
}

export interface OrigenLegacy {
  source_system: string;
  source_file: string;
  source_sheet: string;
  source_row: number;
  legacy_id: string;
}

export interface MovimientoImportado {
  fecha: string;
  contraparte: string;
  concepto: string;
  categoria: Categoria;
  partidas: PartidaCalculable[];
  origen: OrigenLegacy;
}

export interface ErrorFila {
  fila: number;
  campo: string;
  valor: string;
  motivo: string;
}

/** Convierte un arreglo de celdas en una fila con nombre. */
export function filaDesdeCeldas(celdas: readonly string[]): FilaLegacy {
  const c = (i: number) => (celdas[i] ?? "").trim();
  return {
    fecha: c(0), contraparte: c(1), detalle: c(2), tipoMovimiento: c(3),
    pesos: c(4), tc: c(5), dolares: c(6), euros: c(7), reales: c(8),
    pagoFacil: c(9), comision: c(10), tcTransferencia: c(11),
    transfPesos: c(12), transfDolares: c(13), transfEuros: c(14), transfReales: c(15),
  };
}

/** ¿La fila está completamente vacía? Las plantillas traen cientos así. */
export function filaVaciaLegacy(f: FilaLegacy): boolean {
  return Object.values(f).every((v) => v === "");
}

interface Pata {
  medio: MedioPago;
  moneda: Moneda;
  monto: string;
  tc: string | null;
  comision: boolean;
}

/**
 * Las nueve patas posibles de una fila ancha.
 *
 * `PESOS` y `Pago Facil` comparten el tipo de cambio `TC`, tal como los suma
 * el consolidado antes de dividir. Las cuatro patas de transferencia llevan
 * comisión; las de efectivo no.
 */
const PATAS: Pata[] = [
  { medio: "efectivo",      moneda: "ARS", monto: "pesos",         tc: "tc",              comision: false },
  { medio: "pago_facil",    moneda: "ARS", monto: "pagoFacil",     tc: "tc",              comision: false },
  { medio: "efectivo",      moneda: "USD", monto: "dolares",       tc: null,              comision: false },
  { medio: "efectivo",      moneda: "EUR", monto: "euros",         tc: null,              comision: false },
  { medio: "efectivo",      moneda: "BRL", monto: "reales",        tc: null,              comision: false },
  { medio: "transferencia", moneda: "ARS", monto: "transfPesos",   tc: "tcTransferencia", comision: true },
  { medio: "transferencia", moneda: "USD", monto: "transfDolares", tc: null,              comision: true },
  { medio: "transferencia", moneda: "EUR", monto: "transfEuros",   tc: null,              comision: true },
  { medio: "transferencia", moneda: "BRL", monto: "transfReales",  tc: null,              comision: true },
];

export interface ResultadoTransformacion {
  movimiento: MovimientoImportado | null;
  errores: ErrorFila[];
}

/** Transforma una fila ancha en un movimiento con sus patas. */
export function transformarFila(
  f: FilaLegacy,
  origen: Omit<OrigenLegacy, "legacy_id"> & { legacy_id?: string },
): ResultadoTransformacion {
  const errores: ErrorFila[] = [];
  const fila = origen.source_row;
  const err = (campo: string, valor: string, motivo: string) =>
    errores.push({ fila, campo, valor, motivo });

  const fecha = interpretarFecha(f.fecha);
  if (!fecha) err("Fecha", f.fecha, "No se pudo interpretar como fecha");

  if (f.contraparte === "") err("Cliente/Proveedor", "", "Falta la contraparte");

  const categoria = interpretarCategoria(f.tipoMovimiento);
  if (!categoria) {
    err("Tipo de Movimiento", f.tipoMovimiento,
        "No corresponde a ninguna categoría conocida");
  }

  const comisionPct = numeroDe(f.comision, "Comisión", err);
  const tcGeneral = numeroDe(f.tc, "TC", err);
  const tcTransf = numeroDe(f.tcTransferencia, "TC Transferencia", err);

  const partidas: PartidaCalculable[] = [];
  for (const pata of PATAS) {
    const crudo = f[pata.monto as keyof FilaLegacy];
    const monto = numeroDe(crudo, pata.monto, err);
    if (monto === null || monto === 0) continue;

    if (Math.abs(monto) > MONTO_MAXIMO) {
      err(pata.monto, crudo, `Supera el máximo admitido (${MONTO_MAXIMO})`);
      continue;
    }

    const tc = pata.tc === "tc" ? tcGeneral : pata.tc === "tcTransferencia" ? tcTransf : null;
    partidas.push({
      medio_pago: pata.medio,
      moneda_nominal: pata.moneda,
      monto_nominal: monto,
      // Una pata ya en dólares no lleva tipo de cambio.
      tipo_cambio: pata.moneda === "USD" ? null : tc && tc > 0 ? tc : null,
      comision_pct: pata.comision && comisionPct ? comisionPct : null,
    });
  }

  if (partidas.length === 0 && errores.length === 0) {
    err("montos", "", "La fila no tiene ningún importe distinto de cero");
  }

  if (errores.length > 0 || !fecha || !categoria) {
    return { movimiento: null, errores };
  }

  return {
    movimiento: {
      fecha,
      contraparte: f.contraparte,
      concepto: f.detalle,
      categoria,
      partidas,
      origen: {
        ...origen,
        // Identidad de origen: es la clave de idempotencia. Nunca se
        // deduplica por contenido financiero — dos pagos idénticos son dos
        // pagos, y ese era el bug 2 del legacy.
        legacy_id: origen.legacy_id ?? `${origen.source_sheet}:${origen.source_row}`,
      },
    },
    errores,
  };
}

function numeroDe(
  crudo: string,
  campo: string,
  err: (c: string, v: string, m: string) => void,
): number | null {
  if (crudo === "") return null;
  const n = parsearNumero(crudo);
  if (n === null) {
    err(campo, crudo, "No es un número");
    return null;
  }
  return n;
}

/* ── Conciliación ──────────────────────────────────────────────
   Reproduce la fórmula del consolidado 2026 para poder comparar, fila por
   fila, lo que el sistema viejo habría calculado contra lo que calcula el
   nuevo. Las diferencias esperadas son los bugs corregidos; cualquier otra
   es una señal de que algo se interpretó mal.
   ──────────────────────────────────────────────────────────────── */

export interface Diferencia {
  fila: number;
  moneda: Moneda;
  legacy: number | null;
  nuevo: number;
  motivo: MotivoDiferencia;
  /** Patas que la fórmula legacy descartó, cuando eso explica la diferencia. */
  patasDescartadas?: string[];
}

export type MotivoDiferencia =
  /** El legacy anulaba la columna de pesos porque existía algún tipo de
   *  cambio, sin recuperar la pata sin convertir. Bug 5. */
  | "bug5_columna_anulada"
  /** El legacy usaba un o-exclusivo donde correspondía una suma, y
   *  descartaba una pata entera. Bug 6. */
  | "bug6_pata_descartada"
  /** Diferencia que no se explica por ningún defecto conocido: hay que
   *  investigarla antes de migrar. */
  | "sin_explicar";

/** Lo que el consolidado 2026 habría producido para esta fila. */
export function consolidadoLegacy(f: FilaLegacy): Record<Moneda, number | null> {
  const n = (s: string) => parsearNumero(s) ?? 0;
  const com = n(f.comision);
  const tc = n(f.tc);
  const tct = n(f.tcTransferencia);
  const pesos = n(f.pesos);
  const pf = n(f.pagoFacil);
  const trp = n(f.transfPesos);

  return {
    ARS: tc > 0 || tct > 0 ? null : redondear(pesos + pf + trp * (1 + com), 2),
    USD: redondear(
      (n(f.dolares) !== 0 ? n(f.dolares) : tc > 0 ? (pesos + pf) / tc : 0) +
      (n(f.transfDolares) !== 0
        ? n(f.transfDolares) * (1 + com)
        : tct > 0 ? (trp * (1 + com)) / tct : 0),
      2),
    EUR: redondear(n(f.euros) + n(f.transfEuros) * (1 + com), 2),
    BRL: redondear(n(f.reales) + n(f.transfReales) * (1 + com), 2),
  };
}

/**
 * Qué patas descarta la fórmula legacy para una fila dada.
 *
 * Es el corazón de la conciliación: sin esto, toda diferencia queda como
 * «sin explicar» y no se puede distinguir un defecto conocido de un error
 * de interpretación nuestro.
 */
function patasDescartadasPorLegacy(f: FilaLegacy): { moneda: Moneda; pata: string }[] {
  const n = (s: string) => parsearNumero(s) ?? 0;
  const tc = n(f.tc);
  const tct = n(f.tcTransferencia);
  const fuera: { moneda: Moneda; pata: string }[] = [];

  // Bug 5: la columna de pesos se anula si existe cualquiera de los dos TC,
  // pero DOLARES solo recupera la pata efectivo cuando TC > 0.
  if (tc > 0 || tct > 0) {
    if (tc === 0 && n(f.pesos) !== 0) fuera.push({ moneda: "ARS", pata: "PESOS" });
    if (tc === 0 && n(f.pagoFacil) !== 0) fuera.push({ moneda: "ARS", pata: "Pago Facil" });
    if (tct === 0 && n(f.transfPesos) !== 0) fuera.push({ moneda: "ARS", pata: "Transferencia Pesos" });
  }

  // Bug 6: `IF DOLARES <> 0 THEN DOLARES ELSIF TC > 0 THEN (PESOS+PF)/TC`.
  // Con un nominal en dólares presente, la pata convertida se descarta.
  if (n(f.dolares) !== 0 && tc > 0) {
    if (n(f.pesos) !== 0) fuera.push({ moneda: "USD", pata: "PESOS convertido" });
    if (n(f.pagoFacil) !== 0) fuera.push({ moneda: "USD", pata: "Pago Facil convertido" });
  }
  if (n(f.transfDolares) !== 0 && tct > 0 && n(f.transfPesos) !== 0) {
    fuera.push({ moneda: "USD", pata: "Transferencia Pesos convertida" });
  }

  return fuera;
}

/** Compara una fila legacy con su versión importada. */
export function conciliarFila(f: FilaLegacy, mov: MovimientoImportado): Diferencia[] {
  const viejo = consolidadoLegacy(f);
  const nuevo: Record<Moneda, number> = { ARS: 0, USD: 0, EUR: 0, BRL: 0 };
  for (const p of mov.partidas) {
    const i = calcularImpacto(p);
    nuevo[i.moneda] += i.monto;
  }

  const descartadas = patasDescartadasPorLegacy(f);
  const out: Diferencia[] = [];

  for (const m of ["ARS", "USD", "EUR", "BRL"] as Moneda[]) {
    const n2 = redondear(nuevo[m], 2);
    const v = viejo[m];
    if (v !== null && redondear(v, 2) === n2) continue;
    if (v === null && n2 === 0) continue;

    const patas = descartadas.filter((d) => d.moneda === m).map((d) => d.pata);
    const motivo: MotivoDiferencia =
      patas.length === 0 ? "sin_explicar"
      : v === null ? "bug5_columna_anulada"
      : "bug6_pata_descartada";

    out.push({
      fila: mov.origen.source_row,
      moneda: m,
      legacy: v,
      nuevo: n2,
      motivo,
      ...(patas.length > 0 ? { patasDescartadas: patas } : {}),
    });
  }
  return out;
}
