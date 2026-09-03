import type { Contraparte, EntradaAuditoria, Movimiento, Oficina, Partida } from "../domain/types";
import { CATEGORIAS_QUE_IMPACTAN } from "../domain/types";
import { normalizarNombre } from "../domain/contrapartes";
import { generarDataset } from "./dataset";

/**
 * Correcciones sembradas en la auditoría de la demostración.
 *
 * `desdeElFinal` es el índice negativo del movimiento del que toman la fecha
 * y la referencia, así que siempre apuntan a algo que existe. La descripción
 * es propia de la corrección: no se toma prestada del movimiento, para que la
 * fila se lea coherente.
 */
const CORRECCIONES_DEMO = [
  {
    entidad: "movimiento", operacion: "UPDATE" as const, desdeElFinal: -22,
    descripcion: "Cobro de factura 0001-00014892",
    campo: "concepto", anterior: "Cobro factura", nuevo: "Cobro de factura 0001-00014892",
    motivo: "Faltaba el número de comprobante", hora: "11:42",
    actor: "operaciones@nordelta.com",
  },
  {
    entidad: "movimiento", operacion: "UPDATE" as const, desdeElFinal: -35,
    descripcion: "Liquidación de saldo",
    campo: "categoria", anterior: "ingreso", nuevo: "full_pago",
    motivo: "Cerraba la cuenta, no era un ingreso más", hora: "16:08",
    actor: "santi@swlconsulting.com",
  },
  {
    entidad: "partida", operacion: "UPDATE" as const, desdeElFinal: -48,
    descripcion: "Pago mixto: efectivo y transferencia",
    campo: "partidas", anterior: "2 partidas", nuevo: "3 partidas",
    motivo: "Se había cargado en una sola línea un pago mixto", hora: "10:19",
    actor: "operaciones@nordelta.com",
  },
];

/**
 * Almacén de la demostración.
 *
 * Existe para que el producto se pueda usar de punta a punta sin Supabase,
 * ejercitando los MISMOS caminos de código que la versión con base de datos.
 *
 * Los cambios duran toda la sesión del servidor: crear un movimiento en
 * `/carga` cambia el saldo en la cuenta, el balance, la actividad reciente y
 * la auditoría. Esa coherencia es lo que hace que la demo se sienta como un
 * producto y no como pantallas separadas.
 *
 * No pretende reemplazar a Postgres: no aplica seguridad por fila ni valida
 * invariantes. Esas garantías son de la base, y por eso la base es la
 * autoridad.
 */
class AlmacenDemo {
  oficinas!: Oficina[];
  contrapartes!: Contraparte[];
  movimientos!: Movimiento[];
  auditoria!: EntradaAuditoria[];

  private secMov = 900_000;
  private secPart = 9_000_000;
  private secCp = 900;
  private secAud = 0;

  constructor() { this.restablecer(); }

  /** Vuelve al dataset inicial. Es lo que usa el botón de reinicio. */
  restablecer() {
    const d = generarDataset();
    this.oficinas = d.oficinas;
    this.contrapartes = d.contrapartes;
    this.movimientos = d.movimientos;
    this.auditoria = [];
    this.secMov = 900_000;
    this.secPart = 9_000_000;
    this.secCp = 900;
    this.secAud = 0;
    // Auditoría de arranque: da algo que mostrar sin haber cargado nada.
    this.sembrarAuditoria();
  }

  private sembrarAuditoria() {
    const recientes = this.movimientos.slice(-14);
    for (const m of recientes) {
      this.registrar("movimiento", m.id, "INSERT", null, null, null,
        `${m.fecha}T${String(9 + (m.orden % 9)).padStart(2, "0")}:${String((m.orden * 7) % 60).padStart(2, "0")}:00`,
        "operaciones@nordelta.com", m.concepto);
    }

    // Correcciones históricas: sin ellas la pantalla solo muestra altas y no
    // se ve lo que hace valiosa a la auditoría —el antes y el después—.
    // Son registros de la demostración: no tocan ningún movimiento ni saldo.
    for (const c of CORRECCIONES_DEMO) {
      const m = this.movimientos.at(c.desdeElFinal);
      if (!m) continue;
      this.registrar(
        c.entidad, m.id, c.operacion, c.campo, c.anterior, c.nuevo,
        `${m.fecha}T${c.hora}:00`, c.actor, c.descripcion, c.motivo,
      );
    }

    // Una contraparte que se había escrito mal. Es el caso que la planilla no
    // podía evitar y la base ahora sí.
    const cp = this.contrapartes.find((c) => c.nombre === "Electrónica Palermo SRL");
    if (cp) {
      this.registrar(
        "contraparte", String(cp.id), "UPDATE", "nombre",
        "Electronica Palermo", cp.nombre,
        `${this.movimientos.at(-60)?.fecha ?? "2026-08-26"}T09:35:00`,
        "santi@swlconsulting.com", cp.nombre,
        "Nombre incompleto y sin tilde",
      );
    }
  }

