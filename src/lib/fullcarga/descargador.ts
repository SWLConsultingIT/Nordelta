/**
 * Descargador HTTP: autenticación → sesión → formulario → token → POST → XLS.
 *
 * Es la única pieza que conoce el orden de los pasos. Todo lo que sabe hacer
 * está en los módulos vecinos —cookies, formulario, fechas, validación— para
 * que cada parte se pueda probar sola.
 *
 * Estados de la evidencia (ver `docs/FULLCARGA_HTTP_POC.md`):
 *   · VERIFIED   las rutas, los campos del formulario y las cabeceras de la
 *                descarga salen de la inspección autenticada con DevTools;
 *   · INFERRED   cómo se comprueba que la sesión quedó abierta, y qué campos
 *                del formulario hay que reenviar sin tocar;
 *   · NOT TESTED nada de este archivo se ejecutó todavía contra Fullcarga.
 */

import { RUTAS, type ConfiguracionFullcarga } from "./config";
import { ClienteHTTP } from "./http";
import { rangoFullcarga } from "./fechas";
import {
  camposOcultos,
  enlaceDelMenu,
  esPantallaDeIngreso,
  esSesionInhabilitada,
  extraerTokenStruts,
} from "./formulario";
import {
  contentTypeRazonable,
  esAttachment,
  nombreDeContentDisposition,
  sanearNombre,
  sha256,
  validarInforme,
} from "./descarga";
import {
  FullcargaAuthenticationError,
  FullcargaDownloadError,
  FullcargaReportGenerationError,
  FullcargaSessionExpiredError,
} from "./errores";
import { registradorMudo, seguro, type Registrador } from "./redaccion";
import type { Descargador, InformeDescargado, PedidoDeInforme } from "./tipos";

/** Cookie con la que Tomcat sostiene la sesión. */
export const COOKIE_SESION = "JSESSIONID";

/**
 * Campos del formulario observados en la inspección. Se mandan siempre, aun
 * vacíos: un formulario de Struts que recibe menos campos de los que emitió
 * puede fallar de formas poco descriptivas.
 */
const FILTROS_POR_DEFECTO: Readonly<Record<string, string>> = {
  clicod: "",
  __checkbox_jerarquia: "",
  rs: "",
  tarjeta: "",
  banco: "",
};

export class DescargadorHTTP implements Descargador {
  private readonly http: ClienteHTTP;
  private readonly config: ConfiguracionFullcarga;
  private readonly log: Registrador;
  private autenticado = false;
  /**
   * Enlace al informe **tal como lo emitió el menú**, con su token de
   * navegación en la query. Titán no acepta la ruta pelada.
   */
  private enlaceInforme: string | null = null;

  constructor(
    config: ConfiguracionFullcarga,
    opciones: { registrador?: Registrador; tiempoLimiteMs?: number } = {},
  ) {
    this.config = config;
    this.log = opciones.registrador ?? registradorMudo;
    this.http = new ClienteHTTP(config.baseUrl, opciones.tiempoLimiteMs);
  }

  /** Nombres de las cookies vigentes. Nunca sus valores. Para diagnóstico. */
  get cookiesPresentes(): string[] {
    return this.http.cookies.nombres();
  }

