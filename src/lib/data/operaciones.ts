import "server-only";
import { repositorios } from "./contexto";
import { bucketDe, estaAcreditada, requiereAtencion } from "../operaciones/buckets";
import { diasPendiente } from "../operaciones/fechas";
import { correrConciliacion } from "../servicios/conciliacion";
import type {
  AcreditacionGuardada, Bucket, Cliente, Corrida, Decision, Evento, Informe,
  MapeoIdentidad, Operacion, Planilla,
} from "../operaciones/tipos";
import type { Repositorios } from "./puertos";
import { hoyISO } from "../format";
import { ErrorNoEncontrado, ErrorValidacion } from "../domain/errors";

/**
 * Capa de aplicación del módulo operativo.
 *
 * Ya no habla con ningún almacén: habla con **repositorios**. Qué hay
 * detrás —un archivo local o Postgres— lo decide `contexto.ts` y nadie más
 * necesita saberlo. Las pantallas siguen llamando a las mismas funciones.
 *
 * Lo que queda acá es lo que de verdad es de esta capa: componer lo que
 * varias consultas devuelven y derivar lo que no se guarda. Todo lo
 * derivado —días pendiente, estado de una planilla, totales— se calcula al
 * leer. Guardar un derivado es garantizar que en algún momento quede viejo.
 */

const ACTOR_DEMO = "mati@nordelta.com";

/**
 * ¿El dominio operativo ya corre contra Postgres?
 *
 * Sí. Acreditaciones, planillas, transferencias, resoluciones e historial
 * se leen y se escriben en la base, con seguridad por fila verificada
 * contra dos organizaciones y el recorrido completo probado de punta a
 * punta.
 *
 * La constante se queda porque su trabajo no terminó: si alguien vuelve a
 * dejar una parte del dominio fuera de la base, esto se pone en `false` y
 * la aplicación lo dice en pantalla. Un despliegue que cree estar leyendo
 * la base y esté leyendo un archivo local es exactamente el tipo de cosa
 * que nadie descubre hasta que importa.
 */
export const OPERACIONES_MIGRADAS = true;

const CENTAVOS = (n: number) => Math.round(n * 100);

/* ── Maestros ───────────────────────────────────────────────── */

export async function getClientes(): Promise<Cliente[]> {
  return (await repositorios()).clientes.listar();
}

export async function getCliente(id: string): Promise<Cliente> {
  const c = await (await repositorios()).clientes.obtener(id);
  if (!c) throw new ErrorNoEncontrado(`No existe el cliente ${id}`, { id });
  return c;
}

export async function getInformes(): Promise<Informe[]> {
  return (await repositorios()).informes.listar();
}

export async function getCorridas(limite = 20): Promise<Corrida[]> {
  return (await repositorios()).conciliacion.corridas(limite);
}

export async function getMapeos(): Promise<MapeoIdentidad[]> {
  return (await repositorios()).conciliacion.mapeos();
}

/* ── Vista de una operación ─────────────────────────────────── */

/** Una operación con todo lo que una pantalla necesita, ya resuelto. */
export interface OperacionVista extends Operacion {
  cliente: Cliente;
  planilla: Planilla;
  bucket: Bucket;
  /** Derivado al leer. Nunca persistido. */
  diasPendiente: number;
  acreditacion: AcreditacionGuardada | null;
  candidatos: AcreditacionGuardada[];
}

/**
 * Arma las vistas resolviendo cliente, planilla y acreditaciones de una
 * sola pasada.
 *
 * Se hace con índices en memoria y no con una consulta por fila: con la
 * cola en régimen —miles de operaciones— una consulta por fila sería
 * exactamente el problema de las N+1 consultas.
 */
