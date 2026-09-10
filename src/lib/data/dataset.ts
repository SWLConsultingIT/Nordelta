import type {
  Categoria, Contraparte, EntradaAuditoria, MedioPago, Moneda, Movimiento, Oficina, Partida,
} from "../domain/types";
import { hoyISO } from "../format";

/**
 * Dataset de demostración.
 *
 * Se genera con una semilla fija: la misma corrida produce siempre los mismos
 * datos, así una demo se puede repetir y el guion no queda librado al azar.
 *
 * Todas las contrapartes son ficticias. Ninguna corresponde a un cliente real
 * de Nordelta.
 *
 * Seis cuentas están construidas a mano para que el recorrido de la demo
 * tenga historias concretas que mostrar; el resto es relleno realista que le
 * da volumen y variedad a las pantallas.
 */

/* ── Generador determinístico ─────────────────────────────── */

class Aleatorio {
  private s: number;
  constructor(semilla: number) { this.s = semilla >>> 0; }
  /** Congruencial lineal: alcanza para datos de muestra y es reproducible. */
  private siguiente(): number {
    this.s = (this.s * 1664525 + 1013904223) >>> 0;
    return this.s / 0x100000000;
  }
  entre(min: number, max: number): number {
    return min + Math.floor(this.siguiente() * (max - min + 1));
  }
  uno<T>(xs: readonly T[]): T { return xs[this.entre(0, xs.length - 1)]; }
  /** Devuelve true con la probabilidad dada. */
  chance(p: number): boolean { return this.siguiente() < p; }
  /** Monto "redondo", como los cargan las personas. */
  monto(min: number, max: number, paso: number): number {
    return this.entre(Math.ceil(min / paso), Math.floor(max / paso)) * paso;
  }
}

/* ── Oficinas ─────────────────────────────────────────────── */

export const OFICINAS: Oficina[] = [
  { id: 1, nombre: "Nordelta" },
  { id: 2, nombre: "Corrientes" },
  { id: 3, nombre: "Puertos" },
  { id: 4, nombre: "Remeros" },
];

/* ── Contrapartes ─────────────────────────────────────────── */

/** Las seis de las historias del guion de demostración. */
export const PROTAGONISTAS = {
  activa: "Patagonia Comercial SA",
  cerrada: "Estudio Delta SRL",
  multiMoneda: "Grupo Horizonte SA",
  comision: "Logística del Sur SA",
  cheque: "Distribuidora Andina SRL",
  ajuste: "Servicios Costanera SRL",
} as const;

const NOMBRES: string[] = [
  PROTAGONISTAS.activa, PROTAGONISTAS.cerrada, PROTAGONISTAS.multiMoneda,
  PROTAGONISTAS.comision, PROTAGONISTAS.cheque, PROTAGONISTAS.ajuste,
  "Inversiones Río SA", "Mercado Central SA", "Astillero Paraná SRL",
  "Cerealera del Litoral SA", "Metalúrgica Vicente López SRL", "Textil Almagro SA",
  "Frigorífico Zárate SA", "Bodega Alto Valle SRL", "Molinos Chacabuco SA",
  "Transporte Tigre SRL", "Consultora Belgrano SA", "Inmobiliaria Retiro SRL",
  "Farmacéutica Quilmes SA", "Papelera Campana SRL", "Vidriería Avellaneda SA",
  "Curtiembre Lanús SRL", "Química San Isidro SA", "Electrónica Palermo SRL",
  "Maderera Escobar SA", "Plásticos Munro SRL", "Refrigeración Olivos SA",
  "Cooperativa El Talar SRL", "Automotores Pilar SA", "Neumáticos Boulogne SRL",
  "Seguros Recoleta SA", "Gráfica Barracas SRL", "Alimentos Berazategui SA",
  "Herrería Del Viso SRL", "Náutica Benavídez SA", "Gastos Oficina",
];

/* ── Constructores de partidas ────────────────────────────── */

let secuenciaPartida = 0;
const idPartida = () => `p${++secuenciaPartida}`;

function pata(
  medio: MedioPago, moneda: Moneda, monto: number,
  tc: number | null = null, comision: number | null = null,
): Partida {
  return {
    id: idPartida(), medio_pago: medio, moneda_nominal: moneda,
    monto_nominal: monto, tipo_cambio: tc, comision_pct: comision,
  };
}

const ef = (m: Moneda, n: number, tc: number | null = null) => pata("efectivo", m, n, tc);
const tr = (m: Moneda, n: number, tc: number | null = null, c: number | null = null) =>
  pata("transferencia", m, n, tc, c);
