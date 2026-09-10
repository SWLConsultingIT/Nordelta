/**
 * Cliente HTTP con sesión.
 *
 * `fetch` no mantiene cookies entre llamadas, y Titán apoya toda la sesión en
 * una. Este cliente agrega tres cosas y ninguna más:
 *
 *   1. **frasco de cookies** compartido entre peticiones;
 *   2. **redirecciones seguidas a mano**, para poder capturar `Set-Cookie` en
 *      cada salto —siguiéndolas automáticamente se pierden las intermedias, y
 *      la que interesa suele venir justo en el 302 del login—;
 *   3. **decodificación por juego de caracteres**: la entrada de Titán declara
 *      `ISO-8859-1`. Leer latin-1 como UTF-8 rompe los acentos y, peor, puede
 *      romper el parseo del formulario.
 *
 * El cuerpo se lee siempre como bytes. Quien necesite texto llama a `texto()`.
 */

import { FullcargaNetworkError } from "./errores";
import { FrascoDeCookies } from "./cookies";
import { seguro } from "./redaccion";

/** Cabeceras de un navegador de escritorio. No hay engaño acá: es un cliente
 *  automatizado de Nordelta identificándose de forma que el servidor lo trate
 *  como al navegador de siempre. Si Fullcarga pide otra cosa, se cambia. */
const CABECERAS_BASE: Record<string, string> = {
  "Accept-Language": "es-AR,es;q=0.9",
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
};

export interface RespuestaHTTP {
  estado: number;
  url: string;
  cabeceras: Headers;
  bytes: Buffer;
  /** Cuerpo decodificado según el juego de caracteres declarado. */
  texto(): string;
  /** Saltos recorridos, si hubo redirecciones. */
  saltos: number;
}

export interface OpcionesPeticion {
  metodo?: "GET" | "POST";
  /** Cuerpo de formulario. Se envía como `application/x-www-form-urlencoded`. */
  formulario?: URLSearchParams;
  cabeceras?: Record<string, string>;
  /** Máximo de redirecciones a seguir. Cero las deja sin seguir. */
  maximoSaltos?: number;
  /** Milisegundos antes de abandonar. */
  tiempoLimiteMs?: number;
}

/** Extrae el juego de caracteres de un `Content-Type`. */
export function juegoDeCaracteres(contentType: string | null): BufferEncoding {
  if (!contentType) return "utf8";
  const m = /charset\s*=\s*"?([\w-]+)"?/i.exec(contentType);
  const nombre = (m?.[1] ?? "").toLowerCase();
  if (nombre === "iso-8859-1" || nombre === "latin1" || nombre === "windows-1252") {
    return "latin1";
  }
  return "utf8";
}

export class ClienteHTTP {
  readonly cookies = new FrascoDeCookies();
  private readonly base: URL;
  private readonly tiempoLimiteMs: number;

  constructor(baseUrl: string, tiempoLimiteMs = 60_000) {
    this.base = new URL(baseUrl);
    this.tiempoLimiteMs = tiempoLimiteMs;
  }

  /** Resuelve una ruta relativa contra la base configurada. */
  url(ruta: string): URL {
    return new URL(ruta, this.base);
  }

  async pedir(ruta: string, opciones: OpcionesPeticion = {}): Promise<RespuestaHTTP> {
    const maximoSaltos = opciones.maximoSaltos ?? 5;
    let url = this.url(ruta);
    let metodo = opciones.metodo ?? "GET";
    let cuerpo = opciones.formulario?.toString();
    let saltos = 0;

    for (;;) {
      const cabeceras: Record<string, string> = { ...CABECERAS_BASE, ...opciones.cabeceras };
      const cookie = this.cookies.cabeceraPara(url.pathname);
      if (cookie) cabeceras["Cookie"] = cookie;
      if (cuerpo !== undefined) {
        cabeceras["Content-Type"] = "application/x-www-form-urlencoded";
      }

      const respuesta = await this.unaVez(url, metodo, cuerpo, cabeceras);

      // El path de la petición es el default del atributo Path de la cookie.
      const pathDefecto = url.pathname.replace(/\/[^/]*$/, "") || "/";
      this.cookies.guardarTodas(respuesta.headers, pathDefecto);

      const location = respuesta.headers.get("location");
      const esRedireccion = respuesta.status >= 300 && respuesta.status < 400 && location;

      if (!esRedireccion || saltos >= maximoSaltos) {
        const bytes = Buffer.from(await respuesta.arrayBuffer());
        const contentType = respuesta.headers.get("content-type");
        return {
          estado: respuesta.status,
          url: url.toString(),
          cabeceras: respuesta.headers,
          bytes,
          texto: () => bytes.toString(juegoDeCaracteres(contentType)),
          saltos,
        };
      }

      // 303 y 302 pasan a GET y descartan el cuerpo; 307 y 308 conservan todo.
      if (respuesta.status !== 307 && respuesta.status !== 308) {
        metodo = "GET";
        cuerpo = undefined;
      }
      url = new URL(location, url);
      saltos += 1;
      // El cuerpo de la redirección no interesa, pero hay que consumirlo para
      // que la conexión se libere.
      await respuesta.arrayBuffer();
    }
  }

  private async unaVez(
    url: URL,
    metodo: string,
    cuerpo: string | undefined,
    cabeceras: Record<string, string>,
  ): Promise<Response> {
    const abortar = AbortSignal.timeout(this.tiempoLimiteMs);
    try {
      return await fetch(url, { method: metodo, body: cuerpo, headers: cabeceras, redirect: "manual", signal: abortar });
    } catch (e) {
      // El mensaje de `fetch` puede traer la URL completa; se redacta igual.
      throw new FullcargaNetworkError(
        `No se pudo completar ${metodo} ${url.pathname}: ${seguro((e as Error).message)}`,
        { metodo, ruta: url.pathname },
      );
    }
  }
}
