/**
 * Emparejamiento entre lo enviado y lo acreditado.
 *
 * **Diseño, no producción.** Existe para demostrar que las acreditaciones
 * parseadas alcanzan para conciliar, y para que la regla quede escrita y
 * discutible antes de construir el módulo de verdad.
 *
 * Reglas confirmadas por NORD que están codificadas acá:
 *
 *   · el emparejamiento es por **CUIT + fecha**, con el monto como señal
 *     adicional. El monto solo no alcanza: hay muchas transferencias del
 *     mismo importe;
 *   · **las acreditaciones son siempre totales.** No existen parciales, así
 *     que un importe distinto no es un pago parcial: es una anomalía;
 *   · un CUIT parecido **nunca** se empareja solo. Se sugiere y decide una
 *     persona.
 *
 * Todo veredicto es explicable en una frase: el `motivo` está pensado para
 * mostrárselo a Mati, no para depurar.
 */

import { esCero } from "../domain/dinero";
import { cuitsParecidos, type Parecido } from "./cuit";
import type { Acreditacion } from "./informe";

/** Una transferencia que Nordelta declaró haber enviado. */
export interface Enviada {
  id: string;
  cuit: string;
  /** `YYYY-MM-DD`. */
  fecha: string;
  importe: number;
}

export type Veredicto =
  /** CUIT, fecha e importe coinciden. Se concilia sin intervención. */
  | "MATCH_EXACTO"
  /** CUIT y fecha coinciden, el importe no. Requiere mirada. */
  | "MATCH_PROBABLE"
  /** El CUIT difiere en un dígito. **Sugerencia, nunca automático.** */
  | "POSIBLE_MATCH"
  /** Varios candidatos igual de buenos. Elige una persona. */
  | "AMBIGUO"
  /** Nada que se le parezca. */
  | "SIN_MATCH";

export interface Resultado {
  acreditacion: Acreditacion;
  veredicto: Veredicto;
  /** Los enviados candidatos. Vacío en `SIN_MATCH`. */
  candidatos: Enviada[];
  motivo: string;
  /** Solo en `POSIBLE_MATCH`: en qué se parecen los CUIT. */
  parecido?: Parecido;
  /** Verdadero cuando el sistema puede cerrarlo solo. */
  automatico: boolean;
}

export interface OpcionesMatching {
  /**
   * Días de tolerancia entre la fecha enviada y la acreditada.
   *
   * Cero por defecto, y **es a propósito**: en el archivo real la fecha de la
   * observación coincide exactamente con FECHA INGRESO en las 82 filas, así
   * que no hay evidencia que justifique una ventana. Ampliarla sin datos es
   * inventar tolerancia y aumentar los falsos positivos.
   */
  toleranciaDias?: number;
}

/** Diferencia en días entre dos fechas ISO, sin usar `Date`. */
export function diferenciaEnDias(a: string, b: string): number {
  const dias = (iso: string): number => {
    const [y, m, d] = iso.split("-").map(Number);
    // Algoritmo de días julianos: aritmética entera, sin husos horarios.
    const a2 = Math.floor((14 - m) / 12);
    const y2 = y + 4800 - a2;
    const m2 = m + 12 * a2 - 3;
    return (
      d + Math.floor((153 * m2 + 2) / 5) + 365 * y2 + Math.floor(y2 / 4) -
      Math.floor(y2 / 100) + Math.floor(y2 / 400) - 32045
    );
  };
  return Math.abs(dias(a) - dias(b));
}

/**
 * Empareja una acreditación contra el conjunto de lo enviado.
 *
 * Orden de preferencia: CUIT exacto primero, y recién si no hay ninguno se
 * buscan parecidos. Nunca al revés — un parecido no debe poder ganarle a una
 * coincidencia exacta.
 */