async function componer(
  repos: Repositorios,
  operaciones: readonly Operacion[],
): Promise<OperacionVista[]> {
  if (operaciones.length === 0) return [];
  const hoy = hoyISO();
  const [clientes, planillas, acreditaciones] = await Promise.all([
    repos.clientes.listar(),
    repos.planillas.listar(),
    repos.acreditaciones.listar(),
  ]);
  const porCliente = new Map(clientes.map((c) => [c.id, c]));
  const porPlanilla = new Map(planillas.map((p) => [p.id, p]));
  const porAcreditacion = new Map(acreditaciones.map((a) => [a.id, a]));

  return operaciones.map((o) => ({
    ...o,
    cliente: porCliente.get(o.clienteId) ?? { id: o.clienteId, nombre: "—", alias: "—" },
    planilla: porPlanilla.get(o.planillaId)!,
    bucket: bucketDe(o.estado),
    diasPendiente: diasPendiente(o.fechaDeposito, hoy),
    acreditacion: o.acreditacionId ? porAcreditacion.get(o.acreditacionId) ?? null : null,
    candidatos: o.candidatoIds
      .map((id) => porAcreditacion.get(id))
      .filter((a): a is AcreditacionGuardada => Boolean(a)),
  }));
}

export interface FiltrosOperaciones {
  /** `null` = todas. */
  bucket?: Bucket | null;
  clienteId?: string | null;
  planillaId?: string | null;
  /** Busca en nombre, identificación, importe y número de comprobante. */
  texto?: string;
  /** Solo las que llevan al menos tantos días. */
  desdeDias?: number | null;
  orden?: "ANTIGUEDAD" | "IMPORTE" | "FECHA" | "CLIENTE";
}

/**
 * La cola de operaciones, filtrada y ordenada.
 *
 * Sabemos que puede llegar a miles: con la mitad del volumen acreditando
 * después de D+1, la cola en régimen no es una lista corta que se lee de
 * arriba abajo. Por eso el filtro y el orden no son un extra de la versión
 * dos: son parte de que la pantalla sirva.
 */
export async function getOperaciones(f: FiltrosOperaciones = {}): Promise<OperacionVista[]> {
  const repos = await repositorios();
  const crudas = await repos.transferencias.listar({
    planillaId: f.planillaId ?? undefined,
    clienteId: f.clienteId ?? undefined,
  });
  const vistas = await componer(repos, crudas);

  const texto = (f.texto ?? "").trim().toLowerCase();
  const filtradas = vistas.filter((o) => {
    if (f.bucket && o.bucket !== f.bucket) return false;
    if (f.desdeDias && o.diasPendiente < f.desdeDias) return false;
    if (texto === "") return true;
    return (
      (o.nombreDepositante ?? "").toLowerCase().includes(texto) ||
      o.identificacionOriginal.toLowerCase().includes(texto) ||
      o.identificacionNormalizada.includes(texto) ||
      (o.numeroDeposito ?? "").includes(texto) ||
      String(o.importe).includes(texto) ||
      o.cliente.nombre.toLowerCase().includes(texto)
    );
  });

  const orden = f.orden ?? "ANTIGUEDAD";
  return filtradas.sort((a, b) => {
    if (orden === "IMPORTE") return b.importe - a.importe;
    if (orden === "FECHA") return a.fechaDeposito < b.fechaDeposito ? 1 : -1;
    if (orden === "CLIENTE") {
      const c = a.cliente.nombre.localeCompare(b.cliente.nombre, "es");
      return c !== 0 ? c : b.diasPendiente - a.diasPendiente;
    }
    // Antigüedad: la que más espera, primero. Las dos son problema desde el
    // día cero; el orden es para priorizar, no para clasificar.
    return b.diasPendiente - a.diasPendiente || b.importe - a.importe;
  });
}

export async function getOperacion(id: string): Promise<OperacionVista> {
  const repos = await repositorios();
  const op = await repos.transferencias.obtener(id);
  if (!op) throw new ErrorNoEncontrado(`No existe la operación ${id}`, { id });
  const [vista] = await componer(repos, [op]);
  return vista;
}

/** El historial de una operación: qué pasó, cuándo y por qué. */
export async function getHistorial(operacionId: string): Promise<Evento[]> {
  return (await repositorios()).conciliacion.eventos(operacionId);
}

