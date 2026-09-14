/**
 * Importar la capa de datos no puede escribir en disco.
 *
 * Esto se rompió en producción y el síntoma no se parecía en nada a la
 * causa: la pantalla decía «A server error occurred» y abajo del todo, en
 * los registros del proveedor, había un `ENOENT` haciendo `mkdir` sobre
 * `/var/task/.data`.
 *
 * Lo que pasaba: el almacén respaldado en archivo se instancia **durante la
 * evaluación del módulo**, y su constructor escribía el estado inicial. La
 * regla que decidía si tocar el disco estaba escrita al revés —«no tocarlo
 * solo si `DATA_MODE=demo`»— así que con `DATA_MODE=supabase`, donde este
 * almacén ni siquiera se usa, igual escribía. En un contenedor de solo
 * lectura eso tumbaba la aplicación entera antes de que corriera una sola
 * función, y no había forma de atraparlo desde ningún lado.
 *
 * `NORD_DATA_DIR` apunta acá a una ruta imposible de crear: es la manera de
 * tener un sistema de archivos de solo lectura dentro de un test.
 */

import { existsSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** No se puede crear un directorio dentro de un dispositivo. */
const IMPOSIBLE = "/dev/null/no-se-puede-escribir";

const original = { ...process.env };

function entorno(vars: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

beforeEach(() => vi.resetModules());

afterEach(() => {
  for (const k of Object.keys(process.env)) if (!(k in original)) delete process.env[k];
  Object.assign(process.env, original);
});

async function importar() {
  return import("../../src/lib/data/almacen-operaciones");
}

describe("el almacén en archivo no toca el disco donde no corresponde", () => {
  it("con DATA_MODE=supabase no escribe, ni siquiera al importarse", async () => {
    entorno({ NODE_ENV: "production", DATA_MODE: "supabase", NORD_DATA_DIR: IMPOSIBLE });
    const m = await importar();
    expect(m.almacenOps.estado.operaciones.length).toBeGreaterThan(0);
    expect(existsSync(IMPOSIBLE)).toBe(false);
  });

  it("con DATA_MODE=demo tampoco", async () => {
    entorno({ NODE_ENV: "production", DATA_MODE: "demo", NORD_DATA_DIR: IMPOSIBLE });
    await expect(importar()).resolves.toBeDefined();
    expect(existsSync(IMPOSIBLE)).toBe(false);
  });

  it("en producción y sin DATA_MODE tampoco", async () => {
    // Es el despliegue a medio configurar. Tiene que fallar por la
    // variable que falta, no por un `mkdir` en un disco de solo lectura.
    entorno({ NODE_ENV: "production", DATA_MODE: undefined, NORD_DATA_DIR: IMPOSIBLE });
    await expect(importar()).resolves.toBeDefined();
    expect(existsSync(IMPOSIBLE)).toBe(false);
  });

  it("en modo local, si el disco no deja escribir, sigue en memoria", async () => {
    // Aunque el modo pida disco, un contenedor de solo lectura o un
    // volumen lleno no pueden tumbar la aplicación.
    entorno({ NODE_ENV: "development", DATA_MODE: "local", NORD_DATA_DIR: IMPOSIBLE });
    const m = await importar();
    expect(() => m.almacenOps.guardar()).not.toThrow();
    expect(m.almacenOps.estado.operaciones.length).toBeGreaterThan(0);
  });
});
