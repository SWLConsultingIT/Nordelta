/**
 * Flujo completo contra un servidor simulado.
 *
 * Corre sobre el `ClienteHTTP` real —sockets, cookies, redirecciones,
 * juego de caracteres—, así que lo que se prueba acá es el mismo código que
 * va a correr contra Fullcarga. Lo único simulado es el otro extremo.
 */

import { afterEach, describe, expect, it } from "vitest";
import { DescargadorHTTP } from "../../src/lib/fullcarga/descargador";
import {
  FullcargaAuthenticationError,
  FullcargaDownloadError,
  FullcargaInvalidReportError,
  FullcargaSessionExpiredError,
  FullcargaTokenError,
} from "../../src/lib/fullcarga/errores";
import type { ConfiguracionFullcarga } from "../../src/lib/fullcarga/config";
import {
  CLAVE_VALIDA,
  NOMBRE_ARCHIVO,
  SESION_SIMULADA,
  USUARIO_VALIDO,
  levantarSimulacion,
  type OpcionesSimulacion,
  type Simulacion,
} from "./servidor-simulado";

let simulacion: Simulacion | null = null;

afterEach(async () => {
  await simulacion?.cerrar();
  simulacion = null;
});

async function armar(opciones: OpcionesSimulacion = {}): Promise<DescargadorHTTP> {
  simulacion = await levantarSimulacion(opciones);
  const config: ConfiguracionFullcarga = {
    baseUrl: simulacion.url,
    credenciales: { usuario: USUARIO_VALIDO, password: CLAVE_VALIDA },
  };
  return new DescargadorHTTP(config, { tiempoLimiteMs: 10_000 });
}

