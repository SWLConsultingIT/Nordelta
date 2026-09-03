import type { Contraparte, Movimiento, Oficina, EntradaAuditoria } from "../domain/types";
import { CONTRAPARTES, MOVIMIENTOS, OFICINAS, AUDITORIA } from "./fixtures";
import { normalizarNombre } from "../domain/contrapartes";
import { CATEGORIAS_QUE_IMPACTAN } from "../domain/types";

/**
 * Almacén en memoria para desarrollo y demostración.
 *
 * Existe para que la aplicación se pueda usar de punta a punta sin Supabase
 * configurado, ejercitando los MISMOS caminos de código que la versión con
 * base de datos. Un almacén de escritura real —aunque sea volátil— vale más
 * que una función que no hace nada: si el guardado está roto, se nota acá.
 *
 * No pretende reemplazar a Postgres: no valida invariantes ni aplica
 * seguridad por fila. Esas garantías son de la base, y por eso la base es la
 * autoridad.
 */
class AlmacenMemoria {
  oficinas: Oficina[] = [...OFICINAS];
  contrapartes: Contraparte[] = [...CONTRAPARTES];
  movimientos: Movimiento[] = MOVIMIENTOS.map((m) => ({ ...m }));
  auditoria: EntradaAuditoria[] = [...AUDITORIA];

  private secMov = 10_000;
  private secPart = 100_000;
  private secCp = 1_000;

  obtenerOCrearContraparte(nombre: string): number {
    const norm = normalizarNombre(nombre);
    const existente = this.contrapartes.find((c) => normalizarNombre(c.nombre) === norm);
    if (existente) return existente.id;
    const id = ++this.secCp;
    this.contrapartes.push({ id, nombre: nombre.trim(), activo: true });
    return id;
  }

  siguienteOrden(fecha: string, oficinaId: number): number {
    const delDia = this.movimientos.filter((m) => m.fecha === fecha && m.oficina_id === oficinaId);
    return delDia.reduce((max, m) => Math.max(max, m.orden), 0) + 1;
  }

  crearMovimiento(
    entrada: Omit<Movimiento, "id" | "afecta_cta_cte" | "orden"> & { orden?: number },
  ): Movimiento {
    const id = String(++this.secMov);
    const mov: Movimiento = {
      ...entrada,
      id,
      afecta_cta_cte: CATEGORIAS_QUE_IMPACTAN.has(entrada.categoria),
      orden: entrada.orden ?? this.siguienteOrden(entrada.fecha, entrada.oficina_id),
      partidas: entrada.partidas.map((p) => ({ ...p, id: `p${++this.secPart}` })),
    };
    this.movimientos.push(mov);
    this.registrar("movimiento", id, "INSERT", null, null, null);
    return mov;
  }

  eliminarMovimiento(id: string, motivo?: string): boolean {
    const i = this.movimientos.findIndex((m) => m.id === id);
    if (i < 0) return false;
    const [borrado] = this.movimientos.splice(i, 1);
    this.registrar("movimiento", id, "DELETE", null, borrado.concepto, null, motivo);
    return true;
  }

  private registrar(
    entidad: string, ref: string, operacion: EntradaAuditoria["operacion"],
    campo: string | null, anterior: string | null, nuevo: string | null, motivo?: string,
  ) {
    this.auditoria.unshift({
      id: `a${this.auditoria.length + 1000}`,
      ocurrido_en: new Date().toISOString().slice(0, 19),
      actor: "demo@nordelta.com",
      operacion, entidad, referencia: ref,
      campo, valor_anterior: anterior, valor_nuevo: nuevo,
      motivo: motivo ?? null,
    });
  }
}

/** Una sola instancia por proceso. En dev, Next recarga módulos, así que se
 *  guarda en el global para que el estado sobreviva a un hot reload. */
const clave = Symbol.for("nordelta.almacen");
type Portador = { [clave]?: AlmacenMemoria };
const portador = globalThis as unknown as Portador;

export const almacen: AlmacenMemoria = portador[clave] ?? (portador[clave] = new AlmacenMemoria());