const pf = (n: number, tc: number | null = null) => pata("pago_facil", "ARS", n, tc);
const chq = (m: Moneda, n: number) => pata("cheque", m, n);

let secuenciaMov = 0;
function mov(
  fecha: string, oficinaId: number, contraparteId: number, concepto: string,
  categoria: Categoria, partidas: Partida[], orden: number,
): Movimiento {
  return {
    id: `m${++secuenciaMov}`, fecha, oficina_id: oficinaId,
    contraparte_id: contraparteId, concepto, categoria, orden, partidas,
  };
}

/* ── Vocabulario de conceptos ─────────────────────────────── */

const CONCEPTOS: Record<Categoria, string[]> = {
  ingreso: [
    "Depósito en efectivo", "Transferencia recibida", "Cobro de factura",
    "Anticipo de cliente", "Cobro pago fácil", "Liquidación de operación",
    "Ingreso por venta de divisa", "Reintegro",
  ],
  pago_proveedor: [
    "Pago a proveedor", "Pago parcial", "Liquidación de saldo",
    "Transferencia enviada", "Pago de honorarios", "Devolución de anticipo",
  ],
  full_pago: ["Liquidación total", "Cancelación de operación"],
  compra: ["Compra de divisa", "Compra de insumos", "Compra de equipamiento"],
  venta: ["Venta de divisa", "Venta de mercadería"],
  impuesto: ["Retención de ingresos brutos", "Impuesto al débito", "Percepción IVA"],
  ajuste_cierre: ["Cierre de cuenta corriente", "Ajuste de saldo"],
};

/** Tipo de cambio del día, con una deriva suave y realista. */
function tcDelDia(indiceDia: number, r: Aleatorio): number {
  return 1465 + indiceDia * 1.4 + r.entre(-4, 4);
}

/* ── Calendario ───────────────────────────────────────────── */