/* ── Resumen operativo ──────────────────────────────────────── */

export interface ResumenOperativo {
  total: number;
  conciliadas: number;
  resueltas: number;
  requierenAtencion: number;
  pendientes: number;
  revision: number;
  errores: number;
  tasaAutomatica: number;
  montoEnviado: number;
  montoAcreditado: number;
  montoPendiente: number;
  montoEnRiesgo: number;
  /** Momento de la última corrida, si hubo alguna. */
  ultimaCorrida: Corrida | null;
  /** La operación abierta que más tiempo lleva esperando. */
  masAntigua: number;
}

export async function getResumenOperativo(): Promise<ResumenOperativo> {
  const repos = await repositorios();
  const hoy = hoyISO();
  const [ops, corridas] = await Promise.all([
    repos.transferencias.listar(),
    repos.conciliacion.corridas(1),
  ]);

  let conciliadas = 0, resueltas = 0, pendientes = 0, revision = 0, errores = 0;
  let enviado = 0, acreditado = 0, pendiente = 0, riesgo = 0, masAntigua = 0;

  for (const o of ops) {
    enviado += CENTAVOS(o.importe);
    const b = bucketDe(o.estado);
    if (b === "CONCILIADA") conciliadas++;
    else if (b === "RESUELTA") resueltas++;
    else if (b === "PENDIENTE") pendientes++;
    else if (b === "REVISION") revision++;
    else errores++;

    if (estaAcreditada(o.estado)) acreditado += CENTAVOS(o.importe);
    if (b === "PENDIENTE") pendiente += CENTAVOS(o.importe);
    if (requiereAtencion(o.estado)) {
      riesgo += CENTAVOS(o.importe);
      masAntigua = Math.max(masAntigua, diasPendiente(o.fechaDeposito, hoy));
    }
  }

  return {
    total: ops.length,
    conciliadas,
    resueltas,
    requierenAtencion: pendientes + revision + errores,
    pendientes,
    revision,
    errores,
    tasaAutomatica: ops.length === 0 ? 0 : Math.round((conciliadas / ops.length) * 1000) / 10,
    montoEnviado: enviado / 100,
    montoAcreditado: acreditado / 100,
    montoPendiente: pendiente / 100,
    montoEnRiesgo: riesgo / 100,
    ultimaCorrida: corridas[0] ?? null,
    masAntigua,
  };
}

/**
 * Flujo, no stock.
 *
 * Cuántos pendientes hay es un número que por sí solo no dice nada: con la
 * mitad del volumen acreditando después de D+1, una cola grande es el
 * estado normal. Lo que hay que poder responder es **si crece o si drena**,
 * y eso sale de los eventos, no del recuento.
 */
export interface Flujo {
  nuevosHoy: number;
  acreditadosHoy: number;
  /** Positivo: la cola creció. Negativo: drenó. */
  variacion: number;
  abiertos: number;
  /** Cuántas se acreditaron gracias a algo que Mati enseñó. */
  porMapeoHoy: number;
}

export async function getFlujo(): Promise<Flujo> {
  const repos = await repositorios();
  const hoy = hoyISO();
  const [delDia, ops] = await Promise.all([
    repos.conciliacion.eventosDelDia(hoy),
    repos.transferencias.listar(),
  ]);
  const nuevosHoy = delDia.filter((e) => e.a === "PENDIENTE_NO_ENCONTRADA_EN_RANGO").length;
  const acreditadosHoy = delDia.filter((e) => estaAcreditada(e.a)).length;
  return {
    nuevosHoy,
    acreditadosHoy,
    variacion: nuevosHoy - acreditadosHoy,
    abiertos: ops.filter((o) => requiereAtencion(o.estado)).length,
    porMapeoHoy: ops.filter(
      (o) => o.viaMapeo && estaAcreditada(o.estado) && o.evaluadaEn.slice(0, 10) === hoy,
    ).length,
  };
}

/* ── Planillas ──────────────────────────────────────────────── */

