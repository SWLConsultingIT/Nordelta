/**
 * Unidades del POC de Fullcarga: fechas, formulario, cookies, validación y
 * redacción. Todo puro, sin red.
 */

import { describe, expect, it } from "vitest";
import {
  aFormatoFullcarga,
  esFechaCalendario,
  rangoFullcarga,
} from "../../src/lib/fullcarga/fechas";
import {
  CAMPO_NOMBRE_TOKEN,
  camposDelFormulario,
  camposOcultos,
  desescapar,
  esPantallaDeIngreso,
  extraerTokenStruts,
} from "../../src/lib/fullcarga/formulario";
import {
  contentTypeRazonable,
  detectarFormato,
  esAttachment,
  nombreArchivoLocal,
  nombreDeContentDisposition,
  sanearNombre,
  sha256,
  validarInforme,
} from "../../src/lib/fullcarga/descarga";
import { FrascoDeCookies } from "../../src/lib/fullcarga/cookies";
import { juegoDeCaracteres } from "../../src/lib/fullcarga/http";
import { redactar, seguro } from "../../src/lib/fullcarga/redaccion";
import { describir, hayCredenciales, leerConfiguracion } from "../../src/lib/fullcarga/config";
import {
  FullcargaConfigurationError,
  FullcargaInvalidReportError,
  FullcargaSessionExpiredError,
  FullcargaTokenError,
} from "../../src/lib/fullcarga/errores";
import { htmlFormularioInforme, htmlIngreso, xlsSintetico } from "./servidor-simulado";

describe("fechas", () => {
  it("convierte ISO al formato del formulario", () => {
    expect(aFormatoFullcarga("2026-09-08")).toBe("08-09-2026");
    expect(aFormatoFullcarga("2026-01-01")).toBe("01-01-2026");
    expect(aFormatoFullcarga("2026-12-31")).toBe("31-12-2026");
  });

  it("no depende del huso horario", () => {
    // Con `new Date` + `toISOString`, un huso al este del meridiano puede
    // correr la fecha un día. Acá la conversión es de texto, así que el
    // resultado es el mismo con cualquier TZ.
    const original = process.env.TZ;
    try {
      for (const tz of ["UTC", "Pacific/Kiritimati", "Pacific/Midway", "America/Argentina/Buenos_Aires"]) {
        process.env.TZ = tz;
        expect(aFormatoFullcarga("2026-09-08")).toBe("08-09-2026");
        expect(aFormatoFullcarga("2026-01-01")).toBe("01-01-2026");
      }
    } finally {
      process.env.TZ = original;
    }
  });

  it("acepta el 29 de febrero solo en año bisiesto", () => {
    expect(esFechaCalendario("2028-02-29")).toBe(true);
    expect(esFechaCalendario("2026-02-29")).toBe(false);
    expect(esFechaCalendario("2100-02-29")).toBe(false); // divisible por 100
    expect(esFechaCalendario("2000-02-29")).toBe(true); // divisible por 400
  });

  it("rechaza lo que no es una fecha ISO válida", () => {
    for (const malo of ["08-09-2026", "2026-9-8", "2026-13-01", "2026-00-10", "2026-04-31", "", "hoy"]) {
      expect(esFechaCalendario(malo)).toBe(false);
      expect(() => aFormatoFullcarga(malo)).toThrow(FullcargaConfigurationError);
    }
  });

  it("rechaza un rango invertido", () => {
    expect(() => rangoFullcarga("2026-09-08", "2026-09-01")).toThrow(FullcargaConfigurationError);
    expect(rangoFullcarga("2026-09-01", "2026-09-08")).toEqual({
      desde: "01-09-2026",
      hasta: "08-09-2026",
    });
  });
});

