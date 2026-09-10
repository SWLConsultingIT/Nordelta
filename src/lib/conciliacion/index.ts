/**
 * Conciliación: lo que el cliente dice que mandó contra lo que Fullcarga
 * dice que acreditó.
 *
 * Reglas que gobiernan todo el archivo, y ninguna se inventó acá:
 *
 *   · se cruza **identidad + fecha de depósito + importe**. La fecha del lado
 *     de Fullcarga es **FECHA INGRESO**, nunca FECHA — medido: en un informe
 *     todas las filas comparten FECHA, mientras FECHA INGRESO abarca meses;
 *   · la identidad se resuelve por **CUIT** o, desde que NORD lo confirmó,
 *     por **DNI contra el documento de un CUIT real de persona física**;
 *   · **el nombre no se usa jamás para emparejar.** Sirve para que una
 *     persona revise. Sin similitud de texto, sin IA;
 *   · **cada acreditación se consume una sola vez**, y si dos filas la
 *     pretenden, **ninguna se la queda**: las dos quedan ambiguas;
 *   · **ante la duda, no hay match.** Mati revisa.
 *
 * Y una consecuencia del atraso medido —hasta 113 días—: no encontrar una
 * transferencia dentro del rango consultado **no significa que falló**.
 *
 * ## Orden de resolución
 *
 * Las reglas exactas se agotan antes de mirar parecidos:
 *
 *   1. CUIT exacto + fecha + importe        → `ACREDITADA_EXACTA_CUIT`
 *   2. DNI en CUIT de persona + fecha + imp → `ACREDITADA_EXACTA_DNI`
 *   3. CUIT a un dígito                     → `POSIBLE_MATCH` (sugerencia)
 *   4. sin candidato                        → pendiente o revisión
 *
 * El CUIT va primero a propósito: es identidad directa, mientras que el DNI
 * es identidad derivada del documento embebido. Ante competencia por el mismo
 * registro, gana la evidencia más fuerte.
 */

import { esCero } from "../domain/dinero";
import { cuitsParecidos } from "../fullcarga/cuit";
import { dniCoincideConCuit } from "../planillas/identificacion";
import type { Acreditacion } from "../fullcarga/informe";
import type { ClientTransfer } from "../planillas/cliente";

export type EstadoConciliacion =
  /** CUIT, fecha e importe coinciden con exactamente una acreditación. */
  | "ACREDITADA_EXACTA_CUIT"
  /**
   * El DNI informado es el documento de un CUIT real de persona física, y
   * coinciden fecha e importe, con un solo candidato.
   *
   * Regla **confirmada por NORD**. Se acredita sola.
   */
  | "ACREDITADA_EXACTA_DNI"
  /**
   * Nada en el rango consultado. **No es un fallo del matching:** puede
   * acreditarse más adelante, y se midieron atrasos de hasta 113 días.
   *
   * Pero **sí es un problema abierto desde el momento del envío**: regla
   * confirmada por NORD, sin período de gracia. Se re-evalúa con cada
   * informe nuevo hasta que acredite.
   */
  | "PENDIENTE_NO_ENCONTRADA_EN_RANGO"
  /** Varios candidatos, o dos filas peleando por el mismo registro. */
  | "MATCH_AMBIGUO"
  /** CUIT a un dígito de distancia. **Sugerencia, nunca acreditación.** */
  | "POSIBLE_MATCH"
  /** Trae DNI, el documento aparece, pero no cuadra fecha o importe. */
  | "IDENTITY_MAPPING_REQUIRED"
  /** Once dígitos con el verificador mal. */
  | "ERROR_CUIT"
  /** La identificación no es ni CUIT ni DNI. */
  | "ERROR_IDENTIFICACION"
  /** Falta el número de depósito o no tiene forma válida. */
  | "COMPROBANTE_INVALIDO"
  /** Otra fila de la misma planilla parece la misma operación. */
  | "POSIBLE_DUPLICADO"
  /** Falta fecha o importe: no se puede ni intentar. */
  | "DATOS_INVALIDOS";

/** Los dos estados que el sistema cierra solo. */
export const ESTADOS_ACREDITADOS: ReadonlySet<EstadoConciliacion> = new Set([
  "ACREDITADA_EXACTA_CUIT",
  "ACREDITADA_EXACTA_DNI",
]);

