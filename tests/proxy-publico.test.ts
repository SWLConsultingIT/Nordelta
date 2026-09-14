/**
 * Las rutas públicas no pueden depender del backend.
 *
 * La portada y el ingreso son la puerta de entrada: si no cargan, no hay
 * forma de entrar ni de darse cuenta de qué pasó. Tienen que responder con
 * la base caída, con Supabase mal configurado, sin Fullcarga y sin una sola
 * variable de servidor.
 *
 * Esto se rompió de verdad y el síntoma no se parecía a la causa: con
 * `NEXT_PUBLIC_SUPABASE_URL` pegada sin el `https://`, el constructor del
 * cliente tiraba «Invalid supabaseUrl» **dentro del proxy**, y como el proxy
 * corre antes que cualquier página, `/`, `/login` e `/inicio` devolvían 500
 * los tres. Una portada prerenderizada, que no consulta nada, caída por una
 * variable del backend.
 *
 * La regla que queda escrita acá:
 *
 *   · público    → pasa siempre, sin tocar nada;
 *   · protegido  → exige sesión, y si la configuración está rota manda al
 *     ingreso. Falla cerrado, nunca con un 500.
 *
 * Que producción no se degrade sola a demostración se prueba aparte, en
 * `modo.test.ts`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const original = { ...process.env };

/** Variables de una sola prueba. `undefined` borra. */
function entorno(vars: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

/** Todo lo que el proxy podría llegar a mirar, en blanco. */
const SIN_NADA = {
  NEXT_PUBLIC_SUPABASE_URL: undefined,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
  SUPABASE_URL: undefined,
  SUPABASE_SECRET_KEY: undefined,
  DATA_MODE: undefined,
  FULLCARGA_USERNAME: undefined,
  FULLCARGA_PASSWORD: undefined,
  FULLCARGA_BASE_URL: undefined,
};

/** Supabase configurado y sano. */
const SUPABASE_OK = {
  NEXT_PUBLIC_SUPABASE_URL: "https://ejemplo.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_de_prueba",
};

/**
 * Supabase mal cargado: la URL sin esquema.
 *
 * Es el error real, no uno inventado: así queda si alguien copia el host
 * del panel de Supabase sin el `https://`.
 */
const SUPABASE_ROTO = {
  NEXT_PUBLIC_SUPABASE_URL: "ejemplo.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_de_prueba",
};

const pedir = (ruta: string) => new NextRequest(new URL(ruta, "https://nord.example"));

async function correr(ruta: string) {
  const { proxy } = await import("../src/proxy");
  return proxy(pedir(ruta));
}

beforeEach(() => {
  vi.resetModules();
  entorno(SIN_NADA);
});

afterEach(() => {
  vi.restoreAllMocks();
  // Si una prueba falla a mitad de camino, el módulo simulado no puede
  // quedar puesto para la siguiente: se deshace acá y no al final del
  // caso, o un fallo se propaga y esconde cuál era el problema real.
  vi.doUnmock("@supabase/ssr");
  for (const k of Object.keys(process.env)) if (!(k in original)) delete process.env[k];
  Object.assign(process.env, original);
});

const PUBLICAS = ["/", "/login", "/login?volver=%2Finicio", "/manifest.webmanifest"];

describe("las rutas públicas pasan siempre", () => {
  it("sin ninguna variable de entorno", async () => {
    for (const ruta of PUBLICAS) {
      const r = await correr(ruta);
      expect(r.status, ruta).toBe(200);
      expect(r.headers.get("location"), ruta).toBeNull();
    }
  });

  it("con Supabase configurado y sano", async () => {
    entorno(SUPABASE_OK);
    for (const ruta of PUBLICAS) {
      expect((await correr(ruta)).status, ruta).toBe(200);
    }
  });

  it("con Supabase MAL configurado, que es el caso que rompió", async () => {
    entorno(SUPABASE_ROTO);
    for (const ruta of PUBLICAS) {
      // Ni excepción ni redirección: la portada no tiene nada que ver con
      // que una variable del backend esté mal.
      const r = await correr(ruta);
      expect(r.status, ruta).toBe(200);
      expect(r.headers.get("location"), ruta).toBeNull();
    }
  });

  it("sin Fullcarga y sin la clave secreta", async () => {
    entorno({ ...SUPABASE_OK, FULLCARGA_USERNAME: undefined, SUPABASE_SECRET_KEY: undefined });
    expect((await correr("/")).status).toBe(200);
    expect((await correr("/login")).status).toBe(200);
  });

  it("ni siquiera construyen el cliente de Supabase", async () => {
    // La prueba de fondo, y la que hay que mirar si algún día esto se
    // vuelve a romper: no alcanza con que las rutas públicas *respondan*,
    // no pueden **depender** de Supabase para hacerlo.
    //
    // Espiar `fetch` no sirve acá y vale la pena decir por qué: sin cookie
    // de sesión, `getUser()` corta antes de salir a la red, así que un
    // contador de requests en cero también se cumplía con el proxy roto.
    // Lo que distingue una versión de la otra es si el cliente llega a
    // construirse, que es exactamente donde estaba la excepción.
    entorno(SUPABASE_OK);
    const construir = vi.fn(() => {
      throw new Error("una ruta pública construyó el cliente de Supabase");
    });
    vi.doMock("@supabase/ssr", () => ({ createServerClient: construir }));

    for (const ruta of PUBLICAS) {
      expect((await correr(ruta)).status, ruta).toBe(200);
    }
    expect(construir).not.toHaveBeenCalled();
  });
});

describe("las rutas protegidas siguen cerradas", () => {
  const PROTEGIDAS = ["/inicio", "/conciliacion", "/planillas/importar", "/api/export"];

  it("sin sesión mandan al ingreso y recuerdan a dónde iba", async () => {
    entorno(SUPABASE_OK);
    // El servidor de auth contesta que no hay nadie.
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ msg: "no session" }), { status: 401 }),
    );

    for (const ruta of PROTEGIDAS) {
      const r = await correr(ruta);
      expect(r.status, ruta).toBe(307);
      const destino = new URL(r.headers.get("location")!);
      expect(destino.pathname, ruta).toBe("/login");
      expect(destino.searchParams.get("volver"), ruta).toBe(new URL(ruta, "https://x").pathname);
    }
  });

  it("con la configuración rota fallan CERRADAS, no con un 500", async () => {
    entorno(SUPABASE_ROTO);
    for (const ruta of PROTEGIDAS) {
      const r = await correr(ruta);
      expect(r.status, ruta).toBe(307);
      expect(new URL(r.headers.get("location")!).pathname, ruta).toBe("/login");
    }
  });

  it("con el servidor de auth caído también fallan cerradas", async () => {
    entorno(SUPABASE_OK);
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));
    const r = await correr("/inicio");
    expect(r.status).toBe(307);
    expect(new URL(r.headers.get("location")!).pathname).toBe("/login");
  });

  it("sin Supabase configurado no se bloquea: es el modo demostración", async () => {
    // Trabar el acceso sin credenciales dejaría afuera a todo el mundo,
    // incluida la demostración hosteada. Quien controla de verdad es la
    // seguridad por fila y el `exigirSesion()` de cada acción.
    entorno({ ...SIN_NADA, DATA_MODE: "demo" });
    expect((await correr("/inicio")).status).toBe(200);
  });
});

describe("el proxy no conoce el backend", () => {
  it("no menciona Fullcarga, la clave secreta ni los repositorios", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const fuente = readFileSync(join(import.meta.dirname, "..", "src", "proxy.ts"), "utf8");
    const sinComentarios = fuente
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");

    for (const prohibido of [
      "FULLCARGA",
      "SUPABASE_SECRET_KEY",
      "claveSecreta",
      "repositorios",
      "modoDatos",
      "lib/data",
    ]) {
      expect(sinComentarios.includes(prohibido), `proxy.ts menciona ${prohibido}`).toBe(false);
    }
  });
});
