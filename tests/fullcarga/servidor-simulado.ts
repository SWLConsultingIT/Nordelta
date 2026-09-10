/**
 * Servidor que imita a Titán, para probar el flujo completo sin tocar
 * Fullcarga.
 *
 * Es un `node:http` de verdad en `127.0.0.1` con puerto efímero, no un doble
 * de `fetch`. La diferencia importa: así el test ejercita el cliente HTTP
 * real —cookies, redirecciones, juego de caracteres, cabeceras— que es
 * justamente la parte que puede fallar en vivo.
 *
 * Todo lo que hay acá es **sintético**. No sale ningún dato de Fullcarga ni
 * de Nordelta: el XLS es un archivo OLE2 mínimo fabricado a mano, las
 * credenciales son de juguete y el token es inventado en cada corrida.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { AddressInfo } from "node:net";

export const USUARIO_VALIDO = "usuario-de-prueba";
export const CLAVE_VALIDA = "clave-de-prueba";
export const SESION_SIMULADA = "sesion-simulada-0001";

/**
 * Un archivo con firma OLE2 y relleno. No es un Excel que Excel pueda abrir
 * —no hace falta— pero tiene la firma que el validador comprueba.
 */
export function xlsSintetico(relleno = 2048): Buffer {
  const firma = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  return Buffer.concat([firma, Buffer.alloc(relleno, 0x20)]);
}

export const NOMBRE_ARCHIVO = "Informe Movimiento de Saldos 08-09-2026.xls";

/** HTML de la pantalla de ingreso, calcado en estructura del real. */
export function htmlIngreso(): string {
  return `<!DOCTYPE html><html><head><title>TITAN</title></head><body>
    <form id="theForm" name="frm" action="/TITAN/Login.html" method="post">
      <input type="hidden" name="topUp" value="false"/>
      <input type="hidden" name="topUpAdquirencia" value="false"/>
      <input type="hidden" name="version" value=""/>
      <input type="text" id="id_nombre" name="usuario" maxlength="100"/>
      <input type="password" id="id_pass" name="password" class="keyboardInput1"/>
      <input type="submit" value="Entrar"/>
    </form></body></html>`;
}

/**
 * Menú posterior al ingreso.
 *
 * Modela lo observado en Titán: **cada enlace lleva su propio token de
 * navegación en la query**, escapado como `&amp;`. Pedir la ruta pelada no
 * funciona.
 */
export function htmlMenu(tokenNavegacion: string, conEnlaceInforme = true): string {
  const enlace = conEnlaceInforme
    ? `<a href="/TITAN/informeIngresosCreditos.html?struts.token.name=token&amp;token=${tokenNavegacion}">Ingresos y Créditos</a>`
    : "";
  return `<!DOCTYPE html><html><head><title>:: TITAN :: Fullcarga</title></head><body>
    <a href="/TITAN/MenuInformes.html?struts.token.name=token&amp;token=${tokenNavegacion}">Informes</a>
    ${enlace}
    </body></html>`;
}

/** La pantalla que Titán devuelve cuando el token de navegación no cuadra. */
export function htmlSesionInhabilitada(): string {
  return `<!DOCTYPE html><html><head><title>:: TITAN :: Fullcarga</title></head><body>
    <h1>Sesión inhabilitada</h1>
    <p>La sesión ha sido inhabilitada por una de las siguientes circunstancias.</p>
    <a href="Inicio.html?dirStyl=cfc">Volver</a>
    </body></html>`;
}

/** Formulario del informe, con la indirección del token de Struts. */
export function htmlFormularioInforme(nombreToken: string, valorToken: string): string {
  return `<!DOCTYPE html><html><head><title>Informe</title></head><body>
    <form action="/TITAN/informeIngresosCreditos.html" method="post">
      <input type="hidden" name="struts.token.name" value="${nombreToken}"/>
      <input type="hidden" name="${nombreToken}" value="${valorToken}"/>
      <input type="hidden" name="estadoConsulta" value="inicial"/>
      <input type="text" name="clicod" value=""/>
      <input type="checkbox" name="__checkbox_jerarquia" value="true"/>
      <input type="text" name="rs" value=""/>
      <input type="text" name="tarjeta" value=""/>
      <input type="text" name="banco" value=""/>
      <input type="text" name="fechaini" value=""/>
      <input type="text" name="fechafin" value=""/>
      <input type="text" name="formato" value="PDF"/>
      <input type="submit" name="submit" value="Aceptar"/>
    </form></body></html>`;
}

export interface OpcionesSimulacion {
  /** Rechaza cualquier credencial: simula usuario o clave incorrectos. */
  rechazarIngreso?: boolean;
  /** La sesión se cae justo al pedir el formulario del informe. */
  sesionExpiraEnFormulario?: boolean;
  /** El formulario llega sin el campo `struts.token.name`. */
  sinToken?: boolean;
  /** La descarga devuelve HTML en lugar del XLS. */
  descargaDevuelveHTML?: boolean;
  /** La descarga devuelve un archivo de cero bytes. */
  descargaVacia?: boolean;
  /** Responde al login con un 302, como suele hacer una app Java. */
  redirigirTrasIngreso?: boolean;
  /** El XLS llega sin declararse como descarga. */
  sinAttachment?: boolean;
  /** El menú no ofrece el informe: la cuenta no lo tiene habilitado. */
  menuSinEnlaceInforme?: boolean;
}

