import "server-only";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type {
  AcreditacionGuardada, Cliente, ClienteEmail, Corrida, Evento, Informe,
  MapeoIdentidad, Operacion, Planilla, Resolucion,
} from "../operaciones/tipos";
import { generarOperaciones } from "./dataset-operaciones";

/**
 * Almacén del módulo operativo, respaldado en un archivo.
 *
 * Por qué existe: el matcher es una función pura y eso está bien, pero el
 * producto tiene que **recordar**. Si Mati resuelve una excepción hoy, mañana
 * no puede reaparecer como si nunca hubiera pasado. El almacén en memoria del
 * módulo financiero no alcanza para eso: se pierde al reiniciar el servidor,
 * y una demostración que pierde las decisiones no demuestra nada.
 *
 * Por qué un archivo y no Supabase: esta etapa tiene que poder correrse en
 * una notebook sin infraestructura. El archivo vive en `.data/`, que está
 * ignorado por git.
 *
 * **Esto no es una base de datos** y no pretende serlo: no hay transacciones,
 * ni concurrencia, ni seguridad por fila. Es un respaldo para la etapa de
 * MVP. La interfaz que lo envuelve —`lib/data/operaciones.ts`— es la que se
 * va a reimplementar contra Supabase, y por eso nada fuera de este archivo
 * sabe que hay un filesystem debajo.
 */

/**
 * Dónde vive el archivo.
 *
 * Configurable por entorno para dos casos reales: los tests, que no pueden
 * pisar el estado de la demostración, y cualquier despliegue donde el
 * directorio de trabajo sea de solo lectura.
 */
const DIRECTORIO = process.env.NORD_DATA_DIR ?? join(process.cwd(), ".data");
const RUTA = join(DIRECTORIO, "operaciones.json");

/**
 * Cuándo se toca el disco: **solo en modo local**, que es el de desarrollo.
 *
 * La regla estaba escrita al revés —«no tocar el disco solo si
 * `DATA_MODE=demo`»— y tenía dos agujeros que se abrieron juntos en el
 * primer despliegue real:
 *
 *   · con `DATA_MODE=supabase` este almacén no se usa para nada, pero
 *     igual escribía;
 *   · sin `DATA_MODE`, también escribía.
 *
 * Y lo hacía **durante la evaluación del módulo**: bastaba con importar la
 * capa de datos para que un sistema de archivos de solo lectura tumbara la
 * aplicación entera con un `ENOENT` sobre `/var/task/.data`, antes de que
 * ninguna función llegara a correr y sin que nadie pudiera atraparlo.
 *
 * El criterio ahora es el mismo que usa `modoDatos()` para devolver
 * `local`: pedido explícitamente, o nada declarado fuera de producción.
 */
const CON_DISCO =
  process.env.DATA_MODE === "local" ||
  (process.env.DATA_MODE === undefined && process.env.NODE_ENV !== "production");

/**
 * Se apaga sola ante el primer fallo de escritura.
 *
 * Aunque el modo diga `local`, el disco puede no estar: un contenedor de
 * solo lectura, un volumen lleno, un permiso. Nada de eso puede tumbar la
 * aplicación, así que se sigue en memoria y no se vuelve a intentar.
 */
let escribible = true;

/** Versión del formato. Si cambia el modelo, el archivo viejo se descarta. */
const VERSION = 1;

export interface Estado {
  version: number;
  clientes: Cliente[];
  /** Correos por cliente. Preparado para la ingesta por Gmail. */
  clienteEmails?: ClienteEmail[];
  /** Bajas lógicas: nada se borra, tampoco acá. */
  clientesInactivos?: string[];
  planillas: Planilla[];
  operaciones: Operacion[];
  informes: Informe[];
  acreditaciones: AcreditacionGuardada[];
  resoluciones: Resolucion[];
  mapeos: MapeoIdentidad[];
  eventos: Evento[];
  corridas: Corrida[];
  secuencias: Record<string, number>;
}

/**
 * El número más alto ya usado con ese prefijo.
 *
 * Se deduce de los identificadores en lugar de contar los elementos: si el
 * dataset saltea un número —como pasa con el par duplicado, que produce dos
 * filas de una sola intención— contar daría un valor bajo y volvería a
 * colisionar.
 */
function ultimo(prefijo: string, filas: readonly { id: string }[]): number {
  let max = 0;
  const patron = new RegExp(`^${prefijo}(\\d+)`);
  for (const f of filas) {
    const m = patron.exec(f.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max;
}

class AlmacenOperaciones {
  estado!: Estado;

  constructor() {
    const leido = this.leer();
    this.estado = leido ?? this.inicial();
    if (!leido) this.guardar();
  }

  private inicial(): Estado {
    const datos = generarOperaciones();
    // Las secuencias arrancan **después** de lo que ya generó el dataset.
    // Sin esto, la primera planilla que se importe recibiría el id de una
    // operación sembrada, dos filas distintas compartirían identificador y
    // la re-evaluación colapsaría una sobre la otra. Costó un test
    // encontrarlo y no se puede volver a perder.
    return {
      version: VERSION,
      ...datos,
      secuencias: {
        pl: ultimo("pl", datos.planillas),
        op: ultimo("op", datos.operaciones),
        ev: ultimo("ev", datos.eventos),
        co: ultimo("co", datos.corridas),
        inf: ultimo("inf", datos.informes),
      },
    };
  }

  private leer(): Estado | null {
    if (!CON_DISCO) return null;
    try {
      if (!existsSync(RUTA)) return null;
      const crudo = JSON.parse(readFileSync(RUTA, "utf8")) as Partial<Estado>;
      // Un archivo de una versión anterior se descarta entero. Migrar el
      // estado de una demostración cuesta más de lo que vale.
      if (crudo.version !== VERSION || !Array.isArray(crudo.operaciones)) return null;
      return crudo as Estado;
    } catch {
      // Un archivo corrupto no puede tumbar la aplicación: se regenera.
      return null;
    }
  }

  /**
   * Escritura atómica: se escribe a un temporal y se renombra.
   *
   * Sin esto, un corte durante el `write` deja el archivo a medias y la
   * próxima lectura pierde todo. El renombrado dentro del mismo directorio
   * es atómico en los sistemas de archivos que nos importan.
   */
  guardar() {
    if (!CON_DISCO || !escribible) return;
    try {
      const dir = dirname(RUTA);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const tmp = `${RUTA}.${process.pid}.tmp`;
      writeFileSync(tmp, JSON.stringify(this.estado), "utf8");
      renameSync(tmp, RUTA);
    } catch {
      escribible = false;
    }
  }

  /** Identificador legible y estable dentro del proceso. */
  id(prefijo: string): string {
    const n = (this.estado.secuencias[prefijo] ?? 0) + 1;
    this.estado.secuencias[prefijo] = n;
    return `${prefijo}${String(n).padStart(5, "0")}`;
  }

  /** Vuelve al dataset inicial. Es lo que usa el botón de reinicio. */
  restablecer() {
    this.estado = this.inicial();
    this.guardar();
  }
}

/** Una sola instancia por proceso, que sobrevive al hot reload de Next. */
const clave = Symbol.for("nordelta.almacen.operaciones");
type Portador = { [clave]?: AlmacenOperaciones };
const portador = globalThis as unknown as Portador;

export const almacenOps: AlmacenOperaciones =
  portador[clave] ?? (portador[clave] = new AlmacenOperaciones());
