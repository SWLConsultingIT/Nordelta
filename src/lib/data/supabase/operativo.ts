import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ErrorDatos, ErrorNoEncontrado, ErrorValidacion } from "../../domain/errors";
import { esFechaCalendario } from "../../fullcarga/fechas";
import type {
  AcreditacionGuardada, Corrida, Evento, Informe, MapeoIdentidad, Operacion, Resolucion,
} from "../../operaciones/tipos";
import type {
  FiltroTransferencias, RepositorioAcreditaciones, RepositorioConciliacion,
  RepositorioInformes, RepositorioTransferencias,
} from "../puertos";

/**
 * Los cuatro repositorios del núcleo operativo, contra Postgres.
 *
 * Dos cosas que estos adaptadores hacen y conviene no perder de vista:
 *
 * **El dinero cruza la frontera en centavos enteros.** En la base es
 * `bigint`; en el dominio es un número de pesos. La conversión ocurre acá y
 * solo acá. Un redondeo repartido por la aplicación es la forma más común
 * de que dos pantallas muestren totales distintos.
 *
 * **El aislamiento entre organizaciones no se hace acá.** Lo hacen la
 * seguridad por fila y las claves foráneas compuestas. Si dependiera de que
 * cada consulta se acuerde de filtrar, alcanzaría un olvido para filtrar
 * datos de otro inquilino.
 *
 * `organizacionId` es opcional y existe para **un solo caso**: las tareas
 * de administración que corren con la clave secreta, donde no hay sesión y
 * por lo tanto el valor por defecto de la columna —`fn_org()`— es nulo.
 * Una herramienta que escribe en nombre de una organización tiene que
 * decir cuál; deducirlo sería adivinar. Desde la aplicación se omite y lo
 * resuelve la base a partir del perfil.
 */

/** Columna de organización, solo cuando quien escribe la declara. */
const conOrg = (id?: string) => (id ? { organizacion_id: id } : {});

const aPesos = (centavos: number) => centavos / 100;
const aCentavos = (pesos: number) => Math.round(pesos * 100);

function fallo(descripcion: string, e: { message: string } | null): never {
  throw new ErrorDatos(`Falló ${descripcion}`, { causa: e?.message ?? "desconocido" });
}

/* ── Transferencias ─────────────────────────────────────────── */

interface FilaTransferencia {
  id: string;
  planilla_id: string;
  cliente_id: string;
  fila: number;
  fecha_deposito: string | null;
  banco: string | null;
  nombre_depositante: string | null;
  identificacion_original: string;
  identificacion_normalizada: string;
  tipo_identificacion: Operacion["tipoIdentificacion"];
  importe_centavos: number;
  numero_deposito: string | null;
  estado: Operacion["estado"];
  motivo: string;
  acreditacion_id: string | null;
  candidato_ids: string[];
  duplicado_de: number[];
  automatica: boolean;
  via_mapeo: boolean;
  acreditada_el: string | null;
  evaluada_en: string;
  intentos: number;
}

const CAMPOS_T =
  "id, planilla_id, cliente_id, fila, fecha_deposito, banco, nombre_depositante, " +
  "identificacion_original, identificacion_normalizada, tipo_identificacion, " +
  "importe_centavos, numero_deposito, estado, motivo, acreditacion_id, candidato_ids, " +
  "duplicado_de, automatica, via_mapeo, acreditada_el, evaluada_en, intentos";