export interface PlanillaVista extends Planilla {
  cliente: Cliente;
  operaciones: number;
  enviado: number;
  acreditado: number;
  pendiente: number;
  /** Cuántas filas tienen el dato mal. */
  errores: number;
  /** Plata parada en filas con el dato mal. */
  montoError: number;
  /** Cuántas acreditaron, para mostrar «11 de 12». */
  acreditadas: number;
  /** Todas acreditadas: puede pasar a cuenta corriente. */
  listaParaCtaCte: boolean;
  /** Última vez que algo se movió en esta planilla. */
  ultimaActividad: string;
}

function vistaPlanilla(
  p: Planilla,
  operaciones: readonly Operacion[],
  clientes: ReadonlyMap<string, Cliente>,
): PlanillaVista {
  const propias = operaciones.filter((o) => o.planillaId === p.id);
  let enviado = 0, acreditado = 0, pendiente = 0, error = 0, errores = 0, acreditadas = 0;
  let ultima = p.importadaEn;

  for (const o of propias) {
    enviado += CENTAVOS(o.importe);
    if (estaAcreditada(o.estado)) { acreditado += CENTAVOS(o.importe); acreditadas++; }
    else if (bucketDe(o.estado) === "ERROR") { errores++; error += CENTAVOS(o.importe); }
    else pendiente += CENTAVOS(o.importe);
    if (o.evaluadaEn > ultima) ultima = o.evaluadaEn;
  }

  return {
    ...p,
    cliente: clientes.get(p.clienteId) ?? { id: p.clienteId, nombre: "—", alias: "—" },
    operaciones: propias.length,
    enviado: enviado / 100,
    acreditado: acreditado / 100,
    pendiente: pendiente / 100,
    errores,
    montoError: error / 100,
    acreditadas,
    listaParaCtaCte: propias.length > 0 && acreditadas === propias.length,
    ultimaActividad: ultima,
  };
}

export async function getPlanillas(clienteId?: string): Promise<PlanillaVista[]> {
  const repos = await repositorios();
  const [planillas, operaciones, clientes] = await Promise.all([
    repos.planillas.listar(clienteId),
    repos.transferencias.listar(clienteId ? { clienteId } : {}),
    repos.clientes.listar(),
  ]);
  const porCliente = new Map(clientes.map((c) => [c.id, c]));
  return planillas.map((p) => vistaPlanilla(p, operaciones, porCliente));
}

export async function getPlanilla(id: string): Promise<PlanillaVista> {
  const repos = await repositorios();
  const p = await repos.planillas.obtener(id);
  if (!p) throw new ErrorNoEncontrado(`No existe la planilla ${id}`, { id });
  const [operaciones, clientes] = await Promise.all([
    repos.transferencias.listar({ planillaId: id }),
    repos.clientes.listar(),
  ]);
  return vistaPlanilla(p, operaciones, new Map(clientes.map((c) => [c.id, c])));
}

/* ── Clientes con estado ────────────────────────────────────── */

export interface ClienteVista extends Cliente {
  planillas: number;
  operaciones: number;
  enviado: number;
  acreditado: number;
  pendiente: number;
  errores: number;
  montoError: number;
  requierenAtencion: number;
  /** Última vez que algo se movió. Vacío si nunca mandó nada. */
  ultimaActividad: string | null;
}

