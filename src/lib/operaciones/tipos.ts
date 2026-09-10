/**
 * Modelo operativo de acreditaciones y conciliación.
 *
 * Vive al lado del dominio financiero, no adentro: una transferencia
 * acreditada **no es** un movimiento contable. La operación registra el
 * hecho; el movimiento registra el impacto, y el puente entre los dos lo
 * acciona una persona hasta que NORD defina la regla.
 */

import type { EstadoConciliacion } from "../conciliacion";
import type { TipoIdentificacion } from "../planillas/identificacion";

/**
 * Estados que puede tener una operación en la vida real.
 *
 * Son los once que produce el matcher más dos que solo puede producir una
 * persona. Se separan a propósito: `ACREDITADA_MANUAL` significa «la cerró
 * Mati», y mezclarla con las automáticas haría que la tasa de automatización
 * —que es la métrica del proyecto— se infle sola.
 */
export type EstadoOperacional =
  | EstadoConciliacion
  /** Mati confirmó un candidato que el sistema no se animó a elegir. */
  | "ACREDITADA_MANUAL"
  /** Mati confirmó que la fila estaba duplicada. No se acredita. */
  | "DESCARTADA_DUPLICADO";

/**
 * Los cinco grupos con los que se opera.
 *
 * `PENDIENTE`, `REVISION` y `ERROR` son los tres que **requieren atención**.
 * La regla confirmada por NORD es que los tres son problema desde el día
 * cero: no hay período de gracia y ninguno se esconde. Lo que los separa no
 * es la urgencia sino **quién puede hacer algo**.
 */
export type Bucket = "CONCILIADA" | "RESUELTA" | "PENDIENTE" | "REVISION" | "ERROR";

export interface Cliente {
  id: string;
  nombre: string;
  /** Identificador corto para columnas densas. */
  alias: string;
}

/** Correo desde el que un cliente manda planillas. */
export interface ClienteEmail {
  clienteId: string;
  email: string;
  principal: boolean;
}

/**
 * Estados de una planilla. Seis y no más: cada estado visual que se agrega
 * es una celda que alguien tiene que interpretar.
 */
export type EstadoPlanilla =
  | "RECIBIDA"
  | "CON_ERRORES"
  | "LISTA"
  | "ENVIADA"
  | "PENDIENTE"
  | "ACREDITADA";

export interface Planilla {
  id: string;
  clienteId: string;
  archivo: string;
  /** Fecha en que el cliente la mandó. */
  fecha: string;
  /** Momento de la importación al sistema. ISO con hora. */
  importadaEn: string;
  estado: EstadoPlanilla;
  /**
   * Huella del archivo tal como llegó.
   *
   * En el flujo por correo el mismo adjunto llega varias veces. Sin la
   * huella, cada reenvío duplica las transferencias del cliente.
   */
  sha256?: string | null;
  /** Dónde quedó el original. Es la prueba de qué mandó el cliente. */
  storagePath?: string | null;
  /** Derivados de sus transferencias, guardados para no recontar. */
  filas?: number;
  totalCentavos?: number;
}

/** Una acreditación del informe de Fullcarga, ya guardada en el pozo. */
export interface AcreditacionGuardada {
  id: string;
  informeId: string;
  cuit: string;
  fecha: string;
  importe: number;
  banco: string | null;
  descripcion: string | null;
  /** Fila del informe, para poder auditar contra el archivo original. */
  row: number;
}

export interface Informe {
  id: string;
  archivo: string;
  desde: string;
  hasta: string;
  origen: "AUTOMATICO" | "MANUAL";
  importadoEn: string;
  acreditaciones: number;
  sha256?: string | null;
  storagePath?: string | null;
}

/**
 * Una transferencia declarada por un cliente.
 *
 * Guarda a la vez **lo que mandó el cliente** (nunca se pisa) y **el
 * resultado de la última conciliación**. Que convivan en la misma entidad es
 * deliberado: el estado de una operación es una función de sus datos y del
 * pozo de acreditaciones, y separarlos obligaría a un join en cada pantalla.
 */
export interface Operacion {
  id: string;
  planillaId: string;
  clienteId: string;
  /** Fila en la planilla original, para que Mati pueda ubicarse. */
  fila: number;

  /* ── Lo que mandó el cliente. Inmutable. ── */
  fechaDeposito: string;
  banco: string | null;
  nombreDepositante: string | null;
  identificacionOriginal: string;
  identificacionNormalizada: string;
  tipoIdentificacion: TipoIdentificacion;
  importe: number;
  numeroDeposito: string | null;