describe("formulario y token de Struts", () => {
  it("resuelve el token siguiendo el nombre declarado", () => {
    const html = htmlFormularioInforme("token", "ABC123");
    expect(extraerTokenStruts(html)).toEqual({ nombre: "token", valor: "ABC123" });
  });

  it("sigue el nombre dinámico, que cambia entre respuestas", () => {
    // Struts genera el nombre del campo; no se puede fijar en el código.
    for (const nombre of ["token", "struts.token", "csrf_9f2a", "TOKEN_X"]) {
      const html = htmlFormularioInforme(nombre, `valor-de-${nombre}`);
      expect(extraerTokenStruts(html)).toEqual({ nombre, valor: `valor-de-${nombre}` });
    }
  });

  it("falla si no está el campo que declara el nombre", () => {
    const html = `<form><input type="hidden" name="token" value="ABC"/></form>`;
    expect(() => extraerTokenStruts(html)).toThrow(FullcargaTokenError);
    expect(() => extraerTokenStruts(html)).toThrow(new RegExp(CAMPO_NOMBRE_TOKEN.replace(/\./g, "\\.")));
  });

  it("falla si el campo declarado no existe o vino vacío", () => {
    const ausente = `<form><input type="hidden" name="struts.token.name" value="token"/></form>`;
    expect(() => extraerTokenStruts(ausente)).toThrow(FullcargaTokenError);

    const vacio = `<form>
      <input type="hidden" name="struts.token.name" value="token"/>
      <input type="hidden" name="token" value=""/></form>`;
    expect(() => extraerTokenStruts(vacio)).toThrow(FullcargaTokenError);
  });

  it("el error del token nunca incluye su valor", () => {
    const html = `<form>
      <input type="hidden" name="struts.token.name" value="token"/>
      <input type="hidden" name="otro" value="SECRETO-QUE-NO-DEBE-SALIR"/></form>`;
    try {
      extraerTokenStruts(html);
      expect.unreachable("tenía que fallar");
    } catch (e) {
      expect((e as Error).message).not.toContain("SECRETO-QUE-NO-DEBE-SALIR");
    }
  });

  it("lee los ocultos y respeta comillas simples, dobles y sin comillas", () => {
    const html = `<input type='hidden' name='a' value='1'>
      <input type="hidden" name="b" value="2">
      <input type=hidden name=c value=3>`;
    expect(Object.fromEntries(camposOcultos(html))).toEqual({ a: "1", b: "2", c: "3" });
  });

  it("no envía botones ni casilleros sin marcar, como un navegador", () => {
    const html = `<input type="hidden" name="h" value="1">
      <input type="submit" name="submit" value="Aceptar">
      <input type="checkbox" name="sinMarcar" value="x">
      <input type="checkbox" name="marcado" value="y" checked>`;
    const campos = camposDelFormulario(html);
    expect(campos.has("submit")).toBe(false);
    expect(campos.has("sinMarcar")).toBe(false);
    expect(campos.get("marcado")).toBe("y");
    expect(campos.get("h")).toBe("1");
  });

  it("resuelve las entidades del valor", () => {
    expect(desescapar("a&amp;b&lt;c&gt;d&quot;e&#39;f")).toBe(`a&b<c>d"e'f`);
    const html = `<input type="hidden" name="x" value="a&amp;b"/>`;
    expect(camposOcultos(html).get("x")).toBe("a&b");
  });

  it("reconoce la pantalla de ingreso", () => {
    expect(esPantallaDeIngreso(htmlIngreso())).toBe(true);
    expect(esPantallaDeIngreso(htmlFormularioInforme("token", "A"))).toBe(false);
    expect(esPantallaDeIngreso("<html><body>Bienvenido</body></html>")).toBe(false);
  });
});

describe("cookies", () => {
  it("guarda y devuelve la cookie de sesión para su path", () => {
    const frasco = new FrascoDeCookies();
    frasco.guardar("JSESSIONID=ABC123; Path=/TITAN; Secure; HttpOnly");
    expect(frasco.cabeceraPara("/TITAN/Informes.html")).toBe("JSESSIONID=ABC123");
    expect(frasco.tiene("JSESSIONID")).toBe(true);
  });

  it("no manda una cookie fuera de su path", () => {
    const frasco = new FrascoDeCookies();
    frasco.guardar("JSESSIONID=ABC123; Path=/TITAN");
    expect(frasco.cabeceraPara("/otra/cosa")).toBeNull();
    // Un prefijo de texto no alcanza: /TITANX no está dentro de /TITAN.
    expect(frasco.cabeceraPara("/TITANX/x.html")).toBeNull();
  });

  it("reemplaza el valor cuando el servidor rota la sesión", () => {
    const frasco = new FrascoDeCookies();
    frasco.guardar("JSESSIONID=VIEJA; Path=/TITAN");
    frasco.guardar("JSESSIONID=NUEVA; Path=/TITAN");
    expect(frasco.cabeceraPara("/TITAN/x")).toBe("JSESSIONID=NUEVA");
    expect(frasco.cantidad).toBe(1);
  });

  it("borra la cookie cuando el servidor la expira", () => {
    const frasco = new FrascoDeCookies();
    frasco.guardar("JSESSIONID=ABC; Path=/TITAN");
    frasco.guardar("JSESSIONID=ABC; Path=/TITAN; Max-Age=0");
    expect(frasco.tiene("JSESSIONID")).toBe(false);
  });

  it("nunca revela los valores al convertirse en texto", () => {
    const frasco = new FrascoDeCookies();
    frasco.guardar("JSESSIONID=SECRETO-DE-SESION; Path=/TITAN");
    expect(String(frasco)).not.toContain("SECRETO-DE-SESION");
    expect(JSON.stringify({ frasco })).not.toContain("SECRETO-DE-SESION");
    expect(`${frasco}`).toContain("JSESSIONID");
  });
});

