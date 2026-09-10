/**
 * De los trece estados a los cinco grupos con los que se opera.
 *
 * El motor distingue trece estados porque **el motivo importa para
 * resolver**. La pantalla agrupa porque **el grupo importa para priorizar**.
 * No son dos verdades en conflicto: el grupo ordena la lista, el estado
 * explica la fila.
 *
 * Regla confirmada por NORD y es la que gobierna este archivo:
 *
 *     TODO LO QUE EL SISTEMA NO CERRÓ SOLO ES UN PROBLEMA VISIBLE,
 *     DESDE EL MOMENTO DEL ENVÍO.
 *
 * No hay período de gracia, no hay umbral de antigüedad y **no existe una
 * categoría «en curso» donde esconder pendientes**. Lo que sí se distingue
 * es qué puede hacer una persona con cada uno, que es distinto de si es un
 * problema.
 */

import type { Tono } from "@/components/ui";
import type { Bucket, EstadoOperacional } from "./tipos";

const BUCKET: Record<EstadoOperacional, Bucket> = {
  ACREDITADA_EXACTA_CUIT: "CONCILIADA",
  ACREDITADA_EXACTA_DNI: "CONCILIADA",
  ACREDITADA_MANUAL: "RESUELTA",
  DESCARTADA_DUPLICADO: "RESUELTA",
  PENDIENTE_NO_ENCONTRADA_EN_RANGO: "PENDIENTE",
  MATCH_AMBIGUO: "REVISION",
  POSIBLE_MATCH: "REVISION",
  IDENTITY_MAPPING_REQUIRED: "REVISION",
  POSIBLE_DUPLICADO: "REVISION",
  ERROR_CUIT: "ERROR",
  ERROR_IDENTIFICACION: "ERROR",
  COMPROBANTE_INVALIDO: "ERROR",
  DATOS_INVALIDOS: "ERROR",
};

export function bucketDe(estado: EstadoOperacional): Bucket {
  return BUCKET[estado];
}

/** Los tres grupos que requieren atención. El orden es el de la pantalla. */
export const BUCKETS_ATENCION: readonly Bucket[] = ["PENDIENTE", "REVISION", "ERROR"];

/** ¿Requiere que alguien mire esta operación? */
export function requiereAtencion(estado: EstadoOperacional): boolean {
  return BUCKETS_ATENCION.includes(bucketDe(estado));
}

/** ¿La operación está cerrada con plata efectivamente acreditada? */
export function estaAcreditada(estado: EstadoOperacional): boolean {
  return (
    estado === "ACREDITADA_EXACTA_CUIT" ||
    estado === "ACREDITADA_EXACTA_DNI" ||
    estado === "ACREDITADA_MANUAL"
  );
}

export interface DescripcionBucket {
  etiqueta: string;
  /** Qué significa el grupo, en una frase. */
  explicacion: string;
  /** Qué hace Mati con las filas de este grupo. */
  accion: string;
  tono: Tono;
}

export const BUCKETS: Record<Bucket, DescripcionBucket> = {
  CONCILIADA: {
    etiqueta: "Conciliadas automáticamente",
    explicacion: "El sistema encontró la acreditación y la cerró solo.",
    accion: "Nada. Ya está.",
    tono: "pos",
  },
  RESUELTA: {
    etiqueta: "Resueltas por vos",
    explicacion: "Las cerraste vos revisando una excepción.",
    accion: "Nada. Ya está.",
    tono: "brand",
  },
  PENDIENTE: {
    etiqueta: "Pendientes de acreditación",
    explicacion: "El cliente la declaró y todavía no aparece en Fullcarga.",
    accion: "Monitorear. Se vuelve a buscar con cada informe nuevo.",
    tono: "warn",
  },
  REVISION: {
    etiqueta: "Requieren revisión",
    explicacion: "Hay información suficiente, pero la decisión es tuya.",
    accion: "Elegir. El sistema no adivina entre dos candidatos.",
    tono: "warn",
  },
  ERROR: {
    etiqueta: "Con error",
    explicacion: "El dato que mandó el cliente está mal.",
    accion: "Pedir corrección al cliente.",
    tono: "neg",
  },
};

