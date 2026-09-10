/**
 * Motor de re-evaluación.
 *
 * Una operación pendiente **no es un resultado, es un estado abierto**. Cada
 * informe nuevo de Fullcarga vuelve a intentar conciliar todo lo que sigue
 * abierto, contra una ventana que se mueve. Se midieron atrasos de hasta 113
 * días: buscar solo contra el envío del día anterior perdería la mitad del
 * volumen.
 *
 * Este archivo es **puro**. No lee ni escribe: recibe el estado y devuelve el
 * estado siguiente más los eventos que lo explican. Toda la persistencia vive
 * en `lib/data/operaciones.ts`, y esa separación es lo que permite testear la
 * re-evaluación sin tocar el disco.
 *
 * Orden de las tres fuentes de verdad, y no es arbitrario:
 *
 *   1. **lo que decidió una persona** — se respeta siempre, no se recalcula;
 *   2. **lo que una persona enseñó** — los mapeos de identidad confirmados;
 *   3. **lo que deduce el matcher** — solo sobre lo que quedó sin decidir.
 */

import { conciliar } from "../conciliacion";
import type { Acreditacion } from "../fullcarga/informe";
import type { ClientTransfer } from "../planillas/cliente";
import { estaAcreditada } from "./buckets";
import type {
  AcreditacionGuardada, Corrida, Evento, MapeoIdentidad, Operacion, Resolucion,
} from "./tipos";

/** Clave con la que el matcher identifica una acreditación. */
const claveAcreditacion = (a: AcreditacionGuardada) => `${a.informeId}|${a.row}`;

/** `AcreditacionGuardada` en la forma que espera el matcher. */
function aAcreditacion(a: AcreditacionGuardada): Acreditacion {
  return {
    sourceFile: a.informeId,
    sheet: "",
    row: a.row,
    cuit: a.cuit,
    fecha: a.fecha,
    importe: a.importe,
    banco: a.banco,
    clienteNord: null,
    descripcion: a.descripcion,
  };
}

/**
 * `Operacion` en la forma que espera el matcher.
 *
 * `sourceRow` lleva el índice dentro de la corrida, no la fila de la
 * planilla: el matcher lo usa como clave y tiene que ser único entre
 * planillas distintas.
 */
function aTransferencia(op: Operacion, indice: number, identificacion: string): ClientTransfer {
  return {
    sourceFile: op.planillaId,
    sourceSheet: "",
    sourceRow: indice,
    clientAlias: op.clienteId,
    banco: op.banco,
    fechaDeposito: op.fechaDeposito,
    importe: op.importe,
    nombreDepositante: op.nombreDepositante,
    identificacionOriginal: op.identificacionOriginal,
    identificacionNormalizada: identificacion,
    tipoIdentificacion: identificacion === op.identificacionNormalizada
      ? op.tipoIdentificacion
      : "CUIT_VALIDO",
    numeroDeposito: op.numeroDeposito,
    tipo: null,
    comentario: null,
    validationStatus: "VALIDA",
    validationErrors: [],
  };
}

export interface EntradaEvaluacion {
  operaciones: readonly Operacion[];
  acreditaciones: readonly AcreditacionGuardada[];
  mapeos: readonly MapeoIdentidad[];
  resoluciones: readonly Resolucion[];
  /** ISO con hora. Se usa para fechar los eventos y la corrida. */
  momento: string;
  disparador: Corrida["disparador"];
}

export interface SalidaEvaluacion {
  operaciones: Operacion[];
  eventos: Omit<Evento, "id">[];
  corrida: Omit<Corrida, "id">;
  /** Mapeos que se aplicaron, con cuántas veces. Para actualizar los usos. */
  usosDeMapeo: Map<string, number>;
}

/** La última resolución de cada operación. La última gana. */
function ultimaResolucionPorOperacion(
  resoluciones: readonly Resolucion[],
): Map<string, Resolucion> {
  const salida = new Map<string, Resolucion>();
  for (const r of [...resoluciones].sort((a, b) => (a.momento < b.momento ? -1 : 1))) {
    salida.set(r.operacionId, r);
  }
  return salida;
}

/**
 * Vuelve a conciliar todo lo que sigue abierto.
 *
 * Devuelve el arreglo completo de operaciones —abiertas y cerradas— para que
 * quien llama pueda reemplazarlo entero sin tener que mezclar.
 */
