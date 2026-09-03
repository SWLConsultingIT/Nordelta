/**
 * Importador de datos legacy.
 *
 *   npm run migrar:legacy -- --dry-run <archivo.csv|tsv>
 *
 * El dry-run NO escribe en ninguna base: lee el archivo, transforma, concilia
 * contra la fórmula del consolidado 2026, clasifica cada fila y deja los
 * reportes en `reconciliation/`.
 *
 * Escribir en producción es un modo aparte que todavía no está habilitado a
 * propósito: primero hay que mirar el reporte.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, join } from "node:path";
import { importar, separarDelimitado } from "../src/lib/migracion/importador";
import { generarReportes } from "../src/lib/migracion/reportes";
import { resumenEsConsistente } from "../src/lib/migracion/estados";

interface Args {
  archivo: string;
  dryRun: boolean;
  hoja: string;
  encabezados: number;
  salida: string;
}

function leerArgs(argv: string[]): Args | string {
  const libres: string[] = [];
  let dryRun = false;
  let hoja = "";
  let encabezados = 1;
  let salida = "reconciliation";

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") dryRun = true;
    else if (a === "--hoja") hoja = argv[++i] ?? "";
    else if (a === "--encabezados") encabezados = Number(argv[++i] ?? 1);
    else if (a === "--salida") salida = argv[++i] ?? salida;
    else if (a.startsWith("--")) return `Opción desconocida: ${a}`;
    else libres.push(a);
  }

  if (libres.length !== 1) {
    return "Uso: npm run migrar:legacy -- --dry-run <archivo> [--hoja NOMBRE] [--encabezados N] [--salida DIR]";
  }
  if (!Number.isInteger(encabezados) || encabezados < 0) {
    return "--encabezados tiene que ser un entero mayor o igual a cero";
  }
  return { archivo: libres[0], dryRun, hoja: hoja || basename(libres[0]), encabezados, salida };
}

function main() {
  const args = leerArgs(process.argv.slice(2));
  if (typeof args === "string") {
    console.error(args);
    process.exit(2);
  }

  if (!args.dryRun) {
    console.error(
      "Solo está habilitado --dry-run.\n\n" +
      "La escritura en producción se habilita después de revisar el reporte de\n" +
      "conciliación y de resolver las decisiones D1 y D2. Ver\n" +
      "docs/RECONCILIATION_STRATEGY.md y docs/PARALLEL_RUN.md.",
    );
    process.exit(2);
  }

  let texto: string;
  try {
    texto = readFileSync(args.archivo, "utf8");
  } catch (e) {
    console.error(`No se pudo leer ${args.archivo}: ${(e as Error).message}`);
    process.exit(1);
  }

  const celdas = separarDelimitado(texto.replace(/^﻿/, ""));
  const { filas, resumen } = importar(celdas, {
    sourceSystem: "sheets-caja-diaria",
    sourceFile: basename(args.archivo),
    sourceSheet: args.hoja,
    encabezados: args.encabezados,
  });

  const reportes = generarReportes(filas, resumen, {
    archivo: basename(args.archivo),
    hoja: args.hoja,
  });

  mkdirSync(args.salida, { recursive: true });
  for (const [nombre, contenido] of Object.entries(reportes)) {
    writeFileSync(join(args.salida, nombre), contenido, "utf8");
  }

  /* ── Resumen en pantalla ── */
  const p = resumen.porEstado;
  console.log(`
╭─ Importación legacy · DRY-RUN (no se escribió nada) ─────────╮
│  Archivo   ${basename(args.archivo).padEnd(48)}│
│  Hoja      ${args.hoja.slice(0, 48).padEnd(48)}│
╰──────────────────────────────────────────────────────────────╯

  Filas del archivo        ${String(resumen.totalFilas).padStart(8)}
  Vacías de plantilla      ${String(resumen.filasVacias).padStart(8)}
  Analizadas               ${String(resumen.filasAnalizadas).padStart(8)}

  IMPORTED                 ${String(p.IMPORTED).padStart(8)}
  EXPECTED_DIFFERENCE      ${String(p.EXPECTED_DIFFERENCE).padStart(8)}
  BLOCKED_BUSINESS_RULE    ${String(p.BLOCKED_BUSINESS_RULE).padStart(8)}
  INVALID_SOURCE           ${String(p.INVALID_SOURCE).padStart(8)}
  UNEXPLAINED_DIFFERENCE   ${String(p.UNEXPLAINED_DIFFERENCE).padStart(8)}

  Movimientos              ${String(resumen.movimientos).padStart(8)}
  Partidas                 ${String(resumen.partidas).padStart(8)}
  Contrapartes nuevas      ${String(resumen.contrapartesNuevas).padStart(8)}
  Con variantes            ${String(resumen.contrapartesNormalizadas).padStart(8)}
`);

  for (const c of resumen.cuantificacion) {
    if (c.filasAfectadas === 0) {
      console.log(`  ${c.bug}: ninguna fila afectada`);
      continue;
    }
    console.log(`  ${c.bug}: ${c.filasAfectadas} filas · ${c.fechaMinima} → ${c.fechaMaxima} · ${c.contrapartes.length} contrapartes`);
    for (const d of c.porMoneda) {
      console.log(`        ${d.moneda} no contabilizado: ${d.monto.toLocaleString("es-AR")}  (${d.filas} filas)`);
    }
  }
  if (resumen.filasConAmbosBugs > 0) {
    console.log(`  filas con los dos bugs: ${resumen.filasConAmbosBugs} (el daño se atribuye por pata, no se duplica)`);
  }

  console.log(`\n  Reportes en ${args.salida}/`);

  if (!resumenEsConsistente(resumen)) {
    console.error("\n❌ La clasificación NO cierra: hay filas sin estado. Es un defecto del importador.");
    process.exit(1);
  }
  if (p.UNEXPLAINED_DIFFERENCE > 0) {
    console.error(`\n❌ ${p.UNEXPLAINED_DIFFERENCE} filas con diferencias SIN EXPLICAR. Revisar unexplained.csv antes de avanzar.`);
    process.exit(1);
  }
  console.log("\n✅ Toda fila quedó clasificada y ninguna diferencia quedó sin explicar.\n");
}

main();
