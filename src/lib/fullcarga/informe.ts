/**
 * Del XLS de Fullcarga a acreditaciones estructuradas.
 *
 * Estructura verificada sobre el archivo real del 08-09-2026:
 *
 *     fila 0   título: «Informe Movimiento de Saldos, DD-MM-YYYY»
 *     fila 1   vacía
 *     fila 2   encabezados, catorce columnas
 *     fila 3+  datos
 *
 * Las columnas **no se fijan por posición**: se buscan por su encabezado
 * normalizado. Que hoy OBSERVACIÓN sea la columna 13 es una casualidad del
 * archivo de hoy —de hecho su encabezado viene con un espacio adelante—, y
 * atarse al índice es cómo un informe con una columna nueva rompe el parser
 * en silencio.
 *
 * Principio heredado del importador legacy y sostenido acá: **ninguna fila
 * desaparece.** Toda fila del archivo termina en exactamente una
 * clasificación, y la suma de las clasificaciones da el total de filas.
 */

import { redondear } from "../domain/dinero";
import { clave, leerLibro, type Hoja, type ValorCelda } from "./xls";
import { leerObservacion, type ObservacionLeida } from "./observacion";
import { FullcargaInvalidReportError } from "./errores";

/* ── Columnas ───────────────────────────────────────────────── */

export const COLUMNAS = {
  codigoCliente: "CODIGO CLIENTE",
  codigoDistribuidor: "CODIGO DISTRIBUIDOR",
  codigoMayorista: "CODIGO MAYORISTA",
  razonSocial: "RAZON SOCIAL",
  tarjeta: "TARJETA",
  creditoInicial: "CREDITO INICIAL",
  incremento: "INCREMENTO",
  creditoFinal: "CREDITO FINAL",
  fecha: "FECHA",
  fechaIngreso: "FECHA INGRESO",
  banco: "BANCO",
  tipoIncremento: "TIPO INCREMENTO",
  bolsaDestino: "BOLSA DESTINO",
  observacion: "OBSERVACION",
} as const;

export type NombreColumna = keyof typeof COLUMNAS;

/** Sin acentos, sin espacios de sobra, en mayúsculas. */
function normalizarEncabezado(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/* ── Clasificación ──────────────────────────────────────────── */

export type Clasificacion =
  /** Plata de un cliente, por transferencia. Es lo que se concilia. */
  | "ACREDITACION_TRANSFERENCIA"
  /** Efectivo depositado en sucursal. **No tiene CUIT de depositante.** */
  | "DEPOSITO"
  /** Comisión de plataforma que cobra Fullcarga. */
  | "FEE_MANTENIMIENTO"
  /** Devolución de gastos bancarios. No es plata de un cliente. */
  | "REINTEGRO_BANCARIO"
  | "AJUSTE"
  | "OTRO"
  | "DESCONOCIDO";

/* ── Filas ──────────────────────────────────────────────────── */

export interface FilaInforme {
  /** Trazabilidad al origen: archivo, hoja y fila. Siempre presente. */
  sourceFile: string;
  sheet: string;
  row: number;

  codigoCliente: string | null;
  razonSocial: string | null;
  /** Fecha en que el crédito impacta en Fullcarga. `YYYY-MM-DD`. */
  fechaMovimiento: string | null;
  /** Fecha en que el dinero ingresó. Puede ser de meses atrás. */
  fechaIngreso: string | null;
  importe: number | null;
  banco: string | null;
  tipoIncremento: string | null;
  bolsaDestino: string | null;

  observacionOriginal: string;
  observacion: ObservacionLeida;
  /** Solo dígitos, o `null` si no se pudo extraer ninguno. */
  cuitExtraido: string | null;
  clasificacion: Clasificacion;
}

export interface InformeParseado {
  sourceFile: string;
  sheet: string;
  /** Fila del encabezado, base cero. */
  filaEncabezado: number;
  columnas: Partial<Record<NombreColumna, number>>;
  /** Encabezados que el archivo trae y no esperábamos. */
  columnasDesconocidas: string[];
  filas: FilaInforme[];
}

/* ── Utilidades de celda ────────────────────────────────────── */

function texto(v: ValorCelda): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return String(v);
  const t = v.trim();
  return t === "" ? null : t;
}