describe("juego de caracteres", () => {
  it("usa latin1 cuando el servidor lo declara, que es lo que hace Titán", () => {
    expect(juegoDeCaracteres("text/html;charset=ISO-8859-1")).toBe("latin1");
    expect(juegoDeCaracteres("text/html; charset=utf-8")).toBe("utf8");
    expect(juegoDeCaracteres(null)).toBe("utf8");
  });
});

describe("Content-Disposition y nombre de archivo", () => {
  it("extrae el nombre entre comillas", () => {
    expect(
      nombreDeContentDisposition('attachment; filename="Informe Movimiento de Saldos 08-09-2026.xls"'),
    ).toBe("Informe Movimiento de Saldos 08-09-2026.xls");
  });

  it("extrae el nombre sin comillas", () => {
    expect(nombreDeContentDisposition("attachment; filename=informe.xls")).toBe("informe.xls");
  });

  it("prefiere la forma extendida RFC 5987", () => {
    expect(
      nombreDeContentDisposition("attachment; filename=\"basico.xls\"; filename*=UTF-8''informe%20septiembre.xls"),
    ).toBe("informe septiembre.xls");
  });

  it("exige que la respuesta se declare como descarga", () => {
    expect(esAttachment('attachment; filename="x.xls"')).toBe(true);
    expect(esAttachment("ATTACHMENT")).toBe(true);
    expect(esAttachment("inline; filename=\"x.xls\"")).toBe(false);
    expect(esAttachment(null)).toBe(false);
  });

  it("guarda en una carpeta por fecha, con el hash en el nombre", () => {
    const hash = "a".repeat(64);
    expect(nombreArchivoLocal("2026-09-08", hash, "xls")).toBe(
      "2026-09-08/automatico-aaaaaaaaaaaa.xls",
    );
    // Dos descargas del mismo día con contenido distinto no se pisan.
    expect(nombreArchivoLocal("2026-09-08", "b".repeat(64), "xls")).not.toBe(
      nombreArchivoLocal("2026-09-08", hash, "xls"),
    );
  });

  it("devuelve null cuando no hay cabecera", () => {
    expect(nombreDeContentDisposition(null)).toBeNull();
    expect(nombreDeContentDisposition("attachment")).toBeNull();
  });

  it("sanea rutas, controles y caracteres que rompen en disco", () => {
    expect(sanearNombre("../../../etc/passwd")).toBe("passwd");
    expect(sanearNombre("C:\\Windows\\System32\\x.xls")).toBe("x.xls");
    expect(sanearNombre('inf<>:"|?*orme.xls')).toBe("informe.xls");
    expect(sanearNombre("..")).toBe("informe.xls");
    expect(sanearNombre("")).toBe("informe.xls");
    expect(sanearNombre("   ")).toBe("informe.xls");
  });

  it("recorta un nombre desmedido", () => {
    expect(sanearNombre("a".repeat(400)).length).toBe(180);
  });
});

