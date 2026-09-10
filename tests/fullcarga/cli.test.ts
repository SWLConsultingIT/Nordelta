/**
 * El script de línea de comandos.
 *
 * Se ejecuta de verdad, en un proceso aparte. Es la única forma de demostrar
 * lo que importa acá: que **sin `--live` no sale una petición a la red**.
 *
 * El truco para probarlo: se apunta `FULLCARGA_BASE_URL` a un host que no
 * resuelve. Si el modo de ensayo intentara conectarse, fallaría o tardaría;
 * como no lo intenta, termina bien y al instante.
 */

import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const ejecutar = promisify(execFile);
const RAIZ = path.resolve(import.meta.dirname, "../..");
const GUION = path.join(RAIZ, "scripts/fullcarga-poc.mts");

/** Entorno limpio: sin credenciales heredadas de la máquina de quien corre. */
function entornoLimpio(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const base = { ...process.env };
  delete base.FULLCARGA_USERNAME;
  delete base.FULLCARGA_PASSWORD;
  delete base.FULLCARGA_BASE_URL;
  return { ...base, ...extra };
}

async function correr(
  args: string[],
  entorno: NodeJS.ProcessEnv = entornoLimpio(),
): Promise<{ codigo: number; salida: string }> {
  try {
    const { stdout, stderr } = await ejecutar("npx", ["tsx", GUION, ...args], {
      cwd: RAIZ,
      env: entorno,
      timeout: 60_000,
    });
    return { codigo: 0, salida: stdout + stderr };
  } catch (e) {
    const err = e as { code?: number; stdout?: string; stderr?: string };
    return { codigo: err.code ?? 1, salida: (err.stdout ?? "") + (err.stderr ?? "") };
  }
}

describe("modo de ensayo", () => {
  it("describe el flujo completo sin tocar la red", async () => {
    const { codigo, salida } = await correr(
      ["--date", "2026-09-08", "--dry-run"],
      // Host inexistente: si intentara conectarse, se notaría.
      entornoLimpio({ FULLCARGA_BASE_URL: "https://no-existe.invalid/TITAN/" }),
    );

    expect(codigo).toBe(0);
    expect(salida).toContain("[DRY RUN]");
    expect(salida).toContain("POST /TITAN/Login.html");
    expect(salida).toContain("GET /TITAN/informeIngresosCreditos.html");
    expect(salida).toContain("POST /TITAN/informeIngresosCreditos.html");
    expect(salida).toContain("GET /TITAN/Informes.html");
    expect(salida).toContain("08-09-2026");
    expect(salida).toContain("XLS");
    expect(salida).toContain("No se hizo ninguna petición de red.");
  }, 90_000);

  it("es el modo por defecto: sin --live no hay tráfico", async () => {
    const { codigo, salida } = await correr(
      ["--date", "2026-09-08"],
      entornoLimpio({ FULLCARGA_BASE_URL: "https://no-existe.invalid/TITAN/" }),
    );
    expect(codigo).toBe(0);
    expect(salida).toContain("[DRY RUN]");
  }, 90_000);

  it("no imprime credenciales ni cuando están definidas", async () => {
    const { salida } = await correr(
      ["--date", "2026-09-08", "--dry-run"],
      entornoLimpio({
        FULLCARGA_USERNAME: "usuario-secreto",
        FULLCARGA_PASSWORD: "clave-secreta",
      }),
    );
    expect(salida).not.toContain("usuario-secreto");
    expect(salida).not.toContain("clave-secreta");
    expect(salida).toContain("definida");
  }, 90_000);

  it("rechaza una fecha inválida antes de cualquier otra cosa", async () => {
    const { codigo, salida } = await correr(["--date", "2026-02-30", "--dry-run"]);
    expect(codigo).not.toBe(0);
    expect(salida).toContain("CONFIGURACION");
  }, 90_000);

  it("rechaza un rango invertido", async () => {
    const { codigo, salida } = await correr([
      "--from", "2026-09-08", "--to", "2026-09-01", "--dry-run",
    ]);
    expect(codigo).not.toBe(0);
    expect(salida).toContain("invertido");
  }, 90_000);

  it("pide una fecha si no se pasó ninguna", async () => {
    const { codigo, salida } = await correr(["--dry-run"]);
    expect(codigo).not.toBe(0);
    expect(salida).toContain("Falta la fecha");
  }, 90_000);
});

describe("carga de .env.local", () => {
  it("toma las credenciales del archivo, que tsx no lee solo", async () => {
    // Next.js lee .env.local automáticamente; un script con tsx no. Sin la
    // carga explícita, definir las credenciales ahí no tendría efecto.
    const carpeta = await mkdtemp(path.join(tmpdir(), "fullcarga-poc-"));
    try {
      await writeFile(
        path.join(carpeta, ".env.local"),
        "FULLCARGA_USERNAME=usuario-de-archivo\nFULLCARGA_PASSWORD=clave-de-archivo\n",
      );
      const { stdout, stderr } = await ejecutar("npx", ["tsx", GUION, "--date", "2026-09-08", "--dry-run"], {
        cwd: carpeta,
        env: entornoLimpio(),
        timeout: 60_000,
      });
      const salida = stdout + stderr;
      expect(salida).toContain("FULLCARGA_USERNAME  definida");
      expect(salida).toContain("FULLCARGA_PASSWORD  definida");
      // Y sigue sin imprimir los valores.
      expect(salida).not.toContain("usuario-de-archivo");
      expect(salida).not.toContain("clave-de-archivo");
    } finally {
      await rm(carpeta, { recursive: true, force: true });
    }
  }, 90_000);
});

describe("modo en vivo", () => {
  it("falla por configuración ANTES de intentar ninguna petición", async () => {
    // Se corre desde una carpeta vacía a propósito. Si se corriera desde la
    // raíz del repositorio y ahí existiera un `.env.local` con credenciales
    // reales, el script las cargaría y **este test saldría a Internet contra
    // Fullcarga**. Un test que le pega a un tercero es un defecto, no un test.
    const carpeta = await mkdtemp(path.join(tmpdir(), "fullcarga-poc-sin-env-"));
    try {
      const { stdout, stderr } = await ejecutar(
        "npx",
        ["tsx", GUION, "--date", "2026-09-08", "--live"],
        {
          cwd: carpeta,
          // Host que no resuelve: si el orden fuera al revés, el error sería
          // de red y no de configuración.
          env: entornoLimpio({ FULLCARGA_BASE_URL: "https://no-existe.invalid/TITAN/" }),
          timeout: 60_000,
        },
      ).then(
        (r) => r,
        (e: { stdout?: string; stderr?: string }) => ({ stdout: e.stdout ?? "", stderr: e.stderr ?? "" }),
      );
      const salida = stdout + stderr;

      expect(salida).toContain("FullcargaConfigurationError");
      expect(salida).toContain("FULLCARGA_USERNAME");
      expect(salida).toContain("FULLCARGA_PASSWORD");
      expect(salida).not.toContain("FullcargaNetworkError");
      expect(salida).not.toContain("authentication started");
    } finally {
      await rm(carpeta, { recursive: true, force: true });
    }
  }, 90_000);
});
