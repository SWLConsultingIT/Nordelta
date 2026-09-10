/**
 * Identificación del depositante en una planilla de cliente.
 *
 * La columna se llama «DNI/CUIT DEPOSITANTE» y **trae las dos cosas**. En el
 * archivo real de `CLIENT_SAMPLE_01`, de doce filas: seis traen CUIT con
 * guiones y seis traen ocho dígitos sueltos, que es un DNI.
 *
 * Por eso hay que clasificar antes de comparar. Tratar un DNI como CUIT es
 * el camino directo a un match equivocado.
 *
 * **Nunca se infiere un CUIT desde un DNI.** Se puede: el CUIT de una
 * persona es un prefijo de tipo más el DNI más un verificador, y hay quien
 * lo «completa» probando prefijos. **Eso es adivinar la identidad fiscal de
 * alguien** y con eso se manda plata a otra persona. Si hace falta el
 * vínculo, lo aporta el negocio, no una fórmula.
 */

import { esPersonaFisica, normalizarCuit, verificaDigito } from "../fullcarga/cuit";

export type TipoIdentificacion =
  /** Once dígitos y el verificador cierra. */
  | "CUIT_VALIDO"
  /** Siete u ocho dígitos: tiene forma de documento. */
  | "DNI_PROBABLE"
  /** Tiene dígitos pero no es ninguna de las dos cosas */
  | "IDENTIFICACION_INVALIDA"
  /** Vacío o sin un solo dígito. */
  | "UNKNOWN";

export interface Identificacion {
  /** Tal como venía. Nunca se pisa. */
  original: string;
  /** Solo dígitos. */
  normalizada: string;
  tipo: TipoIdentificacion;
  /** Por qué quedó así, en una frase para quien revise. */
  motivo: string;
}

const LARGO_DNI_MINIMO = 7;
const LARGO_DNI_MAXIMO = 8;

/**
 * Clasifica sin corregir.
 *
 * Un número de once dígitos cuyo verificador no cierra **no** se degrada a
 * DNI ni se arregla: se marca inválido, que es la fila que alguien tiene que
 * mirar.
 */
export function analizarIdentificacion(valor: string | number | null | undefined): Identificacion {
  const original = valor === null || valor === undefined ? "" : String(valor).trim();
  const normalizada = normalizarCuit(original);

  if (normalizada === "") {
    return { original, normalizada, tipo: "UNKNOWN", motivo: "No hay identificación" };
  }

  if (normalizada.length === 11) {
    return verificaDigito(normalizada)
      ? { original, normalizada, tipo: "CUIT_VALIDO", motivo: "CUIT de once dígitos, verificador correcto" }
      : {
          original,
          normalizada,
          tipo: "IDENTIFICACION_INVALIDA",
          motivo: "Once dígitos pero el verificador no cierra: probable error de tipeo",
        };
  }

  if (normalizada.length >= LARGO_DNI_MINIMO && normalizada.length <= LARGO_DNI_MAXIMO) {
    return {
      original,
      normalizada,
      tipo: "DNI_PROBABLE",
      motivo: `${normalizada.length} dígitos: tiene forma de DNI, no de CUIT`,
    };
  }

  return {
    original,
    normalizada,
    tipo: "IDENTIFICACION_INVALIDA",
    motivo: `${normalizada.length} dígitos: no es ni un CUIT ni un DNI`,
  };
}

/** El CUIT, solo si la identificación realmente lo es. */
export function cuitDe(id: Identificacion): string | null {
  return id.tipo === "CUIT_VALIDO" ? id.normalizada : null;
}

/**
 * ¿El DNI informado es el documento contenido en ese CUIT real?
 *
 * Un CUIT es `<tipo 2><documento 8><verificador 1>`. La comparación va
 * **siempre en este sentido**: se parte de un CUIT real que devolvió
 * Fullcarga y se mira si su documento es el DNI informado. Nunca al revés:
 * **no se fabrica un CUIT a partir de un DNI**, ni se asume un prefijo, ni se
 * genera nada sintético.
 *
 * Tres condiciones, y las tres son necesarias:
 *
 *   1. el CUIT tiene que ser **válido** —verificador incluido—, o sus dígitos
 *      centrales no significan nada;
 *   2. tiene que ser de **persona física**: en un CUIT de empresa esos ocho
 *      dígitos son parte del identificador societario, no un DNI;
 *   3. el documento tiene que coincidir exacto, con relleno a ocho dígitos
 *      para los DNI de siete.
 *
 * Por sí sola **no alcanza para emparejar**: varias personas distintas pueden
 * aparecer en un informe y un documento se puede repetir entre prefijos. La
 * conciliación exige además fecha e importe, y unicidad.
 */
export function dniCoincideConCuit(dni: string, cuit: string): boolean {
  if (!verificaDigito(cuit)) return false;
  if (!esPersonaFisica(cuit)) return false;
  const documento = normalizarCuit(dni);
  if (documento.length < 7 || documento.length > 8) return false;
  return cuit.slice(2, 10) === documento.padStart(8, "0");
}