describe("validación de la descarga", () => {
  it("acepta un archivo con firma OLE2", () => {
    const bytes = xlsSintetico();
    expect(detectarFormato(bytes)).toBe("xls");
    expect(validarInforme(bytes, "application/vnd.ms-excel")).toEqual({
      formato: "xls",
      bytes: bytes.length,
    });
  });

  it("acepta un xlsx (firma ZIP)", () => {
    const bytes = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(64)]);
    expect(detectarFormato(bytes)).toBe("xlsx");
  });

  it("rechaza HTML disfrazado de Excel", () => {
    const bytes = Buffer.from("<html><body>Error interno</body></html>", "latin1");
    expect(() => validarInforme(bytes, "application/vnd.ms-excel")).toThrow(
      FullcargaInvalidReportError,
    );
  });

  it("distingue la pantalla de ingreso de un error cualquiera", () => {
    const bytes = Buffer.from(htmlIngreso(), "latin1");
    expect(() => validarInforme(bytes, "text/html")).toThrow(FullcargaSessionExpiredError);
  });

  it("rechaza una respuesta vacía", () => {
    expect(() => validarInforme(Buffer.alloc(0), "application/vnd.ms-excel")).toThrow(
      FullcargaInvalidReportError,
    );
  });

  it("rechaza una firma desconocida", () => {
    const bytes = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05]);
    expect(() => validarInforme(bytes, "application/octet-stream")).toThrow(
      FullcargaInvalidReportError,
    );
  });

  it("evalúa el content-type declarado", () => {
    expect(contentTypeRazonable("application/vnd.ms-excel")).toBe(true);
    expect(contentTypeRazonable("application/octet-stream")).toBe(true);
    expect(contentTypeRazonable("text/html;charset=ISO-8859-1")).toBe(false);
    expect(contentTypeRazonable(null)).toBe(false);
  });

  it("el sha256 es estable y distingue contenidos", () => {
    expect(sha256(Buffer.from("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(sha256(xlsSintetico(16))).not.toBe(sha256(xlsSintetico(32)));
  });
});

describe("redacción", () => {
  it("borra el valor de los secretos conocidos y conserva la etiqueta", () => {
    expect(redactar("Cookie: JSESSIONID=ABC123DEF")).not.toContain("ABC123DEF");
    expect(redactar("JSESSIONID=ABC123DEF; Path=/TITAN")).toContain("JSESSIONID=[omitido]");
    expect(redactar("usuario=juan&password=secreta123")).not.toContain("secreta123");
    expect(redactar("token=TOK-9f2a1b")).not.toContain("TOK-9f2a1b");
    expect(redactar("struts.token=XYZ987")).not.toContain("XYZ987");
    expect(redactar("Authorization: Bearer abc.def.ghi")).not.toContain("abc.def.ghi");
  });

  it("recorta, saca controles y colapsa espacios", () => {
    expect(seguro("a\u0000b\u001fc")).toBe("a b c");
    expect(seguro("x".repeat(300)).length).toBeLessThanOrEqual(121);
  });
});

describe("configuración", () => {
  /** Entorno parcial: se le pasa a propósito solo lo que el caso necesita. */
  const entorno = (v: Record<string, string>) => v as unknown as NodeJS.ProcessEnv;
  const base = { FULLCARGA_BASE_URL: "https://ejemplo.test/TITAN/" };

  it("falla nombrando las variables que faltan, sin revelar ninguna", () => {
    try {
      leerConfiguracion(entorno({ ...base }));
      expect.unreachable("tenía que fallar");
    } catch (e) {
      expect(e).toBeInstanceOf(FullcargaConfigurationError);
      expect((e as Error).message).toContain("FULLCARGA_USERNAME");
      expect((e as Error).message).toContain("FULLCARGA_PASSWORD");
    }
  });

  it("exige https para no mandar credenciales en claro", () => {
    expect(() =>
      leerConfiguracion(
        entorno({
          FULLCARGA_BASE_URL: "http://ejemplo.test/TITAN/",
          FULLCARGA_USERNAME: "u",
          FULLCARGA_PASSWORD: "p",
        }),
      ),
    ).toThrow(FullcargaConfigurationError);
  });

  it("describe el estado sin revelar los valores", () => {
    const texto = describir(
      entorno({ ...base, FULLCARGA_USERNAME: "juan.perez", FULLCARGA_PASSWORD: "una-clave-real" }),
    );
    expect(texto).toContain("definida");
    expect(texto).not.toContain("juan.perez");
    expect(texto).not.toContain("una-clave-real");
  });

  it("detecta si hay credenciales sin leerlas", () => {
    expect(hayCredenciales(entorno({}))).toBe(false);
    expect(hayCredenciales(entorno({ FULLCARGA_USERNAME: "u" }))).toBe(false);
    expect(
      hayCredenciales(entorno({ FULLCARGA_USERNAME: "u", FULLCARGA_PASSWORD: "p" })),
    ).toBe(true);
  });
});
