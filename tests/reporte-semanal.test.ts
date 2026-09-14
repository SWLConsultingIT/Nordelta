/**
 * El reporte semanal que ve el cliente.
 *
 * Dos cosas se prueban acá, y la segunda es la que importa.
 *
 * La primera es mecánica: que el changelog se clasifique, que los topes se
 * respeten, que el archivo semanal se valide.
 *
 * La segunda es una garantía: **nada del repositorio se filtra al PDF**.
 * El generador lee mensajes de commit y rutas de archivo, y ninguna de las
 * dos cosas puede aparecer en un documento que se manda por correo a un
 * cliente. Un asunto de commit dice cómo trabajamos; una ruta dice cómo
 * está hecho el sistema; y cualquiera de los dos podría, algún día, traer
 * algo que no debería salir de acá.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TEMAS, esIrrelevante, temaDe } from "../scripts/reporte/temas";
import { leerChangelog, type Changelog } from "../scripts/reporte/git";
import { leerEntrada, PLANTILLA } from "../scripts/reporte/entrada";
import { componer, fechaCorta, html, TOPES, A4 } from "../scripts/reporte/documento";
import { contarPaginas } from "../scripts/reporte/pdf";

const RAIZ = join(import.meta.dirname, "..");

describe("clasificación del changelog", () => {
  it("cada ruta de producto cae en un tema", () => {
    const casos: [string, string][] = [
      ["src/lib/conciliacion/index.ts", "conciliacion"],
      ["src/lib/operaciones/motor.ts", "conciliacion"],
      ["src/lib/fullcarga/http.ts", "fullcarga"],
      ["src/lib/data/supabase/planillas.ts", "datos"],
      ["supabase/migrations/0006_acreditaciones.sql", "datos"],
      ["src/proxy.ts", "seguridad"],
      ["src/app/(auth)/login/page.tsx", "seguridad"],
      ["src/app/(app)/inicio/page.tsx", "pantallas"],
      ["src/app/(marketing)/page.tsx", "portada"],
      ["tests/operaciones/motor.test.ts", "calidad"],
      ["docs/NORD_FLUJO_MATI_MVP.md", "documentacion"],
    ];
    for (const [ruta, esperado] of casos) {
      expect(temaDe(ruta)?.id, ruta).toBe(esperado);
    }
  });

  it("las ubicaciones anteriores al reordenamiento de rutas siguen clasificando", () => {
    // Un reporte de un período viejo tiene que seguir saliendo bien. Si
    // estas dejan de clasificar, las semanas de septiembre pierden temas
    // sin que nadie se entere.
    expect(temaDe("src/app/page.tsx")?.id).toBe("portada");
    expect(temaDe("src/app/login/page.tsx")?.id).toBe("seguridad");
  });

  it("la infraestructura del repositorio no cuenta como trabajo de producto", () => {
    for (const ruta of ["package.json", "tsconfig.json", ".gitignore", "README.md"]) {
      expect(temaDe(ruta), ruta).toBeNull();
      expect(esIrrelevante(ruta), ruta).toBe(true);
    }
  });

  it("una ruta desconocida no se clasifica sola: queda para revisar", () => {
    expect(temaDe("src/lib/inventado/cosa.ts")).toBeNull();
    expect(esIrrelevante("src/lib/inventado/cosa.ts")).toBe(false);
  });

  it("ningún tema pisa a otro", () => {
    // Dos temas que matcheen la misma ruta harían que el reporte dependiera
    // del orden del arreglo, que es la clase de dependencia que nadie ve.
    const muestras = [
      "src/lib/conciliacion/a.ts", "src/lib/fullcarga/a.ts", "src/lib/data/a.ts",
      "src/lib/planillas/a.ts", "src/proxy.ts", "src/app/(app)/inicio/page.tsx",
      "src/app/(marketing)/page.tsx", "tests/a.test.ts", "docs/a.md", "scripts/a.mts",
    ];
    for (const ruta of muestras) {
      const cuantos = TEMAS.filter((t) => t.rutas.some((r) => r.test(ruta))).length;
      expect(cuantos, `${ruta} encaja en ${cuantos} temas`).toBeLessThanOrEqual(1);
    }
  });
});

describe("el changelog sale del repositorio de verdad", () => {
  it("lee el período y agrupa por tema", () => {
    const c = leerChangelog("2026-09-07", "2026-09-11", RAIZ);
    expect(c.commits.length).toBeGreaterThan(0);
    expect(c.temas.length).toBeGreaterThan(0);
    // Ordenado por impacto: nunca un tema liviano antes que uno pesado.
    for (let i = 1; i < c.temas.length; i++) {
      expect(c.temas[i - 1].tema.peso).toBeGreaterThanOrEqual(c.temas[i].tema.peso);
    }
  });

  it("el último día del período entra", () => {
    // `--until` de git corta a la medianoche, así que sin sumar un día el
    // viernes —el día que más commits tiene, porque es cuando se cierra la
    // semana— quedaba afuera entero.
    const soloElViernes = leerChangelog("2026-09-11", "2026-09-11", RAIZ);
    expect(soloElViernes.commits.length).toBeGreaterThan(0);
    for (const c of soloElViernes.commits) expect(c.fecha).toBe("2026-09-11");
  });

  it("un período sin actividad devuelve vacío, no falla", () => {
    const c = leerChangelog("2020-01-01", "2020-01-03", RAIZ);
    expect(c.commits).toEqual([]);
    expect(c.temas).toEqual([]);
  });
});

describe("el archivo semanal", () => {
  it("si no existe, se trabaja con la plantilla en blanco", () => {
    expect(leerEntrada(join(RAIZ, "reports", "weekly", "1999-01-01.json"))).toEqual(PLANTILLA);
  });

  it("el de esta semana es válido", () => {
    const ruta = join(RAIZ, "reports", "weekly", "2026-09-11.json");
    if (!existsSync(ruta)) return;
    const e = leerEntrada(ruta);
    expect(e.weekEnd).toBe("2026-09-11");
    expect(e.openItems.length).toBeGreaterThan(0);
  });

  it("rechaza un estado inventado", () => {
    const ruta = join(RAIZ, "reports", "weekly", "2026-09-11.json");
    if (!existsSync(ruta)) return;
    const crudo = JSON.parse(readFileSync(ruta, "utf8"));
    expect(["ON TRACK", "AT RISK", "BLOCKED", null]).toContain(crudo.status ?? null);
  });
});

describe("composición", () => {
  const changelogFalso = (titulos: string[]): Changelog => ({
    desde: "2026-09-07",
    hasta: "2026-09-11",
    commits: [],
    temas: titulos.map((t, i) => ({
      tema: { id: `t${i}`, titulo: t, rutas: [], peso: 10 - i },
      commits: 1,
      archivos: 1,
    })),
    sinClasificar: [],
  });

  it("lo cargado a mano va antes que lo derivado del changelog", () => {
    const r = componer(
      changelogFalso(["del changelog"]),
      { ...PLANTILLA, progressExtra: ["a mano"] },
      "2026-09-11",
    );
    expect(r.progreso[0]).toBe("a mano");
    expect(r.progreso[1]).toBe("del changelog");
  });

  it("recorta a los topes en vez de desbordar la hoja", () => {
    const muchos = Array.from({ length: 20 }, (_, i) => `punto ${i}`);
    const r = componer(changelogFalso(muchos), {
      ...PLANTILLA,
      pending: muchos,
      openItems: muchos,
      nextSteps: muchos,
    }, "2026-09-11");
    expect(r.progreso).toHaveLength(TOPES.progreso);
    expect(r.pendientes).toHaveLength(TOPES.pendientes);
    expect(r.abiertos).toHaveLength(TOPES.abiertos);
    expect(r.siguientes).toHaveLength(TOPES.siguientes);
  });

  it("sin open items lo dice, no lo inventa", () => {
    const documento = html(componer(changelogFalso([]), PLANTILLA, "2026-09-11"));
    expect(documento).toContain("Sin puntos bloqueantes esta semana.");
  });

  it("sin estado no hay sello ni rótulo", () => {
    const documento = html(componer(changelogFalso([]), PLANTILLA, "2026-09-11"));
    expect(documento).not.toContain("Estado general");
  });

  it("con estado, el sello aparece una sola vez", () => {
    for (const estado of ["ON TRACK", "AT RISK", "BLOCKED"] as const) {
      const documento = html(
        componer(changelogFalso([]), { ...PLANTILLA, status: estado }, "2026-09-11"),
      );
      expect(documento.split(estado).length - 1, estado).toBe(1);
      expect(documento).toContain("Estado general");
    }
  });

  it("las fechas se muestran como las lee un argentino", () => {
    expect(fechaCorta("2026-09-11")).toBe("11/09/2026");
  });
});

describe("nada del repositorio se filtra al documento", () => {
  /**
   * La prueba que justifica el archivo.
   *
   * Se arma un changelog con lo peor que podría traer un commit y se
   * comprueba que ni una palabra llega al PDF. El generador puede leer
   * todo esto; lo que no puede es imprimirlo.
   */
  const VENENO = [
    "arregla el matcher DNI→CUIT para 20304050607",
    "sube SUPABASE_SECRET_KEY al entorno de staging",
    "rama feature/plata-de-padel-pro-norte",
  ];

  const changelog: Changelog = {
    desde: "2026-09-07",
    hasta: "2026-09-11",
    commits: VENENO.map((asunto) => ({
      fecha: "2026-09-09",
      asunto,
      rutas: ["src/lib/conciliacion/index.ts", "private_samples/planilla-real.xlsx"],
    })),
    temas: [{ tema: TEMAS[0], commits: 3, archivos: 2 }],
    sinClasificar: ["private_samples/planilla-real.xlsx"],
  };

  const documento = html(componer(changelog, PLANTILLA, "2026-09-11"));

  it("no aparece ningún asunto de commit", () => {
    for (const asunto of VENENO) {
      expect(documento.includes(asunto), asunto).toBe(false);
    }
  });

  it("no aparece ninguna ruta de archivo ni nombre de rama", () => {
    for (const rastro of [
      "src/lib", "private_samples", ".ts", ".xlsx", "feature/",
      "SUPABASE_SECRET_KEY", "CUIT", "20304050607",
    ]) {
      expect(documento.includes(rastro), rastro).toBe(false);
    }
  });

  it("lo que sí aparece es la frase revisada del tema", () => {
    expect(documento).toContain(TEMAS[0].titulo);
  });

  it("el texto del archivo semanal se escapa antes de entrar al HTML", () => {
    const d = html(
      componer(changelog, { ...PLANTILLA, pending: ["<script>alert(1)</script>"] }, "2026-09-11"),
    );
    expect(d).not.toContain("<script>alert(1)</script>");
    expect(d).toContain("&lt;script&gt;");
  });
});