export interface Simulacion {
  url: string;
  cerrar(): Promise<void>;
  /** Lo que el servidor recibió, para poder afirmar sobre el payload. */
  peticiones: { metodo: string; ruta: string; cuerpo: URLSearchParams; cookie: string | null }[];
  /** El token vigente. El test lo usa para comprobar que se reenvió bien. */
  tokenActual: { nombre: string; valor: string };
  /** El token que el menú pone en la query de sus enlaces. */
  tokenNavegacion: string;
}

function leerCuerpo(req: IncomingMessage): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const partes: Buffer[] = [];
    req.on("data", (c: Buffer) => partes.push(c));
    req.on("end", () => resolver(Buffer.concat(partes).toString("utf8")));
    req.on("error", rechazar);
  });
}

export async function levantarSimulacion(opciones: OpcionesSimulacion = {}): Promise<Simulacion> {
  const peticiones: Simulacion["peticiones"] = [];
  const token = { nombre: "token", valor: "TOK-" + Math.random().toString(36).slice(2, 12) };
  const tokenNavegacion = "NAV-" + Math.random().toString(36).slice(2, 12).toUpperCase();
  // La sesión solo se considera abierta después de un ingreso correcto.
  let sesionAbierta = false;
  let informeListo = false;

  const manejar = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const ruta = url.pathname;
    const cuerpoCrudo = req.method === "POST" ? await leerCuerpo(req) : "";
    const cuerpo = new URLSearchParams(cuerpoCrudo);
    const cookie = req.headers.cookie ?? null;
    peticiones.push({ metodo: req.method ?? "GET", ruta, cuerpo, cookie });

    const traeSesion = (cookie ?? "").includes(`JSESSIONID=${SESION_SIMULADA}`);

    const html = (cuerpoHtml: string, estado = 200): void => {
      res.writeHead(estado, { "Content-Type": "text/html;charset=ISO-8859-1" });
      res.end(cuerpoHtml);
    };

    if (ruta === "/TITAN/Inicio.html") {
      // Tomcat entrega la cookie ya en la pantalla de ingreso.
      res.setHeader("Set-Cookie", `JSESSIONID=${SESION_SIMULADA}; Path=/TITAN; Secure; HttpOnly`);
      html(htmlIngreso());
      return;
    }

    if (ruta === "/TITAN/Login.html" && req.method === "POST") {
      const ok =
        !opciones.rechazarIngreso &&
        cuerpo.get("usuario") === USUARIO_VALIDO &&
        cuerpo.get("password") === CLAVE_VALIDA;
      sesionAbierta = ok;
      if (!ok) {
        html(htmlIngreso());
        return;
      }
      if (opciones.redirigirTrasIngreso) {
        res.writeHead(302, { Location: "/TITAN/Menu.html" });
        res.end();
        return;
      }
      html(htmlMenu(tokenNavegacion, !opciones.menuSinEnlaceInforme));
      return;
    }

    if (ruta === "/TITAN/Menu.html") {
      html(htmlMenu(tokenNavegacion, !opciones.menuSinEnlaceInforme));
      return;
    }

    if (ruta === "/TITAN/informeIngresosCreditos.html") {
      if (!sesionAbierta || !traeSesion || opciones.sesionExpiraEnFormulario) {
        html(htmlIngreso());
        return;
      }
      // El guardián de navegación: un GET sin el token de la query es, para
      // Titán, lo mismo que escribir la URL en la barra de direcciones.
      if (req.method === "GET" && url.searchParams.get("token") !== tokenNavegacion) {
        html(htmlSesionInhabilitada());
        return;
      }
      if (req.method === "POST") {
        if (cuerpo.get(token.nombre) !== token.valor) {
          html("<html><body>Token invalido</body></html>", 400);
          return;
        }
        informeListo = true;
        html("<html><body>Informe generado</body></html>");
        return;
      }
      html(
        opciones.sinToken
          ? htmlFormularioInforme("token", token.valor).replace(
              /<input type="hidden" name="struts\.token\.name"[^>]*\/>/,
              "",
            )
          : htmlFormularioInforme(token.nombre, token.valor),
      );
      return;
    }

    if (ruta === "/TITAN/Informes.html") {
      if (!sesionAbierta || !traeSesion) {
        html(htmlIngreso());
        return;
      }
      if (opciones.descargaDevuelveHTML) {
        html("<html><body>Error generando el informe</body></html>");
        return;
      }
      if (!informeListo) {
        html("<html><body>No hay informe pendiente</body></html>");
        return;
      }
      const contenido = opciones.descargaVacia ? Buffer.alloc(0) : xlsSintetico();
      res.writeHead(200, {
        "Content-Type": "application/vnd.ms-excel",
        "Content-Disposition": opciones.sinAttachment
          ? `inline; filename="${NOMBRE_ARCHIVO}"`
          : `attachment; filename="${NOMBRE_ARCHIVO}"`,
        "Content-Length": String(contenido.length),
      });
      res.end(contenido);
      return;
    }

    html("<html><body>No encontrado</body></html>", 404);
  };

  const servidor: Server = createServer((req, res) => {
    manejar(req, res).catch(() => {
      res.writeHead(500);
      res.end();
    });
  });

  await new Promise<void>((r) => servidor.listen(0, "127.0.0.1", r));
  const { port } = servidor.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}/TITAN/`,
    peticiones,
    tokenActual: token,
    tokenNavegacion,
    cerrar: () => new Promise<void>((r) => servidor.close(() => r())),
  };
}
