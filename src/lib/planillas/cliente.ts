/**
 * Parser de la planilla de transferencias de un cliente.
 *
 * ⚠️ **Escrito contra UN formato real: el de `CLIENT_SAMPLE_01`.** No se
 * afirma que sirva para todos los clientes — sigue abierta la pregunta de si
 * cada uno manda el suyo. Las columnas se ubican por nombre y las que no se
 * reconozcan se informan, así que un formato distinto falla diciendo qué le
 * falta en lugar de leer cualquier cosa.
 *
 * Columnas del formato observado:
 *
 *     BANCO · FECHA DEPOSITO · IMPORTE · NOMBRE ·
 *     DNI/CUIT DEPOSITANTE · NRO DEPOSITO · TIPO · COMENTARIO
 */

import { redondear } from "../domain/dinero";
import { clave, leerXlsx, type CeldaXlsx, type HojaXlsx } from "./xlsx";
import { analizarIdentificacion, type Identificacion } from "./identificacion";

export const COLUMNAS_CLIENTE = {
  banco: "BANCO",
  fechaDeposito: "FECHA DEPOSITO",
  importe: "IMPORTE",
  nombre: "NOMBRE",
  identificacion: "DNI/CUIT DEPOSITANTE",
  numeroDeposito: "NRO DEPOSITO",
  tipo: "TIPO",
  comentario: "COMENTARIO",
} as const;

export type ColumnaCliente = keyof typeof COLUMNAS_CLIENTE;

export type EstadoValidacion = "VALIDA" | "REVISAR" | "INVALIDA";

export interface ClientTransfer {
  sourceFile: string;
  sourceSheet: string;
  /** Fila del archivo, base cero, tal como la ve Excel menos uno. */
  sourceRow: number;

  /** Identificador técnico del cliente. **Nunca el nombre comercial.** */
  clientAlias: string;

  banco: string | null;
  /** `YYYY-MM-DD`. Es la fecha que se cruza contra FECHA INGRESO. */
  fechaDeposito: string | null;
  importe: number | null;
  nombreDepositante: string | null;

  identificacionOriginal: string;
  identificacionNormalizada: string;
  tipoIdentificacion: Identificacion["tipo"];

  numeroDeposito: string | null;
  tipo: string | null;
  comentario: string | null;

  validationStatus: EstadoValidacion;
  validationErrors: string[];
}

export interface PlanillaCliente {
  sourceFile: string;
  sourceSheet: string;
  clientAlias: string;
  filaEncabezado: number;
  columnas: Partial<Record<ColumnaCliente, number>>;
  columnasDesconocidas: string[];
  columnasFaltantes: ColumnaCliente[];
  /** Señales de que la planilla esconde algo. */
  filasOcultas: number[];
  columnasOcultas: number[];
  celdasCombinadas: string[];
  celdasConFormula: number;
  transferencias: ClientTransfer[];
}

function normalizarEncabezado(t: string): string {
  return t
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[.\s]+/g, " ")
    .trim()
    .toUpperCase();
}

function textoDe(c: CeldaXlsx | undefined): string | null {
  if (!c || c.valor === null) return null;
  const t = String(c.valor).trim();
  return t === "" ? null : t;
}

/**
 * Importe de la celda.
 *
 * Se acepta número —que es como viene— y también texto, por si alguna fila
 * llega escrita a mano. El redondeo es el del dominio financiero: no se
 * inventa una regla nueva ni se usa coma flotante sin control.
 */