  /**
   * Abre sesión.
   *
   * Dos cosas que no son obvias y son el motivo de la mitad del método:
   *
   *   · se pide primero la pantalla de ingreso, porque Tomcat entrega ahí el
   *     `JSESSIONID` inicial y algunas configuraciones rechazan un POST que
   *     llega sin sesión previa;
   *   · **un 200 no prueba nada.** Una aplicación Java devuelve 200 con la
   *     pantalla de ingreso cuando las credenciales fallan. La comprobación
   *     real es pedir una pantalla que exige sesión y ver qué contesta.
   */
  async autenticar(): Promise<void> {
    this.log.paso("authentication started");
    this.log.checkpoint(1);

    await this.http.pedir(RUTAS.ingreso);

    const formulario = new URLSearchParams({
      usuario: this.config.credenciales.usuario,
      password: this.config.credenciales.password,
      topUp: "false",
      topUpAdquirencia: "false",
      version: "",
    });

    const respuesta = await this.http.pedir(RUTAS.login, {
      metodo: "POST",
      formulario,
      cabeceras: {
        Referer: this.http.url(RUTAS.ingreso).toString(),
        Origin: this.http.url("/").origin,
      },
    });

    if (respuesta.estado >= 500) {
      throw new FullcargaAuthenticationError(
        `El servidor respondió ${respuesta.estado} al iniciar sesión`,
        { estado: respuesta.estado },
      );
    }

    if (!this.http.cookies.tiene(COOKIE_SESION)) {
      throw new FullcargaAuthenticationError(
        `No se recibió la cookie de sesión (${COOKIE_SESION}) en ningún momento del ingreso`,
        { estado: respuesta.estado, cookies: this.cookiesPresentes.join(",") },
      );
    }

    // El POST del ingreso aterriza en el menú, y esa misma página es la
    // comprobación. No se pide ninguna otra pantalla para verificar: hacerlo
    // dispara el guardián de navegación de Titán, que interpreta una segunda
    // petición a la misma URL como un F5.
    const menu = respuesta.texto();
    if (esPantallaDeIngreso(menu)) {
      throw new FullcargaAuthenticationError(
        "El ingreso no prosperó: después del POST volvió la pantalla de ingreso. Revisá usuario y contraseña, o si la cuenta pide un segundo factor.",
        { estado: respuesta.estado },
      );
    }
    if (esSesionInhabilitada(menu)) {
      throw new FullcargaSessionExpiredError(
        "Titán respondió «Sesión inhabilitada» ya en el ingreso: puede haber otra sesión abierta con el mismo usuario",
        { estado: respuesta.estado },
      );
    }

    // Cada enlace del menú lleva su propio token de navegación en la query.
    // Hay que usar el que emitió el servidor: pedir la ruta pelada equivale,
    // para Titán, a escribirla en la barra de direcciones.
    this.enlaceInforme = enlaceDelMenu(menu, RUTAS.formularioInforme);
    if (this.enlaceInforme === null) {
      throw new FullcargaAuthenticationError(
        `El menú no trae el enlace a ${RUTAS.formularioInforme}. Puede que esta cuenta no tenga habilitado ese informe, o que el menú haya cambiado.`,
        { estado: respuesta.estado, ruta: new URL(respuesta.url).pathname },
      );
    }

    this.autenticado = true;
    this.log.paso("authentication successful");
    this.log.checkpoint(2, `cookies: ${this.cookiesPresentes.join(", ")}`);
    this.log.paso("session established");
  }

  /**
   * Trae el formulario y resuelve el token.
   *
   * Se conservan **todos** los campos ocultos y encima se escriben los
   * nuestros: reenviar el estado que el servidor emitió es más seguro que
   * reconstruirlo, porque no sabemos qué significa cada campo.
   */
  private async cargarFormulario(): Promise<{ campos: Map<string, string>; tokenNombre: string }> {
    // Se navega por el enlace del menú, con su token. Nunca por la ruta pelada.
    const respuesta = await this.http.pedir(this.enlaceInforme ?? RUTAS.formularioInforme);
    const html = respuesta.texto();

    if (esPantallaDeIngreso(html)) {
      throw new FullcargaSessionExpiredError(
        "Al pedir el formulario del informe volvió la pantalla de ingreso: la sesión se cayó",
        { estado: respuesta.estado },
      );
    }
    if (esSesionInhabilitada(html)) {
      throw new FullcargaSessionExpiredError(
        "Titán respondió «Sesión inhabilitada» al abrir el informe: el token de navegación ya se había usado, o hay otra sesión abierta con el mismo usuario",
        { estado: respuesta.estado },
      );
    }

    this.log.paso("report form loaded");
    this.log.checkpoint(3, `HTTP ${respuesta.estado}`);

    const token = extraerTokenStruts(html);
    const campos = camposOcultos(html);
    campos.set(token.nombre, token.valor);

    this.log.paso("token extracted");
    // Se informa el NOMBRE del campo, que es dinámico y sirve para
    // diagnosticar. El valor no sale de acá.
    this.log.checkpoint(4, `campo "${token.nombre}"`);

    return { campos, tokenNombre: token.nombre };
  }