const aOperacion = (f: FilaTransferencia): Operacion => ({
  id: f.id,
  planillaId: f.planilla_id,
  clienteId: f.cliente_id,
  fila: f.fila,
  fechaDeposito: f.fecha_deposito ?? "",
  banco: f.banco,
  nombreDepositante: f.nombre_depositante,
  identificacionOriginal: f.identificacion_original,
  identificacionNormalizada: f.identificacion_normalizada,
  tipoIdentificacion: f.tipo_identificacion,
  importe: aPesos(f.importe_centavos),
  numeroDeposito: f.numero_deposito,
  estado: f.estado,
  motivo: f.motivo,
  acreditacionId: f.acreditacion_id,
  candidatoIds: f.candidato_ids ?? [],
  duplicadoDe: f.duplicado_de ?? [],
  automatico: f.automatica,
  viaMapeo: f.via_mapeo,
  fechaAcreditacion: f.acreditada_el,
  evaluadaEn: f.evaluada_en,
  intentos: f.intentos,
});

export function repositorioTransferencias(sb: SupabaseClient, organizacionId?: string): RepositorioTransferencias {
  return {
    async listar(filtro: FiltroTransferencias = {}) {
      let q = sb.from("transferencias").select(CAMPOS_T);
      if (filtro.planillaId) q = q.eq("planilla_id", filtro.planillaId);
      if (filtro.clienteId) q = q.eq("cliente_id", filtro.clienteId);
      if (filtro.soloAbiertas) {
        // El predicado vive en la base como función inmutable, así que el
        // índice parcial de la cola de trabajo se puede usar.
        q = q.not("estado", "in",
          "(ACREDITADA_EXACTA_CUIT,ACREDITADA_EXACTA_DNI,ACREDITADA_MANUAL,DESCARTADA_DUPLICADO)");
      }
      const { data, error } = await q;
      if (error) fallo("la consulta de transferencias", error);
      return (data as unknown as FilaTransferencia[]).map(aOperacion);
    },

    async obtener(id) {
      const { data, error } = await sb
        .from("transferencias").select(CAMPOS_T).eq("id", id).maybeSingle();
      if (error) fallo("la consulta de la transferencia", error);
      return data ? aOperacion(data as unknown as FilaTransferencia) : null;
    },

    async crearLote(planillaId, filas) {
      if (filas.length === 0) return [];
      const { data: planilla, error: e1 } = await sb
        .from("planillas").select("id, cliente_id").eq("id", planillaId).maybeSingle();
      if (e1) fallo("la consulta de la planilla", e1);
      if (!planilla) throw new ErrorNoEncontrado(`No existe la planilla ${planillaId}`);

      const { data, error } = await sb
        .from("transferencias")
        .insert(filas.map((f) => ({
          ...conOrg(organizacionId),
          planilla_id: planillaId,
          cliente_id: (planilla as { cliente_id: string }).cliente_id,
          fila: f.fila,
          fecha_deposito: f.fechaDeposito || null,
          banco: f.banco,
          nombre_depositante: f.nombreDepositante,
          identificacion_original: f.identificacionOriginal,
          identificacion_normalizada: f.identificacionNormalizada,
          tipo_identificacion: f.tipoIdentificacion,
          importe_centavos: aCentavos(f.importe),
          numero_deposito: f.numeroDeposito,
        })))
        .select(CAMPOS_T);
      if (error) fallo("el alta de transferencias", error);
      return (data as unknown as FilaTransferencia[]).map(aOperacion);
    },

    async guardarResultados(operaciones) {
      if (operaciones.length === 0) return;

      // Se lee la organización de las filas que se van a tocar, en lugar
      // de deducirla. Dos motivos: el `upsert` de PostgREST es un INSERT
      // con ON CONFLICT, así que necesita la columna aunque nunca inserte;
      // y consultar primero **acota la escritura a lo que quien llama
      // puede leer**, que es la garantía que da la seguridad por fila.
      // La consulta va en lotes: PostgREST pone el filtro `in` en la
      // cadena de la URL, y quinientos identificadores no entran. El
      // síntoma es un «fetch failed» que no dice nada.
      const ids = operaciones.map((o) => o.id);
      const orgDe = new Map<string, string>();
      for (let i = 0; i < ids.length; i += 100) {
        const { data, error } = await sb
          .from("transferencias").select("id, organizacion_id").in("id", ids.slice(i, i + 100));
        if (error) fallo("la consulta previa al guardado", error);
        for (const f of data as unknown as { id: string; organizacion_id: string }[]) {
          orgDe.set(f.id, f.organizacion_id);
        }
      }

      const filas = operaciones
        .filter((o) => orgDe.has(o.id))
        .map((o) => ({
          id: o.id,
          organizacion_id: orgDe.get(o.id)!,
          planilla_id: o.planillaId,
          cliente_id: o.clienteId,
          fila: o.fila,
          fecha_deposito: o.fechaDeposito || null,
          banco: o.banco,
          nombre_depositante: o.nombreDepositante,
          identificacion_original: o.identificacionOriginal,
          identificacion_normalizada: o.identificacionNormalizada,
          tipo_identificacion: o.tipoIdentificacion,
          importe_centavos: aCentavos(o.importe),
          numero_deposito: o.numeroDeposito,
          estado: o.estado,
          motivo: o.motivo,
          acreditacion_id: o.acreditacionId,
          candidato_ids: o.candidatoIds,
          duplicado_de: o.duplicadoDe,
          automatica: o.automatico,
          via_mapeo: o.viaMapeo,
          acreditada_el: o.fechaAcreditacion,
          evaluada_en: o.evaluadaEn,
          intentos: o.intentos,
        }));
      if (filas.length === 0) return;

      // En lotes: una corrida puede tocar cientos de filas y un cuerpo de
      // varios megabytes es la forma más simple de que la petición falle
      // por razones que no tienen nada que ver con los datos.
      for (let i = 0; i < filas.length; i += 200) {
        const { error } = await sb
          .from("transferencias").upsert(filas.slice(i, i + 200), { onConflict: "id" });
        if (error) fallo("el guardado de los resultados de la conciliación", error);
      }
    },
  };
}

