import { digitoVerificador } from "../fullcarga/cuit";
import { hoyISO } from "../format";
import { sumarDias } from "../operaciones/fechas";
import { reevaluar } from "../operaciones/motor";
import type {
  AcreditacionGuardada, Cliente, Corrida, Evento, Informe, MapeoIdentidad,
  Operacion, Planilla, Resolucion,
} from "../operaciones/tipos";

/**
 * Dataset de demostración del módulo operativo.
 *
 * Todo es **sintético**. Ni un nombre, ni un CUIT, ni un importe sale de un
 * archivo real de cliente: los CUIT se construyen con el algoritmo de la
 * AFIP a partir de documentos inventados, y los nombres son combinaciones
 * armadas acá.
 *
 * Lo que sí es real es **la forma de los datos**, y de ahí sale su valor:
 *
 *   · la escala —497 operaciones, cerca de las 300–600 diarias de NORD—;
 *   · la mezcla de identificación —cerca de la mitad llega con DNI y no con
 *     CUIT, que es lo que se midió en el archivo real—;
 *   · la distribución de atrasos, con pendientes de un día y de dos meses;
 *   · las excepciones, que son las que de verdad ejercitan el producto.
 *
 * **Los estados no se escriben a mano.** Se generan las operaciones y las
 * acreditaciones, se corre el matcher de verdad y el resultado es el que se
 * guarda. Si el matcher cambia, la demostración cambia con él: no puede
 * quedar mostrando un número que el motor ya no produce.
 */

/* ── Azar reproducible ──────────────────────────────────────── */