/** Días hábiles hacia atrás desde una fecha, en formato ISO. */
function diasHabiles(hasta: string, cantidad: number): string[] {
  const fin = new Date(hasta + "T12:00:00Z");
  const dias: string[] = [];
  const cursor = new Date(fin);
  while (dias.length < cantidad) {
    const dow = cursor.getUTCDay();
    if (dow !== 0 && dow !== 6) dias.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return dias.reverse();
}

/**
 * Última fecha del dataset financiero.
 *
 * Es **el último día hábil hasta hoy**, no una fecha fija. Antes estaba
 * clavada, y el resultado era que la portada decía «Hoy, 3 de septiembre»
 * mientras la conciliación mostraba el 10: dos fechas distintas en la
 * misma pantalla, que en una herramienta de dinero se lee como un error.
 *
 * Que sea el último día hábil y no el día calendario mantiene la
 * invariante del dataset —la última fecha generada siempre existe— también
 * cuando la demostración se abre un sábado.
 */
function ultimoDiaHabil(desde = hoyISO()): string {
  const d = new Date(desde + "T12:00:00Z");
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export const HOY_DEMO = ultimoDiaHabil();
const DIAS = diasHabiles(HOY_DEMO, 30);

/* ── Generación ───────────────────────────────────────────── */

export interface DatasetDemo {
  oficinas: Oficina[];
  contrapartes: Contraparte[];
  movimientos: Movimiento[];
  auditoria: EntradaAuditoria[];
}

export function generarDataset(): DatasetDemo {
  secuenciaMov = 0;
  secuenciaPartida = 0;
  const r = new Aleatorio(20260903);

  const contrapartes: Contraparte[] = NOMBRES.map((nombre, i) => ({
    id: i + 1, nombre, activo: true,
  }));
  const idDe = (nombre: string) => contrapartes.find((c) => c.nombre === nombre)!.id;

  const movimientos: Movimiento[] = [];
  const ordenPorDia = new Map<string, number>();
  const siguienteOrden = (fecha: string) => {
    const n = (ordenPorDia.get(fecha) ?? 0) + 1;
    ordenPorDia.set(fecha, n);
    return n;
  };

  const agregar = (
    fecha: string, oficina: number, contraparte: number, concepto: string,
    categoria: Categoria, partidas: Partida[],
  ) => {
    const m = mov(fecha, oficina, contraparte, concepto, categoria, partidas, siguienteOrden(fecha));
    movimientos.push(m);
    return m;
  };

  /* ── Historia 1 · cuenta activa con saldo en ARS y USD ── */
  {
    const id = idDe(PROTAGONISTAS.activa);
    agregar(DIAS[2], 1, id, "Anticipo de cliente", "ingreso", [ef("ARS", 3_200_000)]);
    agregar(DIAS[6], 1, id, "Transferencia recibida", "ingreso", [tr("USD", 12_000, null, 0.015)]);
    agregar(DIAS[11], 1, id, "Pago parcial", "pago_proveedor", [ef("ARS", -1_150_000)]);
    agregar(DIAS[17], 1, id, "Cobro de factura", "ingreso", [ef("ARS", 1_800_000)]);
    agregar(DIAS[22], 1, id, "Pago parcial", "pago_proveedor", [ef("USD", -3_500)]);
    agregar(DIAS[26], 1, id, "Depósito en efectivo", "ingreso", [ef("ARS", 950_000)]);
  }

  /* ── Historia 2 · cuenta que cerró y volvió a abrir ──────
     Las cuatro monedas tienen que dar exactamente cero para que la vista
     marque el cierre sola. */
  {
    const id = idDe(PROTAGONISTAS.cerrada);
    agregar(DIAS[1], 2, id, "Anticipo de cliente", "ingreso", [ef("ARS", 2_400_000), ef("USD", 5_000)]);
    agregar(DIAS[5], 2, id, "Pago parcial", "pago_proveedor", [ef("ARS", -900_000)]);
    agregar(DIAS[9], 2, id, "Pago parcial", "pago_proveedor", [ef("USD", -2_000)]);
    // Deja las cuatro en cero: -1.500.000 ARS y -3.000 USD.
    agregar(DIAS[13], 2, id, "Liquidación total", "full_pago",
      [ef("ARS", -1_500_000), ef("USD", -3_000)]);
    // Ciclo nuevo después del cierre.
    agregar(DIAS[19], 2, id, "Cobro de factura", "ingreso", [ef("ARS", 1_650_000)]);
    agregar(DIAS[24], 2, id, "Transferencia recibida", "ingreso", [tr("USD", 4_200, null, 0.02)]);
  }

  /* ── Historia 3 · multi-moneda ─────────────────────────── */
  {
    const id = idDe(PROTAGONISTAS.multiMoneda);
    agregar(DIAS[3], 3, id, "Cobro de factura", "ingreso", [ef("ARS", 5_400_000)]);
    agregar(DIAS[8], 3, id, "Transferencia recibida", "ingreso", [tr("USD", 9_800, null, 0.015)]);
    agregar(DIAS[14], 3, id, "Liquidación de operación", "ingreso", [ef("EUR", 6_500)]);
    agregar(DIAS[20], 3, id, "Pago a proveedor", "pago_proveedor", [ef("ARS", -1_900_000)]);
    agregar(DIAS[25], 3, id, "Transferencia enviada", "pago_proveedor", [tr("EUR", -1_200, null, 0.01)]);
    agregar(DIAS[27], 3, id, "Ingreso por venta de divisa", "ingreso", [ef("BRL", 18_000)]);
  }

  /* ── Historia 4 · transferencia con comisión y tipo de cambio ──
     Es la fila donde se ve claro monto nominal → TC → comisión → impacto. */
  {
    const id = idDe(PROTAGONISTAS.comision);
    const tc = tcDelDia(10, r);
    agregar(DIAS[10], 1, id, "Transferencia recibida", "ingreso",
      [tr("ARS", 7_425_000, tc, 0.02)]);
    agregar(DIAS[16], 1, id, "Cobro de factura", "ingreso", [ef("ARS", 2_100_000)]);
    // Operación mixta: efectivo sin conversión más transferencia convertida.
    // Es el caso que el sistema legacy perdía.
    agregar(DIAS[21], 1, id, "Liquidación de operación", "ingreso",
      [ef("ARS", 1_500_000), tr("ARS", 3_000_000, tcDelDia(21, r), 0.025)]);
    agregar(DIAS[28], 1, id, "Pago parcial", "pago_proveedor", [ef("USD", -4_000)]);
  }

  /* ── Historia 5 · cheques ──────────────────────────────── */
  {
    const id = idDe(PROTAGONISTAS.cheque);
    agregar(DIAS[4], 4, id, "Cheque 0042-1187", "ingreso", [chq("ARS", 2_750_000)]);
    agregar(DIAS[12], 4, id, "Cheque 0051-3320", "ingreso", [chq("ARS", 1_480_000)]);
    agregar(DIAS[18], 4, id, "Pago a proveedor", "pago_proveedor", [ef("ARS", -1_200_000)]);
    agregar(DIAS[23], 4, id, "Cheque 0058-7741", "ingreso", [chq("USD", 6_500)]);
  }

  /* ── Historia 6 · saldo chico, listo para ajustar a cero ──
     Queda con 47.350 ARS y 128,40 USD: montos que se entienden de un vistazo
     cuando el ajuste los lleva a cero durante la demo. */
  {
    const id = idDe(PROTAGONISTAS.ajuste);
    agregar(DIAS[7], 2, id, "Cobro de factura", "ingreso", [ef("ARS", 1_247_350), ef("USD", 3_128.4)]);
    agregar(DIAS[15], 2, id, "Pago parcial", "pago_proveedor", [ef("ARS", -1_200_000)]);
    agregar(DIAS[24], 2, id, "Pago parcial", "pago_proveedor", [ef("USD", -3_000)]);
  }

  /* ── Relleno realista ──────────────────────────────────── */

  const protagonistas = new Set(Object.values(PROTAGONISTAS) as string[]);
  const resto = contrapartes.filter(
    (c) => !protagonistas.has(c.nombre) && c.nombre !== "Gastos Oficina",
  );
  const gastosOficina = idDe("Gastos Oficina");

  const ultimoDia = DIAS.length - 1;

  DIAS.forEach((fecha, indiceDia) => {
    const tc = tcDelDia(indiceDia, r);
    const esHoy = indiceDia === ultimoDia;
    // El último día es el que se abre en la demostración: se le da un poco
    // más de volumen para que la pantalla de carga no arranque casi vacía.
    const cantidad = esHoy ? 14 : r.entre(6, 11);

    for (let i = 0; i < cantidad; i++) {
      // Nordelta concentra más. En el día de la demostración, las primeras
      // seis van a Nordelta para que la oficina por defecto tenga qué mostrar.
      const oficina = esHoy && i < 6 ? 1 : r.uno([1, 1, 1, 2, 2, 3, 3, 4]);
      const contraparte = r.uno(resto).id;
      const categoria = r.uno<Categoria>([
        "ingreso", "ingreso", "ingreso", "ingreso",
        "pago_proveedor", "pago_proveedor",
        "full_pago", "compra", "venta", "impuesto",
      ]);
      const concepto = r.uno(CONCEPTOS[categoria]);
      const signo = categoria === "pago_proveedor" ? -1 : 1;
      const partidas: Partida[] = [];

      // La mayoría en pesos o dólares; euros y reales aparecen lo suficiente
      // para que se vea que el producto es multi-moneda de verdad.
      const perfil = r.entre(1, 100);

      if (perfil <= 40) {
        partidas.push(ef("ARS", signo * r.monto(150_000, 4_500_000, 50_000)));
      } else if (perfil <= 58) {
        partidas.push(tr("ARS", signo * r.monto(500_000, 6_000_000, 50_000), tc, r.uno([0.01, 0.015, 0.02, 0.025])));
      } else if (perfil <= 70) {
        partidas.push(ef("USD", signo * r.monto(800, 15_000, 100)));
      } else if (perfil <= 78) {
        partidas.push(tr("USD", signo * r.monto(1_000, 12_000, 500), null, r.uno([0.01, 0.015, 0.02])));
      } else if (perfil <= 84) {
        partidas.push(pf(signo * r.monto(80_000, 900_000, 10_000)));
      } else if (perfil <= 89) {
        partidas.push(chq("ARS", r.monto(600_000, 3_500_000, 50_000)));
      } else if (perfil <= 88) {
        partidas.push(ef("EUR", signo * r.monto(600, 9_000, 100)));
      } else if (perfil <= 92) {
        partidas.push(ef("BRL", signo * r.monto(3_000, 40_000, 500)));
      } else {
        // Operación de varias patas: efectivo más transferencia convertida.
        partidas.push(ef("ARS", signo * r.monto(200_000, 1_500_000, 50_000)));
        partidas.push(tr("ARS", signo * r.monto(500_000, 3_000_000, 50_000), tc, 0.02));
      }

      // De vez en cuando, una segunda moneda en la misma operación.
      if (r.chance(0.22)) {
        partidas.push(ef(r.uno<Moneda>(["USD", "EUR", "BRL"]), signo * r.monto(300, 4_000, 100)));
      }

      agregar(fecha, oficina, contraparte, concepto, categoria, partidas);
    }

    // Gastos de oficina, un par de veces por semana.
    if (r.chance(0.35)) {
      agregar(fecha, r.uno([1, 2, 3, 4]), gastosOficina,
        r.uno(["Alquiler", "Servicios", "Insumos de oficina", "Mantenimiento"]),
        "pago_proveedor", [tr("ARS", -r.monto(150_000, 1_400_000, 50_000), null, 0)]);
    }
  });

  return { oficinas: OFICINAS, contrapartes, movimientos, auditoria: [] };
}
