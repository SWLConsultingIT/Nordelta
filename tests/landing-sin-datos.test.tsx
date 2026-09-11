/**
 * La portada no puede mostrar información de la operación.
 *
 * Es pública; el producto no lo es. Y la garantía no puede ser que
 * alguien se acuerde de revisarla: hoy los datos de staging son
 * sintéticos, mañana no van a serlo, y nadie va a volver a mirar la
 * portada cuando eso pase.
 *
 * Por eso esto se verifica de dos maneras:
 *
 *   1. **Estructural** — el árbol de la portada no importa nada de la
 *      capa de datos, así que no hay por dónde entre un dato real.
 *   2. **Léxica** — no aparecen palabras ni formas de número que
 *      pertenecen a la operación, para que tampoco se filtren copiados a
 *      mano.
 *
 * La primera es la que importa. La segunda atrapa el descuido.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(import.meta.dirname, "..");

/** Todo lo que se renderiza en la portada. */
const ARBOL = [
  join(RAIZ, "src", "app", "(marketing)"),
  join(RAIZ, "src", "components", "marketing"),
];

function fuentes(): { ruta: string; texto: string }[] {
  const salida: { ruta: string; texto: string }[] = [];
  const recorrer = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const f = join(dir, e.name);
      if (e.isDirectory()) recorrer(f);
      else if (/\.tsx?$/.test(e.name)) {
        salida.push({ ruta: f.replace(RAIZ + "/", ""), texto: readFileSync(f, "utf8") });
      }
    }
  };
  for (const d of ARBOL) recorrer(d);
  return salida;
}

const ARCHIVOS = fuentes();

describe("la portada existe y es lo que creemos", () => {
  it("tiene archivos que revisar", () => {
    expect(ARCHIVOS.length).toBeGreaterThan(0);
  });
});

describe("no puede llegar a los datos", () => {
  /**
   * Módulos prohibidos: todo lo que sabe de la operación, directa o
   * indirectamente. Si algún día la portada necesita uno de estos, el
   * test falla y la conversación pasa a ser explícita.
   */
  const PROHIBIDOS = [
    "lib/data",
    "lib/operaciones",
    "lib/conciliacion",
    "lib/fullcarga",
    "lib/planillas",
    "lib/servicios",
    "lib/supabase",
    "lib/auth",
    "lib/domain",
    "dataset",
  ];

  it("no importa ningún módulo de datos", () => {
    for (const { ruta, texto } of ARCHIVOS) {
      for (const m of texto.matchAll(/from\s+["']([^"']+)["']/g)) {
        const destino = m[1];
        for (const prohibido of PROHIBIDOS) {
          expect(
            destino.includes(prohibido),
            `${ruta} importa "${destino}", que sabe de la operación`,
          ).toBe(false);
        }
      }
    }
  });

  it("no consulta nada: ni repositorios, ni fetch, ni base", () => {
    for (const { ruta, texto } of ARCHIVOS) {
      for (const señal of ["repositorios(", "createClient(", "await fetch(", ".from("]) {
        expect(texto.includes(señal), `${ruta} contiene ${señal}`).toBe(false);
      }
    }
  });

  it("es estática: sin server actions ni renderizado dinámico", () => {
    for (const { ruta, texto } of ARCHIVOS) {
      expect(texto.includes('"use server"'), ruta).toBe(false);
      expect(texto.includes("force-dynamic"), ruta).toBe(false);
    }
  });
});

describe("no nombra nada de la operación", () => {
  /**
   * Vocabulario que pertenece adentro de la aplicación.
   *
   * Son nombres propios y términos del negocio: sistemas con los que se
   * integra, tipos de documento, clientes. Nombrarlos en una página
   * pública dice cómo trabaja la empresa.
   *
   * **Un rótulo de interfaz sin valor no está acá y no debería estarlo.**
   * «Requieren atención» seguido de un guion no revela nada: describe
   * una columna, no un dato. Lo que revela es el número.
   */
  const PALABRAS = [
    "Fullcarga", "Titán",
    "CUIT", "DNI",
    "Padel Pro Norte", "Gimnasio Lomas", "Academia Sur", "Club del Río",
    "Centro Deportivo Este", "Lucas Padel",
    "acreditación", "acreditaciones", "depositante",
    "matching", "match ambiguo", "posible duplicado",
  ];

  it("no aparece ninguna", () => {
    for (const { ruta, texto } of ARCHIVOS) {
      // Se ignoran los comentarios: explican por qué no hay datos y
      // necesitan poder nombrar lo que no se muestra.
      const sinComentarios = texto
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      for (const palabra of PALABRAS) {
        expect(
          new RegExp(palabra, "i").test(sinComentarios),
          `${ruta} menciona "${palabra}"`,
        ).toBe(false);
      }
    }
  });
});

describe("no muestra ninguna cifra de la operación", () => {
  /**
   * El texto que de verdad se ve.
   *
   * Se extraen los nodos de texto de JSX —lo que queda entre `>` y `<`—
   * en lugar de mirar el archivo entero. La diferencia importa: los
   * anchos de las barras del preview son porcentajes de CSS, no datos, y
   * un control que los confunde con cifras de la operación termina
   * ignorándose, que es peor que no tenerlo.
   */
  const textoVisible = (fuente: string) => {
    const limpio = fuente
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    return [...limpio.matchAll(/>([^<>{}]+)</g)]
      .map((m) => m[1].trim())
      .filter(Boolean)
      .join(" · ");
  };

  it("sin importes", () => {
    for (const { ruta, texto } of ARCHIVOS) {
      expect(/\$\s?[\d.]/.test(textoVisible(texto)), `${ruta} muestra un importe`).toBe(false);
    }
  });

  it("sin porcentajes", () => {
    for (const { ruta, texto } of ARCHIVOS) {
      expect(/\d[\d.,]*\s?%/.test(textoVisible(texto)), `${ruta} muestra un porcentaje`)
        .toBe(false);
    }
  });

  it("sin cantidades", () => {
    for (const { ruta, texto } of ARCHIVOS) {
      // Dos dígitos seguidos o más, en texto visible, ya es una cifra.
      const hallazgos = [...textoVisible(texto).matchAll(/(?<![\w.-])\d{2,}(?![\w.-])/g)]
        .map((m) => m[0]);
      expect(hallazgos, `${ruta} muestra ${hallazgos.join(", ")}`).toEqual([]);
    }
  });
});

describe("lo que el preview realmente renderiza", () => {
  it("no contiene un solo dígito", async () => {
    // La prueba más directa: se renderiza el componente y se mira el
    // texto resultante. Si algún día alguien le pasa datos, esto falla.
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { VentanaNord, DetalleOscuro } = await import(
      "../src/components/marketing/VentanaNord"
    );

    for (const [nombre, Componente] of [
      ["VentanaNord", VentanaNord],
      ["DetalleOscuro", DetalleOscuro],
    ] as const) {
      const html = renderToStaticMarkup(<Componente />);
      const visible = html
        // Fuera los atributos: ahí viven los anchos y las clases.
        .replace(/<[^>]*>/g, " ")
        .replace(/&[a-z]+;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      expect(/\d/.test(visible), `${nombre} renderiza "${visible}"`).toBe(false);
    }
  });
});