export function emparejar(
  acreditacion: Acreditacion,
  enviadas: readonly Enviada[],
  opciones: OpcionesMatching = {},
): Resultado {
  const tolerancia = opciones.toleranciaDias ?? 0;

  const mismaFecha = (e: Enviada) => diferenciaEnDias(e.fecha, acreditacion.fecha) <= tolerancia;
  const mismoImporte = (e: Enviada) => esCero(e.importe - acreditacion.importe);

  const porCuit = enviadas.filter((e) => e.cuit === acreditacion.cuit);
  const porCuitYFecha = porCuit.filter(mismaFecha);

  const exactos = porCuitYFecha.filter(mismoImporte);
  if (exactos.length === 1) {
    return {
      acreditacion,
      veredicto: "MATCH_EXACTO",
      candidatos: exactos,
      motivo: "CUIT, fecha e importe coinciden",
      automatico: true,
    };
  }
  if (exactos.length > 1) {
    return {
      acreditacion,
      veredicto: "AMBIGUO",
      candidatos: exactos,
      motivo: `${exactos.length} envíos con el mismo CUIT, fecha e importe`,
      automatico: false,
    };
  }

  if (porCuitYFecha.length === 1) {
    return {
      acreditacion,
      veredicto: "MATCH_PROBABLE",
      candidatos: porCuitYFecha,
      motivo:
        "CUIT y fecha coinciden, el importe no. Las acreditaciones son siempre totales, así que la diferencia es una anomalía",
      automatico: false,
    };
  }
  if (porCuitYFecha.length > 1) {
    return {
      acreditacion,
      veredicto: "AMBIGUO",
      candidatos: porCuitYFecha,
      motivo: `${porCuitYFecha.length} envíos con el mismo CUIT y fecha, ninguno con el importe exacto`,
      automatico: false,
    };
  }

  if (porCuit.length > 0) {
    return {
      acreditacion,
      veredicto: "MATCH_PROBABLE",
      candidatos: porCuit,
      motivo: "El CUIT coincide pero ninguna fecha cuadra",
      automatico: false,
    };
  }

  // Recién acá se buscan parecidos, y solo como sugerencia.
  const conocidos = new Set(enviadas.map((e) => e.cuit));
  const parecidos = cuitsParecidos(acreditacion.cuit, conocidos, 1);
  if (parecidos.length > 0) {
    const mejor = parecidos[0];
    const candidatos = enviadas.filter((e) => e.cuit === mejor.cuit);
    return {
      acreditacion,
      veredicto: "POSIBLE_MATCH",
      candidatos,
      parecido: mejor,
      motivo: `Posible coincidencia: ${mejor.motivo.toLowerCase()}. Requiere confirmación`,
      automatico: false,
    };
  }

  return {
    acreditacion,
    veredicto: "SIN_MATCH",
    candidatos: [],
    motivo: "No hay ningún envío con ese CUIT",
    automatico: false,
  };
}

export interface ResumenMatching {
  total: number;
  porVeredicto: Record<Veredicto, number>;
  automaticos: number;
  requierenPersona: number;
  /** Porcentaje que el sistema cierra solo, con un decimal. */
  automaticoPct: number;
}

export function emparejarLote(
  acreditaciones: readonly Acreditacion[],
  enviadas: readonly Enviada[],
  opciones: OpcionesMatching = {},
): { resultados: Resultado[]; resumen: ResumenMatching } {
  const resultados = acreditaciones.map((a) => emparejar(a, enviadas, opciones));

  const porVeredicto: Record<Veredicto, number> = {
    MATCH_EXACTO: 0,
    MATCH_PROBABLE: 0,
    POSIBLE_MATCH: 0,
    AMBIGUO: 0,
    SIN_MATCH: 0,
  };
  for (const r of resultados) porVeredicto[r.veredicto] += 1;

  const automaticos = resultados.filter((r) => r.automatico).length;
  return {
    resultados,
    resumen: {
      total: resultados.length,
      porVeredicto,
      automaticos,
      requierenPersona: resultados.length - automaticos,
      automaticoPct:
        resultados.length === 0 ? 0 : Math.round((automaticos / resultados.length) * 1000) / 10,
    },
  };
}