function numero(v: ValorCelda): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? redondear(v, 2) : null;
  return null;
}

/**
 * Fecha calendario a partir de `YYYY-MM-DD HH:MM:SS.mmm`.
 *
 * En este informe las dos fechas llegan como **texto**, no como serial de
 * Excel, así que alcanza con recortar. Se hace por posición y sin `Date`:
 * convertir a `Date` para volver a formatear es cómo una fecha se corre un
 * día según el huso.
 */
export function fechaDeCelda(v: ValorCelda): string | null {
  const t = texto(v);
  if (t === null) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (!m) return null;
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/**
 * Clasifica la fila a partir de la evidencia disponible.
 *
 * Se cruzan dos señales, y ninguna se inventa: el TIPO INCREMENTO de la
 * columna y la operación bancaria del texto de la observación. Cuando no
 * alcanzan, el resultado es `DESCONOCIDO` — que es un resultado válido y no
 * un fallo.
 */
export function clasificarFila(
  tipoIncremento: string | null,
  obs: ObservacionLeida,
  importe: number | null,
): Clasificacion {
  const tipo = (tipoIncremento ?? "").toLowerCase();

  if (obs.patron === "MANTENIMIENTO" || tipo.includes("mantenimiento")) {
    return "FEE_MANTENIMIENTO";
  }

  // Antes que nada de depósitos: el texto de un reintegro dice «depósito»
  // —«Reintegro de gastos bancarios depósito $X»— y sin esta guarda se
  // clasificaba como plata de un cliente. Lo encontró la validación multidía.
  if (tipo.includes("reintegro") || /^reintegro\b/i.test(obs.operacion ?? "")) {
    return "REINTEGRO_BANCARIO";
  }

  const operacion = (obs.operacion ?? "").toLowerCase();
  if (/transf|credito transf/.test(operacion)) return "ACREDITACION_TRANSFERENCIA";
  if (/dep[oó]sito|deposito/.test(operacion)) return "DEPOSITO";

  if (obs.patron === "VACIA" && importe !== null && importe < 0) return "AJUSTE";
  if (obs.patron === "VACIA") return "OTRO";

  return "DESCONOCIDO";
}

/** Las clasificaciones que representan plata que entró de un tercero. */
export const CLASIFICACIONES_ACREDITACION: ReadonlySet<Clasificacion> = new Set([
  "ACREDITACION_TRANSFERENCIA",
  "DEPOSITO",
]);

/* ── Parser ─────────────────────────────────────────────────── */

function ubicarEncabezado(hoja: Hoja): { fila: number; columnas: Partial<Record<NombreColumna, number>>; desconocidas: string[] } {
  const esperados = new Map<string, NombreColumna>();
  for (const [k, v] of Object.entries(COLUMNAS)) {
    esperados.set(normalizarEncabezado(v), k as NombreColumna);
  }

  // Se busca la fila que más encabezados conocidos tenga, en las primeras
  // veinte: el título y las filas vacías de arriba varían entre informes.
  let mejor = { fila: -1, aciertos: 0 };
  const limite = Math.min(hoja.maxFila, 20);
  for (let f = 0; f <= limite; f++) {
    let aciertos = 0;
    for (let c = 0; c <= hoja.maxColumna; c++) {
      const v = hoja.celdas.get(clave(f, c));
      if (typeof v === "string" && esperados.has(normalizarEncabezado(v))) aciertos++;
    }
    if (aciertos > mejor.aciertos) mejor = { fila: f, aciertos };
  }

  if (mejor.aciertos < 5) {
    throw new FullcargaInvalidReportError(
      `No se encontró la fila de encabezados: la mejor candidata tiene ${mejor.aciertos} columnas reconocidas de ${esperados.size}`,
      { filaCandidata: mejor.fila, aciertos: mejor.aciertos },
    );
  }

  const columnas: Partial<Record<NombreColumna, number>> = {};
  const desconocidas: string[] = [];
  for (let c = 0; c <= hoja.maxColumna; c++) {
    const v = hoja.celdas.get(clave(mejor.fila, c));
    if (typeof v !== "string" || v.trim() === "") continue;
    const norm = normalizarEncabezado(v);
    const conocida = esperados.get(norm);
    if (conocida) columnas[conocida] = c;
    else desconocidas.push(norm);
  }

  return { fila: mejor.fila, columnas, desconocidas };
}

/** ¿La fila está completamente vacía? No cuenta como fila de datos. */
function filaVacia(hoja: Hoja, fila: number): boolean {
  for (let c = 0; c <= hoja.maxColumna; c++) {
    const v = hoja.celdas.get(clave(fila, c));
    if (v !== undefined && v !== null && String(v).trim() !== "") return false;
  }
  return true;
}

export interface OpcionesParseo {
  /** Nombre del archivo, solo para trazabilidad. */
  sourceFile?: string;
  /** Cuál hoja leer, si hubiera más de una. */
  indiceHoja?: number;
}

/** Lee el informe completo desde los bytes del XLS. */
export function parsearInforme(bytes: Buffer, opciones: OpcionesParseo = {}): InformeParseado {
  const hojas = leerLibro(bytes);
  if (hojas.length === 0) {
    throw new FullcargaInvalidReportError("El libro no tiene ninguna hoja", { bytes: bytes.length });
  }
  const hoja = hojas[opciones.indiceHoja ?? 0];
  const sourceFile = opciones.sourceFile ?? "(sin nombre)";

  const { fila: filaEncabezado, columnas, desconocidas } = ubicarEncabezado(hoja);

  const celda = (fila: number, col: NombreColumna): ValorCelda => {
    const c = columnas[col];
    return c === undefined ? null : (hoja.celdas.get(clave(fila, c)) ?? null);
  };

  const filas: FilaInforme[] = [];
  for (let f = filaEncabezado + 1; f <= hoja.maxFila; f++) {
    if (filaVacia(hoja, f)) continue;

    const observacionOriginal = texto(celda(f, "observacion")) ?? "";
    const obs = leerObservacion(observacionOriginal);
    const importe = numero(celda(f, "incremento"));
    const tipoIncremento = texto(celda(f, "tipoIncremento"));

    filas.push({
      sourceFile,
      sheet: hoja.nombre,
      row: f,
      codigoCliente: texto(celda(f, "codigoCliente")),
      razonSocial: texto(celda(f, "razonSocial")),
      fechaMovimiento: fechaDeCelda(celda(f, "fecha")),
      fechaIngreso: fechaDeCelda(celda(f, "fechaIngreso")),
      importe,
      banco: texto(celda(f, "banco")),
      tipoIncremento,
      bolsaDestino: texto(celda(f, "bolsaDestino")),
      observacionOriginal,
      observacion: obs,
      cuitExtraido: obs.cuit?.estado === "VALIDO" ? obs.cuit.normalizado : null,
      clasificacion: clasificarFila(tipoIncremento, obs, importe),
    });
  }

  return { sourceFile, sheet: hoja.nombre, filaEncabezado, columnas, columnasDesconocidas: desconocidas, filas };
}

/* ── Acreditaciones listas para conciliar ───────────────────── */

/**
 * Una acreditación, ya normalizada.
 *
 * La fecha que se expone para conciliar es **`fechaIngreso`**, no
 * `fechaMovimiento`. El motivo está medido: en el archivo real las 84 filas
 * comparten la misma `fechaMovimiento` —la del informe—, mientras que
 * `fechaIngreso` abarca treinta días distintos. Conciliar contra una fecha
 * que es igual en todas las filas no discrimina nada.
 */
export interface Acreditacion {
  sourceFile: string;
  sheet: string;
  row: number;
  cuit: string;
  /** `YYYY-MM-DD`. La fecha en que el depositante hizo la transferencia. */
  fecha: string;
  importe: number;
  banco: string | null;
  clienteNord: string | null;
  descripcion: string | null;
}

/** Filas que son acreditaciones y tienen los datos mínimos para conciliar. */
export function acreditacionesConciliables(informe: InformeParseado): Acreditacion[] {
  const salida: Acreditacion[] = [];
  for (const f of informe.filas) {
    if (!CLASIFICACIONES_ACREDITACION.has(f.clasificacion)) continue;
    if (f.cuitExtraido === null || f.fechaIngreso === null || f.importe === null) continue;
    salida.push({
      sourceFile: f.sourceFile,
      sheet: f.sheet,
      row: f.row,
      cuit: f.cuitExtraido,
      fecha: f.fechaIngreso,
      importe: f.importe,
      banco: f.banco,
      clienteNord: f.razonSocial,
      descripcion: f.observacion.descripcion,
    });
  }
  return salida;
}

/* ── Cobertura ──────────────────────────────────────────────── */

export interface Cobertura {
  totalFilas: number;
  porClasificacion: Record<Clasificacion, number>;
  /** Transferencias más depósitos: toda la plata que entró de terceros. */
  filasRelevantes: number;
  /**
   * Solo transferencias. Es el denominador honesto para el CUIT: **un
   * depósito de efectivo en sucursal no tiene depositante identificado**, así
   * que contarlo como «sin CUIT» ensucia la métrica sin significar nada.
   */
  transferencias: number;
  /** Depósitos en efectivo. Sin CUIT por naturaleza, no por un fallo. */
  depositos: number;
  conCuitValido: number;
  cuitInvalido: number;
  sinCuit: number;
  conVariosCuit: number;
  patronesDesconocidos: number;
  /** Sobre las filas relevantes. Se conserva para poder comparar. */
  coberturaPct: number;
  /** Sobre las transferencias. **Es la métrica que importa.** */
  coberturaTransferenciasPct: number;
  operacionesNuevas: string[];
}

/** Métricas agregadas. No devuelve ningún dato de una fila en particular. */
export function medirCobertura(informe: InformeParseado): Cobertura {
  const porClasificacion: Record<Clasificacion, number> = {
    ACREDITACION_TRANSFERENCIA: 0,
    DEPOSITO: 0,
    FEE_MANTENIMIENTO: 0,
    REINTEGRO_BANCARIO: 0,
    AJUSTE: 0,
    OTRO: 0,
    DESCONOCIDO: 0,
  };

  let conCuitValido = 0;
  let cuitInvalido = 0;
  let sinCuit = 0;
  let conVariosCuit = 0;
  let patronesDesconocidos = 0;
  const operacionesNuevas = new Set<string>();

  for (const f of informe.filas) {
    porClasificacion[f.clasificacion] += 1;
    if (f.observacion.patron === "DESCONOCIDO") patronesDesconocidos += 1;
    if (f.observacion.patron === "TRANSFERENCIA_OPERACION_NUEVA" && f.observacion.operacion) {
      operacionesNuevas.add(f.observacion.operacion);
    }
    if (!CLASIFICACIONES_ACREDITACION.has(f.clasificacion)) continue;

    if (f.observacion.candidatosCuit > 1) conVariosCuit += 1;
    const estado = f.observacion.cuit?.estado ?? "CUIT_NO_ENCONTRADO";
    if (estado === "VALIDO") conCuitValido += 1;
    else if (estado === "CUIT_INVALIDO") cuitInvalido += 1;
    else sinCuit += 1;
  }

  const transferencias = porClasificacion.ACREDITACION_TRANSFERENCIA;
  const depositos = porClasificacion.DEPOSITO;
  const filasRelevantes = transferencias + depositos;
  const porcentaje = (n: number, total: number) =>
    total === 0 ? 0 : Math.round((n / total) * 1000) / 10;

  return {
    totalFilas: informe.filas.length,
    porClasificacion,
    filasRelevantes,
    transferencias,
    depositos,
    conCuitValido,
    cuitInvalido,
    sinCuit,
    conVariosCuit,
    patronesDesconocidos,
    coberturaPct: porcentaje(conCuitValido, filasRelevantes),
    coberturaTransferenciasPct: porcentaje(conCuitValido, transferencias),
    operacionesNuevas: [...operacionesNuevas].sort(),
  };
}