  /* ── Resultado de la última evaluación. ── */
  estado: EstadoOperacional;
  motivo: string;
  /** La acreditación consumida, si se acreditó. */
  acreditacionId: string | null;
  /** Candidatos cuando decide una persona. */
  candidatoIds: string[];
  /** Otras filas de la misma planilla que se le parecen. */
  duplicadoDe: number[];
  /** Verdadero solo si lo cerró el sistema sin intervención. */
  automatico: boolean;
  /** Se acreditó porque Mati había confirmado antes esta identidad. */
  viaMapeo: boolean;
  fechaAcreditacion: string | null;
  /** Momento de la última vez que se intentó conciliar. */
  evaluadaEn: string;
  /** Cuántas veces se intentó. Distingue «recién entró» de «hace un mes». */
  intentos: number;
}

/** Lo que Mati puede decidir sobre una excepción. */
export type Decision =
  | "CONFIRMAR_MATCH"
  | "RECHAZAR_CANDIDATOS"
  | "MANTENER_PENDIENTE"
  | "MARCAR_DUPLICADO";

/**
 * De dónde salió una resolución.
 *
 * Hoy todas son humanas —una resolución es alguien decidiendo—, pero el
 * origen queda explícito porque de él depende la regla que gobierna la
 * re-evaluación: **una decisión humana no la pisa una corrida automática.**
 */
export type OrigenResolucion = "HUMANA" | "AUTOMATICA";

export interface Resolucion {
  id: string;
  operacionId: string;
  decision: Decision;
  origen: OrigenResolucion;
  /** La acreditación elegida, cuando la decisión es confirmar. */
  acreditacionId: string | null;
  /**
   * En qué estado estaba la operación justo antes de la decisión.
   *
   * Se guarda para poder auditar una acreditación discutida meses después
   * sin tener que reconstruir la historia entera desde los eventos.
   */
  estadoPrevio: EstadoOperacional;
  actor: string;
  /** ISO con hora. */
  momento: string;
  motivo: string | null;
  /** Si la resolución dejó además un mapeo de identidad aprendido. */
  mapeoId: string | null;
}

/**
 * Una identidad confirmada por una persona.
 *
 * **Nunca se deduce.** Es la afirmación «el depositante que el cliente
 * identifica así es el titular de este CUIT real», y la hizo alguien con
 * nombre y fecha. El sistema la aplica en corridas futuras; no la inventa.
 *
 * `clienteId` acota el alcance a un cliente. Es el alcance más angosto
 * posible y por eso el que no puede aplicar mal en otro lado.
 * **TO VALIDATE — F-3:** NORD tiene que decir si un mapeo confirmado vale
 * para todos los clientes o solo para el que lo originó.
 */
export interface MapeoIdentidad {
  id: string;
  clienteId: string;
  /** Lo que escribe el cliente en su planilla, normalizado a dígitos. */
  identificacion: string;
  /** El CUIT real que devolvió Fullcarga. */
  cuit: string;
  actor: string;
  momento: string;
  origen: "RESOLUCION" | "MANUAL";
  /** Cuántas veces se aplicó después. Mide si aprender sirvió. */
  usos: number;
}

/** Cambio de estado de una operación. El «qué pasó, cuándo y por qué». */
export interface Evento {
  id: string;
  operacionId: string;
  momento: string;
  de: EstadoOperacional | null;
  a: EstadoOperacional;
  motivo: string;
  actor: string;
  origen: "IMPORTACION" | "CONCILIACION" | "RESOLUCION";
}

/** Una corrida de conciliación. Sirve para saber si la cola crece o drena. */
export interface Corrida {
  id: string;
  momento: string;
  disparador: "MANUAL" | "IMPORTACION_PLANILLA" | "IMPORTACION_INFORME";
  operacionesEvaluadas: number;
  nuevasAcreditadas: number;
  /** Acreditadas gracias a un mapeo aprendido. Mide el efecto compuesto. */
  porMapeo: number;
  pendientesAlCierre: number;
  /**
   * Cuánto tardó, en milisegundos.
   *
   * Con 300–600 operaciones por día y una cola que en régimen es de miles,
   * saber si la corrida empieza a degradarse importa antes de que moleste.
   */
  duracionMs?: number;
}
