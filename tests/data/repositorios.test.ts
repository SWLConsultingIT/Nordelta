/**
 * Los adaptadores de Postgres.
 *
 * Se prueban contra un doble del cliente de Supabase, no contra una base.
 * Lo que se verifica es lo que el adaptador **sí** controla: qué valida
 * antes de escribir, qué columnas manda, cómo traduce la fila a dominio y
 * cómo convierte un fallo del driver en un error que alguien pueda leer.
 *
 * Lo que NO se prueba acá es el aislamiento entre organizaciones: eso lo
 * garantiza la seguridad por fila de Postgres y se verifica contra una base
 * real. Un test con un doble que «confirma» el aislamiento daría una
 * seguridad falsa, que es peor que no tener el test.
 */

import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { repositorioClientes } from "../../src/lib/data/supabase/clientes";
import { repositorioPlanillas } from "../../src/lib/data/supabase/planillas";
import { ErrorDatos, ErrorValidacion } from "../../src/lib/domain/errors";

type Respuesta = { data: unknown; error: { message: string; code?: string } | null };

/** Registra lo que el adaptador pidió y devuelve lo que se le indique. */
function doble(respuesta: Respuesta) {
  const llamadas: { tabla: string; op: string; carga?: unknown; filtros: [string, unknown][] } = {
    tabla: "", op: "", filtros: [],
  };

  const encadenable: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "limit"]) {
    encadenable[m] = (a?: unknown, b?: unknown) => {
      if (m === "eq") llamadas.filtros.push([String(a), b]);
      return encadenable;
    };
  }
  encadenable.single = async () => respuesta;
  encadenable.maybeSingle = async () => respuesta;
  encadenable.then = (r: (v: Respuesta) => unknown) => Promise.resolve(respuesta).then(r);
  encadenable.insert = (c: unknown) => { llamadas.op = "insert"; llamadas.carga = c; return encadenable; };
  encadenable.update = (c: unknown) => { llamadas.op = "update"; llamadas.carga = c; return encadenable; };

  const sb = {
    from(tabla: string) { llamadas.tabla = tabla; return encadenable; },
  } as unknown as SupabaseClient;

  return { sb, llamadas };
}

const FILA_CLIENTE = { id: "c1", nombre: "Padel Pro Norte", alias: "PADEL-N", activo: true };
const ok = (data: unknown) => ({ data, error: null });
const err = (message: string, code?: string) => ({ data: null, error: { message, code } });

describe("clientes · lectura", () => {
  it("traduce la fila al tipo de dominio y no filtra por organización a mano", async () => {
    const { sb, llamadas } = doble(ok([FILA_CLIENTE]));
    const r = await repositorioClientes(sb).listar();
    expect(r).toEqual([{ id: "c1", nombre: "Padel Pro Norte", alias: "PADEL-N" }]);
    // El aislamiento lo hace la seguridad por fila. Si el adaptador
    // filtrara por organización, un olvido bastaría para filtrar datos.
    expect(llamadas.filtros.map(([col]) => col)).not.toContain("organizacion_id");
  });

  it("un cliente inexistente es null, no una excepción", async () => {
    const { sb } = doble(ok(null));
    expect(await repositorioClientes(sb).obtener("nope")).toBeNull();
  });

  it("un fallo del driver sale como error de dominio, no como texto crudo", async () => {
    const { sb } = doble(err("connection reset by peer"));
    await expect(repositorioClientes(sb).listar()).rejects.toBeInstanceOf(ErrorDatos);
  });
});