export interface ResultadoFila {
  transfer: ClientTransfer;
  estado: EstadoConciliacion;
  /** Explicación en una frase, pensada para que la lea Mati. */
  motivo: string;
  /** La acreditación consumida, si se acreditó. */
  acreditacion: Acreditacion | null;
  /** Candidatos, cuando la decisión la toma una persona. */
  candidatos: Acreditacion[];
  /** Filas de la misma planilla que se le parecen. */
  duplicadoDe: number[];
  /** Verdadero solo cuando el sistema lo cierra sin intervención. */
  automatico: boolean;
}

export interface OpcionesConciliacion {
  /** Días de tolerancia entre la fecha del cliente y la de ingreso. */
  toleranciaDias?: number;
}

/** Diferencia en días entre dos fechas ISO. Aritmética entera, sin husos. */
export function diasEntre(a: string, b: string): number {
  const jd = (iso: string): number => {
    const [y, m, d] = iso.split("-").map(Number);
    const a2 = Math.floor((14 - m) / 12);
    const y2 = y + 4800 - a2;
    const m2 = m + 12 * a2 - 3;
    return (
      d + Math.floor((153 * m2 + 2) / 5) + 365 * y2 + Math.floor(y2 / 4) -
      Math.floor(y2 / 100) + Math.floor(y2 / 400) - 32045
    );
  };
  return Math.abs(jd(a) - jd(b));
}

/** ¿Tiene forma de comprobante? Sin guiones ni letras, según Fullcarga. */
export function comprobanteValido(nro: string | null): boolean {
  if (nro === null || nro.trim() === "") return false;
  return /^\d+$/.test(nro.trim());
}

/**
 * Filas de la planilla que parecen la misma operación.
 *
 * **Importe repetido no es duplicado.** En el archivo real hay doce filas con
 * apenas tres importes distintos, así que el importe solo no dice nada. Se
 * exige que coincidan identificación, fecha e importe **a la vez**, y aun así
 * el resultado es «posible», nunca definitivo. Nada se borra jamás.
 */
export function detectarDuplicados(filas: readonly ClientTransfer[]): Map<number, number[]> {
  const porClave = new Map<string, number[]>();
  for (const f of filas) {
    if (f.fechaDeposito === null || f.importe === null) continue;
    const k = `${f.identificacionNormalizada}|${f.fechaDeposito}|${f.importe}`;
    porClave.set(k, [...(porClave.get(k) ?? []), f.sourceRow]);
  }
  const salida = new Map<number, number[]>();
  for (const filasIguales of porClave.values()) {
    if (filasIguales.length < 2) continue;
    for (const r of filasIguales) {
      salida.set(r, filasIguales.filter((x) => x !== r));
    }
  }
  return salida;
}

const idDe = (a: Acreditacion) => `${a.sourceFile}|${a.row}`;

/**
 * Reparte acreditaciones entre las filas que las pretenden, **sin
 * arbitrariedad**.
 *
 * Cada fila llega con su conjunto de candidatos. Se queda con un registro
 * solo si se dan las dos cosas:
 *
 *   · tiene **exactamente un** candidato, y
 *   · **ninguna otra fila** pretende ese mismo registro.
 *
 * Lo segundo es lo que evita que gane la primera por orden de aparición. Si
 * dos filas apuntan al mismo registro único, **las dos quedan ambiguas** y
 * decide una persona.
 */
function repartir(
  pretensiones: ReadonlyMap<number, Acreditacion[]>,
): { asignadas: Map<number, Acreditacion>; enConflicto: Map<number, Acreditacion[]> } {
  const pretendientes = new Map<string, number[]>();
  for (const [fila, candidatos] of pretensiones) {
    if (candidatos.length !== 1) continue;
    const k = idDe(candidatos[0]);
    pretendientes.set(k, [...(pretendientes.get(k) ?? []), fila]);
  }

  const asignadas = new Map<number, Acreditacion>();
  const enConflicto = new Map<number, Acreditacion[]>();
  for (const [fila, candidatos] of pretensiones) {
    if (candidatos.length !== 1) continue;
    const compiten = pretendientes.get(idDe(candidatos[0])) ?? [];
    if (compiten.length === 1) asignadas.set(fila, candidatos[0]);
    else enConflicto.set(fila, candidatos);
  }
  return { asignadas, enConflicto };
}

/**
 * Concilia una planilla contra las acreditaciones de Fullcarga.
 *
 * Cada fase calcula **todas** sus pretensiones antes de asignar nada, así el
 * resultado no depende del orden de las filas en el archivo.
 */