export async function getClientesConEstado(): Promise<ClienteVista[]> {
  const repos = await repositorios();
  const [clientes, planillas, operaciones] = await Promise.all([
    repos.clientes.listar(),
    repos.planillas.listar(),
    repos.transferencias.listar(),
  ]);

  return clientes
    .map((c) => {
      const propias = operaciones.filter((o) => o.clienteId === c.id);
      const suyas = planillas.filter((p) => p.clienteId === c.id);
      let enviado = 0, acreditado = 0, pendiente = 0, error = 0, errores = 0, atencion = 0;
      let ultima: string | null = null;

      for (const o of propias) {
        enviado += CENTAVOS(o.importe);
        if (estaAcreditada(o.estado)) acreditado += CENTAVOS(o.importe);
        else if (bucketDe(o.estado) === "ERROR") { errores++; error += CENTAVOS(o.importe); }
        else pendiente += CENTAVOS(o.importe);
        if (requiereAtencion(o.estado)) atencion++;
      }
      for (const p of suyas) if (!ultima || p.fecha > ultima) ultima = p.fecha;

      return {
        ...c,
        planillas: suyas.length,
        operaciones: propias.length,
        enviado: enviado / 100,
        acreditado: acreditado / 100,
        pendiente: pendiente / 100,
        errores,
        montoError: error / 100,
        requierenAtencion: atencion,
        ultimaActividad: ultima,
      };
    })
    .sort((a, b) => b.requierenAtencion - a.requierenAtencion || b.enviado - a.enviado);
}

/* ── Escritura ──────────────────────────────────────────────── */

/**
 * Vuelve a conciliar todo lo que sigue abierto.
 *
 * Es la acción «Actualizar conciliación». No hay cron todavía y no hace
 * falta: lo que importa del producto es que el estado de una operación
 * **pueda** cambiar sin que nadie la vuelva a cargar.
 */
export async function reevaluarTodo(
  disparador: Corrida["disparador"] = "MANUAL",
): Promise<Corrida> {
  const { corrida } = await correrConciliacion(await repositorios(), disparador);
  return corrida;
}

export interface EntradaResolucion {
  operacionId: string;
  decision: Decision;
  acreditacionId?: string | null;
  motivo?: string | null;
  /**
   * Guardar además la identidad como aprendida.
   *
   * Es lo único de todo el flujo con efecto compuesto: cada identidad que
   * Mati confirma sube la tasa automática de las conciliaciones siguientes.
   */
  aprenderIdentidad?: boolean;
  actor?: string;
}

/**
 * Registra lo que decidió una persona y vuelve a conciliar.
 *
 * La resolución se guarda **antes** de re-evaluar, y el motor la lee como
 * fuente de verdad por encima del matcher. Es lo que garantiza que una
 * excepción resuelta hoy no reaparezca mañana como si nada hubiera pasado,
 * y que una corrida automática **no pise** una decisión humana.
 */
export async function resolverExcepcion(entrada: EntradaResolucion): Promise<Corrida> {
  const repos = await repositorios();
  const op = await repos.transferencias.obtener(entrada.operacionId);
  if (!op) throw new ErrorNoEncontrado(`No existe la operación ${entrada.operacionId}`);

  if (entrada.decision === "CONFIRMAR_MATCH") {
    if (!entrada.acreditacionId) {
      throw new ErrorValidacion("Para confirmar hay que elegir una acreditación", "acreditacionId");
    }
    // El candidato tiene que ser uno de los que el sistema le mostró para
    // **esta** operación. Una Server Action es un POST alcanzable por
    // cualquiera: confiar en el identificador que llega sería habilitar
    // acreditar contra un registro arbitrario.
    if (!op.candidatoIds.includes(entrada.acreditacionId)) {
      throw new ErrorValidacion(
        "Esa acreditación no es candidata de esta operación",
        "acreditacionId",
        { operacionId: op.id },
      );
    }
  }

  const actor = entrada.actor ?? ACTOR_DEMO;
  let mapeoId: string | null = null;

  // Aprender la identidad solo tiene sentido al confirmar un match: es ahí
  // donde queda establecido qué CUIT real corresponde a lo que informa el
  // cliente. Nunca se deduce de otra cosa.
  if (entrada.aprenderIdentidad && entrada.decision === "CONFIRMAR_MATCH") {
    const acreditaciones = await repos.acreditaciones.listar();
    const a = acreditaciones.find((x) => x.id === entrada.acreditacionId);
    if (a && a.cuit !== op.identificacionNormalizada) {
      const mapeo = await repos.conciliacion.registrarMapeo({
        clienteId: op.clienteId,
        identificacion: op.identificacionNormalizada,
        cuit: a.cuit,
        actor,
        momento: new Date().toISOString().slice(0, 19),
        origen: "RESOLUCION",
      });
      mapeoId = mapeo.id;
    }
  }

  await repos.conciliacion.registrarResolucion({
    operacionId: entrada.operacionId,
    decision: entrada.decision,
    // Toda resolución que entra por acá la tomó una persona.
    origen: "HUMANA",
    estadoPrevio: op.estado,
    acreditacionId: entrada.acreditacionId ?? null,
    actor,
    momento: new Date().toISOString().slice(0, 19),
    motivo: entrada.motivo ?? null,
    mapeoId,
  });

  const { corrida } = await correrConciliacion(repos, "MANUAL");
  return corrida;
}