  obtenerOCrearContraparte(nombre: string): number {
    const norm = normalizarNombre(nombre);
    const existente = this.contrapartes.find((c) => normalizarNombre(c.nombre) === norm);
    if (existente) return existente.id;
    const id = ++this.secCp;
    this.contrapartes.push({ id, nombre: nombre.trim(), activo: true });
    this.registrar("contraparte", String(id), "INSERT", null, null, nombre.trim());
    return id;
  }

  siguienteOrden(fecha: string, oficinaId: number): number {
    return this.movimientos
      .filter((m) => m.fecha === fecha && m.oficina_id === oficinaId)
      .reduce((max, m) => Math.max(max, m.orden), 0) + 1;
  }

  crearMovimiento(
    entrada: Omit<Movimiento, "id" | "afecta_cta_cte" | "orden"> & { orden?: number },
  ): Movimiento {
    const id = `m${++this.secMov}`;
    const mov: Movimiento = {
      ...entrada,
      id,
      afecta_cta_cte: CATEGORIAS_QUE_IMPACTAN.has(entrada.categoria),
      orden: entrada.orden ?? this.siguienteOrden(entrada.fecha, entrada.oficina_id),
      partidas: entrada.partidas.map((p) => ({ ...p, id: `p${++this.secPart}` })),
    };
    this.movimientos.push(mov);
    this.registrar("movimiento", id, "INSERT", null, null, null, undefined, undefined, mov.concepto);
    return mov;
  }

  obtenerMovimiento(id: string): Movimiento | undefined {
    return this.movimientos.find((m) => m.id === id);
  }

  /**
   * Reemplaza cabecera y partidas de un movimiento, registrando en la
   * auditoría cada campo que cambió con su valor anterior y el nuevo.
   */
  actualizarMovimiento(
    id: string,
    cambios: Partial<Pick<Movimiento, "fecha" | "oficina_id" | "contraparte_id" | "concepto" | "categoria">>,
    partidas: Omit<Partida, "id">[] | undefined,
    motivo?: string,
  ): Movimiento | undefined {
    const i = this.movimientos.findIndex((m) => m.id === id);
    if (i < 0) return undefined;
    const antes = this.movimientos[i];

    for (const [campo, valor] of Object.entries(cambios)) {
      const previo = antes[campo as keyof Movimiento];
      if (valor !== undefined && String(previo) !== String(valor)) {
        this.registrar("movimiento", id, "UPDATE", campo, String(previo), String(valor),
          undefined, undefined, antes.concepto, motivo);
      }
    }

    const nuevo: Movimiento = {
      ...antes,
      ...cambios,
      afecta_cta_cte: CATEGORIAS_QUE_IMPACTAN.has(cambios.categoria ?? antes.categoria),
      partidas: partidas
        ? partidas.map((p) => ({ ...p, id: `p${++this.secPart}` }))
        : antes.partidas,
    };

    if (partidas) {
      this.registrar("partida", id, "UPDATE", "partidas",
        `${antes.partidas.length} partidas`, `${partidas.length} partidas`,
        undefined, undefined, antes.concepto, motivo);
    }

    this.movimientos[i] = nuevo;
    return nuevo;
  }

  eliminarMovimiento(id: string, motivo?: string): boolean {
    const i = this.movimientos.findIndex((m) => m.id === id);
    if (i < 0) return false;
    const [borrado] = this.movimientos.splice(i, 1);
    this.registrar("movimiento", id, "DELETE", null, borrado.concepto, null,
      undefined, undefined, borrado.concepto, motivo);
    return true;
  }

  private registrar(
    entidad: string, ref: string, operacion: EntradaAuditoria["operacion"],
    campo: string | null, anterior: string | null, nuevo: string | null,
    momento?: string, actor?: string, descripcion?: string, motivo?: string,
  ) {
    this.auditoria.unshift({
      id: `a${++this.secAud}`,
      ocurrido_en: momento ?? new Date().toISOString().slice(0, 19),
      actor: actor ?? "santi@swlconsulting.com",
      operacion, entidad, referencia: ref,
      campo, valor_anterior: anterior, valor_nuevo: nuevo,
      motivo: motivo ?? null,
      descripcion,
    });
  }
}

/** Una sola instancia por proceso, que sobrevive al hot reload de Next. */
const clave = Symbol.for("nordelta.almacen");
type Portador = { [clave]?: AlmacenDemo };
const portador = globalThis as unknown as Portador;

export const almacen: AlmacenDemo = portador[clave] ?? (portador[clave] = new AlmacenDemo());