describe("camino feliz", () => {
  it("autentica, resuelve el token, pide el informe y descarga el XLS", async () => {
    const descargador = await armar();
    const informe = await descargador.descargarInforme({
      desde: "2026-09-08",
      hasta: "2026-09-08",
      formato: "XLS",
    });

    expect(informe.formatoDetectado).toBe("xls");
    expect(informe.filename).toBe(NOMBRE_ARCHIVO);
    expect(informe.contentType).toBe("application/vnd.ms-excel");
    expect(informe.requestedFrom).toBe("2026-09-08");
    expect(informe.requestedTo).toBe("2026-09-08");
    expect(informe.tamanoBytes).toBeGreaterThan(0);
    expect(informe.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(Date.parse(informe.downloadedAt)).not.toBeNaN();
  });

  it("recorre los pasos en orden, sin pedir dos veces la misma pantalla", async () => {
    const descargador = await armar();
    await descargador.descargarInforme({ desde: "2026-09-08", hasta: "2026-09-08" });

    const rutas = simulacion!.peticiones.map((p) => `${p.metodo} ${p.ruta}`);
    // Cinco peticiones, ni una de más. Pedir dos veces la misma pantalla es
    // lo que Titán interpreta como un F5 y responde «Sesión inhabilitada».
    expect(rutas).toEqual([
      "GET /TITAN/Inicio.html",
      "POST /TITAN/Login.html",
      "GET /TITAN/informeIngresosCreditos.html",
      "POST /TITAN/informeIngresosCreditos.html",
      "GET /TITAN/Informes.html",
    ]);
  });

  it("abre el informe por el enlace del menú, con su token de navegación", async () => {
    const descargador = await armar();
    await descargador.descargarInforme({ desde: "2026-09-08", hasta: "2026-09-08" });

    // El servidor simulado devuelve «Sesión inhabilitada» si el GET llega sin
    // el token, así que llegar al final ya prueba que se usó el enlace real.
    const get = simulacion!.peticiones.find(
      (p) => p.metodo === "GET" && p.ruta === "/TITAN/informeIngresosCreditos.html",
    );
    expect(get).toBeDefined();
    expect(simulacion!.tokenNavegacion).toMatch(/^NAV-/);
  });

  it("avisa con claridad si el menú no ofrece ese informe", async () => {
    const descargador = await armar({ menuSinEnlaceInforme: true });
    await expect(
      descargador.descargarInforme({ desde: "2026-09-08", hasta: "2026-09-08" }),
    ).rejects.toThrow(/no trae el enlace/);
  });

  it("mantiene la cookie de sesión en todas las peticiones posteriores", async () => {
    const descargador = await armar();
    await descargador.descargarInforme({ desde: "2026-09-08", hasta: "2026-09-08" });

    // La primera no puede traerla: es la que la entrega.
    const [primera, ...resto] = simulacion!.peticiones;
    expect(primera.cookie).toBeNull();
    for (const p of resto) {
      expect(p.cookie).toContain(`JSESSIONID=${SESION_SIMULADA}`);
    }
    expect(descargador.cookiesPresentes).toEqual(["JSESSIONID"]);
  });

  it("manda las fechas en DD-MM-YYYY y el formato XLS", async () => {
    const descargador = await armar();
    await descargador.descargarInforme({
      desde: "2026-09-01",
      hasta: "2026-09-08",
      formato: "XLS",
    });

    const post = simulacion!.peticiones.find(
      (p) => p.metodo === "POST" && p.ruta === "/TITAN/informeIngresosCreditos.html",
    );
    expect(post?.cuerpo.get("fechaini")).toBe("01-09-2026");
    expect(post?.cuerpo.get("fechafin")).toBe("08-09-2026");
    expect(post?.cuerpo.get("formato")).toBe("XLS");
    expect(post?.cuerpo.get("submit")).toBe("Aceptar");
  });

  it("reenvía el token vigente y los campos ocultos que emitió el servidor", async () => {
    const descargador = await armar();
    await descargador.descargarInforme({ desde: "2026-09-08", hasta: "2026-09-08" });

    const post = simulacion!.peticiones.find(
      (p) => p.metodo === "POST" && p.ruta === "/TITAN/informeIngresosCreditos.html",
    );
    const { nombre, valor } = simulacion!.tokenActual;
    expect(post?.cuerpo.get(nombre)).toBe(valor);
    expect(post?.cuerpo.get("struts.token.name")).toBe(nombre);
    // Un oculto que no entendemos igual se devuelve.
    expect(post?.cuerpo.get("estadoConsulta")).toBe("inicial");
  });

  it("manda los filtros vacíos que observamos en el formulario real", async () => {
    const descargador = await armar();
    await descargador.descargarInforme({ desde: "2026-09-08", hasta: "2026-09-08" });

    const post = simulacion!.peticiones.find(
      (p) => p.metodo === "POST" && p.ruta === "/TITAN/informeIngresosCreditos.html",
    );
    for (const campo of ["clicod", "__checkbox_jerarquia", "rs", "tarjeta", "banco"]) {
      expect(post?.cuerpo.has(campo)).toBe(true);
    }
  });

  it("acepta filtros propios sin romper el resto del payload", async () => {
    const descargador = await armar();
    await descargador.descargarInforme({
      desde: "2026-09-08",
      hasta: "2026-09-08",
      filtros: { banco: "0072" },
    });

    const post = simulacion!.peticiones.find(
      (p) => p.metodo === "POST" && p.ruta === "/TITAN/informeIngresosCreditos.html",
    );
    expect(post?.cuerpo.get("banco")).toBe("0072");
    expect(post?.cuerpo.get("clicod")).toBe("");
  });

  it("sigue la redirección del login sin perder la sesión", async () => {
    const descargador = await armar({ redirigirTrasIngreso: true });
    const informe = await descargador.descargarInforme({
      desde: "2026-09-08",
      hasta: "2026-09-08",
    });
    expect(informe.formatoDetectado).toBe("xls");
    expect(simulacion!.peticiones.some((p) => p.ruta === "/TITAN/Menu.html")).toBe(true);
  });
});

describe("fallos", () => {
  it("detecta credenciales rechazadas aunque el servidor conteste 200", async () => {
    const descargador = await armar({ rechazarIngreso: true });
    await expect(
      descargador.descargarInforme({ desde: "2026-09-08", hasta: "2026-09-08" }),
    ).rejects.toBeInstanceOf(FullcargaAuthenticationError);
  });

  it("detecta la sesión caída al cargar el formulario", async () => {
    const descargador = await armar({ sesionExpiraEnFormulario: true });
    // El ingreso sí prosperó —el menú llegó bien—; la sesión se cae después.
    // Por eso es sesión expirada y no un fallo de autenticación: son dos
    // incidentes distintos y llevan a dos acciones distintas.
    await expect(
      descargador.descargarInforme({ desde: "2026-09-08", hasta: "2026-09-08" }),
    ).rejects.toBeInstanceOf(FullcargaSessionExpiredError);
  });

  it("falla si el formulario no trae el token", async () => {
    const descargador = await armar({ sinToken: true });
    await expect(
      descargador.descargarInforme({ desde: "2026-09-08", hasta: "2026-09-08" }),
    ).rejects.toBeInstanceOf(FullcargaTokenError);
  });

  it("rechaza HTML devuelto en lugar del XLS", async () => {
    const descargador = await armar({ descargaDevuelveHTML: true });
    await expect(
      descargador.descargarInforme({ desde: "2026-09-08", hasta: "2026-09-08" }),
    ).rejects.toBeInstanceOf(FullcargaInvalidReportError);
  });

  it("rechaza una descarga vacía", async () => {
    const descargador = await armar({ descargaVacia: true });
    await expect(
      descargador.descargarInforme({ desde: "2026-09-08", hasta: "2026-09-08" }),
    ).rejects.toBeInstanceOf(FullcargaInvalidReportError);
  });

  it("rechaza una respuesta que no se declara como descarga", async () => {
    const descargador = await armar({ sinAttachment: true });
    await expect(
      descargador.descargarInforme({ desde: "2026-09-08", hasta: "2026-09-08" }),
    ).rejects.toBeInstanceOf(FullcargaDownloadError);
  });

  it("valida las fechas antes de tocar la red", async () => {
    const descargador = await armar();
    await expect(
      descargador.descargarInforme({ desde: "2026-09-31", hasta: "2026-09-31" }),
    ).rejects.toThrow();
    expect(simulacion!.peticiones).toHaveLength(0);
  });
});

describe("no se filtran secretos", () => {
  it("el informe devuelto no expone cookie, contraseña ni token", async () => {
    const descargador = await armar();
    const informe = await descargador.descargarInforme({
      desde: "2026-09-08",
      hasta: "2026-09-08",
    });

    // Sobre las claves: si mañana alguien agrega un campo con un secreto,
    // esta afirmación lo detecta.
    expect(Object.keys(informe).sort()).toEqual([
      "bytes",
      "contentType",
      "downloadedAt",
      "filename",
      "formatoDetectado",
      "requestedFrom",
      "requestedTo",
      "sha256",
      "tamanoBytes",
    ]);

    const serializado = JSON.stringify({ ...informe, bytes: undefined });
    expect(serializado).not.toContain(SESION_SIMULADA);
    expect(serializado).not.toContain(CLAVE_VALIDA);
    expect(serializado).not.toContain(simulacion!.tokenActual.valor);
  });

  it("ningún mensaje de error incluye la contraseña ni la sesión", async () => {
    const descargador = await armar({ rechazarIngreso: true });
    try {
      await descargador.descargarInforme({ desde: "2026-09-08", hasta: "2026-09-08" });
      expect.unreachable("tenía que fallar");
    } catch (e) {
      const texto = `${(e as Error).message} ${JSON.stringify((e as { contexto?: unknown }).contexto)}`;
      expect(texto).not.toContain(CLAVE_VALIDA);
      expect(texto).not.toContain(SESION_SIMULADA);
    }
  });

  it("los checkpoints no imprimen el valor del token ni la cookie", async () => {
    simulacion = await levantarSimulacion();
    const escrito: string[] = [];
    const descargador = new DescargadorHTTP(
      {
        baseUrl: simulacion.url,
        credenciales: { usuario: USUARIO_VALIDO, password: CLAVE_VALIDA },
      },
      {
        registrador: {
          paso: (p) => escrito.push(p),
          checkpoint: (n, d) => escrito.push(`${n} ${d ?? ""}`),
        },
      },
    );
    await descargador.descargarInforme({ desde: "2026-09-08", hasta: "2026-09-08" });

    const todo = escrito.join("\n");
    expect(todo).not.toContain(simulacion.tokenActual.valor);
    expect(todo).not.toContain(SESION_SIMULADA);
    expect(todo).not.toContain(CLAVE_VALIDA);
    // Pero sí registra lo que sirve para diagnosticar.
    expect(todo).toContain("authentication successful");
    expect(todo).toContain("token extracted");
    expect(todo).toContain("XLS validated");
  });
});