export function reevaluar(entrada: EntradaEvaluacion): SalidaEvaluacion {
  const { operaciones, acreditaciones, mapeos, resoluciones, momento } = entrada;

  const porClave = new Map(acreditaciones.map((a) => [claveAcreditacion(a), a]));
  const resolucionDe = ultimaResolucionPorOperacion(resoluciones);
  const usosDeMapeo = new Map<string, number>();

  /** Acreditaciones ya comprometidas. Una no se puede cobrar dos veces. */
  const consumidas = new Set<string>();
  const salida = new Map<string, Operacion>();
  const eventos: Omit<Evento, "id">[] = [];

  const anotar = (previo: Operacion, siguiente: Operacion, origen: Evento["origen"], actor: string) => {
    salida.set(siguiente.id, siguiente);
    if (previo.estado !== siguiente.estado) {
      eventos.push({
        operacionId: siguiente.id,
        momento,
        de: previo.estado,
        a: siguiente.estado,
        motivo: siguiente.motivo,
        actor,
        origen,
      });
    }
  };

  /* ── 1 · Lo que decidió una persona, esté abierto o cerrado ── */
  //
  // El orden importa y costó un test descubrirlo. Antes se apartaba
  // primero lo cerrado y recién después se miraban las resoluciones, así
  // que **una decisión humana sobre algo que el sistema ya había cerrado
  // se ignoraba en silencio**: si el matcher acreditaba una fila y Mati
  // después descubría que era un duplicado, no había forma de corregirlo.
  //
  // La regla es que la persona gana. También cuando llega tarde.

  /** Por operación, las acreditaciones que Mati descartó. */
  const rechazadas = new Map<string, Set<string>>();
  const porDecidir: Operacion[] = [];
  const abiertas: Operacion[] = [];

  for (const op of operaciones) {
    const r = resolucionDe.get(op.id);
    const cerrada = estaAcreditada(op.estado) || op.estado === "DESCARTADA_DUPLICADO";

    if (!r) {
      if (cerrada) {
        if (op.acreditacionId) consumidas.add(op.acreditacionId);
        salida.set(op.id, op);
        continue;
      }
      abiertas.push(op);
      porDecidir.push(op);
      continue;
    }

    if (!cerrada) abiertas.push(op);

    if (r.decision === "CONFIRMAR_MATCH" && r.acreditacionId) {
      // Una acreditación que otra operación ya se llevó no se puede
      // confirmar de nuevo: se deja la operación abierta antes que romper
      // el uno a uno.
      if (consumidas.has(r.acreditacionId)) {
        porDecidir.push(op);
        continue;
      }
      consumidas.add(r.acreditacionId);
      const a = porClave.get(r.acreditacionId);
      anotar(op, {
        ...op,
        estado: "ACREDITADA_MANUAL",
        motivo: `Confirmada por ${r.actor}${r.motivo ? `: ${r.motivo}` : ""}`,
        acreditacionId: r.acreditacionId,
        candidatoIds: [],
        automatico: false,
        fechaAcreditacion: a?.fecha ?? op.fechaDeposito,
        evaluadaEn: momento,
        intentos: op.intentos + 1,
      }, "RESOLUCION", r.actor);
      continue;
    }

    if (r.decision === "MARCAR_DUPLICADO") {
      anotar(op, {
        ...op,
        estado: "DESCARTADA_DUPLICADO",
        motivo: `Marcada como duplicada por ${r.actor}${r.motivo ? `: ${r.motivo}` : ""}`,
        acreditacionId: null,
        candidatoIds: [],
        automatico: false,
        evaluadaEn: momento,
        intentos: op.intentos + 1,
      }, "RESOLUCION", r.actor);
      continue;
    }

    // Rechazar o mantener: los candidatos que Mati vio quedan descartados,
    // así la operación no vuelve mañana con la misma propuesta. Sigue
    // abierta, porque puede aparecer una acreditación distinta.
    if (op.candidatoIds.length > 0) {
      rechazadas.set(op.id, new Set([...(rechazadas.get(op.id) ?? []), ...op.candidatoIds]));
    }
    porDecidir.push(op);
  }

  /* ── 3 · Lo que una persona enseñó ───────────────────────── */

  const mapeoDe = new Map(mapeos.map((m) => [`${m.clienteId}|${m.identificacion}`, m]));
  const identificacionUsada = new Map<string, { valor: string; mapeoId: string | null }>();
  for (const op of porDecidir) {
    const m = mapeoDe.get(`${op.clienteId}|${op.identificacionNormalizada}`);
    identificacionUsada.set(op.id, {
      valor: m ? m.cuit : op.identificacionNormalizada,
      mapeoId: m ? m.id : null,
    });
  }

  /* ── 4 · Lo que deduce el matcher ────────────────────────── */

  const disponibles = () =>
    acreditaciones.filter((a) => !consumidas.has(claveAcreditacion(a)));

  // Dos pasadas: primero las operaciones sin descartes, después las que
  // tienen, cada una contra su propio pozo. Mezclarlas obligaría al matcher
  // a conocer exclusiones por fila, que no es su trabajo.
  const limpias = porDecidir.filter((op) => !rechazadas.has(op.id));
  const conDescartes = porDecidir.filter((op) => rechazadas.has(op.id));

  const aplicar = (ops: readonly Operacion[], pozo: readonly AcreditacionGuardada[]) => {
    if (ops.length === 0) return;
    const transferencias = ops.map((op, i) =>
      aTransferencia(op, i, identificacionUsada.get(op.id)!.valor),
    );
    const resultados = conciliar(transferencias, pozo.map(aAcreditacion));

    resultados.forEach((r) => {
      const op = ops[r.transfer.sourceRow];
      const mapeoId = identificacionUsada.get(op.id)!.mapeoId;
      const elegida = r.acreditacion
        ? `${r.acreditacion.sourceFile}|${r.acreditacion.row}`
        : null;
      if (elegida) consumidas.add(elegida);
      if (elegida && mapeoId) usosDeMapeo.set(mapeoId, (usosDeMapeo.get(mapeoId) ?? 0) + 1);

      anotar(op, {
        ...op,
        estado: r.estado,
        motivo: r.motivo,
        acreditacionId: elegida,
        candidatoIds: r.candidatos.map((c) => `${c.sourceFile}|${c.row}`),
        duplicadoDe: r.duplicadoDe,
        automatico: r.automatico,
        viaMapeo: Boolean(elegida && mapeoId),
        fechaAcreditacion: r.acreditacion ? r.acreditacion.fecha : null,
        evaluadaEn: momento,
        intentos: op.intentos + 1,
      }, "CONCILIACION", "sistema");
    });
  };

  // Se corre **por planilla**, no todo junto. La detección de duplicados
  // del matcher compara identificación, fecha e importe, y esa comparación
  // solo tiene sentido dentro de una misma planilla: dos clientes distintos
  // pueden recibir lo mismo el mismo día del mismo depositante sin que eso
  // sea un duplicado. El pozo de acreditaciones, en cambio, es global: una
  // acreditación consumida por una planilla ya no está para las demás.
  const porPlanilla = new Map<string, Operacion[]>();
  for (const op of limpias) {
    porPlanilla.set(op.planillaId, [...(porPlanilla.get(op.planillaId) ?? []), op]);
  }
  for (const id of [...porPlanilla.keys()].sort()) {
    aplicar(porPlanilla.get(id)!, disponibles());
  }

  for (const op of conDescartes) {
    const descartadas = rechazadas.get(op.id)!;
    aplicar([op], disponibles().filter((a) => !descartadas.has(claveAcreditacion(a))));
  }

  /* ── 5 · Resultado ───────────────────────────────────────── */

  const finales = operaciones.map((op) => salida.get(op.id) ?? op);
  const nuevasAcreditadas = eventos.filter((e) => estaAcreditada(e.a)).length;
  const porMapeo = finales.filter(
    (op) => op.viaMapeo && estaAcreditada(op.estado) && op.evaluadaEn === momento,
  ).length;

  return {
    operaciones: finales,
    eventos,
    corrida: {
      momento,
      disparador: entrada.disparador,
      operacionesEvaluadas: abiertas.length,
      nuevasAcreditadas,
      porMapeo,
      pendientesAlCierre: finales.filter(
        (op) => op.estado === "PENDIENTE_NO_ENCONTRADA_EN_RANGO",
      ).length,
    },
    usosDeMapeo,
  };
}

/** Fecha de hoy en ISO, para lo que se deriva al leer. */
export function hoyOperativo(momento = new Date().toISOString()): string {
  return momento.slice(0, 10);
}
