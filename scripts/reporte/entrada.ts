/**
 * Lo que el changelog no puede saber.
 *
 * Del repositorio sale qué se hizo. No sale qué quedó pendiente, qué
 * estamos esperando del cliente ni qué sigue la semana que viene: eso son
 * decisiones, no commits. Va en un archivo por semana que se completa a
 * mano en dos minutos.
 *
 * La regla que sostiene todo el sistema: **este archivo nunca se inventa**.
 * Si una lista está vacía, el reporte dice que está vacía. Un one-pager con
 * un «pendiente» que nadie escribió es peor que uno con una sección corta.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export type Estado = "ON TRACK" | "AT RISK" | "BLOCKED";

const ESTADOS: Estado[] = ["ON TRACK", "AT RISK", "BLOCKED"];

export interface EntradaSemanal {
  weekStart: string;
  weekEnd: string;
  /** Sin evidencia no se inventa: queda en null y el PDF omite el sello. */
  status: Estado | null;
  /** Logros que el changelog no puede ver (reuniones, relevamientos, acuerdos). */
  progressExtra: string[];
  /** Abierto de nuestro lado. */
  pending: string[];
  /** Lo que necesitamos del cliente. */
  openItems: string[];
  /** Qué hacemos la semana que viene. */
  nextSteps: string[];
}

export const PLANTILLA: EntradaSemanal = {
  weekStart: "",
  weekEnd: "",
  status: null,
  progressExtra: [],
  pending: [],
  openItems: [],
  nextSteps: [],
};

export function rutaDeEntrada(raiz: string, hasta: string): string {
  return join(raiz, "reports", "weekly", `${hasta}.json`);
}

/** Texto de una viñeta: recortado, sin saltos y sin vacíos. */
function limpiarLista(valor: unknown, campo: string): string[] {
  if (valor === undefined || valor === null) return [];
  if (!Array.isArray(valor)) throw new Error(`${campo} tiene que ser una lista.`);
  return valor
    .map((v, i) => {
      if (typeof v !== "string") throw new Error(`${campo}[${i}] tiene que ser texto.`);
      return v.replace(/\s+/g, " ").trim();
    })
    .filter(Boolean);
}

export function leerEntrada(ruta: string): EntradaSemanal {
  if (!existsSync(ruta)) return { ...PLANTILLA };

  let crudo: unknown;
  try {
    crudo = JSON.parse(readFileSync(ruta, "utf8"));
  } catch (e) {
    throw new Error(`${ruta} no es JSON válido: ${(e as Error).message}`);
  }
  if (typeof crudo !== "object" || crudo === null) {
    throw new Error(`${ruta} tiene que contener un objeto.`);
  }
  const o = crudo as Record<string, unknown>;

  const status = o.status ?? null;
  if (status !== null && !ESTADOS.includes(status as Estado)) {
    throw new Error(`status tiene que ser uno de ${ESTADOS.join(", ")} o null. Vino: ${String(status)}`);
  }

  return {
    weekStart: typeof o.weekStart === "string" ? o.weekStart : "",
    weekEnd: typeof o.weekEnd === "string" ? o.weekEnd : "",
    status: status as Estado | null,
    progressExtra: limpiarLista(o.progressExtra, "progressExtra"),
    pending: limpiarLista(o.pending, "pending"),
    openItems: limpiarLista(o.openItems, "openItems"),
    nextSteps: limpiarLista(o.nextSteps, "nextSteps"),
  };
}
