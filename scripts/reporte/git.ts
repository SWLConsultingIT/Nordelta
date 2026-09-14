/**
 * El changelog del período, leído del repositorio.
 *
 * Lee **metadatos**: fechas, asuntos y rutas de archivo. Nunca abre el
 * contenido de un archivo, y por eso no hay forma de que una muestra real
 * de un cliente, un CUIT o una credencial termine en el reporte.
 *
 * Lo que sale de acá tampoco llega tal cual al PDF: los asuntos de commit
 * sirven para contar y clasificar, no para redactar. Al cliente le llegan
 * las frases revisadas de `temas.ts`.
 */

import { execFileSync } from "node:child_process";
import { esIrrelevante, temaDe, type Tema } from "./temas";

export interface Commit {
  fecha: string;
  asunto: string;
  rutas: string[];
}

export interface TemaConEvidencia {
  tema: Tema;
  /** Cuántos commits del período tocaron este tema. */
  commits: number;
  /** Cuántos archivos distintos. Para ordenar y para la consola. */
  archivos: number;
}

export interface Changelog {
  desde: string;
  hasta: string;
  commits: Commit[];
  temas: TemaConEvidencia[];
  /** Rutas que no encajaron en ningún tema: hay que mirarlas a mano. */
  sinClasificar: string[];
}

/**
 * Separador de registros.
 *
 * Un carácter de control, no un salto de línea ni un guion: los asuntos de
 * commit pueden contener cualquier cosa y un separador que además sea texto
 * legible es un separador que algún día aparece dentro de un asunto.
 */
const SEPARADOR = "\x1e";

/**
 * Las horas van explícitas, y no es un detalle.
 *
 * A `--since` y `--until` se les puede pasar una fecha suelta, pero git
 * completa la hora que falta **con la hora actual**. O sea que
 * `--since=2026-09-11` corrido un viernes a las seis de la tarde significa
 * «desde las 18:00 del viernes», y el reporte de esa semana sale sin el
 * viernes. El mismo comando a las nueve de la mañana lo incluye.
 *
 * Costó un test descubrirlo y es la peor clase de error que podía tener
 * esto: no falla, entrega de menos, y el resultado depende de la hora a la
 * que uno apriete enter.
 */
function desdeLaMedianoche(iso: string): string {
  return `${iso}T00:00:00`;
}

function hastaLaMedianoche(iso: string): string {
  return `${iso}T23:59:59`;
}

export function leerChangelog(desde: string, hasta: string, repo: string): Changelog {
  const crudo = execFileSync(
    "git",
    [
      "log",
      `--since=${desdeLaMedianoche(desde)}`,
      `--until=${hastaLaMedianoche(hasta)}`,
      "--date=short",
      `--pretty=format:${SEPARADOR}%ad|%s`,
      "--name-only",
      "--no-merges",
    ],
    { cwd: repo, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );

  const commits: Commit[] = [];
  for (const bloque of crudo.split(SEPARADOR)) {
    if (!bloque.trim()) continue;
    const [cabecera, ...resto] = bloque.split("\n");
    const corte = cabecera.indexOf("|");
    commits.push({
      fecha: cabecera.slice(0, corte),
      asunto: cabecera.slice(corte + 1),
      rutas: resto.map((r) => r.trim()).filter(Boolean),
    });
  }

  // ── Agregación por tema ──
  const porTema = new Map<string, { tema: Tema; commits: Set<number>; archivos: Set<string> }>();
  const sinClasificar = new Set<string>();

  commits.forEach((c, i) => {
    for (const ruta of c.rutas) {
      const tema = temaDe(ruta);
      if (!tema) {
        if (!esIrrelevante(ruta)) sinClasificar.add(ruta);
        continue;
      }
      const entrada = porTema.get(tema.id) ?? { tema, commits: new Set(), archivos: new Set() };
      entrada.commits.add(i);
      entrada.archivos.add(ruta);
      porTema.set(tema.id, entrada);
    }
  });

  const temas = [...porTema.values()]
    .map((e) => ({ tema: e.tema, commits: e.commits.size, archivos: e.archivos.size }))
    // Primero lo que más le importa a quien lo lee; a igual peso, lo que más
    // movimiento tuvo en la semana.
    .sort((a, b) => b.tema.peso - a.tema.peso || b.commits - a.commits);

  return { desde, hasta, commits, temas, sinClasificar: [...sinClasificar].sort() };
}
