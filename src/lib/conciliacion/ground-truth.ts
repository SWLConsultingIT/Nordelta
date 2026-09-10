/**
 * Validación contra el resultado humano.
 *
 * Mide **precisión**, no cobertura. La cobertura ya la sabemos: qué
 * porcentaje de filas cierra el sistema. Lo que no sabemos es si esas filas
 * están bien cerradas, y eso solo lo dice comparar contra alguien que hizo el
 * mismo trabajo a mano.
 *
 * Regla de aceptación, y es la que ordena todo el archivo:
 *
 *     PRECISIÓN antes que COBERTURA.
 *
 * En una operación financiera un falso positivo es plata dada por cobrada.
 * Un falso negativo es una fila que Mati mira de más. No son comparables, y
 * por eso el umbral propuesto para habilitar cualquier regla automática es
 * **precisión del 100 %**.
 */

import type { EstadoConciliacion, ResultadoFila } from "./index";

/** Lo que Mati puede responder por fila. */
export const RESULTADOS_HUMANOS = [
  "ACREDITADA",
  "NO_ACREDITADA",
  "ERROR",
  "DUPLICADA",
  "OTRO",
] as const;
export type ResultadoHumano = (typeof RESULTADOS_HUMANOS)[number];

/** Identificador neutro de fila: `ROW_01`. No depende de ningún dato real. */
export const idDeFila = (indice: number): string => `ROW_${String(indice + 1).padStart(2, "0")}`;

/**
 * Los dos conjuntos de reglas que se comparan.
 *
 * `CONFIRMADO` es lo que el sistema hace hoy, con la regla de DNI que NORD
 * confirmó. `SOLO_CUIT` es el reglamento anterior, y se conserva para poder
 * medir **cuánto aportó la regla nueva y a qué costo** cuando llegue el
 * resultado humano.
 */
export type Reglamento = "SOLO_CUIT" | "CONFIRMADO";

/** Estados que cada reglamento considera «acreditada por el sistema». */
export function acreditaAutomaticamente(estado: EstadoConciliacion, reglamento: Reglamento): boolean {
  if (estado === "ACREDITADA_EXACTA_CUIT") return true;
  return reglamento === "CONFIRMADO" && estado === "ACREDITADA_EXACTA_DNI";
}

export interface FilaValidacion {
  rowId: string;
  /** Fila de la planilla original, para que Mati pueda ubicarse. */
  filaPlanilla: number;
  fecha: string | null;
  importe: number | null;
  identificacionEnmascarada: string;
  tipoIdentificacion: string;
  estadoAutomatico: EstadoConciliacion;
}

export interface Metricas {
  reglamento: Reglamento;
  filas: number;
  /** Filas que el sistema da por acreditadas. */
  acreditadasPorSistema: number;
  /** Filas que Mati dio por acreditadas. */
  acreditadasPorMati: number;
  verdaderosPositivos: number;
  falsosPositivos: number;
  falsosNegativos: number;
  /** El sistema no acreditó y Mati tampoco: abstención correcta. */
  verdaderosNegativos: number;
  /** `null` cuando el sistema no acreditó nada: la precisión no está definida. */
  precision: number | null;
  /** `null` cuando Mati no acreditó nada. */
  recall: number | null;
  tasaAutomatica: number;
  tasaRevision: number;
  /** ¿Cumple el umbral de precisión del 100 %? */
  aptoParaAutomatizar: boolean;
}

const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 1000) / 10);

/**
 * Cruza el resultado del sistema contra el de Mati.
 *
 * `ACREDITADA` es la única respuesta humana que cuenta como acreditación.
 * `ERROR`, `DUPLICADA` y `OTRO` cuentan como no acreditada: si el sistema
 * acreditó una de esas, **es un falso positivo**, que es exactamente lo que
 * hay que detectar.
 */