export function conciliar(
  transferencias: readonly ClientTransfer[],
  acreditaciones: readonly Acreditacion[],
  opciones: OpcionesConciliacion = {},
): ResultadoFila[] {
  const tolerancia = opciones.toleranciaDias ?? 0;
  const duplicados = detectarDuplicados(transferencias);
  const consumidas = new Set<string>();
  const resultados = new Map<number, ResultadoFila>();

  const disponibles = (filtro: (a: Acreditacion) => boolean) =>
    acreditaciones.filter((a) => !consumidas.has(idDe(a)) && filtro(a));

  const registrar = (
    t: ClientTransfer,
    estado: EstadoConciliacion,
    motivo: string,
    extra: Partial<ResultadoFila> = {},
  ) => {
    resultados.set(t.sourceRow, {
      transfer: t,
      estado,
      motivo,
      acreditacion: null,
      candidatos: [],
      duplicadoDe: duplicados.get(t.sourceRow) ?? [],
      automatico: ESTADOS_ACREDITADOS.has(estado),
      ...extra,
    });
  };

  /** Coincide fecha e importe con la fila del cliente. */
  const cuadra = (a: Acreditacion, t: ClientTransfer) =>
    diasEntre(a.fecha, t.fechaDeposito!) <= tolerancia && esCero(a.importe - t.importe!);

  /* ── Fase 1 · triaje ──────────────────────────────────────── */
  const conCuit: ClientTransfer[] = [];
  const conDni: ClientTransfer[] = [];
  for (const t of transferencias) {
    if (t.fechaDeposito === null || t.importe === null || t.importe <= 0) {
      registrar(t, "DATOS_INVALIDOS", t.validationErrors.join(" · ") || "Faltan fecha o importe");
      continue;
    }
    switch (t.tipoIdentificacion) {
      case "CUIT_VALIDO":
        conCuit.push(t);
        break;
      case "DNI_PROBABLE":
        conDni.push(t);
        break;
      case "IDENTIFICACION_INVALIDA":
        registrar(
          t,
          t.identificacionNormalizada.length === 11 ? "ERROR_CUIT" : "ERROR_IDENTIFICACION",
          t.validationErrors[0] ?? "La identificación no es válida",
        );
        break;
      default:
        registrar(t, "ERROR_IDENTIFICACION", "No hay identificación del depositante");
    }
  }

  /* ── Fase 2 · CUIT exacto ─────────────────────────────────── */
  const pretensionesCuit = new Map<number, Acreditacion[]>();
  for (const t of conCuit) {
    pretensionesCuit.set(
      t.sourceRow,
      disponibles((a) => a.cuit === t.identificacionNormalizada && cuadra(a, t)),
    );
  }
  const repartoCuit = repartir(pretensionesCuit);

  const cuitSinResolver: ClientTransfer[] = [];
  for (const t of conCuit) {
    const asignada = repartoCuit.asignadas.get(t.sourceRow);
    if (asignada) {
      consumidas.add(idDe(asignada));
      registrar(t, "ACREDITADA_EXACTA_CUIT", "CUIT, fecha e importe coinciden", {
        acreditacion: asignada,
        candidatos: [asignada],
      });
      continue;
    }
    const conflicto = repartoCuit.enConflicto.get(t.sourceRow);
    if (conflicto) {
      registrar(
        t,
        "MATCH_AMBIGUO",
        "Otra fila de la planilla apunta a la misma acreditación. No se elige ninguna",
        { candidatos: conflicto },
      );
      continue;
    }
    const varios = pretensionesCuit.get(t.sourceRow) ?? [];
    if (varios.length > 1) {
      registrar(
        t,
        "MATCH_AMBIGUO",
        `${varios.length} acreditaciones con el mismo CUIT, fecha e importe. No se elige ninguna`,
        { candidatos: varios },
      );
      continue;
    }
    cuitSinResolver.push(t);
  }

  /* ── Fase 3 · DNI contra el documento de un CUIT real ─────── */
  // Regla confirmada por NORD. Corre **después** de que las filas con CUIT
  // consumieron lo suyo: la identidad directa tiene prioridad sobre la
  // derivada del documento embebido.
  const pretensionesDni = new Map<number, Acreditacion[]>();
  for (const t of conDni) {
    pretensionesDni.set(
      t.sourceRow,
      disponibles((a) => dniCoincideConCuit(t.identificacionNormalizada, a.cuit) && cuadra(a, t)),
    );
  }
  const repartoDni = repartir(pretensionesDni);

  for (const t of conDni) {
    const asignada = repartoDni.asignadas.get(t.sourceRow);
    if (asignada) {
      consumidas.add(idDe(asignada));
      registrar(
        t,
        "ACREDITADA_EXACTA_DNI",
        "El DNI es el documento de un CUIT de persona física, y coinciden fecha e importe con un solo registro",
        { acreditacion: asignada, candidatos: [asignada] },
      );
      continue;
    }
    const conflicto = repartoDni.enConflicto.get(t.sourceRow);
    if (conflicto) {
      registrar(
        t,
        "MATCH_AMBIGUO",
        "Otra fila de la planilla apunta a la misma acreditación por documento. No se elige ninguna",
        { candidatos: conflicto },
      );
      continue;
    }
    const varios = pretensionesDni.get(t.sourceRow) ?? [];
    if (varios.length > 1) {
      registrar(
        t,
        "MATCH_AMBIGUO",
        `${varios.length} acreditaciones con ese documento, fecha e importe. No se elige ninguna`,
        { candidatos: varios },
      );
      continue;
    }

    // Sin candidato exacto. ¿El documento aparece con otra fecha o importe?
    const porDocumento = disponibles((a) =>
      dniCoincideConCuit(t.identificacionNormalizada, a.cuit),
    );
    registrar(
      t,
      porDocumento.length > 0 ? "IDENTITY_MAPPING_REQUIRED" : "PENDIENTE_NO_ENCONTRADA_EN_RANGO",
      porDocumento.length > 0
        ? `Hay ${porDocumento.length} acreditación/es con ese documento pero no cuadra la fecha o el importe`
        : "Ningún CUIT de persona física del informe contiene ese documento. Puede acreditarse más adelante: se midieron atrasos de hasta 113 días",
      { candidatos: porDocumento },
    );
  }

  /* ── Fase 4 · lo que quedó del lado del CUIT ──────────────── */
  for (const t of cuitSinResolver) {
    const mismoCuit = disponibles((a) => a.cuit === t.identificacionNormalizada);
    const mismoCuitYFecha = mismoCuit.filter(
      (a) => diasEntre(a.fecha, t.fechaDeposito!) <= tolerancia,
    );

    if (mismoCuitYFecha.length > 0) {
      registrar(
        t,
        "MATCH_AMBIGUO",
        "El CUIT y la fecha coinciden pero ningún importe. Las acreditaciones son siempre totales, así que la diferencia es una anomalía",
        { candidatos: mismoCuitYFecha },
      );
      continue;
    }
    if (mismoCuit.length > 0) {
      registrar(t, "MATCH_AMBIGUO", "El CUIT coincide pero ninguna fecha cuadra", {
        candidatos: mismoCuit,
      });
      continue;
    }

    // Recién acá los parecidos, agotadas las reglas exactas.
    const universo = new Set(disponibles(() => true).map((a) => a.cuit));
    const parecidos = cuitsParecidos(t.identificacionNormalizada, universo, 1);
    const candidatos = disponibles((a) => parecidos.some((p) => p.cuit === a.cuit) && cuadra(a, t));
    if (candidatos.length > 0) {
      registrar(
        t,
        "POSIBLE_MATCH",
        "Hay una acreditación con la misma fecha e importe cuyo CUIT difiere en un dígito. Requiere confirmación: no se acredita sola",
        { candidatos },
      );
      continue;
    }

    registrar(
      t,
      "PENDIENTE_NO_ENCONTRADA_EN_RANGO",
      comprobanteValido(t.numeroDeposito)
        ? "No aparece en el rango consultado. Puede acreditarse más adelante: se midieron atrasos de hasta 113 días"
        : "No aparece en el rango consultado. Tampoco trae número de comprobante válido",
    );
  }

  /* ── Fase 5 · posibles duplicados ─────────────────────────── */
  for (const [fila, otras] of duplicados) {
    const r = resultados.get(fila);
    if (!r) continue;
    // Un duplicado que ya se acreditó contra su propio registro no es un
    // problema: son dos operaciones reales que Fullcarga también trae dos
    // veces. Solo se marca lo que quedó sin acreditar.
    if (ESTADOS_ACREDITADOS.has(r.estado)) continue;
    if (r.estado === "PENDIENTE_NO_ENCONTRADA_EN_RANGO" || r.estado === "MATCH_AMBIGUO") {
      resultados.set(fila, {
        ...r,
        estado: "POSIBLE_DUPLICADO",
        motivo: `Misma identificación, fecha e importe que ${otras.length === 1 ? "otra fila" : `otras ${otras.length} filas`} de la planilla. Puede ser real o cargado dos veces: no se descarta ninguna`,
      });
    }
  }

  // El orden de salida es el del archivo, para poder leerlo al lado del Excel.
  return transferencias.map((t) => resultados.get(t.sourceRow)!);
}

