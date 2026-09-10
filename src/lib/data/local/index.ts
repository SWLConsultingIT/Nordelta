import "server-only";
import { almacenOps } from "../almacen-operaciones";
import { ErrorNoEncontrado, ErrorValidacion } from "../../domain/errors";
import { esFechaCalendario } from "../../fullcarga/fechas";
import type {
  AcreditacionGuardada, Cliente, Corrida, Evento, Informe, MapeoIdentidad,
  Operacion, Planilla, Resolucion,
} from "../../operaciones/tipos";
import type {
  ClienteNuevo, FiltroTransferencias, PlanillaNueva, Repositorios,
} from "../puertos";
import { requiereAtencion } from "../../operaciones/buckets";

/**
 * Implementación local de los puertos, sobre el almacén respaldado en
 * archivo.
 *
 * No es un simulacro: es la implementación que hace andar el producto en
 * una notebook sin infraestructura, y la que corren los tests de contrato.
 * Que el mismo conjunto de pruebas valga para esta y para la de Postgres es
 * lo que impide que las dos interpreten distinto el mismo dominio —el
 * problema clásico de tener dos backends y descubrir la diferencia en
 * producción—.
 *
 * Lo que **no** replica, y hay que tenerlo presente: no hay transacciones,
 * ni concurrencia, ni seguridad por fila. Esas garantías son de la base, y
 * por eso la base es la autoridad.
 */

const ALIAS = /^[A-Z0-9][A-Z0-9-]{0,15}$/;
const CENTAVOS = (n: number) => Math.round(n * 100);