/** Generador determinista: la demostración tiene que ser siempre la misma. */
function azar(semilla: number) {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── Nombres inventados ─────────────────────────────────────── */

const NOMBRES = [
  "Martín", "Sofía", "Lucas", "Valentina", "Mateo", "Camila", "Joaquín", "Julieta",
  "Tomás", "Delfina", "Bruno", "Renata", "Ignacio", "Micaela", "Facundo", "Pilar",
  "Santiago", "Agustina", "Nicolás", "Florencia", "Emilia", "Gonzalo", "Rocío", "Damián",
];
const APELLIDOS = [
  "Ferreyra", "Quiroga", "Bustamante", "Alsina", "Zampini", "Zabala", "Ocampo", "Iturbe",
  "Bengoechea", "Mansilla", "Urquiza", "Peralta", "Villalba", "Sarmiento", "Cabral",
  "Echeverría", "Godoy", "Larrea", "Miranda", "Oyarzún", "Pizarro", "Salvatierra",
];

const BANCOS = [
  "BANCO GALICIA", "BANCO SANTANDER", "BANCO NACION", "BANCO MACRO",
  "BBVA ARGENTINA", "BANCO CIUDAD", "MERCADO PAGO", "BANCO PROVINCIA",
];

/** Importes que se repiten, como en el archivo real: cuotas y paquetes. */
const IMPORTES = [153_500, 185_000, 245_000, 320_000, 499_000, 799_000, 1_250_000];

/* ── CUIT sintéticos ────────────────────────────────────────── */

/** Prefijos de persona física. Los de empresa no llevan DNI adentro. */
const PREFIJOS_FISICA = ["20", "23", "24", "27"];

/** Arma un CUIT válido a partir de un documento. Nunca al revés. */
function cuitDesde(prefijo: string, documento: string): string {
  const diez = prefijo + documento.padStart(8, "0");
  return diez + String(digitoVerificador(diez));
}

/* ── Clientes ───────────────────────────────────────────────── */

const CLIENTES: Cliente[] = [
  { id: "cl01", nombre: "Padel Pro Norte", alias: "PADEL-N" },
  { id: "cl02", nombre: "Gimnasio Lomas", alias: "GYM-LOM" },
  { id: "cl03", nombre: "Academia Sur", alias: "ACAD-S" },
  { id: "cl04", nombre: "Club del Río", alias: "CLUB-R" },
  { id: "cl05", nombre: "Centro Deportivo Este", alias: "CDE" },
];

/**
 * Qué le tiene que pasar a cada operación.
 *
 * Se declara la intención y después se fabrican las acreditaciones que la
 * producen. El estado final lo decide el matcher, no esta tabla: si algo no
 * coincide, el número de la demostración cambia y se nota.
 */
type Intencion =
  | "AUTO_CUIT"
  | "AUTO_DNI"
  | "PENDIENTE"
  | "AMBIGUO"
  | "PARECIDO"
  | "IDENTIDAD"
  | "DUPLICADO"
  | "ERROR_CUIT"
  | "ERROR_ID"
  | "SIN_DATOS";

/** La mezcla de la demostración. Produce 497 operaciones. */
const MEZCLA: [Intencion, number][] = [
  ["AUTO_CUIT", 258],
  ["AUTO_DNI", 197],
  ["PENDIENTE", 24],
  ["AMBIGUO", 3],
  ["PARECIDO", 3],
  ["IDENTIDAD", 3],
  // Una sola intención, pero produce dos operaciones: el par duplicado.
  ["DUPLICADO", 1],
  ["ERROR_CUIT", 3],
  ["ERROR_ID", 3],
  ["SIN_DATOS", 1],
];

export interface DatosIniciales {
  clientes: Cliente[];
  planillas: Planilla[];
  operaciones: Operacion[];
  informes: Informe[];
  acreditaciones: AcreditacionGuardada[];
  resoluciones: Resolucion[];
  mapeos: MapeoIdentidad[];
  eventos: Evento[];
  corridas: Corrida[];
}

export function generarOperaciones(hoy = hoyISO()): DatosIniciales {
  const rnd = azar(20260910);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];

  /* ── Planillas ────────────────────────────────────────────── */
  // Repartidas en las últimas seis semanas, con más peso en lo reciente.
  const planillas: Planilla[] = [];
  const DIAS_PLANILLA = [1, 2, 3, 5, 6, 8, 11, 15, 22, 31, 44];
  DIAS_PLANILLA.forEach((atraso, i) => {
    const cliente = CLIENTES[i % CLIENTES.length];
    const fecha = sumarDias(hoy, -atraso);
    planillas.push({
      id: `pl${String(i + 1).padStart(3, "0")}`,
      clienteId: cliente.id,
      archivo: `Transferencias ${cliente.alias} ${fecha}.xlsx`,
      fecha,
      importadaEn: `${fecha}T09:${String(10 + i * 3).padStart(2, "0")}:00`,
      estado: "ENVIADA",
    });
  });

  /* ── Cola de intenciones, barajada de forma determinista ──── */
  const cola: Intencion[] = [];
  for (const [intencion, n] of MEZCLA) for (let i = 0; i < n; i++) cola.push(intencion);
  for (let i = cola.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [cola[i], cola[j]] = [cola[j], cola[i]];
  }

  /* ── Operaciones y las acreditaciones que las explican ────── */
  const operaciones: Operacion[] = [];
  const acreditaciones: AcreditacionGuardada[] = [];
  const documentosUsados = new Set<string>();

  /** Documento de ocho dígitos, único en todo el dataset. */
  const documento = (): string => {
    for (;;) {
      const d = String(20_000_000 + Math.floor(rnd() * 25_000_000));
      if (!documentosUsados.has(d)) {
        documentosUsados.add(d);
        return d;
      }
    }
  };

  const informeId = "inf00001";
  let filaInforme = 1;
  const acreditar = (cuit: string, fecha: string, importe: number, banco: string) => {
    const a: AcreditacionGuardada = {
      id: `${informeId}|${filaInforme}`,
      informeId,
      cuit,
      fecha,
      importe,
      banco,
      descripcion: `Transf Recibida De ${cuit}`,
      row: filaInforme,
    };
    filaInforme += 1;
    acreditaciones.push(a);
    return a;
  };

  const AHORA = `${hoy}T08:00:00`;
  let n = 0;

  for (const intencion of cola) {
    n += 1;
    const planilla = planillas[Math.floor(rnd() * planillas.length)];
    // La fecha del depósito nunca es posterior a la de la planilla.
    const fecha = sumarDias(planilla.fecha, -Math.floor(rnd() * 4));
    const importe = pick(IMPORTES);
    const banco = pick(BANCOS);
    const nombre = `${pick(NOMBRES)} ${pick(APELLIDOS)}`;
    const doc = documento();
    const cuit = cuitDesde(pick(PREFIJOS_FISICA), doc);

    const base = {
      id: `op${String(n).padStart(5, "0")}`,
      planillaId: planilla.id,
      clienteId: planilla.clienteId,
      fila: 0,
      fechaDeposito: fecha,
      banco,
      nombreDepositante: nombre,
      importe,
      numeroDeposito: String(4_000_000 + Math.floor(rnd() * 900_000)),
      estado: "PENDIENTE_NO_ENCONTRADA_EN_RANGO" as const,
      motivo: "Sin evaluar",
      acreditacionId: null,
      candidatoIds: [],
      duplicadoDe: [],
      automatico: false,
      viaMapeo: false,
      fechaAcreditacion: null,
      evaluadaEn: AHORA,
      intentos: 0,
    };

    const empujar = (extra: Pick<Operacion,
      "identificacionOriginal" | "identificacionNormalizada" | "tipoIdentificacion"> &
      Partial<Operacion>) => {
      operaciones.push({ ...base, ...extra });
    };

    switch (intencion) {
      case "AUTO_CUIT": {
        acreditar(cuit, fecha, importe, banco);
        empujar({
          identificacionOriginal: `${cuit.slice(0, 2)}-${cuit.slice(2, 10)}-${cuit.slice(10)}`,
          identificacionNormalizada: cuit,
          tipoIdentificacion: "CUIT_VALIDO",
        });
        break;
      }

      case "AUTO_DNI": {
        // El cliente informa el DNI; Fullcarga devuelve el CUIT real que lo
        // contiene. Es la regla que NORD confirmó.
        acreditar(cuit, fecha, importe, banco);
        empujar({
          identificacionOriginal: doc,
          identificacionNormalizada: doc,
          tipoIdentificacion: "DNI_PROBABLE",
        });
        break;
      }

      case "PENDIENTE": {
        // Sin acreditación: todavía no llegó. Es problema desde el día cero.
        // El sorteo se hace **una sola vez**: con tres llamadas separadas al
        // azar salían filas incoherentes —tipo CUIT con ocho dígitos— que
        // ningún archivo real produce.
        const conCuit = rnd() < 0.5;
        empujar({
          identificacionOriginal: conCuit ? cuit : doc,
          identificacionNormalizada: conCuit ? cuit : doc,
          tipoIdentificacion: conCuit ? "CUIT_VALIDO" : "DNI_PROBABLE",
        });
        break;
      }

      case "AMBIGUO": {
        // Dos acreditaciones idénticas: el sistema no elige ninguna.
        acreditar(cuit, fecha, importe, banco);
        acreditar(cuit, fecha, importe, pick(BANCOS));
        empujar({
          identificacionOriginal: cuit,
          identificacionNormalizada: cuit,
          tipoIdentificacion: "CUIT_VALIDO",
        });
        break;
      }

      case "PARECIDO": {
        // Un dígito cambiado en el CUIT que informó Fullcarga: error de
        // tipeo típico. Se sugiere, no se acredita.
        const alterado =
          cuit.slice(0, 5) + String((Number(cuit[5]) + 1) % 10) + cuit.slice(6);
        acreditar(alterado, fecha, importe, banco);
        empujar({
          identificacionOriginal: cuit,
          identificacionNormalizada: cuit,
          tipoIdentificacion: "CUIT_VALIDO",
        });
        break;
      }

      case "IDENTIDAD": {
        // El documento aparece en un CUIT real, pero con otro importe.
        acreditar(cuit, fecha, importe + 1_000, banco);
        empujar({
          identificacionOriginal: doc,
          identificacionNormalizada: doc,
          tipoIdentificacion: "DNI_PROBABLE",
        });
        break;
      }

      case "DUPLICADO": {
        // Dos filas iguales en la misma planilla contra una sola
        // acreditación. Ninguna se descarta: las mira una persona.
        acreditar(cuit, fecha, importe, banco);
        for (const sufijo of ["a", "b"]) {
          operaciones.push({
            ...base,
            id: `${base.id}${sufijo}`,
            identificacionOriginal: cuit,
            identificacionNormalizada: cuit,
            tipoIdentificacion: "CUIT_VALIDO",
          });
        }
        break;
      }

      case "ERROR_CUIT": {
        // Once dígitos con el verificador mal: no se corrige, se avisa.
        const malo = cuit.slice(0, 10) + String((Number(cuit[10]) + 1) % 10);
        empujar({
          identificacionOriginal: malo,
          identificacionNormalizada: malo,
          tipoIdentificacion: "IDENTIFICACION_INVALIDA",
        });
        break;
      }

      case "ERROR_ID": {
        const corto = doc.slice(0, 5);
        empujar({
          identificacionOriginal: corto,
          identificacionNormalizada: corto,
          tipoIdentificacion: "IDENTIFICACION_INVALIDA",
        });
        break;
      }

      case "SIN_DATOS": {
        empujar({
          identificacionOriginal: cuit,
          identificacionNormalizada: cuit,
          tipoIdentificacion: "CUIT_VALIDO",
          importe: 0,
        });
        break;
      }
    }
  }

  // Numeración de fila dentro de cada planilla, como la vería el cliente.
  const contadores = new Map<string, number>();
  for (const op of operaciones) {
    const n2 = (contadores.get(op.planillaId) ?? 1) + 1;
    contadores.set(op.planillaId, n2);
    op.fila = n2;
  }

  /* ── Informe ──────────────────────────────────────────────── */
  const fechas = acreditaciones.map((a) => a.fecha).sort();
  const informes: Informe[] = [{
    id: informeId,
    archivo: `informe-ingresos-creditos-${fechas[0]}_${fechas[fechas.length - 1]}.xls`,
    desde: fechas[0],
    hasta: fechas[fechas.length - 1],
    origen: "AUTOMATICO",
    importadoEn: `${hoy}T07:55:00`,
    acreditaciones: acreditaciones.length,
  }];

  /* ── Se corre el matcher de verdad ────────────────────────── */
  const salida = reevaluar({
    operaciones,
    acreditaciones,
    mapeos: [],
    resoluciones: [],
    momento: AHORA,
    disparador: "IMPORTACION_INFORME",
  });

  // Los eventos de la siembra se fechan cuando **realmente** habrían
  // ocurrido, no en el momento de generar el dataset. Si no, la métrica de
  // flujo diría que hoy acreditaron 455 operaciones y que la cola drenó
  // 455 posiciones, que es falso y además esconde el movimiento real del
  // día. Una demostración que miente en su propia métrica no sirve.
  const porOperacion = new Map(salida.operaciones.map((o) => [o.id, o]));
  const eventos: Evento[] = salida.eventos.map((e, i) => {
    const op = porOperacion.get(e.operacionId);
    const dia = op?.fechaAcreditacion ?? op?.fechaDeposito ?? hoy;
    return { ...e, id: `ev${String(i + 1).padStart(5, "0")}`, momento: `${dia}T08:00:00` };
  });

  return {
    clientes: CLIENTES,
    planillas: planillas.map((p) => ({ ...p, estado: estadoDePlanilla(p.id, salida.operaciones) })),
    operaciones: salida.operaciones,
    informes,
    acreditaciones,
    resoluciones: [],
    mapeos: [],
    eventos,
    corridas: [{ ...salida.corrida, id: "co00001" }],
  };
}

/**
 * Estado de una planilla, derivado de sus operaciones.
 *
 * Seis estados y ni uno más. Cada estado visual extra es una celda que
 * alguien tiene que aprender a interpretar.
 */
export function estadoDePlanilla(
  planillaId: string,
  operaciones: readonly Operacion[],
): Planilla["estado"] {
  const propias = operaciones.filter((o) => o.planillaId === planillaId);
  if (propias.length === 0) return "RECIBIDA";

  const acreditadas = propias.filter(
    (o) => o.estado === "ACREDITADA_EXACTA_CUIT" ||
      o.estado === "ACREDITADA_EXACTA_DNI" ||
      o.estado === "ACREDITADA_MANUAL",
  ).length;
  const conError = propias.some(
    (o) => o.estado === "ERROR_CUIT" || o.estado === "ERROR_IDENTIFICACION" ||
      o.estado === "COMPROBANTE_INVALIDO" || o.estado === "DATOS_INVALIDOS",
  );

  if (acreditadas === propias.length) return "ACREDITADA";
  if (conError) return "CON_ERRORES";
  return "PENDIENTE";
}