/* ── Informes ───────────────────────────────────────────────── */

interface FilaInforme {
  id: string; archivo: string; desde: string; hasta: string;
  origen: Informe["origen"]; descargado_en: string; acreditaciones: number;
  sha256: string | null; storage_path: string | null;
}

const CAMPOS_I = "id, archivo, desde, hasta, origen, descargado_en, acreditaciones, sha256, storage_path";

const aInforme = (f: FilaInforme): Informe => ({
  id: f.id,
  archivo: f.archivo,
  desde: f.desde,
  hasta: f.hasta,
  origen: f.origen,
  importadoEn: f.descargado_en,
  acreditaciones: f.acreditaciones,
  sha256: f.sha256,
  storagePath: f.storage_path,
});

export function repositorioInformes(sb: SupabaseClient, organizacionId?: string): RepositorioInformes {
  return {
    async listar() {
      const { data, error } = await sb
        .from("informes_fullcarga").select(CAMPOS_I).order("descargado_en", { ascending: false });
      if (error) fallo("la consulta de informes", error);
      return (data as unknown as FilaInforme[]).map(aInforme);
    },

    async registrar(datos) {
      if (!esFechaCalendario(datos.desde) || !esFechaCalendario(datos.hasta)) {
        throw new ErrorValidacion("El rango del informe no es válido", "desde");
      }
      if (datos.hasta < datos.desde) {
        throw new ErrorValidacion("El rango termina antes de empezar", "hasta");
      }
      const { data, error } = await sb
        .from("informes_fullcarga")
        .insert({
          ...conOrg(organizacionId),
          archivo: datos.archivo,
          desde: datos.desde,
          hasta: datos.hasta,
          origen: datos.origen,
          sha256: datos.sha256 ?? null,
          storage_path: datos.storagePath ?? null,
        })
        .select(CAMPOS_I)
        .single();
      if (error) fallo("el registro del informe", error);
      return aInforme(data as unknown as FilaInforme);
    },
  };
}

/* ── Acreditaciones ─────────────────────────────────────────── */

