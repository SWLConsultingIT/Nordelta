/**
 * Imprimir el one-pager, y comprobar que salió bien.
 *
 * Usa el Chrome que ya está instalado, por el protocolo de depuración. No
 * agrega una dependencia de npm para generar PDF, que para un documento de
 * una página sería traer una imprenta entera.
 *
 * La parte que importa es la segunda: **que el archivo exista no es que el
 * reporte esté bien**. Un one-pager que se fue a dos hojas, o al que se le
 * cortó la última viñeta, es peor que ninguno, porque se manda igual. Por
 * eso se mide antes de imprimir —en el navegador, donde se puede— y se
 * verifica después sobre el PDF ya escrito.
 */

import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { A4 } from "./documento";

const CHROME =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

export interface Diagnostico {
  altoDelContenido: number;
  altoDisponible: number;
  entraEnUnaPagina: boolean;
  /** Elementos cuyo contenido no entra en su caja: texto cortado. */
  recortados: string[];
  /** Elementos que se salen de la hoja. */
  desbordados: string[];
  paginas: number | null;
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Cliente mínimo del protocolo de Chrome sobre el WebSocket de Node. */
async function conectar(puerto: number) {
  let url: string | undefined;
  for (let i = 0; i < 60 && !url; i++) {
    try {
      const pestañas = (await (await fetch(`http://127.0.0.1:${puerto}/json/list`)).json()) as {
        type: string;
        webSocketDebuggerUrl: string;
      }[];
      url = pestañas.find((p) => p.type === "page")?.webSocketDebuggerUrl;
    } catch {
      /* Chrome todavía no levantó. */
    }
    if (!url) await esperar(250);
  }
  if (!url) throw new Error("No se pudo hablar con Chrome.");

  const socket = new WebSocket(url);
  await new Promise((r) => socket.addEventListener("open", r, { once: true }));

  let id = 0;
  const pendientes = new Map<number, (m: { error?: { message: string }; result: unknown }) => void>();
  socket.addEventListener("message", (e) => {
    const m = JSON.parse(String(e.data));
    const resolver = pendientes.get(m.id);
    if (resolver) {
      pendientes.delete(m.id);
      resolver(m);
    }
  });

  const cmd = <T>(method: string, params: Record<string, unknown> = {}): Promise<T> =>
    new Promise((res, rej) => {
      const n = ++id;
      pendientes.set(n, (m) =>
        m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result as T),
      );
      socket.send(JSON.stringify({ id: n, method, params }));
    });

  return { cmd, cerrar: () => socket.close() };
}

/**
 * Cuántas páginas tiene el PDF.
 *
 * Se lee del árbol de páginas del propio archivo (`/Type /Pages … /Count N`)
 * y, si eso no aparece, contando los objetos de página. Devuelve `null` si
 * ninguna de las dos cosas se puede afirmar, que es más honesto que
 * devolver 1 por omisión.
 */
export function contarPaginas(pdf: Buffer): number | null {
  const texto = pdf.toString("latin1");

  const porArbol = [...texto.matchAll(/\/Type\s*\/Pages[^>]*?\/Count\s+(\d+)/g)].map((m) =>
    Number(m[1]),
  );
  if (porArbol.length > 0) return Math.max(...porArbol);

  const porObjeto = [...texto.matchAll(/\/Type\s*\/Page[^s]/g)].length;
  return porObjeto > 0 ? porObjeto : null;
}

export async function generarPdf(
  documento: string,
  destino: string,
): Promise<Diagnostico> {
  mkdirSync(dirname(destino), { recursive: true });

  const puerto = 9350 + Math.floor(Math.random() * 40);
  const perfil = join(process.env.TMPDIR ?? "/tmp", `chrome-reporte-${puerto}`);
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${puerto}`,
      `--user-data-dir=${perfil}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  try {
    const { cmd, cerrar } = await conectar(puerto);
    await cmd("Page.enable");
    await cmd("Runtime.enable");
    await cmd("Emulation.setDeviceMetricsOverride", {
      width: A4.ancho,
      height: A4.alto,
      deviceScaleFactor: 1,
      mobile: false,
    });

    // Se carga el HTML directamente: sin archivo temporal y sin servidor.
    const { frameTree } = await cmd<{ frameTree: { frame: { id: string } } }>(
      "Page.getFrameTree",
    );
    await cmd("Page.setDocumentContent", { frameId: frameTree.frame.id, html: documento });
    await esperar(500);

    // ── Medición, antes de imprimir ──
    const { result } = await cmd<{ result: { value: Omit<Diagnostico, "paginas"> } }>(
      "Runtime.evaluate",
      {
        returnByValue: true,
        expression: `
        (function () {
          var hoja = document.querySelector(".hoja");
          var limite = ${A4.alto};
          // El alto REAL del contenido, no el de la hoja.
          //
          // La hoja tiene alto fijo —lo necesita para imprimirse— así que
          // preguntarle cuánto mide devuelve siempre el alto de una A4 y la
          // comprobación no comprueba nada. Se la suelta un instante, se
          // mide, y se la vuelve a fijar.
          var fijo = hoja.style.height;
          hoja.style.height = "auto";
          void hoja.offsetHeight;
          var natural = Math.ceil(hoja.getBoundingClientRect().height);
          hoja.style.height = fijo;
          void hoja.offsetHeight;
          var recortados = [], desbordados = [];
          document.querySelectorAll(".hoja *").forEach(function (e) {
            var nombre = e.tagName.toLowerCase() + (e.className ? "." + String(e.className).split(" ")[0] : "");
            // Texto que no entra en su propia caja.
            if (e.scrollHeight > e.clientHeight + 1 && getComputedStyle(e).overflow !== "visible") {
              recortados.push(nombre);
            }
            var c = e.getBoundingClientRect();
            if (c.bottom > limite + 1 || c.right > ${A4.ancho} + 1) desbordados.push(nombre);
          });
          return {
            altoDelContenido: natural,
            altoDisponible: limite,
            entraEnUnaPagina: natural <= limite + 1,
            recortados: recortados,
            desbordados: desbordados
          };
        })()`,
      },
    );

    const { data } = await cmd<{ data: string }>("Page.printToPDF", {
      printBackground: true,
      preferCSSPageSize: true,
      marginTop: 0,
      marginBottom: 0,
      marginLeft: 0,
      marginRight: 0,
      scale: 1,
    });

    const pdf = Buffer.from(data, "base64");
    writeFileSync(destino, pdf);
    cerrar();

    return { ...result.value, paginas: contarPaginas(pdf) };
  } finally {
    chrome.kill();
  }
}

/**
 * Rasteriza la primera página para poder mirarla.
 *
 * Es la última comprobación y la única que ve lo que va a ver el cliente.
 * Si la herramienta del sistema no está, se dice; no se finge que se miró.
 */
export function vistaPrevia(pdf: string, carpeta: string): string | null {
  try {
    mkdirSync(carpeta, { recursive: true });
    execFileSync("qlmanage", ["-t", "-s", "1400", "-o", carpeta, pdf], { stdio: "ignore" });
    const salida = join(carpeta, `${pdf.split("/").pop()}.png`);
    readFileSync(salida);
    return salida;
  } catch {
    return null;
  }
}
