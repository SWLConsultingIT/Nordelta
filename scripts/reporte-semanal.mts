/**
 * El reporte semanal para el cliente, en un comando.
 *
 *     npm run weekly-report -- --from 2026-09-07 --to 2026-09-11
 *
 * Sin fechas toma la semana en curso, de lunes a viernes, que es el caso
 * de todos los viernes.
 *
 * Lo que hace, en orden: lee el changelog del período, lo traduce a
 * lenguaje de proyecto, le suma el archivo que se completa a mano, arma el
 * documento, lo imprime y **lo verifica**. Si el reporte no entra en una
 * hoja o hay texto cortado, termina con error: un one-pager roto se manda
 * igual si el comando dice que salió bien.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { leerChangelog } from "./reporte/git";
import { leerEntrada, rutaDeEntrada, PLANTILLA } from "./reporte/entrada";
import { componer, fechaCorta, html, TOPES } from "./reporte/documento";
import { generarPdf, vistaPrevia } from "./reporte/pdf";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
/** El repositorio vive dentro del espacio de trabajo; las salidas, afuera. */
const SALIDAS = resolve(RAIZ, "..", "Salidas", "Reportes");

/* ── Argumentos ─────────────────────────────────────────────── */

function argumento(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Lunes a viernes de la semana en curso. */
function semanaEnCurso(): { desde: string; hasta: string } {
  const hoy = new Date();
  const diaDeLaSemana = (hoy.getDay() + 6) % 7; // 0 = lunes
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - diaDeLaSemana);
  const viernes = new Date(lunes);
  viernes.setDate(lunes.getDate() + 4);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { desde: iso(lunes), hasta: iso(viernes) };
}

const porDefecto = semanaEnCurso();
const desde = argumento("from") ?? porDefecto.desde;
const hasta = argumento("to") ?? porDefecto.hasta;

for (const [nombre, valor] of [["from", desde], ["to", hasta]] as const) {
  if (!ISO.test(valor)) {
    console.error(`--${nombre} tiene que ser una fecha AAAA-MM-DD. Vino: ${valor}`);
    process.exit(2);
  }
}
if (desde > hasta) {
  console.error(`El período está al revés: ${desde} es posterior a ${hasta}.`);
  process.exit(2);
}

/* ── 1 · Changelog ──────────────────────────────────────────── */

console.log(`\nPagos Nordelta · reporte semanal`);
console.log(`Período: ${fechaCorta(desde)} — ${fechaCorta(hasta)}\n`);

const changelog = leerChangelog(desde, hasta, RAIZ);
console.log(`1 · Changelog: ${changelog.commits.length} commits, ${changelog.temas.length} temas`);
for (const t of changelog.temas) {
  console.log(`      ${t.tema.id.padEnd(14)} ${t.commits} commits · ${t.archivos} archivos`);
}
if (changelog.sinClasificar.length > 0) {
  console.log(`\n   Sin clasificar (no entraron al reporte; agregá un tema si corresponde):`);
  for (const r of changelog.sinClasificar.slice(0, 12)) console.log(`      ${r}`);
}

/* ── 2 · Entrada manual ─────────────────────────────────────── */

const rutaEntrada = rutaDeEntrada(RAIZ, hasta);
if (!existsSync(rutaEntrada)) {
  mkdirSync(dirname(rutaEntrada), { recursive: true });
  writeFileSync(
    rutaEntrada,
    JSON.stringify({ ...PLANTILLA, weekStart: desde, weekEnd: hasta }, null, 2) + "\n",
  );
  console.log(`\n2 · Entrada manual: creada en blanco en ${rutaEntrada.replace(RAIZ + "/", "")}`);
} else {
  console.log(`\n2 · Entrada manual: ${rutaEntrada.replace(RAIZ + "/", "")}`);
}

const entrada = leerEntrada(rutaEntrada);
const avisos: string[] = [];
if (!entrada.status) avisos.push("estado general sin definir (el PDF sale sin sello)");
if (entrada.pending.length === 0) avisos.push("sin pendientes cargados");
if (entrada.openItems.length === 0) avisos.push("sin open items cargados");
if (entrada.nextSteps.length === 0) avisos.push("sin next steps cargados");

/* ── 3 · Composición ────────────────────────────────────────── */

const emitido = new Date().toISOString().slice(0, 10);
const reporte = componer(changelog, entrada, emitido);

const recortes: string[] = [];
const dePlano = [
  ["progreso", entrada.progressExtra.length + changelog.temas.length, TOPES.progreso],
  ["pendientes", entrada.pending.length, TOPES.pendientes],
  ["open items", entrada.openItems.length, TOPES.abiertos],
  ["next steps", entrada.nextSteps.length, TOPES.siguientes],
] as const;
for (const [nombre, hay, tope] of dePlano) {
  if (hay > tope) recortes.push(`${nombre}: ${hay} → ${tope}`);
}

console.log(
  `\n3 · Contenido: ${reporte.progreso.length} progreso · ${reporte.pendientes.length} pendientes · ` +
    `${reporte.abiertos.length} open items · ${reporte.siguientes.length} next steps`,
);
if (recortes.length > 0) console.log(`   Recortado por espacio: ${recortes.join(" · ")}`);

/* ── 4 · PDF ────────────────────────────────────────────────── */

const archivo = join(SALIDAS, `Pagos Nordelta - Weekly Report - ${hasta}.pdf`);
const diagnostico = await generarPdf(html(reporte), archivo);

console.log(`\n4 · PDF: ${archivo}`);
console.log(
  `   Alto del contenido: ${diagnostico.altoDelContenido} de ${diagnostico.altoDisponible} px ` +
    `(${Math.round((diagnostico.altoDelContenido / diagnostico.altoDisponible) * 100)} % de la hoja)`,
);
console.log(`   Páginas: ${diagnostico.paginas ?? "no se pudo determinar"}`);

const previa = vistaPrevia(archivo, join(SALIDAS, ".vistas"));
console.log(`   Vista previa: ${previa ?? "no disponible en este sistema"}`);

/* ── 5 · Veredicto ──────────────────────────────────────────── */

const fallas: string[] = [];
if (!diagnostico.entraEnUnaPagina) {
  fallas.push(
    `el contenido no entra en una hoja (${diagnostico.altoDelContenido} px de ${diagnostico.altoDisponible})`,
  );
}
if (diagnostico.paginas !== null && diagnostico.paginas !== 1) {
  fallas.push(`el PDF quedó de ${diagnostico.paginas} páginas`);
}
if (diagnostico.recortados.length > 0) {
  fallas.push(`hay texto cortado en: ${diagnostico.recortados.join(", ")}`);
}
if (diagnostico.desbordados.length > 0) {
  fallas.push(`se sale de la hoja: ${diagnostico.desbordados.join(", ")}`);
}

console.log("");
if (avisos.length > 0) console.log(`AVISOS · ${avisos.join(" · ")}`);

if (fallas.length > 0) {
  console.error(`FALLA · ${fallas.join(" · ")}`);
  process.exit(1);
}
console.log(`OK · una hoja A4, sin texto cortado ni desbordes.\n`);