/* ── Alta de datos ──────────────────────────────────────────── */

export interface OperacionNueva {
  fila: number;
  fechaDeposito: string;
  banco: string | null;
  nombreDepositante: string | null;
  identificacionOriginal: string;
  identificacionNormalizada: string;
  tipoIdentificacion: Operacion["tipoIdentificacion"];
  importe: number;
  numeroDeposito: string | null;
}

/** Da de alta una planilla con sus operaciones y concilia enseguida. */
export async function crearPlanilla(
  clienteId: string,
  archivo: string,
  fecha: string,
  filas: readonly OperacionNueva[],
  huella?: string,
  /** Dónde quedó el archivo original. De la fila al archivo fuente. */
  storagePath?: string,
): Promise<{ planilla: Planilla; corrida: Corrida }> {
  const repos = await repositorios();
  if (filas.length === 0) {
    throw new ErrorValidacion("La planilla no tiene ninguna fila con datos", "archivo");
  }

  const planilla = await repos.planillas.crear({
    clienteId, archivo, fecha, sha256: huella ?? null, storagePath: storagePath ?? null,
  });
  const creadas = await repos.transferencias.crearLote(planilla.id, filas);

  await repos.conciliacion.registrarEventos(
    creadas.map((o) => ({
      operacionId: o.id,
      momento: new Date().toISOString().slice(0, 19),
      de: null,
      a: "PENDIENTE_NO_ENCONTRADA_EN_RANGO" as const,
      motivo: `Importada de ${archivo}`,
      actor: ACTOR_DEMO,
      origen: "IMPORTACION" as const,
    })),
  );

  const { corrida } = await correrConciliacion(repos, "IMPORTACION_PLANILLA");
  return { planilla: (await repos.planillas.obtener(planilla.id))!, corrida };
}

export interface AcreditacionNueva {
  cuit: string;
  fecha: string;
  importe: number;
  banco: string | null;
  descripcion: string | null;
  row: number;
}

/**
 * Incorpora un informe de Fullcarga al pozo y vuelve a conciliar.
 *
 * Da igual si vino del descargador automático o de un archivo subido a
 * mano: **entran por el mismo camino**. Que el fallback manual recorriera
 * otro código sería garantizar que se comporte distinto justo el día que
 * se lo necesita.
 */
export async function importarInforme(
  archivo: string,
  desde: string,
  hasta: string,
  origen: Informe["origen"],
  filas: readonly AcreditacionNueva[],
  huella?: string,
  storagePath?: string,
): Promise<{ informe: Informe; corrida: Corrida; nuevas: number }> {
  const repos = await repositorios();
  const informe = await repos.informes.registrar({
    archivo, desde, hasta, origen, sha256: huella ?? null, storagePath: storagePath ?? null,
  });
  const { nuevas } = await repos.acreditaciones.incorporar(informe.id, filas);
  const { corrida } = await correrConciliacion(repos, "IMPORTACION_INFORME");
  return { informe: { ...informe, acreditaciones: nuevas }, corrida, nuevas };
}

/** Vuelve el módulo operativo al estado inicial. Solo en modo local. */
export async function restablecerOperaciones(): Promise<void> {
  const { almacenOps } = await import("./almacen-operaciones");
  almacenOps.restablecer();
}
