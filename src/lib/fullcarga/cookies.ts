/**
 * Frasco de cookies en memoria.
 *
 * Alcance deliberadamente chico: **un solo host, sesión de una corrida**.
 * Titán mantiene la sesión con una sola cookie, `JSESSIONID`, con ámbito
 * `Path=/TITAN`. Eso es todo lo que hay que sostener entre el login, el
 * formulario, el POST y la descarga.
 *
 * Por qué propio y no `tough-cookie` + `fetch-cookie`: son ~50 líneas contra
 * dos dependencias nuevas, y no necesitamos nada de RFC 6265 que no esté acá
 * —ni dominios, ni subdominios, ni persistencia—. Si el ensayo en vivo
 * muestra que hace falta más, cambiarlo es reemplazar este archivo.
 *
 * Invariantes de seguridad:
 *   · vive **solo en memoria**: no hay serialización a disco en ninguna parte;
 *   · `toString()` devuelve los **nombres**, nunca los valores, para que un
 *     frasco interpolado por error en un log no filtre la sesión.
 */

interface Cookie {
  nombre: string;
  valor: string;
  path: string;
}

/** ¿El path de la cookie cubre al de la petición? (RFC 6265 § 5.1.4) */
function pathCubre(pathCookie: string, pathPeticion: string): boolean {
  if (pathCookie === pathPeticion) return true;
  if (!pathPeticion.startsWith(pathCookie)) return false;
  return pathCookie.endsWith("/") || pathPeticion[pathCookie.length] === "/";
}

export class FrascoDeCookies {
  /** Indexado por nombre + path: es la identidad que usa el navegador. */
  private readonly cookies = new Map<string, Cookie>();

  /** Guarda una cabecera `Set-Cookie`. Ignora lo que no sepa interpretar. */
  guardar(setCookie: string, pathPorDefecto = "/"): void {
    const partes = setCookie.split(";");
    const primera = partes[0] ?? "";
    const igual = primera.indexOf("=");
    if (igual <= 0) return;

    const nombre = primera.slice(0, igual).trim();
    const valor = primera.slice(igual + 1).trim();
    if (nombre === "") return;

    let path = pathPorDefecto;
    let expirada = false;

    for (const atributo of partes.slice(1)) {
      const [clave, ...resto] = atributo.split("=");
      const k = clave.trim().toLowerCase();
      const v = resto.join("=").trim();
      if (k === "path" && v !== "") path = v;
      // Borrado: el servidor cierra la sesión con Max-Age=0 o una fecha pasada.
      if (k === "max-age" && Number(v) <= 0) expirada = true;
      if (k === "expires" && v !== "") {
        const t = Date.parse(v);
        if (!Number.isNaN(t) && t <= Date.now()) expirada = true;
      }
    }

    // Separador NUL: no puede aparecer ni en un nombre ni en un path,
    // así que la clave compuesta nunca colisiona.
    const clave = `${nombre}\u0000${path}`;
    if (expirada || valor === "") this.cookies.delete(clave);
    else this.cookies.set(clave, { nombre, valor, path });
  }

  /** Guarda todas las `Set-Cookie` de una respuesta. */
  guardarTodas(cabeceras: Headers, pathPorDefecto = "/"): void {
    for (const sc of cabeceras.getSetCookie()) this.guardar(sc, pathPorDefecto);
  }

  /** Cabecera `Cookie` para una petición a ese path, o `null` si no hay. */
  cabeceraPara(path: string): string | null {
    const aplicables = [...this.cookies.values()].filter((c) => pathCubre(c.path, path));
    if (aplicables.length === 0) return null;
    // Path más específico primero, como hace un navegador.
    aplicables.sort((a, b) => b.path.length - a.path.length);
    return aplicables.map((c) => `${c.nombre}=${c.valor}`).join("; ");
  }

  /** ¿Existe una cookie con ese nombre? Para verificar la sesión sin leerla. */
  tiene(nombre: string): boolean {
    return [...this.cookies.values()].some((c) => c.nombre === nombre);
  }

  /** Los nombres presentes. Nunca los valores. */
  nombres(): string[] {
    return [...new Set([...this.cookies.values()].map((c) => c.nombre))].sort();
  }

  get cantidad(): number {
    return this.cookies.size;
  }

  /**
   * Representación segura: solo nombres. Existe para que un frasco
   * interpolado en un mensaje de error no publique la sesión.
   */
  toString(): string {
    return `FrascoDeCookies(${this.nombres().join(", ") || "vacío"})`;
  }

  /** Igual que `toString()`: protege también a `JSON.stringify`. */
  toJSON(): string {
    return this.toString();
  }
}