/* ── Agregado ───────────────────────────────────────────────── */

export interface ResumenConciliacion {
  clientAlias: string;
  totalFilas: number;
  filasValidas: number;
  totalEnviado: number;
  porEstado: Record<EstadoConciliacion, number>;
  acreditadasPorCuit: number;
  acreditadasPorDni: number;
  acreditadasTotal: number;
  montoAcreditado: number;
  pendientes: number;
  montoPendiente: number;
  requierenIdentidad: number;
  ambiguas: number;
  posiblesMatches: number;
  invalidas: number;
  posiblesDuplicados: number;
  automaticas: number;
  requierenRevision: number;
  tasaAutomatica: number;
  tasaRevision: number;
}

const CENTAVOS = (n: number) => Math.round(n * 100);

export function resumir(resultados: readonly ResultadoFila[], clientAlias: string): ResumenConciliacion {
  const porEstado: Record<EstadoConciliacion, number> = {
    ACREDITADA_EXACTA_CUIT: 0,
    ACREDITADA_EXACTA_DNI: 0,
    PENDIENTE_NO_ENCONTRADA_EN_RANGO: 0,
    MATCH_AMBIGUO: 0,
    POSIBLE_MATCH: 0,
    IDENTITY_MAPPING_REQUIRED: 0,
    ERROR_CUIT: 0,
    ERROR_IDENTIFICACION: 0,
    COMPROBANTE_INVALIDO: 0,
    POSIBLE_DUPLICADO: 0,
    DATOS_INVALIDOS: 0,
  };

  let enviado = 0;
  let acreditado = 0;
  let pendiente = 0;
  for (const r of resultados) {
    porEstado[r.estado] += 1;
    if (r.transfer.importe !== null) enviado += CENTAVOS(r.transfer.importe);
    if (ESTADOS_ACREDITADOS.has(r.estado) && r.acreditacion) {
      acreditado += CENTAVOS(r.acreditacion.importe);
    }
    if (
      (r.estado === "PENDIENTE_NO_ENCONTRADA_EN_RANGO" || r.estado === "POSIBLE_DUPLICADO") &&
      r.transfer.importe !== null
    ) {
      pendiente += CENTAVOS(r.transfer.importe);
    }
  }

  const total = resultados.length;
  const automaticas = resultados.filter((r) => r.automatico).length;
  const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 1000) / 10);

  return {
    clientAlias,
    totalFilas: total,
    filasValidas: resultados.filter((r) => r.transfer.validationStatus !== "INVALIDA").length,
    totalEnviado: enviado / 100,
    porEstado,
    acreditadasPorCuit: porEstado.ACREDITADA_EXACTA_CUIT,
    acreditadasPorDni: porEstado.ACREDITADA_EXACTA_DNI,
    acreditadasTotal: porEstado.ACREDITADA_EXACTA_CUIT + porEstado.ACREDITADA_EXACTA_DNI,
    montoAcreditado: acreditado / 100,
    pendientes: porEstado.PENDIENTE_NO_ENCONTRADA_EN_RANGO,
    montoPendiente: pendiente / 100,
    requierenIdentidad: porEstado.IDENTITY_MAPPING_REQUIRED,
    ambiguas: porEstado.MATCH_AMBIGUO,
    posiblesMatches: porEstado.POSIBLE_MATCH,
    invalidas: porEstado.DATOS_INVALIDOS + porEstado.ERROR_CUIT + porEstado.ERROR_IDENTIFICACION,
    posiblesDuplicados: porEstado.POSIBLE_DUPLICADO,
    automaticas,
    requierenRevision: total - automaticas,
    tasaAutomatica: pct(automaticas),
    tasaRevision: pct(total - automaticas),
  };
}
