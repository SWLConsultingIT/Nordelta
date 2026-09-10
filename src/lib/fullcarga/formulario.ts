/**
 * Lectura del formulario del informe.
 *
 * Dos responsabilidades:
 *
 *   1. **Extraer los campos ocultos** tal como los emite el servidor, para
 *      reenviarlos sin inventarlos. Un formulario de Struts suele llevar
 *      estado que no entendemos y que igual hay que devolver; reconstruirlo a
 *      mano es la forma más rápida de que el POST sea rechazado por algo que
 *      ni siquiera sabíamos que existía.
 *
 *   2. **Resolver el token de Struts**, que es indirecto a propósito:
 *
 *          <input type="hidden" name="struts.token.name" value="token">
 *          <input type="hidden" name="token" value="ZQ1F...">
 *
 *      El primer campo dice **cómo se llama** el segundo, y ese nombre cambia
 *      entre respuestas. Por eso el token no se puede fijar en el código: hay
 *      que leer el nombre y después buscar el valor.
 *
 * Se parsea con expresiones regulares y no con un árbol DOM a propósito: la
 * única estructura que necesitamos son las etiquetas `<input>` sueltas, no hay
 * dependencia que justifique traer un parser completo, y el HTML de Titán es
 * generado por plantilla, no escrito a mano.
 */

import { FullcargaTokenError } from "./errores";

/** Nombre del campo que, en Struts 2, apunta al campo del token. */
export const CAMPO_NOMBRE_TOKEN = "struts.token.name";

const ETIQUETA_INPUT = /<input\b[^>]*>/gi;

/**
 * Atributo con valor entre comillas dobles, simples, sin comillas, o
 * **sin valor**: `checked` y `disabled` se escriben sueltos, y así los emite
 * un JSP. Sin la parte opcional, un casillero marcado pasa por desmarcado.
 */
const ATRIBUTO = /([a-zA-Z_:][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s">]+)))?/g;

/** Atributos de una etiqueta, en minúsculas y con las entidades resueltas. */
function atributos(etiqueta: string): Record<string, string> {
  // Se saca el nombre de la etiqueta para que no se cuele como atributo.
  const cuerpo = etiqueta.replace(/^<\s*[a-zA-Z][\w:-]*/, "").replace(/\/?>$/, "");
  const salida: Record<string, string> = {};
  for (const m of cuerpo.matchAll(ATRIBUTO)) {
    const clave = m[1].toLowerCase();
    salida[clave] = desescapar(m[2] ?? m[3] ?? m[4] ?? "");
  }
  return salida;
}

/** Las cinco entidades que un generador de HTML puede haber escapado. */
export function desescapar(texto: string): string {
  return texto
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Todos los `<input>` del documento con nombre, en orden de aparición.
 *
 * Se conserva el último valor cuando un nombre se repite, que es lo que hace
 * un navegador con campos duplicados en el mismo formulario.
 */
export function camposDelFormulario(html: string): Map<string, string> {
  const campos = new Map<string, string>();
  for (const m of html.matchAll(ETIQUETA_INPUT)) {
    const a = atributos(m[0]);
    const nombre = a["name"];
    if (!nombre) continue;

    const tipo = (a["type"] ?? "text").toLowerCase();
    // Un botón sin pulsar y un casillero sin marcar no se envían.
    if (tipo === "submit" || tipo === "button" || tipo === "image" || tipo === "reset") continue;
    if ((tipo === "checkbox" || tipo === "radio") && !("checked" in a)) continue;

    campos.set(nombre, a["value"] ?? "");
  }
  return campos;
}

/** Solo los ocultos: lo que hay que reenviar sin tocar. */
export function camposOcultos(html: string): Map<string, string> {
  const campos = new Map<string, string>();
  for (const m of html.matchAll(ETIQUETA_INPUT)) {
    const a = atributos(m[0]);
    if ((a["type"] ?? "").toLowerCase() !== "hidden") continue;
    if (!a["name"]) continue;
    campos.set(a["name"], a["value"] ?? "");
  }
  return campos;
}

export interface TokenStruts {
  /** Cómo se llama el campo en esta respuesta. Cambia entre peticiones. */
  nombre: string;
  /** El valor. **Nunca se registra ni se incluye en un error.** */
  valor: string;
}

/**
 * Resuelve el token siguiendo la indirección de Struts.
 *
 * Falla —en vez de continuar sin token— porque un POST sin él es rechazado
 * por el servidor de una forma que después cuesta diagnosticar.
 */
export function extraerTokenStruts(html: string): TokenStruts {
  const campos = camposDelFormulario(html);

  const nombre = campos.get(CAMPO_NOMBRE_TOKEN);
  if (nombre === undefined || nombre.trim() === "") {
    throw new FullcargaTokenError(
      `El formulario no trae el campo "${CAMPO_NOMBRE_TOKEN}": puede que la sesión no esté autenticada o que la pantalla haya cambiado`,
      { campoEsperado: CAMPO_NOMBRE_TOKEN, camposOcultos: campos.size },
    );
  }

  const valor = campos.get(nombre);
  if (valor === undefined || valor.trim() === "") {
    throw new FullcargaTokenError(
      `El formulario declara el token en el campo "${nombre}" pero ese campo no está o vino vacío`,
      { campoDeclarado: nombre, camposOcultos: campos.size },
    );
  }

  return { nombre, valor };
}

/** ¿Este HTML es la pantalla de ingreso? Es cómo se detecta que no hay sesión. */
export function esPantallaDeIngreso(html: string): boolean {
  const campos = camposDelFormulario(html);
  const tieneUsuario = campos.has("usuario");
  const tieneClave = /<input\b[^>]*type\s*=\s*["']?password["']?/i.test(html);
  const apuntaALogin = /action\s*=\s*["'][^"']*Login\.html["']/i.test(html);
  return (tieneUsuario && tieneClave) || apuntaALogin;
}

/**
 * ¿Titán devolvió su pantalla de «Sesión inhabilitada»?
 *
 * Es un estado propio, distinto de «no hay sesión». Titán protege cada
 * navegación con un token de un solo uso y muestra esta pantalla cuando
 * detecta F5, una pestaña nueva, el botón Volver, o —lo que nos pasó a
 * nosotros— **una URL pedida sin el token**, que para la aplicación es lo
 * mismo que escribirla en la barra de direcciones.
 */
export function esSesionInhabilitada(html: string): boolean {
  return /sesi[oó]n\s+(ha\s+sido\s+)?inhabilitada/i.test(html);
}

/**
 * Busca en el menú el enlace a una acción, con su token incluido.
 *
 * Devuelve el `href` tal como lo emitió el servidor, con las entidades
 * resueltas —vienen como `&amp;`—. **Hay que usarlo tal cual**: el token de
 * la query es de un solo uso y lo emite la página que contiene el enlace, así
 * que no se puede fijar en el código ni reconstruir a mano.
 */
export function enlaceDelMenu(html: string, accion: string): string | null {
  const escapada = accion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`<a\\b[^>]*href\\s*=\\s*["']([^"']*${escapada}[^"']*)["']`, "i");
  const m = re.exec(html);
  return m ? desescapar(m[1]) : null;
}
