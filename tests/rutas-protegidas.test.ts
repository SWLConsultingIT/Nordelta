/**
 * Ninguna pantalla puede quedar sin proteger por olvido.
 *
 * El proxy tiene una lista de rutas que exigen sesión. Es una lista escrita
 * a mano, y una lista escrita a mano se desactualiza: se agrega una pantalla
 * nueva, se prueba en modo demostración —donde nada bloquea— y queda
 * abierta. Este test compara la lista contra las carpetas reales.
 *
 * El proxy **no es la frontera de seguridad**: esa es la seguridad por fila
 * de Postgres más el `exigirSesion()` de cada Server Action. Pero que una
 * pantalla con datos renderice para un anónimo sigue siendo una filtración.
 */

import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RUTAS_PROTEGIDAS_TEST } from "../src/proxy";

const RAIZ = join(import.meta.dirname, "..", "src", "app");

/** Rutas de primer nivel dentro del grupo de aplicación. */
function rutasDeLaApp(): string[] {
  const base = join(RAIZ, "(app)");
  return readdirSync(base, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("(") && !e.name.startsWith("["))
    .map((e) => `/${e.name}`);
}

describe("cobertura del control de acceso", () => {
  it("toda pantalla de la aplicación está en la lista", () => {
    const sinProteger = rutasDeLaApp().filter((r) => !RUTAS_PROTEGIDAS_TEST.includes(r));
    expect(sinProteger, `Rutas sin proteger en src/proxy.ts: ${sinProteger.join(", ")}`)
      .toEqual([]);
  });

  it("los endpoints de datos también están cubiertos", () => {
    // `/api` cubre por prefijo: la planilla de ejemplo y la exportación
    // devuelven datos y no pueden quedar abiertas.
    expect(RUTAS_PROTEGIDAS_TEST).toContain("/api");
  });

  it("no protege la landing ni el ingreso, que tienen que ser públicos", () => {
    expect(RUTAS_PROTEGIDAS_TEST).not.toContain("/");
    expect(RUTAS_PROTEGIDAS_TEST).not.toContain("/login");
  });
});
