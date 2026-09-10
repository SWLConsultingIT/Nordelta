/**
 * CUIT: normalización y validación.
 *
 * Se separan a propósito dos preguntas que suelen confundirse:
 *
 *   · **formato** — ¿son once dígitos? Es lo que decide si el texto *parece*
 *     un CUIT;
 *   · **validación** — ¿cierra el dígito verificador? Es lo que decide si
 *     *puede existir*.
 *
 * Un número que pasa el formato y falla la validación es casi siempre un
 * error de tipeo del cliente, y es exactamente la fila que Mati tiene que
 * mirar. Por eso son dos estados distintos y no uno.
 *
 * **Nunca se corrige nada automáticamente.** Requisito explícito del negocio:
 * un dígito cambiado por el sistema manda plata a otra persona.
 *
 * El proyecto no tenía validador de CUIT: se verificó con grep antes de
 * escribir este archivo.
 */

/** Once dígitos. Es todo lo que exige el formato. */
const ONCE_DIGITOS = /^\d{11}$/;

/**
 * Pesos del módulo 11, en el orden de los diez primeros dígitos.
 * Es el algoritmo estándar de CUIT/CUIL de la AFIP.
 */
const PESOS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2] as const;

export type EstadoCuit = "VALIDO" | "CUIT_INVALIDO" | "CUIT_NO_ENCONTRADO";

export interface Cuit {
  /** Tal como venía en el origen, sin tocar. */
  original: string;
  /** Solo dígitos. */
  normalizado: string;
  estado: EstadoCuit;
}

/**
 * Deja solo los dígitos: se van guiones, puntos, espacios —incluidos los
 * raros que traen los pegados— y cualquier otro separador.
 */
export function normalizarCuit(texto: string): string {
  return texto.replace(/\D/g, "");
}

/** ¿Tiene forma de CUIT? No dice nada sobre si existe. */
export function tieneFormatoCuit(normalizado: string): boolean {
  return ONCE_DIGITOS.test(normalizado);
}

/** Dígito verificador esperado para los diez primeros dígitos. */
export function digitoVerificador(diezDigitos: string): number {
  const suma = PESOS.reduce((a, peso, i) => a + Number(diezDigitos[i]) * peso, 0);
  const resto = 11 - (suma % 11);
  if (resto === 11) return 0;
  if (resto === 10) return 9;
  return resto;
}

/** ¿Cierra el dígito verificador? Presupone formato válido. */
export function verificaDigito(normalizado: string): boolean {
  if (!tieneFormatoCuit(normalizado)) return false;
  return Number(normalizado[10]) === digitoVerificador(normalizado.slice(0, 10));
}

/** Normaliza y clasifica en un solo paso. Nunca corrige. */
export function analizarCuit(texto: string | null | undefined): Cuit {
  const original = (texto ?? "").trim();
  const normalizado = normalizarCuit(original);
  if (normalizado === "") {
    return { original, normalizado, estado: "CUIT_NO_ENCONTRADO" };
  }
  if (!tieneFormatoCuit(normalizado) || !verificaDigito(normalizado)) {
    return { original, normalizado, estado: "CUIT_INVALIDO" };
  }
  return { original, normalizado, estado: "VALIDO" };
}

/**
 * Prefijos de CUIT que corresponden a una **persona física**.
 *
 * El prefijo es el par de dígitos inicial y declara el tipo de sujeto:
 *
 *   · `20` · `23` · `24` · `27` → persona física
 *   · `30` · `33` · `34`        → persona jurídica
 *
 * Se verificó contra los datos reales: sobre 1197 acreditaciones del informe
 * del 01 al 10 de septiembre, los prefijos observados fueron 20 (527),
 * 27 (518), 23 (103), 24 (5) —personas— y 30 (39), 33 (5) —empresas—.
 *
 * Importa para una sola cosa, y es de correctitud: **el documento embebido
 * en el CUIT solo significa «DNI» cuando el sujeto es una persona.** En un
 * CUIT de empresa esos ocho dígitos son parte del identificador societario y
 * compararlos contra un DNI no tiene ningún sentido.
 */
const PREFIJOS_PERSONA_FISICA: ReadonlySet<string> = new Set(["20", "23", "24", "27"]);

/** ¿El CUIT corresponde a una persona física? Presupone formato válido. */
export function esPersonaFisica(cuit: string): boolean {
  if (!tieneFormatoCuit(cuit)) return false;
  return PREFIJOS_PERSONA_FISICA.has(cuit.slice(0, 2));
}

/**
 * En cuántos dígitos difieren dos CUIT de la misma longitud.
 *
 * Es distancia de Hamming, y se eligió sobre Levenshtein a propósito: un CUIT
 * tiene **posición fija**, así que la comparación posición a posición es la
 * que corresponde. Levenshtein consideraría «parecidos» dos números
 * desplazados, que en identificadores fiscales no significa nada.
 *
 * Devuelve `null` si no tienen el mismo largo: ahí no hay comparación
 * posicional posible.
 */
export function digitosDiferentes(a: string, b: string): number | null {
  if (a.length !== b.length) return null;
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
  return n;
}

export interface Parecido {
  cuit: string;
  digitosDiferentes: number;
  /** Texto para mostrarle a una persona. Nunca una acción automática. */
  motivo: string;
}

/**
 * Candidatos parecidos dentro de un conjunto conocido.
 *
 * `maximo` por defecto en 1: con dos dígitos de diferencia la sugerencia deja
 * de ser útil y empieza a ser ruido. **Esto sugiere, no corrige.**
 */
export function cuitsParecidos(
  cuit: string,
  conocidos: Iterable<string>,
  maximo = 1,
): Parecido[] {
  const salida: Parecido[] = [];
  for (const c of conocidos) {
    if (c === cuit) continue;
    const d = digitosDiferentes(cuit, c);
    if (d === null || d === 0 || d > maximo) continue;
    salida.push({
      cuit: c,
      digitosDiferentes: d,
      motivo: d === 1 ? "Difiere en 1 dígito" : `Difiere en ${d} dígitos`,
    });
  }
  return salida.sort((a, b) => a.digitosDiferentes - b.digitosDiferentes);
}