interface FilaAcreditacion {
  id: string; informe_id: string; cuit: string; fecha_ingreso: string;
  importe_centavos: number; banco: string | null; descripcion: string | null;
  fila_origen: number;
}

const CAMPOS_A =
  "id, informe_id, cuit, fecha_ingreso, importe_centavos, banco, descripcion, fila_origen";

const aAcreditacion = (f: FilaAcreditacion): AcreditacionGuardada => ({
  id: f.id,
  informeId: f.informe_id,
  cuit: f.cuit,
  fecha: f.fecha_ingreso,
  importe: aPesos(f.importe_centavos),
  banco: f.banco,
  descripcion: f.descripcion,
  row: f.fila_origen,
});

export function repositorioAcreditaciones(sb: SupabaseClient, organizacionId?: string): RepositorioAcreditaciones {
  return {
    async listar() {
      const { data, error } = await sb.from("acreditaciones").select(CAMPOS_A);
      if (error) fallo("la consulta de acreditaciones", error);
      return (data as unknown as FilaAcreditacion[]).map(aAcreditacion);
    },

    async incorporar(informeId, filas) {
      if (filas.length === 0) return { nuevas: 0 };

      // Los informes se superponen por diseño: el de un día sigue
      // creciendo mientras el día está abierto, así que el mismo registro
      // llega varias veces. Se consulta el pozo y se descartan los que ya
      // están, por huella natural. La huella **no** es la identidad: dos
      // personas pueden transferir lo mismo el mismo día y eso son dos
      // acreditaciones reales. Sirve solo para no recargar lo ya cargado.
      const { data: existentes, error: e1 } = await sb
        .from("acreditaciones").select("cuit, fecha_ingreso, importe_centavos, descripcion");
      if (e1) fallo("la consulta del pozo de acreditaciones", e1);

      const conocidas = new Set(
        (existentes as unknown as { cuit: string; fecha_ingreso: string; importe_centavos: number; descripcion: string | null }[])
          .map((a) => `${a.cuit}|${a.fecha_ingreso}|${a.importe_centavos}|${a.descripcion ?? ""}`),
      );

      const aInsertar: Record<string, unknown>[] = [];
      for (const f of filas) {
        const centavos = aCentavos(f.importe);
        const huella = `${f.cuit}|${f.fecha}|${centavos}|${f.descripcion ?? ""}`;
        if (conocidas.has(huella)) continue;
        conocidas.add(huella);
        aInsertar.push({
          ...conOrg(organizacionId),
          informe_id: informeId,
          fila_origen: f.row,
          cuit: f.cuit,
          fecha_ingreso: f.fecha,
          importe_centavos: centavos,
          banco: f.banco,
          descripcion: f.descripcion,
        });
      }

      if (aInsertar.length > 0) {
        const { error } = await sb.from("acreditaciones").insert(aInsertar);
        if (error) fallo("la incorporación de acreditaciones", error);
      }
      const { error: e2 } = await sb
        .from("informes_fullcarga")
        .update({ acreditaciones: aInsertar.length })
        .eq("id", informeId);
      if (e2) fallo("la actualización del informe", e2);

      return { nuevas: aInsertar.length };
    },
  };
}

/* ── Conciliación ───────────────────────────────────────────── */

interface FilaResolucion {
  id: string; transferencia_id: string; decision: Resolucion["decision"];
  origen: Resolucion["origen"]; acreditacion_id: string | null; motivo: string | null;
  estado_previo: Resolucion["estadoPrevio"];
  mapeo_id: string | null; actor: string; decidido_en: string;
}

const aResolucion = (f: FilaResolucion): Resolucion => ({
  id: f.id,
  operacionId: f.transferencia_id,
  decision: f.decision,
  origen: f.origen,
  acreditacionId: f.acreditacion_id,
  estadoPrevio: f.estado_previo,
  actor: f.actor,
  momento: f.decidido_en,
  motivo: f.motivo,
  mapeoId: f.mapeo_id,
});

