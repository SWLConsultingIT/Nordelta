/**
 * Fullcarga sin configurar.
 *
 * Es el estado por defecto de cualquier entorno nuevo —y el de Vercel,
 * donde las credenciales no van a estar— así que **no puede ser un
 * error**. La aplicación tiene que seguir funcionando con lo que ya
 * tiene en el pozo y decir que la integración no está conectada.
 */

import { describe, expect, it } from "vitest";
import { hayCredenciales, leerConfiguracion, describir } from "../../src/lib/fullcarga/config";

const entorno = (v: Record<string, string | undefined>) => v as unknown as NodeJS.ProcessEnv;

describe("sin credenciales", () => {
  it("se detecta sin mirar ningún valor", () => {
    expect(hayCredenciales(entorno({}))).toBe(false);
    expect(hayCredenciales(entorno({ FULLCARGA_USERNAME: "x" }))).toBe(false);
    expect(hayCredenciales(entorno({ FULLCARGA_PASSWORD: "x" }))).toBe(false);
  });

  it("con las dos, sí", () => {
    expect(hayCredenciales(entorno({ FULLCARGA_USERNAME: "u", FULLCARGA_PASSWORD: "p" })))
      .toBe(true);
  });

  it("leer la configuración sin credenciales falla de forma explícita", () => {
    // Falla acá, antes de tocar la red, y no a mitad de una descarga.
    expect(() => leerConfiguracion(entorno({}))).toThrow();
  });

  it("el diagnóstico nunca imprime un valor", () => {
    const texto = describir(entorno({
      FULLCARGA_USERNAME: "usuario-secreto",
      FULLCARGA_PASSWORD: "clave-secreta",
      FULLCARGA_BASE_URL: "https://ejemplo.com/",
    }));
    expect(texto).not.toContain("usuario-secreto");
    expect(texto).not.toContain("clave-secreta");
    expect(texto).toMatch(/definida/i);
  });
});
