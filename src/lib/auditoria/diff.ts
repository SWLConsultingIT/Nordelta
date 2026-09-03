import type { EntradaAuditoria } from "../domain/types";

/**
 * Comparación campo por campo de una entrada de auditoría.
 *
 * El registro guarda el valor anterior y el nuevo como texto. Cuando son
 * objetos, mostrarlos enteros obliga al auditor a compararlos a ojo: acá se
 * quedan solo las claves que efectivamente cambiaron.
 */
export interface Cambio {
  campo: string;
  antes: string | null;
  despues: string | null;
}

function objeto(v: string | null): Record<string, unknown> | null {
  if (!v) return null;
  try {
    const p = JSON.parse(v);
    return p && typeof p === "object" && !Array.isArray(p) ? (p as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Un valor ausente, nulo o vacío no es un dato: se representa como nulo. */
const texto = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));

export function diferencias(
  entrada: Pick<EntradaAuditoria, "campo" | "valor_anterior" | "valor_nuevo">,
): Cambio[] {
  const a = objeto(entrada.valor_anterior);
  const b = objeto(entrada.valor_nuevo);

  if (a || b) {
    const claves = [...new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])];
    return claves
      .map((k) => ({ campo: k, antes: texto(a?.[k]), despues: texto(b?.[k]) }))
      .filter((c) => c.antes !== c.despues);
  }

  if (entrada.valor_anterior === null && entrada.valor_nuevo === null) return [];
  return [
    {
      campo: entrada.campo ?? "valor",
      antes: entrada.valor_anterior,
      despues: entrada.valor_nuevo,
    },
  ];
}