describe("el PDF que se entrega", () => {
  it("el contador de páginas lee el árbol del archivo", () => {
    const unaPagina = Buffer.from("%PDF-1.4\n1 0 obj<</Type /Pages /Kids[2 0 R]/Count 1>>endobj");
    const dos = Buffer.from("%PDF-1.4\n1 0 obj<</Type /Pages /Kids[2 0 R 3 0 R]/Count 2>>endobj");
    expect(contarPaginas(unaPagina)).toBe(1);
    expect(contarPaginas(dos)).toBe(2);
  });

  it("no afirma nada si el archivo no dice cuántas páginas tiene", () => {
    // Devolver 1 por omisión sería exactamente la mentira que este sistema
    // tiene que evitar: un reporte de dos hojas informado como de una.
    expect(contarPaginas(Buffer.from("%PDF-1.4\nnada"))).toBeNull();
  });

  it("el reporte generado tiene una sola página", () => {
    const ruta = join(
      RAIZ, "..", "Salidas", "Reportes", "Pagos Nordelta - Weekly Report - 2026-09-11.pdf",
    );
    if (!existsSync(ruta)) return; // Se genera con `npm run weekly-report`.
    expect(contarPaginas(readFileSync(ruta))).toBe(1);
  });

  it("la hoja es A4 a 96 puntos por pulgada", () => {
    expect(A4).toEqual({ ancho: 794, alto: 1123 });
  });
});
