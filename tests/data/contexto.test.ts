/**
 * Elección del modo de datos.
 *
 * Es una decisión de seguridad y de integridad, no una comodidad: en
 * producción, la ausencia de configuración **no puede** resolverse con un
 * valor por defecto razonable. Un despliegue incompleto que arranca
 * igual es peor que uno que no arranca.
 */

import { describe, expect, it } from "vitest";
import { ErrorConfiguracion, modoDatos } from "../../src/lib/data/contexto";

const env = (v: Record<string, string | undefined>) => v as unknown as NodeJS.ProcessEnv;
const SUPA = {
  NEXT_PUBLIC_SUPABASE_URL: "https://ejemplo.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "clave",
};

describe("en desarrollo", () => {
  it("sin declarar nada, usa el almacén local", () => {
    expect(modoDatos(env({ NODE_ENV: "development" }))).toBe("local");
  });

  it("acepta supabase si está configurado", () => {
    expect(modoDatos(env({ NODE_ENV: "development", DATA_MODE: "supabase", ...SUPA })))
      .toBe("supabase");
  });

  it("rechaza supabase sin credenciales, en vez de caer a local", () => {
    expect(() => modoDatos(env({ NODE_ENV: "development", DATA_MODE: "supabase" })))
      .toThrow(ErrorConfiguracion);
  });
});

describe("en producción falla cerrada", () => {
  it("sin DATA_MODE no asume nada", () => {
    expect(() => modoDatos(env({ NODE_ENV: "production", ...SUPA })))
      .toThrow(/Falta DATA_MODE/);
  });

  it("rechaza el almacén local: no persiste entre despliegues", () => {
    expect(() => modoDatos(env({ NODE_ENV: "production", DATA_MODE: "local" })))
      .toThrow(/no está permitido en producción/);
  });

  it("con supabase configurado, anda", () => {
    expect(modoDatos(env({ NODE_ENV: "production", DATA_MODE: "supabase", ...SUPA })))
      .toBe("supabase");
  });

  it("con supabase declarado y sin credenciales, rompe", () => {
    expect(() => modoDatos(env({ NODE_ENV: "production", DATA_MODE: "supabase" })))
      .toThrow(ErrorConfiguracion);
  });
});

describe("modo demostración hosteable", () => {
  it("vale en producción, porque se pide a propósito", () => {
    // La regla que sigue en pie es otra: una variable **faltante** no
    // puede convertir un despliegue real en una demostración pública.
    expect(modoDatos(env({ NODE_ENV: "production", DATA_MODE: "demo" }))).toBe("demo");
  });

  it("no necesita Supabase ni disco", () => {
    expect(modoDatos(env({ NODE_ENV: "production", DATA_MODE: "demo" }))).toBe("demo");
    expect(modoDatos(env({ NODE_ENV: "development", DATA_MODE: "demo" }))).toBe("demo");
  });

  it("sigue sin poder deducirse: hay que escribirlo", () => {
    expect(() => modoDatos(env({ NODE_ENV: "production" }))).toThrow(/Falta DATA_MODE/);
  });
});

describe("un modo mal escrito no pasa desapercibido", () => {
  it("avisa cuál es el valor inválido", () => {
    expect(() => modoDatos(env({ NODE_ENV: "development", DATA_MODE: "postgres" })))
      .toThrow(/postgres/);
  });

  it("sugiere los válidos", () => {
    expect(() => modoDatos(env({ NODE_ENV: "development", DATA_MODE: "mysql" })))
      .toThrow(/local, demo o supabase/);
  });
});