interface FilaMapeo {
  id: string; cliente_id: string; identificacion: string; cuit: string;
  confirmado_por: string; confirmado_en: string; usos: number;
}

const aMapeo = (f: FilaMapeo): MapeoIdentidad => ({
  id: f.id,
  clienteId: f.cliente_id,
  identificacion: f.identificacion,
  cuit: f.cuit,
  actor: f.confirmado_por,
  momento: f.confirmado_en,
  origen: "RESOLUCION",
  usos: f.usos,
});

interface FilaCorrida {
  id: string; disparador: Corrida["disparador"]; corrida_en: string;
  evaluadas: number; nuevas_acreditadas: number; por_mapeo: number;
  pendientes_al_cierre: number; duracion_ms: number | null;
}

const aCorrida = (f: FilaCorrida): Corrida => ({
  id: f.id,
  momento: f.corrida_en,
  disparador: f.disparador,
  operacionesEvaluadas: f.evaluadas,
  nuevasAcreditadas: f.nuevas_acreditadas,
  porMapeo: f.por_mapeo,
  pendientesAlCierre: f.pendientes_al_cierre,
  duracionMs: f.duracion_ms ?? undefined,
});

interface FilaEvento {
  id: number; transferencia_id: string; ocurrido_en: string;
  estado_previo: Evento["de"]; estado_nuevo: Evento["a"]; motivo: string;
  origen: Evento["origen"]; actor: string | null;
}

const aEvento = (f: FilaEvento): Evento => ({
  id: String(f.id),
  operacionId: f.transferencia_id,
  momento: f.ocurrido_en,
  de: f.estado_previo,
  a: f.estado_nuevo,
  motivo: f.motivo,
  actor: f.actor ?? "sistema",
  origen: f.origen,
});