  async descargarInforme(pedido: PedidoDeInforme): Promise<InformeDescargado> {
    // Las fechas se validan antes de tocar la red: si están mal, no hay por
    // qué molestar a Fullcarga.
    const rango = rangoFullcarga(pedido.desde, pedido.hasta);

    if (!this.autenticado) await this.autenticar();

    const { campos } = await this.cargarFormulario();

    for (const [k, v] of Object.entries({ ...FILTROS_POR_DEFECTO, ...pedido.filtros })) {
      campos.set(k, v);
    }
    campos.set("fechaini", rango.desde);
    campos.set("fechafin", rango.hasta);
    campos.set("formato", pedido.formato ?? "XLS");
    campos.set("submit", "Aceptar");

    const cuerpo = new URLSearchParams();
    for (const [k, v] of campos) cuerpo.append(k, v);

    // El Referer es la URL por la que realmente se llegó al formulario.
    const refererFormulario = this.http.url(this.enlaceInforme ?? RUTAS.formularioInforme).toString();
    const generacion = await this.http.pedir(RUTAS.formularioInforme, {
      metodo: "POST",
      formulario: cuerpo,
      cabeceras: { Referer: refererFormulario, Origin: this.http.url("/").origin },
    });

    if (generacion.estado >= 400) {
      throw new FullcargaReportGenerationError(
        `El pedido del informe falló con HTTP ${generacion.estado}`,
        { estado: generacion.estado, desde: pedido.desde, hasta: pedido.hasta },
      );
    }
    const cuerpoGeneracion = generacion.texto();
    if (esPantallaDeIngreso(cuerpoGeneracion) || esSesionInhabilitada(cuerpoGeneracion)) {
      throw new FullcargaSessionExpiredError(
        "La sesión se cortó al pedir el informe",
        { estado: generacion.estado, inhabilitada: esSesionInhabilitada(cuerpoGeneracion) },
      );
    }

    this.log.paso("report requested");
    this.log.checkpoint(5, `${rango.desde} a ${rango.hasta}, formato ${pedido.formato ?? "XLS"}`);

    const descarga = await this.http.pedir(RUTAS.descarga, {
      cabeceras: { Referer: refererFormulario },
    });

    if (descarga.estado !== 200) {
      throw new FullcargaDownloadError(
        `La descarga respondió HTTP ${descarga.estado}`,
        { estado: descarga.estado },
      );
    }

    const contentType = descarga.cabeceras.get("content-type");
    const disposition = descarga.cabeceras.get("content-disposition");

    this.log.paso("report downloaded");
    this.log.checkpoint(6, `${descarga.bytes.length} bytes, ${contentType ?? "sin content-type"}`);

    // Primero la firma del archivo, que es la prueba dura; el content-type es
    // una declaración del servidor y puede mentir en las dos direcciones.
    const validacion = validarInforme(descarga.bytes, contentType);

    // El orden importa: primero qué son los bytes. Si llegó la pantalla de
    // ingreso o una página de error, ese diagnóstico es mucho más útil que
    // avisar que faltaba una cabecera.
    if (!esAttachment(disposition)) {
      throw new FullcargaDownloadError(
        `Los bytes son de ${validacion.formato} pero la respuesta no se declaró como descarga: Content-Disposition ${disposition ? `= ${seguro(disposition, 80)}` : "ausente"}`,
        { contentDisposition: disposition ? seguro(disposition, 80) : null },
      );
    }

    if (!contentTypeRazonable(contentType)) {
      throw new FullcargaDownloadError(
        `El archivo tiene firma de ${validacion.formato} pero el Content-Type declarado no corresponde a una planilla: ${seguro(contentType ?? "ausente", 60)}`,
        { contentType: contentType ? seguro(contentType, 60) : null, formato: validacion.formato },
      );
    }

    const nombreCrudo = nombreDeContentDisposition(disposition);
    const filename = sanearNombre(
      nombreCrudo ?? `informe-${pedido.desde}-a-${pedido.hasta}.xls`,
    );

    this.log.paso("XLS validated");
    this.log.checkpoint(7, `${validacion.formato}, ${validacion.bytes} bytes`);

    return {
      bytes: descarga.bytes,
      filename,
      contentType: contentType ?? "",
      requestedFrom: pedido.desde,
      requestedTo: pedido.hasta,
      downloadedAt: new Date().toISOString(),
      sha256: sha256(descarga.bytes),
      formatoDetectado: validacion.formato,
      tamanoBytes: validacion.bytes,
    };
  }
}
