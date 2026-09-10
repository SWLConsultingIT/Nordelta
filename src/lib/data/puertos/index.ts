/**
 * Puertos de datos del dominio operativo.
 *
 * Son **contratos, no implementaciones**. Existen para que el mismo
 * servicio de conciliación corra contra el almacén local de la etapa de
 * validación y contra Postgres, sin que ninguna pantalla se entere de cuál
 * está debajo.
 *
 * Tres reglas que estos contratos hacen cumplir por diseño:
 *
 *   1. **Nada devuelve `any` ni la fila cruda de la base.** Lo que sale es
 *      el tipo de dominio; traducir es trabajo del adaptador.
 *   2. **El dinero viaja en centavos enteros** en la frontera de datos. La
 *      conversión a pesos ocurre una sola vez, al presentar.
 *   3. **Nada se borra.** No hay método de baja: se marca inactivo o se
 *      anula. En un sistema financiero, borrar es perder evidencia.
 *
 * El aislamiento entre organizaciones **no** es responsabilidad de estos
 * puertos: lo garantiza la seguridad por fila de Postgres. Que un
 * adaptador se olvide de filtrar no puede ser suficiente para filtrar
 * datos, y por eso la organización no viaja como parámetro.
 */

import type {
  AcreditacionGuardada, Cliente, Corrida, Evento, Informe, MapeoIdentidad,
  Operacion, Planilla, Resolucion,
} from "../../operaciones/tipos";

/** Campos que puede traer un alta de cliente. El resto lo pone la base. */
export interface ClienteNuevo {
  nombre: string;
  alias: string;
}

export interface RepositorioClientes {
  listar(): Promise<Cliente[]>;
  obtener(id: string): Promise<Cliente | null>;
  crear(datos: ClienteNuevo): Promise<Cliente>;
  renombrar(id: string, nombre: string): Promise<Cliente>;
  /** Baja lógica. No existe borrado: rompería la trazabilidad. */
  desactivar(id: string): Promise<void>;
  /** Correos desde los que el cliente manda planillas. */
  emails(clienteId: string): Promise<string[]>;
  agregarEmail(clienteId: string, email: string, principal?: boolean): Promise<void>;
}

export interface PlanillaNueva {
  clienteId: string;
  archivo: string;
  fecha: string;
  sha256?: string | null;
  storagePath?: string | null;
}

export interface RepositorioPlanillas {
  listar(clienteId?: string): Promise<Planilla[]>;
  obtener(id: string): Promise<Planilla | null>;
  crear(datos: PlanillaNueva): Promise<Planilla>;
  /** El estado es derivado de sus transferencias: lo recalcula el servicio. */
  actualizarEstado(id: string, estado: Planilla["estado"]): Promise<void>;
  /**
   * ¿Ya se importó este archivo para este cliente?
   *
   * En el flujo por correo el mismo adjunto llega varias veces. Sin esta
   * pregunta, cada reenvío duplica las transferencias del cliente.
   */
  buscarPorHuella(clienteId: string, sha256: string): Promise<Planilla | null>;
}

export interface FiltroTransferencias {
  planillaId?: string;
  clienteId?: string;
  /** Solo lo que sigue abierto. Es la cola de trabajo. */
  soloAbiertas?: boolean;
}

export interface RepositorioTransferencias {
  listar(filtro?: FiltroTransferencias): Promise<Operacion[]>;
  obtener(id: string): Promise<Operacion | null>;
  /** Alta en lote: una planilla entra entera o no entra. */
  crearLote(planillaId: string, filas: readonly Omit<Operacion,
    "id" | "planillaId" | "clienteId" | "estado" | "motivo" | "acreditacionId" |
    "candidatoIds" | "duplicadoDe" | "automatico" | "viaMapeo" |
    "fechaAcreditacion" | "evaluadaEn" | "intentos">[]): Promise<Operacion[]>;
  /** Guarda el resultado de una corrida sobre las que cambiaron. */
  guardarResultados(operaciones: readonly Operacion[]): Promise<void>;
}

export interface RepositorioInformes {
  listar(): Promise<Informe[]>;
  registrar(datos: {
    archivo: string; desde: string; hasta: string;
    origen: Informe["origen"]; sha256?: string | null; storagePath?: string | null;
  }): Promise<Informe>;
}

export interface RepositorioAcreditaciones {
  /** Todo el pozo disponible para conciliar. */
  listar(): Promise<AcreditacionGuardada[]>;
  /**
   * Incorpora las filas de un informe.
   *
   * Devuelve cuántas eran nuevas. La identidad es `(informe, fila)`: **no**
   * CUIT + fecha + importe, porque dos personas pueden transferir lo mismo
   * el mismo día y colapsarlas perdería una acreditación real.
   */
  incorporar(informeId: string, filas: readonly Omit<AcreditacionGuardada,
    "id" | "informeId">[]): Promise<{ nuevas: number }>;
}

export interface RepositorioConciliacion {
  resoluciones(): Promise<Resolucion[]>;
  registrarResolucion(r: Omit<Resolucion, "id">): Promise<Resolucion>;
  mapeos(): Promise<MapeoIdentidad[]>;
  registrarMapeo(m: Omit<MapeoIdentidad, "id" | "usos">): Promise<MapeoIdentidad>;
  actualizarUsosDeMapeo(usos: ReadonlyMap<string, number>): Promise<void>;
  corridas(limite?: number): Promise<Corrida[]>;
  registrarCorrida(c: Omit<Corrida, "id">): Promise<Corrida>;
  eventos(transferenciaId: string): Promise<Evento[]>;
  /**
   * Los eventos de un día.
   *
   * Es lo que permite responder si la cola crece o drena, que es la
   * pregunta útil sobre los pendientes: cuántos hay, por sí solo, no dice
   * nada cuando la mitad del volumen acredita después de D+1.
   */
  eventosDelDia(fecha: string): Promise<Evento[]>;
  registrarEventos(e: readonly Omit<Evento, "id">[]): Promise<void>;
}

/** Todo lo que el servicio de conciliación necesita, en un solo objeto. */
export interface Repositorios {
  clientes: RepositorioClientes;
  planillas: RepositorioPlanillas;
  transferencias: RepositorioTransferencias;
  informes: RepositorioInformes;
  acreditaciones: RepositorioAcreditaciones;
  conciliacion: RepositorioConciliacion;
}