export function repositorioConciliacion(sb: SupabaseClient, organizacionId?: string): RepositorioConciliacion {
  return {
    async resoluciones() {
      const { data, error } = await sb
        .from("resoluciones")
        .select("id, transferencia_id, decision, origen, acreditacion_id, estado_previo, motivo, mapeo_id, actor, decidido_en")
        .order("decidido_en");
      if (error) fallo("la consulta de resoluciones", error);
      return (data as unknown as FilaResolucion[]).map(aResolucion);
    },

    async registrarResolucion(r) {
      const { data, error } = await sb
        .from("resoluciones")
        .insert({
          ...conOrg(organizacionId),
          transferencia_id: r.operacionId,
          decision: r.decision,
          origen: r.origen,
          acreditacion_id: r.acreditacionId,
          // El estado previo se guarda para poder auditar la decisión sin
          // tener que reconstruir la historia entera.
          estado_previo: r.estadoPrevio,
          motivo: r.motivo,
          mapeo_id: r.mapeoId,
          // `actor` lo verifica la política contra auth.uid(): poder
          // anotar a otro como autor de una decisión sobre plata sería un
          // problema de auditoría, no una comodidad.
          actor: r.actor,
        })
        .select("id, transferencia_id, decision, origen, acreditacion_id, estado_previo, motivo, mapeo_id, actor, decidido_en")
        .single();
      if (error) fallo("el registro de la resolución", error);
      return aResolucion(data as unknown as FilaResolucion);
    },

    async mapeos() {
      const { data, error } = await sb
        .from("mapeos_identidad")
        .select("id, cliente_id, identificacion, cuit, confirmado_por, confirmado_en, usos")
        .order("confirmado_en", { ascending: false });
      if (error) fallo("la consulta de identidades confirmadas", error);
      return (data as unknown as FilaMapeo[]).map(aMapeo);
    },

    async registrarMapeo(m) {
      // Una identidad ya confirmada no se pisa en silencio: se devuelve la
      // que está. Cambiar a qué CUIT apunta un depositante es una decisión
      // distinta y tiene que ser explícita.
      const { data: existente } = await sb
        .from("mapeos_identidad")
        .select("id, cliente_id, identificacion, cuit, confirmado_por, confirmado_en, usos")
        .eq("cliente_id", m.clienteId)
        .eq("identificacion", m.identificacion)
        .maybeSingle();
      if (existente) return aMapeo(existente as FilaMapeo);

      const { data, error } = await sb
        .from("mapeos_identidad")
        .insert({
          ...conOrg(organizacionId),
          cliente_id: m.clienteId,
          identificacion: m.identificacion,
          cuit: m.cuit,
          confirmado_por: m.actor,
        })
        .select("id, cliente_id, identificacion, cuit, confirmado_por, confirmado_en, usos")
        .single();
      if (error) fallo("el registro de la identidad confirmada", error);
      return aMapeo(data as unknown as FilaMapeo);
    },

    async actualizarUsosDeMapeo(usos) {
      for (const [id, n] of usos) {
        const { error } = await sb.from("mapeos_identidad").update({ usos: n }).eq("id", id);
        if (error) fallo("la actualización de usos de una identidad", error);
      }
    },

    async corridas(limite = 20) {
      const { data, error } = await sb
        .from("conciliacion_corridas")
        .select("id, disparador, corrida_en, evaluadas, nuevas_acreditadas, por_mapeo, pendientes_al_cierre, duracion_ms")
        .order("corrida_en", { ascending: false })
        .limit(limite);
      if (error) fallo("la consulta de corridas", error);
      return (data as unknown as FilaCorrida[]).map(aCorrida);
    },

    async registrarCorrida(c) {
      const { data, error } = await sb
        .from("conciliacion_corridas")
        .insert({
          ...conOrg(organizacionId),
          disparador: c.disparador,
          evaluadas: c.operacionesEvaluadas,
          nuevas_acreditadas: c.nuevasAcreditadas,
          por_mapeo: c.porMapeo,
          pendientes_al_cierre: c.pendientesAlCierre,
          duracion_ms: c.duracionMs ?? null,
        })
        .select("id, disparador, corrida_en, evaluadas, nuevas_acreditadas, por_mapeo, pendientes_al_cierre, duracion_ms")
        .single();
      if (error) fallo("el registro de la corrida", error);
      return aCorrida(data as unknown as FilaCorrida);
    },

    async eventos(transferenciaId) {
      const { data, error } = await sb
        .from("transferencia_eventos")
        .select("id, transferencia_id, ocurrido_en, estado_previo, estado_nuevo, motivo, origen, actor")
        .eq("transferencia_id", transferenciaId)
        .order("ocurrido_en", { ascending: false });
      if (error) fallo("la consulta del historial", error);
      return (data as unknown as FilaEvento[]).map(aEvento);
    },

    async eventosDelDia(fecha) {
      const { data, error } = await sb
        .from("transferencia_eventos")
        .select("id, transferencia_id, ocurrido_en, estado_previo, estado_nuevo, motivo, origen, actor")
        .gte("ocurrido_en", `${fecha}T00:00:00`)
        .lt("ocurrido_en", `${fecha}T23:59:59.999`);
      if (error) fallo("la consulta de eventos del día", error);
      return (data as unknown as FilaEvento[]).map(aEvento);
    },

    async registrarEventos(nuevos) {
      if (nuevos.length === 0) return;
      const { error } = await sb.from("transferencia_eventos").insert(
        nuevos.map((e) => ({
          ...conOrg(organizacionId),
          transferencia_id: e.operacionId,
          estado_previo: e.de,
          estado_nuevo: e.a,
          motivo: e.motivo,
          origen: e.origen,
          actor: e.actor === "sistema" ? null : e.actor,
        })),
      );
      if (error) fallo("el registro del historial", error);
    },
  };
}
