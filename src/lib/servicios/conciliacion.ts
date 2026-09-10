import { reevaluar } from "../operaciones/motor";
import { estadoDePlanilla } from "../data/dataset-operaciones";
import type { Repositorios } from "../data/puertos";
import type { Corrida } from "../operaciones/tipos";

/**
 * Servicio de conciliación.
 *
 * Es la única pieza que orquesta una corrida completa, y **no sabe qué hay
 * debajo**: recibe repositorios y trabaja contra la interfaz. Da igual si
 * detrás hay un archivo local o Postgres.
 *
 * La separación importa por una razón concreta: el matcher está validado
 * contra datos reales —91,7 % de acierto, benchmark independiente al
 * 100 %— y no se toca. Lo que faltaba no era lógica de emparejamiento sino
 * un lugar donde poner el «cargar, correr, persistir» sin meterlo en un
 * componente de React ni en la capa de datos.
 *
 * Orden de las tres fuentes de verdad, que lo aplica el motor y este
 * servicio respeta:
 *
 *   1. lo que decidió una persona;
 *   2. lo que una persona enseñó;
 *   3. lo que deduce el matcher, solo sobre lo que quedó sin decidir.
 */

export interface ResultadoCorrida {
  corrida: Corrida;
  /** Cuántas operaciones cambiaron de estado. */
  cambios: number;
}

/**
 * Vuelve a conciliar todo lo que sigue abierto.
 *
 * Es idempotente: correrla dos veces sobre las mismas entradas no duplica
 * emparejamientos, no pisa una decisión humana y no genera eventos que no
 * ocurrieron. La segunda corrida registra que corrió —eso sí pasó— y nada
 * más.
 */
export async function correrConciliacion(
  repos: Repositorios,
  disparador: Corrida["disparador"] = "MANUAL",
): Promise<ResultadoCorrida> {
  const comienzo = Date.now();

  // Se cargan **todas** las transferencias, no solo las abiertas: las
  // cerradas son las que tienen tomadas sus acreditaciones, y sin ellas el
  // uno a uno se rompería entre corridas.
  const [operaciones, acreditaciones, mapeos, resoluciones] = await Promise.all([
    repos.transferencias.listar(),
    repos.acreditaciones.listar(),
    repos.conciliacion.mapeos(),
    repos.conciliacion.resoluciones(),
  ]);

  const salida = reevaluar({
    operaciones,
    acreditaciones,
    mapeos,
    resoluciones,
    momento: new Date().toISOString().slice(0, 19),
    disparador,
  });

  // Solo se escriben las que cambiaron. Reescribir 497 filas idénticas en
  // cada corrida es ruido en la base y en cualquier traza de auditoría.
  const previas = new Map(operaciones.map((o) => [o.id, o]));
  const cambiadas = salida.operaciones.filter((o) => {
    const antes = previas.get(o.id);
    return (
      !antes ||
      antes.estado !== o.estado ||
      antes.acreditacionId !== o.acreditacionId ||
      antes.motivo !== o.motivo ||
      antes.intentos !== o.intentos
    );
  });

  if (cambiadas.length > 0) await repos.transferencias.guardarResultados(cambiadas);
  if (salida.eventos.length > 0) await repos.conciliacion.registrarEventos(salida.eventos);
  if (salida.usosDeMapeo.size > 0) {
    await repos.conciliacion.actualizarUsosDeMapeo(salida.usosDeMapeo);
  }

  await refrescarPlanillas(repos, salida.operaciones);

  const corrida = await repos.conciliacion.registrarCorrida({
    ...salida.corrida,
    duracionMs: Date.now() - comienzo,
  });

  return { corrida, cambios: salida.eventos.length };
}

/**
 * El estado de una planilla es derivado de sus transferencias.
 *
 * Se recalcula acá y no en cada pantalla para que la lista de planillas y
 * el detalle no puedan mostrar cosas distintas. Solo se escribe lo que
 * efectivamente cambió.
 */
async function refrescarPlanillas(
  repos: Repositorios,
  operaciones: Awaited<ReturnType<Repositorios["transferencias"]["listar"]>>,
) {
  const planillas = await repos.planillas.listar();
  for (const p of planillas) {
    const estado = estadoDePlanilla(p.id, operaciones);
    if (estado !== p.estado) await repos.planillas.actualizarEstado(p.id, estado);
  }
}
