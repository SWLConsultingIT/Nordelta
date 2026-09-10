/**
 * Comprobaciones de seguridad que se pueden hacer sin infraestructura.
 *
 * No reemplazan la validación contra una base real —el aislamiento entre
 * organizaciones solo se demuestra con Postgres—, pero cubren la clase de
 * error que se cuela sin que nadie lo note: una clave secreta arrastrada
 * al navegador por una cadena de imports, o una pantalla nueva que quedó
 * sin proteger.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { clavePublicable, faltantes, haySupabase, urlSupabase } from "../src/lib/supabase/config";

const RAIZ = join(import.meta.dirname, "..");

function archivos(dir: string, ext: string[]): string[] {
  const salida: string[] = [];
  const recorrer = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const f = join(d, e.name);
      if (e.isDirectory()) recorrer(f);
      else if (ext.some((x) => e.name.endsWith(x))) salida.push(f);
    }
  };
  recorrer(dir);
  return salida;
}

describe("la clave secreta no puede llegar al navegador", () => {
  const fuentes = archivos(join(RAIZ, "src"), [".ts", ".tsx"]);

  it("solo un archivo la menciona, y está marcado server-only", () => {
    const mencionan = fuentes.filter((f) => {
      const s = readFileSync(f, "utf8");
      return /SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY/.test(s);
    });
    // Uno solo: el cliente de administración. Si aparece otro, hay que
    // mirarlo antes de que lo importe un componente cliente.
    expect(mencionan.map((f) => f.replace(RAIZ + "/", ""))).toEqual([
      "src/lib/supabase/admin.ts",
    ]);
    expect(readFileSync(mencionan[0], "utf8").startsWith('import "server-only"')).toBe(true);
  });

  it("ningún componente cliente importa el cliente de administración", () => {
    const clientes = fuentes.filter((f) => readFileSync(f, "utf8").startsWith('"use client"'));
    for (const f of clientes) {
      const s = readFileSync(f, "utf8");
      expect(s, f).not.toContain("supabase/admin");
      expect(s, f).not.toContain("SUPABASE_SECRET");
    }
  });

  it("los componentes cliente no leen variables de entorno privadas", () => {
    const clientes = fuentes.filter((f) => readFileSync(f, "utf8").startsWith('"use client"'));
    for (const f of clientes) {
      for (const m of readFileSync(f, "utf8").matchAll(/process\.env\.([A-Z_][A-Z0-9_]*)/g)) {
        // NODE_ENV lo inlinea el bundler y no es un secreto.
        expect(
          m[1].startsWith("NEXT_PUBLIC_") || m[1] === "NODE_ENV",
          `${f} lee process.env.${m[1]}`,
        ).toBe(true);
      }
    }
  });
});

describe("el bundle generado", () => {
  const estatico = join(RAIZ, ".next", "static");
  const existe = (() => {
    try { return statSync(estatico).isDirectory(); } catch { return false; }
  })();

  it.skipIf(!existe)("no contiene valores de credenciales", () => {
    const secretos = [
      process.env.SUPABASE_SECRET_KEY,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      process.env.FULLCARGA_USERNAME,
      process.env.FULLCARGA_PASSWORD,
    ].filter((v): v is string => typeof v === "string" && v.length > 6);

    if (secretos.length === 0) return; // nada configurado: nada que filtrar

    for (const f of archivos(estatico, [".js"])) {
      const s = readFileSync(f, "utf8");
      for (const secreto of secretos) {
        expect(s.includes(secreto), `${f} contiene un valor secreto`).toBe(false);
      }
    }
  });
});

describe("resolución de la configuración", () => {
  const env = (v: Record<string, string | undefined>) => v as unknown as NodeJS.ProcessEnv;

  it("acepta el nombre nuevo y el viejo de la clave publicable", () => {
    expect(clavePublicable(env({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "nueva" }))).toBe("nueva");
    expect(clavePublicable(env({ NEXT_PUBLIC_SUPABASE_ANON_KEY: "vieja" }))).toBe("vieja");
  });

  it("prefiere el nombre nuevo cuando están los dos", () => {
    expect(
      clavePublicable(env({
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "nueva",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "vieja",
      })),
    ).toBe("nueva");
  });

  it("acepta la URL pública o la del servidor", () => {
    expect(urlSupabase(env({ SUPABASE_URL: "https://x.supabase.co" }))).toBe("https://x.supabase.co");
  });

  it("sin nada configurado, no hay Supabase", () => {
    expect(haySupabase(env({}))).toBe(false);
  });

  it("informa qué falta por nombre, nunca por valor", () => {
    const falta = faltantes(env({ NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co" }));
    expect(falta).toEqual(["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]);
    // El mensaje no puede contener el valor de nada.
    expect(falta.join(" ")).not.toContain("https://");
  });
});