describe("clientes · alta", () => {
  it("normaliza el alias y no manda la organización", async () => {
    const { sb, llamadas } = doble(ok(FILA_CLIENTE));
    await repositorioClientes(sb).crear({ nombre: "  Padel Pro Norte ", alias: "padel-n" });
    const carga = llamadas.carga as Record<string, unknown>;
    expect(carga.nombre).toBe("Padel Pro Norte");
    expect(carga.alias).toBe("PADEL-N");
    // Aceptar la organización de quien llama sería aceptar que alguien
    // escriba en otro inquilino.
    expect(carga).not.toHaveProperty("organizacion_id");
  });

  it("rechaza un alias con espacios antes de tocar la base", async () => {
    const { sb, llamadas } = doble(ok(FILA_CLIENTE));
    await expect(
      repositorioClientes(sb).crear({ nombre: "X", alias: "con espacios" }),
    ).rejects.toBeInstanceOf(ErrorValidacion);
    expect(llamadas.op).toBe("");
  });

  it("rechaza un nombre vacío", async () => {
    const { sb } = doble(ok(FILA_CLIENTE));
    await expect(
      repositorioClientes(sb).crear({ nombre: "   ", alias: "X" }),
    ).rejects.toBeInstanceOf(ErrorValidacion);
  });

  it("un alias repetido explica cuál es el problema", async () => {
    const { sb } = doble(err("duplicate key", "23505"));
    await expect(
      repositorioClientes(sb).crear({ nombre: "Otro", alias: "PADEL-N" }),
    ).rejects.toThrow(/PADEL-N/);
  });
});

describe("clientes · baja", () => {
  it("es lógica: marca inactivo en lugar de borrar", async () => {
    const { sb, llamadas } = doble(ok(null));
    await repositorioClientes(sb).desactivar("c1");
    expect(llamadas.op).toBe("update");
    expect(llamadas.carga).toEqual({ activo: false });
  });
});

describe("clientes · correos", () => {
  it("normaliza el correo a minúsculas", async () => {
    const { sb, llamadas } = doble(ok(null));
    await repositorioClientes(sb).agregarEmail("c1", "  Pagos@Cliente.COM ");
    expect((llamadas.carga as Record<string, unknown>).email).toBe("pagos@cliente.com");
  });

  it("rechaza algo que no es un correo", async () => {
    const { sb } = doble(ok(null));
    await expect(repositorioClientes(sb).agregarEmail("c1", "sin-arroba"))
      .rejects.toBeInstanceOf(ErrorValidacion);
  });
});

const FILA_PLANILLA = {
  id: "p1", cliente_id: "c1", archivo: "Transferencias.xlsx",
  fecha: "2026-09-10", recibida_en: "2026-09-10T09:00:00Z", estado: "RECIBIDA" as const,
};

describe("planillas", () => {
  it("traduce los nombres de columna al dominio", async () => {
    const { sb } = doble(ok([FILA_PLANILLA]));
    const [p] = await repositorioPlanillas(sb).listar();
    expect(p).toEqual({
      id: "p1", clienteId: "c1", archivo: "Transferencias.xlsx",
      fecha: "2026-09-10", importadaEn: "2026-09-10T09:00:00Z", estado: "RECIBIDA",
    });
  });

  it("rechaza una fecha inválida antes de escribir", async () => {
    const { sb, llamadas } = doble(ok(FILA_PLANILLA));
    await expect(
      repositorioPlanillas(sb).crear({ clienteId: "c1", archivo: "x.xlsx", fecha: "2026-13-40" }),
    ).rejects.toBeInstanceOf(ErrorValidacion);
    expect(llamadas.op).toBe("");
  });

  it("el mismo archivo del mismo cliente avisa en lugar de duplicar", async () => {
    // En el flujo por correo el mismo adjunto llega varias veces.
    const { sb } = doble(err("duplicate key", "23505"));
    await expect(
      repositorioPlanillas(sb).crear({
        clienteId: "c1", archivo: "x.xlsx", fecha: "2026-09-10", sha256: "a".repeat(64),
      }),
    ).rejects.toThrow(/ya se importó/i);
  });

  it("busca por huella para detectar el reenvío", async () => {
    const { sb, llamadas } = doble(ok(FILA_PLANILLA));
    await repositorioPlanillas(sb).buscarPorHuella("c1", "b".repeat(64));
    expect(llamadas.filtros).toContainEqual(["sha256", "b".repeat(64)]);
  });
});
