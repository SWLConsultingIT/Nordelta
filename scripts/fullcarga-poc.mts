/**
 * POC: Fullcarga auth → XLS.
 *
 *   npm run fullcarga:poc -- --date 2026-09-08 --dry-run
 *   npm run fullcarga:poc -- --date 2026-09-08 --live
 *
 * **Sin `--live` no sale ni un byte a la red.** Es el comportamiento por
 * defecto a propósito: la única forma de generar tráfico real contra un
 * tercero es pedirlo explícitamente.
 */

import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DescargadorHTTP,
  RUTAS,
  describir,
  hayCredenciales,
  leerConfiguracion,
  registradorConsola,
  nombreArchivoLocal,
  ErrorFullcarga,
  FullcargaConfigurationError,
  esFechaCalendario,
  aFormatoFullcarga,
} from "../src/lib/fullcarga";

const DESTINO = ".tmp/fullcarga";
const ARCHIVO_ENTORNO = ".env.local";

/**
 * Carga `.env.local` si existe.
 *
 * Hace falta explícitamente: Next.js lee ese archivo solo, pero **un script
 * corrido con `tsx` no**. Sin esto, definir las credenciales en `.env.local`
 * —que es la convención del repositorio— no tendría ningún efecto y el modo
 * en vivo fallaría diciendo que faltan variables que sí están.
 *
 * No imprime nada del contenido.
 */
function cargarEntornoLocal(): void {
  if (!existsSync(ARCHIVO_ENTORNO)) return;
  try {
    process.loadEnvFile(ARCHIVO_ENTORNO);
  } catch {
    // Archivo ilegible o mal formado: se sigue con el entorno del proceso.
    // No se informa el motivo porque podría citar una línea con la clave.
    console.warn(`No se pudo leer ${ARCHIVO_ENTORNO}; se usa el entorno del proceso.`);
  }
}

interface Argumentos {
  desde: string;
  hasta: string;
  live: boolean;
  destino: string;
}

function uso(): string {
  return [
    "",
    "POC de descarga del informe de Fullcarga",
    "",
    "  npm run fullcarga:poc -- --date 2026-09-08 [--dry-run]",
    "  npm run fullcarga:poc -- --from 2026-09-01 --to 2026-09-08 --live",
    "",
    "  --date YYYY-MM-DD   un solo día (equivale a --from y --to iguales)",
    "  --from / --to       rango de fechas",
    "  --dry-run           no toca la red. Es el modo por defecto",
    "  --live              hace tráfico real. Requiere las credenciales",
    "  --out <ruta>        dónde guardar (por defecto .tmp/fullcarga)",
    "",
  ].join("\n");
}

function parsearArgumentos(argv: readonly string[]): Argumentos {
  const valor = (bandera: string): string | undefined => {
    const i = argv.indexOf(bandera);
    return i >= 0 ? argv[i + 1] : undefined;
  };

  const date = valor("--date");
  const from = valor("--from");
  const to = valor("--to");
  const live = argv.includes("--live");
  const destino = valor("--out") ?? DESTINO;

  const desde = date ?? from;
  const hasta = date ?? to ?? from;

  if (!desde || !hasta) {
    throw new FullcargaConfigurationError(
      "Falta la fecha. Usá --date YYYY-MM-DD, o --from y --to.",
    );
  }
  for (const f of [desde, hasta]) {
    if (!esFechaCalendario(f)) {
      throw new FullcargaConfigurationError(
        `"${f}" no es una fecha válida en formato YYYY-MM-DD`,
      );
    }
  }
  if (desde > hasta) {
    throw new FullcargaConfigurationError(`El rango está invertido: ${desde} es posterior a ${hasta}`);
  }

  return { desde, hasta, live, destino };
}

function ensayo(args: Argumentos): void {
  const desde = aFormatoFullcarga(args.desde);
  const hasta = aFormatoFullcarga(args.hasta);
  const base = (process.env.FULLCARGA_BASE_URL ?? "").trim() || "(base por defecto)";

  console.log(
    [
      "",
      "[DRY RUN]",
      "",
      "Login:",
      `POST /TITAN/${RUTAS.login}`,
      "",
      "Report form:",
      `GET /TITAN/${RUTAS.formularioInforme}`,
      "",
      "Report:",
      `POST /TITAN/${RUTAS.formularioInforme}`,
      "",
      "Date:",
      desde === hasta ? desde : `${desde} a ${hasta}`,
      "",
      "Format:",
      "XLS",
      "",
      "Download:",
      `GET /TITAN/${RUTAS.descarga}`,
      "",
      "Destino:",
      path.join(args.destino, "<filename>.xls"),
      "",
      "Base:",
      base,
      "",
      "Configuración:",
      describir(),
      "",
      hayCredenciales()
        ? "Credenciales presentes. Para hacer tráfico real: --live"
        : "Sin credenciales. Definí FULLCARGA_USERNAME y FULLCARGA_PASSWORD antes de --live.",
      "",
      "No se hizo ninguna petición de red.",
      "",
    ].join("\n"),
  );
}

async function enVivo(args: Argumentos): Promise<void> {
  // Se valida antes de abrir un socket: si falta una variable, que falle acá.
  const config = leerConfiguracion();

  console.log(`\n[LIVE] ${args.desde}${args.hasta !== args.desde ? ` a ${args.hasta}` : ""}\n`);

  const registrador = registradorConsola();
  const descargador = new DescargadorHTTP(config, { registrador });
  const informe = await descargador.descargarInforme({
    desde: args.desde,
    hasta: args.hasta,
    formato: "XLS",
  });

  // El nombre local se arma acá: estable, ordenable y atado al hash. El que
  // mandó el servidor se conserva en `informe.filename`.
  // Un rango se guarda en su propia carpeta: `2026-09-01_2026-09-10`. Si no
  // se distinguiera de un día suelto, el informe del rango pisaría al del
  // primer día y los dos parecerían lo mismo.
  const etiqueta = args.desde === args.hasta ? args.desde : `${args.desde}_${args.hasta}`;
  const ruta = path.join(
    args.destino,
    nombreArchivoLocal(etiqueta, informe.sha256, informe.formatoDetectado),
  );
  // `nombreArchivoLocal` devuelve <fecha>/<archivo>: hay que crear la carpeta.
  await mkdir(path.dirname(ruta), { recursive: true });
  await writeFile(ruta, informe.bytes);
  registrador.paso("saved");
  registrador.checkpoint(8, ruta);

  console.log(
    [
      "",
      "RESULTADO",
      `  archivo local     ${ruta}`,
      `  nombre original   ${informe.filename}`,
      `  formato           ${informe.formatoDetectado}`,
      `  content-type      ${informe.contentType}`,
      `  tamaño            ${informe.tamanoBytes} bytes`,
      `  sha256            ${informe.sha256}`,
      `  descargado        ${informe.downloadedAt}`,
      "",
    ].join("\n"),
  );
}

async function main(): Promise<void> {
  cargarEntornoLocal();
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(uso());
    return;
  }

  const args = parsearArgumentos(argv);
  if (args.live) await enVivo(args);
  else ensayo(args);
}

main().catch((e: unknown) => {
  if (e instanceof ErrorFullcarga) {
    console.error(`\n✗ ${e.name} [${e.codigo}]\n  ${e.message}`);
    const contexto = Object.entries(e.contexto);
    if (contexto.length > 0) {
      console.error(`  contexto: ${contexto.map(([k, v]) => `${k}=${v}`).join(" · ")}`);
    }
  } else {
    console.error(`\n✗ ${(e as Error).message}`);
  }
  console.error("");
  process.exitCode = 1;
});
