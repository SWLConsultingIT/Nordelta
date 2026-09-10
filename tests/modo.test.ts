/**
 * Modo demostración contra modo real.
 *
 * Lo que se prueba acá es una decisión de seguridad, no una preferencia: en
 * producción, una variable de entorno faltante **no puede** convertir la
 * aplicación en una demostración pública con sesión ficticia.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const entorno = (vars: Record<string, string | undefined>) => {
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
};

const original = { ...process.env };

beforeEach(() => vi.resetModules());
afterEach(() => {
  for (const k of Object.keys(process.env)) if (!(k in original)) delete process.env[k];
  Object.assign(process.env, original);
});

async function cargar() {
  return (await import("../src/lib/data")) as typeof import("../src/lib/data");
}

describe("cuándo hay modo demostración", () => {
  it("en desarrollo y sin Supabase, sí", async () => {
    entorno({
      NODE_ENV: "development",
      DATA_MODE: undefined,
      NEXT_PUBLIC_SUPABASE_URL: undefined,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
    });
    const m = await cargar();
    expect(m.esDemo).toBe(true);
    expect(m.usaSupabase).toBe(false);
  });

  it("en producción y sin Supabase, NO", async () => {
    // Es el caso peligroso: un despliegue al que le falta una variable.
    // Antes se degradaba a demostración pública; ahora tiene que romper.
    entorno({
      NODE_ENV: "production",
      DATA_MODE: undefined,
      NEXT_PUBLIC_SUPABASE_URL: undefined,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
    });
    const m = await cargar();
    expect(m.esDemo).toBe(false);
  });

  it("en producción SÍ vale si se pide explícitamente", async () => {
    // Cambio deliberado respecto de la iteración anterior: hace falta
    // poder hostear una demostración con el producto real. Lo que sigue
    // prohibido es **deducirla**, que es el caso peligroso.
    entorno({
      NODE_ENV: "production",
      DATA_MODE: "demo",
      NEXT_PUBLIC_SUPABASE_URL: undefined,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
    });
    expect((await cargar()).esDemo).toBe(true);
  });

  it("con Supabase configurado en desarrollo, se puede pedir la demostración", async () => {
    entorno({
      NODE_ENV: "development",
      DATA_MODE: "demo",
      NEXT_PUBLIC_SUPABASE_URL: "https://ejemplo.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "clave-de-prueba",
    });
    const m = await cargar();
    expect(m.usaSupabase).toBe(true);
    expect(m.esDemo).toBe(true);
  });

  it("con Supabase y sin pedirla, no hay demostración", async () => {
    entorno({
      NODE_ENV: "development",
      DATA_MODE: undefined,
      NEXT_PUBLIC_SUPABASE_URL: "https://ejemplo.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "clave-de-prueba",
    });
    expect((await cargar()).esDemo).toBe(false);
  });
});

describe("la sesión ficticia solo existe en la demostración", () => {
  it("sin demostración y sin Supabase no hay sesión", async () => {
    entorno({
      NODE_ENV: "production",
      DATA_MODE: undefined,
      NEXT_PUBLIC_SUPABASE_URL: undefined,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
    });
    const { sesionActual } = await import("../src/lib/auth");
    expect(await sesionActual()).toBeNull();
  });

  it("en la demostración la sesión viene marcada como tal", async () => {
    entorno({
      NODE_ENV: "development",
      DATA_MODE: undefined,
      NEXT_PUBLIC_SUPABASE_URL: undefined,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
    });
    const { sesionActual } = await import("../src/lib/auth");
    const s = await sesionActual();
    expect(s?.demo).toBe(true);
  });
});