export function repositoriosLocales(): Repositorios {
  const e = () => almacenOps.estado;

  return {
    /* ── Clientes ─────────────────────────────────────────── */
    clientes: {
      async listar() {
        return [...e().clientes].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      },
      async obtener(id) {
        return e().clientes.find((c) => c.id === id) ?? null;
      },
      async crear(datos: ClienteNuevo) {
        const nombre = datos.nombre.trim();
        const alias = datos.alias.trim().toUpperCase();
        if (nombre === "") throw new ErrorValidacion("El cliente necesita un nombre", "nombre");
        if (!ALIAS.test(alias)) {
          throw new ErrorValidacion(
            "El alias va en mayúsculas, sin espacios, hasta 16 caracteres", "alias",
          );
        }
        if (e().clientes.some((c) => c.alias === alias)) {
          throw new ErrorValidacion(`Ya existe un cliente con el alias ${alias}`, "alias");
        }
        const cliente: Cliente = { id: almacenOps.id("cl"), nombre, alias };
        e().clientes.push(cliente);
        almacenOps.guardar();
        return cliente;
      },
      async renombrar(id, nombre) {
        const limpio = nombre.trim();
        if (limpio === "") throw new ErrorValidacion("El nombre no puede quedar vacío", "nombre");
        const c = e().clientes.find((x) => x.id === id);
        if (!c) throw new ErrorNoEncontrado(`No existe el cliente ${id}`, { id });
        c.nombre = limpio;
        almacenOps.guardar();
        return c;
      },
      async desactivar(id) {
        // Baja lógica también acá: el almacén local no puede comportarse
        // distinto de la base, o el contrato deja de significar algo.
        e().clientesInactivos = [...new Set([...(e().clientesInactivos ?? []), id])];
        almacenOps.guardar();
      },
      async emails(clienteId) {
        return (e().clienteEmails ?? [])
          .filter((x) => x.clienteId === clienteId)
          .map((x) => x.email);
      },
      async agregarEmail(clienteId, email, principal = false) {
        const limpio = email.trim().toLowerCase();
        if (!limpio.includes("@")) {
          throw new ErrorValidacion("El correo no es válido", "email", { email: limpio });
        }
        const lista = e().clienteEmails ?? (e().clienteEmails = []);
        if (lista.some((x) => x.email === limpio)) {
          throw new ErrorValidacion("Ese correo ya está asociado a un cliente", "email");
        }
        lista.push({ clienteId, email: limpio, principal });
        almacenOps.guardar();
      },
    },

    /* ── Planillas ────────────────────────────────────────── */
    planillas: {
      async listar(clienteId) {
        return e().planillas
          .filter((p) => !clienteId || p.clienteId === clienteId)
          .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
      },
      async obtener(id) {
        return e().planillas.find((p) => p.id === id) ?? null;
      },
      async crear(datos: PlanillaNueva) {
        if (!esFechaCalendario(datos.fecha)) {
          throw new ErrorValidacion("La fecha de la planilla no es válida", "fecha");
        }
        if (datos.archivo.trim() === "") {
          throw new ErrorValidacion("Falta el nombre del archivo", "archivo");
        }
        if (!e().clientes.some((c) => c.id === datos.clienteId)) {
          throw new ErrorValidacion("El cliente no existe", "clienteId");
        }
        if (datos.sha256) {
          const repetida = e().planillas.find(
            (p) => p.clienteId === datos.clienteId && p.sha256 === datos.sha256,
          );
          if (repetida) {
            throw new ErrorValidacion("Esa planilla ya se importó para este cliente", "sha256");
          }
        }
        const planilla: Planilla = {
          id: almacenOps.id("pl"),
          clienteId: datos.clienteId,
          archivo: datos.archivo.trim(),
          fecha: datos.fecha,
          importadaEn: new Date().toISOString().slice(0, 19),
          estado: "RECIBIDA",
          sha256: datos.sha256 ?? null,
          storagePath: datos.storagePath ?? null,
        };
        e().planillas.push(planilla);
        almacenOps.guardar();
        return planilla;
      },
      async actualizarEstado(id, estado) {
        const p = e().planillas.find((x) => x.id === id);
        if (!p) throw new ErrorNoEncontrado(`No existe la planilla ${id}`, { id });
        p.estado = estado;
        almacenOps.guardar();
      },
      async buscarPorHuella(clienteId, sha256) {
        return e().planillas.find(
          (p) => p.clienteId === clienteId && p.sha256 === sha256,
        ) ?? null;
      },
    },

    /* ── Transferencias ───────────────────────────────────── */
    transferencias: {
      async listar(filtro: FiltroTransferencias = {}) {
        return e().operaciones.filter((o) => {
          if (filtro.planillaId && o.planillaId !== filtro.planillaId) return false;
          if (filtro.clienteId && o.clienteId !== filtro.clienteId) return false;
          if (filtro.soloAbiertas && !requiereAtencion(o.estado)) return false;
          return true;
        });
      },
      async obtener(id) {
        return e().operaciones.find((o) => o.id === id) ?? null;
      },
      async crearLote(planillaId, filas) {
        const planilla = e().planillas.find((p) => p.id === planillaId);
        if (!planilla) throw new ErrorNoEncontrado(`No existe la planilla ${planillaId}`);
        const momento = new Date().toISOString().slice(0, 19);
        const creadas: Operacion[] = filas.map((f) => ({
          ...f,
          id: almacenOps.id("op"),
          planillaId,
          clienteId: planilla.clienteId,
          estado: "PENDIENTE_NO_ENCONTRADA_EN_RANGO",
          motivo: "Recién importada, sin conciliar",
          acreditacionId: null,
          candidatoIds: [],
          duplicadoDe: [],
          automatico: false,
          viaMapeo: false,
          fechaAcreditacion: null,
          evaluadaEn: momento,
          intentos: 0,
        }));
        e().operaciones.push(...creadas);
        // El total y el recuento son de la planilla, no de cada fila.
        planilla.filas = e().operaciones.filter((o) => o.planillaId === planillaId).length;
        planilla.totalCentavos = e().operaciones
          .filter((o) => o.planillaId === planillaId)
          .reduce((a, o) => a + CENTAVOS(o.importe), 0);
        almacenOps.guardar();
        return creadas;
      },
      async guardarResultados(operaciones) {
        const porId = new Map(operaciones.map((o) => [o.id, o]));
        e().operaciones = e().operaciones.map((o) => porId.get(o.id) ?? o);
        almacenOps.guardar();
      },
    },

    /* ── Informes ─────────────────────────────────────────── */
    informes: {
      async listar() {
        return [...e().informes].sort((a, b) => (a.importadoEn < b.importadoEn ? 1 : -1));
      },
      async registrar(datos) {
        if (!esFechaCalendario(datos.desde) || !esFechaCalendario(datos.hasta)) {
          throw new ErrorValidacion("El rango del informe no es válido", "desde");
        }
        if (datos.hasta < datos.desde) {
          throw new ErrorValidacion("El rango termina antes de empezar", "hasta");
        }
        const informe: Informe = {
          id: almacenOps.id("inf"),
          archivo: datos.archivo,
          desde: datos.desde,
          hasta: datos.hasta,
          origen: datos.origen,
          importadoEn: new Date().toISOString().slice(0, 19),
          acreditaciones: 0,
          sha256: datos.sha256 ?? null,
          storagePath: datos.storagePath ?? null,
        };
        e().informes.push(informe);
        almacenOps.guardar();
        return informe;
      },
    },

    /* ── Acreditaciones ───────────────────────────────────── */
    acreditaciones: {
      async listar() {
        return e().acreditaciones;
      },
      async incorporar(informeId, filas) {
        // La identidad es (informe, fila). La huella natural
        // —CUIT, fecha, importe— sirve para no recargar un registro que ya
        // está en el pozo, porque los informes se superponen por diseño;
        // **no** para deduplicar entre transferencias reales distintas.
        const conocidas = new Set(
          e().acreditaciones.map((a) => `${a.cuit}|${a.fecha}|${a.importe}|${a.descripcion ?? ""}`),
        );
        let nuevas = 0;
        for (const f of filas) {
          const huella = `${f.cuit}|${f.fecha}|${f.importe}|${f.descripcion ?? ""}`;
          if (conocidas.has(huella)) continue;
          conocidas.add(huella);
          nuevas += 1;
          e().acreditaciones.push({ ...f, id: `${informeId}|${f.row}`, informeId });
        }
        const informe = e().informes.find((i) => i.id === informeId);
        if (informe) informe.acreditaciones = nuevas;
        almacenOps.guardar();
        return { nuevas };
      },
    },

    /* ── Conciliación ─────────────────────────────────────── */
    conciliacion: {
      async resoluciones() {
        return e().resoluciones;
      },
      async registrarResolucion(r) {
        const resolucion: Resolucion = { ...r, id: almacenOps.id("re") };
        e().resoluciones.push(resolucion);
        almacenOps.guardar();
        return resolucion;
      },
      async mapeos() {
        return [...e().mapeos].sort((a, b) => (a.momento < b.momento ? 1 : -1));
      },
      async registrarMapeo(m) {
        const existente = e().mapeos.find(
          (x) => x.clienteId === m.clienteId && x.identificacion === m.identificacion,
        );
        // Una identidad ya confirmada no se pisa en silencio: se devuelve
        // la que está. Cambiar a qué CUIT apunta un depositante es una
        // decisión distinta y tiene que ser explícita.
        if (existente) return existente;
        const mapeo: MapeoIdentidad = { ...m, id: almacenOps.id("mp"), usos: 0 };
        e().mapeos.push(mapeo);
        almacenOps.guardar();
        return mapeo;
      },
      async actualizarUsosDeMapeo(usos) {
        for (const [id, n] of usos) {
          const m = e().mapeos.find((x) => x.id === id);
          if (m) m.usos = n;
        }
        almacenOps.guardar();
      },
      async corridas(limite = 20) {
        return [...e().corridas]
          .sort((a, b) => (a.momento < b.momento ? 1 : -1))
          .slice(0, limite);
      },
      async registrarCorrida(c) {
        const corrida: Corrida = { ...c, id: almacenOps.id("co") };
        e().corridas.push(corrida);
        almacenOps.guardar();
        return corrida;
      },
      async eventos(transferenciaId) {
        return e().eventos
          .filter((x) => x.operacionId === transferenciaId)
          .sort((a, b) => (a.momento < b.momento ? 1 : -1));
      },
      async eventosDelDia(fecha) {
        return e().eventos.filter((x) => x.momento.slice(0, 10) === fecha);
      },
      async registrarEventos(nuevos) {
        for (const ev of nuevos) {
          const evento: Evento = { ...ev, id: almacenOps.id("ev") };
          e().eventos.push(evento);
        }
        almacenOps.guardar();
      },
    },
  };
}

/** Solo para los tests de contrato: qué hay en el pozo. */
export type { AcreditacionGuardada, Operacion };