export interface DescripcionEstado {
  /** Lo que ve Mati. Nunca el código técnico. */
  etiqueta: string;
  /** Qué pasó, en una frase. */
  quePaso: string;
  /** Qué tiene que hacer, en imperativo. */
  queHacer: string;
}

/**
 * Cada estado explicado para quien opera.
 *
 * `ERROR_CUIT` no le dice nada a nadie. «El CUIT tiene once dígitos pero el
 * verificador no cierra» sí, y «solicitar corrección al cliente» le dice qué
 * hacer con eso. El código técnico existe y se puede mostrar, pero como
 * dato secundario, nunca como mensaje principal.
 */
export const ESTADOS: Record<EstadoOperacional, DescripcionEstado> = {
  ACREDITADA_EXACTA_CUIT: {
    etiqueta: "Acreditada",
    quePaso: "Coinciden CUIT, fecha e importe con una única acreditación.",
    queHacer: "Nada.",
  },
  ACREDITADA_EXACTA_DNI: {
    etiqueta: "Acreditada por DNI",
    quePaso:
      "El DNI informado es el documento de un CUIT real de persona física, y coinciden fecha e importe.",
    queHacer: "Nada.",
  },
  ACREDITADA_MANUAL: {
    etiqueta: "Acreditada por vos",
    quePaso: "Confirmaste vos el candidato que el sistema no eligió solo.",
    queHacer: "Nada.",
  },
  DESCARTADA_DUPLICADO: {
    etiqueta: "Descartada",
    quePaso: "La marcaste como duplicada de otra fila de la misma planilla.",
    queHacer: "Nada.",
  },
  PENDIENTE_NO_ENCONTRADA_EN_RANGO: {
    etiqueta: "Pendiente de acreditación",
    quePaso: "No aparece todavía en ningún informe de Fullcarga.",
    queHacer: "Monitorear. Se reintenta con cada informe nuevo.",
  },
  MATCH_AMBIGUO: {
    etiqueta: "Match ambiguo",
    quePaso: "Hay más de una acreditación que encaja, o dos filas se pelean la misma.",
    queHacer: "Elegir cuál corresponde.",
  },
  POSIBLE_MATCH: {
    etiqueta: "CUIT parecido",
    quePaso: "Hay un CUIT a un solo dígito de distancia. Suele ser un error de tipeo.",
    queHacer: "Confirmar si es la misma persona, o pedir corrección.",
  },
  IDENTITY_MAPPING_REQUIRED: {
    etiqueta: "Identidad a confirmar",
    quePaso: "El documento aparece en Fullcarga, pero no cuadra la fecha o el importe.",
    queHacer: "Revisar si es la misma operación.",
  },
  POSIBLE_DUPLICADO: {
    etiqueta: "Posible duplicado",
    quePaso: "Otra fila de la misma planilla tiene igual identificación, fecha e importe.",
    queHacer: "Confirmar si son dos transferencias o una cargada dos veces.",
  },
  ERROR_CUIT: {
    etiqueta: "CUIT incorrecto",
    quePaso: "Tiene once dígitos pero el verificador no cierra.",
    queHacer: "Solicitar corrección al cliente.",
  },
  ERROR_IDENTIFICACION: {
    etiqueta: "Identificación inválida",
    quePaso: "Lo informado no es ni un CUIT ni un DNI.",
    queHacer: "Solicitar corrección al cliente.",
  },
  COMPROBANTE_INVALIDO: {
    etiqueta: "Comprobante inválido",
    quePaso: "Falta el número de depósito o tiene letras y guiones.",
    queHacer: "Pedir el comprobante al cliente. Fullcarga lo rechaza así.",
  },
  DATOS_INVALIDOS: {
    etiqueta: "Datos incompletos",
    quePaso: "Falta la fecha o el importe: no se puede ni intentar.",
    queHacer: "Solicitar la fila completa al cliente.",
  },
};

/** Tono de color de un estado. Deriva del grupo: el color significa una cosa. */
export function tonoDe(estado: EstadoOperacional): Tono {
  return BUCKETS[bucketDe(estado)].tono;
}