export function medir(
  resultados: readonly ResultadoFila[],
  humano: ReadonlyMap<string, ResultadoHumano>,
  reglamento: Reglamento,
): Metricas {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;
  let acreditadasSistema = 0;
  let acreditadasMati = 0;

  resultados.forEach((r, i) => {
    const rowId = idDeFila(i);
    const dijoMati = humano.get(rowId);
    if (dijoMati === undefined) return; // sin respuesta: no se cuenta

    const sistema = acreditaAutomaticamente(r.estado, reglamento);
    const mati = dijoMati === "ACREDITADA";
    if (sistema) acreditadasSistema += 1;
    if (mati) acreditadasMati += 1;

    if (sistema && mati) tp += 1;
    else if (sistema && !mati) fp += 1;
    else if (!sistema && mati) fn += 1;
    else tn += 1;
  });

  const evaluadas = tp + fp + fn + tn;
  return {
    reglamento,
    filas: evaluadas,
    acreditadasPorSistema: acreditadasSistema,
    acreditadasPorMati: acreditadasMati,
    verdaderosPositivos: tp,
    falsosPositivos: fp,
    falsosNegativos: fn,
    verdaderosNegativos: tn,
    precision: tp + fp === 0 ? null : Math.round((tp / (tp + fp)) * 1000) / 10,
    recall: tp + fn === 0 ? null : Math.round((tp / (tp + fn)) * 1000) / 10,
    tasaAutomatica: pct(acreditadasSistema, evaluadas),
    tasaRevision: pct(evaluadas - acreditadasSistema, evaluadas),
    // Cero falsos positivos y al menos una acreditación: sin eso la
    // precisión perfecta no significa nada.
    aptoParaAutomatizar: fp === 0 && tp > 0,
  };
}

/* ── CSV ────────────────────────────────────────────────────── */

/** Punto y coma y BOM: es lo que abre Excel en configuración argentina. */
export const SEPARADOR = ";";
export const BOM = "﻿";

export function campoCsv(v: string | number | null): string {
  const t = v === null || v === undefined ? "" : String(v);
  return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

export function filasACsv(cabecera: readonly string[], filas: readonly (string | number | null)[][]): string {
  return (
    BOM +
    [cabecera.join(SEPARADOR), ...filas.map((f) => f.map(campoCsv).join(SEPARADOR))].join("\r\n") +
    "\r\n"
  );
}

/**
 * Lee el CSV que devuelve Mati.
 *
 * Tolerante a propósito: acepta punto y coma o coma, ignora mayúsculas y
 * acentos en el valor, y **salta las filas sin responder** en lugar de
 * inventarles un resultado. Un archivo que volvió por correo y pasó por
 * Excel no tiene por qué venir prolijo.
 */
export function leerRespuestas(csv: string): {
  respuestas: Map<string, ResultadoHumano>;
  desconocidos: { rowId: string; valor: string }[];
  sinResponder: string[];
} {
  const respuestas = new Map<string, ResultadoHumano>();
  const desconocidos: { rowId: string; valor: string }[] = [];
  const sinResponder: string[] = [];

  const lineas = csv.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lineas.length === 0) return { respuestas, desconocidos, sinResponder };

  const separador = lineas[0].includes(";") ? ";" : ",";
  const cabecera = lineas[0].split(separador).map((h) => h.trim().toLowerCase());
  const iRow = cabecera.findIndex((h) => h.includes("row"));
  const iRes = cabecera.findIndex((h) => h.includes("resultado") || h.includes("result"));
  if (iRow < 0 || iRes < 0) {
    throw new Error(
      `El CSV tiene que traer una columna con "row" y otra con "resultado". Encontradas: ${cabecera.join(", ")}`,
    );
  }

  const normalizar = (s: string) =>
    s
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "_");

  for (const linea of lineas.slice(1)) {
    const celdas = linea.split(separador).map((c) => c.trim().replace(/^"|"$/g, ""));
    const rowId = (celdas[iRow] ?? "").trim().toUpperCase();
    if (rowId === "") continue;
    const crudo = celdas[iRes] ?? "";
    if (crudo.trim() === "") {
      sinResponder.push(rowId);
      continue;
    }
    const valor = normalizar(crudo);
    if ((RESULTADOS_HUMANOS as readonly string[]).includes(valor)) {
      respuestas.set(rowId, valor as ResultadoHumano);
    } else {
      desconocidos.push({ rowId, valor: crudo });
    }
  }

  return { respuestas, desconocidos, sinResponder };
}