function importeDe(c: CeldaXlsx | undefined): number | null {
  if (!c || c.valor === null) return null;
  if (typeof c.valor === "number") {
    return Number.isFinite(c.valor) ? redondear(c.valor, 2) : null;
  }
  const limpio = String(c.valor).replace(/[^\d,.-]/g, "");
  if (limpio === "") return null;
  // Formato argentino: el punto separa miles y la coma decimales.
  const n = Number(limpio.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? redondear(n, 2) : null;
}

function ubicarEncabezado(hoja: HojaXlsx): {
  fila: number;
  columnas: Partial<Record<ColumnaCliente, number>>;
  desconocidas: string[];
} {
  const esperados = new Map<string, ColumnaCliente>();
  for (const [k, v] of Object.entries(COLUMNAS_CLIENTE)) {
    esperados.set(normalizarEncabezado(v), k as ColumnaCliente);
  }

  let mejor = { fila: -1, aciertos: 0 };
  for (let f = 0; f <= Math.min(hoja.maxFila, 20); f++) {
    let aciertos = 0;
    for (let c = 0; c <= hoja.maxColumna; c++) {
      const v = hoja.celdas.get(clave(f, c))?.valor;
      if (typeof v === "string" && esperados.has(normalizarEncabezado(v))) aciertos++;
    }
    if (aciertos > mejor.aciertos) mejor = { fila: f, aciertos };
  }

  const columnas: Partial<Record<ColumnaCliente, number>> = {};
  const desconocidas: string[] = [];
  if (mejor.fila >= 0) {
    for (let c = 0; c <= hoja.maxColumna; c++) {
      const v = hoja.celdas.get(clave(mejor.fila, c))?.valor;
      if (typeof v !== "string" || v.trim() === "") continue;
      const conocida = esperados.get(normalizarEncabezado(v));
      if (conocida) columnas[conocida] = c;
      else desconocidas.push(v.trim());
    }
  }
  return { fila: mejor.fila, columnas, desconocidas };
}

export interface OpcionesCliente {
  sourceFile?: string;
  clientAlias?: string;
  indiceHoja?: number;
}

/**
 * Lee la planilla.
 *
 * Toda fila con algún dato produce una `ClientTransfer`, aun cuando esté
 * incompleta: **ninguna fila se descarta en silencio.** Las que no sirven
 * salen marcadas.
 */
export function parsearPlanillaCliente(bytes: Buffer, opciones: OpcionesCliente = {}): PlanillaCliente {
  const hojas = leerXlsx(bytes);
  if (hojas.length === 0) throw new Error("El libro no tiene ninguna hoja");
  const hoja = hojas[opciones.indiceHoja ?? 0];

  const sourceFile = opciones.sourceFile ?? "(sin nombre)";
  const clientAlias = opciones.clientAlias ?? "CLIENT_SAMPLE_01";
  const { fila: filaEncabezado, columnas, desconocidas } = ubicarEncabezado(hoja);
  const faltantes = (Object.keys(COLUMNAS_CLIENTE) as ColumnaCliente[]).filter(
    (c) => columnas[c] === undefined,
  );

  const celda = (f: number, col: ColumnaCliente): CeldaXlsx | undefined => {
    const i = columnas[col];
    return i === undefined ? undefined : hoja.celdas.get(clave(f, i));
  };

  const transferencias: ClientTransfer[] = [];
  for (let f = filaEncabezado + 1; f <= hoja.maxFila; f++) {
    let vacia = true;
    for (let c = 0; c <= hoja.maxColumna; c++) {
      const v = hoja.celdas.get(clave(f, c))?.valor;
      if (v !== null && v !== undefined && String(v).trim() !== "") {
        vacia = false;
        break;
      }
    }
    if (vacia) continue;

    const celdaFecha = celda(f, "fechaDeposito");
    const fechaDeposito =
      celdaFecha?.fecha ??
      (typeof celdaFecha?.valor === "string"
        ? /^(\d{4})-(\d{2})-(\d{2})/.exec(celdaFecha.valor)?.[0] ?? null
        : null);

    const identificacion = analizarIdentificacion(celda(f, "identificacion")?.valor);
    const importe = importeDe(celda(f, "importe"));

    const errores: string[] = [];
    if (fechaDeposito === null) errores.push("Sin fecha de depósito");
    if (importe === null) errores.push("Sin importe");
    else if (importe <= 0) errores.push("El importe no es positivo");
    if (identificacion.tipo === "UNKNOWN") errores.push("Sin identificación del depositante");
    if (identificacion.tipo === "IDENTIFICACION_INVALIDA") errores.push(identificacion.motivo);

    const estado: EstadoValidacion =
      fechaDeposito === null || importe === null || importe <= 0
        ? "INVALIDA"
        : identificacion.tipo === "CUIT_VALIDO"
          ? "VALIDA"
          : "REVISAR";

    transferencias.push({
      sourceFile,
      sourceSheet: hoja.nombre,
      sourceRow: f,
      clientAlias,
      banco: textoDe(celda(f, "banco")),
      fechaDeposito,
      importe,
      nombreDepositante: textoDe(celda(f, "nombre")),
      identificacionOriginal: identificacion.original,
      identificacionNormalizada: identificacion.normalizada,
      tipoIdentificacion: identificacion.tipo,
      numeroDeposito: textoDe(celda(f, "numeroDeposito")),
      tipo: textoDe(celda(f, "tipo")),
      comentario: textoDe(celda(f, "comentario")),
      validationStatus: estado,
      validationErrors: errores,
    });
  }

  return {
    sourceFile,
    sourceSheet: hoja.nombre,
    clientAlias,
    filaEncabezado,
    columnas,
    columnasDesconocidas: desconocidas,
    columnasFaltantes: faltantes,
    filasOcultas: hoja.filasOcultas,
    columnasOcultas: hoja.columnasOcultas,
    celdasCombinadas: hoja.combinadas,
    celdasConFormula: hoja.conFormula,
    transferencias,
  };
}
