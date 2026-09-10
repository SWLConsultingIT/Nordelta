/**
 * Analiza un informe de Fullcarga y reporta **solo métricas agregadas**.
 *
 *   npm run fullcarga:parse -- .tmp/fullcarga/<archivo>.xls
 *
 * No imprime nombres, ni CUIT, ni importes de ninguna fila: el archivo tiene
 * datos reales de terceros y esta salida se pega en documentos y en chats.
 * Con `--patrones` muestra los esqueletos de la observación, que llevan los
 * dígitos y los nombres enmascarados.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  acreditacionesConciliables,
  medirCobertura,
  parsearInforme,
  type Clasificacion,
} from "../src/lib/fullcarga/informe";
import { ErrorFullcarga } from "../src/lib/fullcarga/errores";

/** Deja el texto sin dígitos ni nombres propios: solo su forma. */
function esqueleto(texto: string): string {
  return texto
    .replace(/\d/g, "#")
    .replace(/(?<= )\p{Lu}\p{Ll}+(?: \p{Lu}\p{Ll}+)*/gu, "<NOMBRE>")
    .replace(/\s+/g, " ")
    .trim();
}

function barra(n: number, total: number, ancho = 28): string {
  if (total === 0) return "";
  const llenos = Math.round((n / total) * ancho);
  return "█".repeat(llenos) + "·".repeat(ancho - llenos);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const mostrarPatrones = argv.includes("--patrones");
  const ruta = argv.find((a) => !a.startsWith("--"));
  if (!ruta) {
    console.error("\nUso: npm run fullcarga:parse -- <archivo.xls> [--patrones]\n");
    process.exitCode = 1;
    return;
  }

  const bytes = await readFile(ruta);
  const informe = parsearInforme(bytes, { sourceFile: path.basename(ruta) });
  const cobertura = medirCobertura(informe);
  const conciliables = acreditacionesConciliables(informe);

  const columnas = Object.entries(informe.columnas);
  console.log(
    [
      "",
      "INFORME DE FULLCARGA · análisis",
      "",
      `  archivo             ${informe.sourceFile}`,
      `  hoja                ${informe.sheet}`,
      `  fila de encabezado  ${informe.filaEncabezado}`,
      `  columnas ubicadas   ${columnas.length} de 14`,
      `  columnas nuevas     ${informe.columnasDesconocidas.length > 0 ? informe.columnasDesconocidas.join(", ") : "ninguna"}`,
      "",
      "FILAS",
      `  total               ${cobertura.totalFilas}`,
      "",
    ].join("\n"),
  );

  console.log("CLASIFICACIÓN");
  for (const [k, n] of Object.entries(cobertura.porClasificacion) as [Clasificacion, number][]) {
    if (n === 0) continue;
    console.log(`  ${k.padEnd(26)} ${String(n).padStart(4)}  ${barra(n, cobertura.totalFilas)}`);
  }

  console.log(
    [
      "",
      "EXTRACCIÓN DE CUIT · sobre las filas de acreditación",
      `  filas relevantes    ${cobertura.filasRelevantes}`,
      `  con CUIT válido     ${cobertura.conCuitValido}`,
      `  CUIT inválido       ${cobertura.cuitInvalido}`,
      `  sin CUIT            ${cobertura.sinCuit}`,
      `  con más de un CUIT  ${cobertura.conVariosCuit}`,
      `  cobertura           ${cobertura.coberturaPct} %`,
      "",
      "OBSERVACIÓN",
      `  patrones desconocidos     ${cobertura.patronesDesconocidos}`,
      `  operaciones no catalogadas ${cobertura.operacionesNuevas.length > 0 ? cobertura.operacionesNuevas.join(" · ") : "ninguna"}`,
      "",
      "LISTAS PARA CONCILIAR",
      `  acreditaciones      ${conciliables.length}`,
      "",
    ].join("\n"),
  );

  // Las fechas explican por qué se concilia contra FECHA INGRESO.
  const movimiento = new Set(informe.filas.map((f) => f.fechaMovimiento).filter(Boolean));
  const ingreso = new Set(informe.filas.map((f) => f.fechaIngreso).filter(Boolean));
  console.log(
    [
      "FECHAS",
      `  días distintos en FECHA          ${movimiento.size}`,
      `  días distintos en FECHA INGRESO  ${ingreso.size}`,
      "",
    ].join("\n"),
  );

  // ¿Alcanza la clave de matching? Se mide sobre los datos, no se supone.
  const contar = (clavesDe: (a: (typeof conciliables)[number]) => string) => {
    const m = new Map<string, number>();
    for (const a of conciliables) {
      const k = clavesDe(a);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    const repetidas = [...m.values()].filter((n) => n > 1);
    return {
      claves: m.size,
      colisiones: repetidas.reduce((a, b) => a + b, 0),
      grupos: repetidas.length,
    };
  };

  const soloCuit = contar((a) => a.cuit);
  const cuitFecha = contar((a) => `${a.cuit}|${a.fecha}`);
  const cuitFechaImporte = contar((a) => `${a.cuit}|${a.fecha}|${a.importe}`);
  const soloImporte = contar((a) => String(a.importe));

  console.log(
    [
      "UNICIDAD DE LA CLAVE · sobre las acreditaciones conciliables",
      `                          claves  filas en colisión`,
      `  solo importe            ${String(soloImporte.claves).padStart(6)}  ${soloImporte.colisiones}`,
      `  solo CUIT               ${String(soloCuit.claves).padStart(6)}  ${soloCuit.colisiones}`,
      `  CUIT + fecha            ${String(cuitFecha.claves).padStart(6)}  ${cuitFecha.colisiones}`,
      `  CUIT + fecha + importe  ${String(cuitFechaImporte.claves).padStart(6)}  ${cuitFechaImporte.colisiones}`,
      "",
    ].join("\n"),
  );

  if (mostrarPatrones) {
    const cuenta = new Map<string, number>();
    for (const f of informe.filas) {
      const e = esqueleto(f.observacionOriginal);
      cuenta.set(e, (cuenta.get(e) ?? 0) + 1);
    }
    console.log("PATRONES DE OBSERVACIÓN · dígitos y nombres enmascarados");
    for (const [e, n] of [...cuenta].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
      console.log(`  ${String(n).padStart(4)}  ${e.slice(0, 100)}`);
    }
    console.log("");
  }
}

main().catch((e: unknown) => {
  if (e instanceof ErrorFullcarga) console.error(`\n✗ ${e.name} [${e.codigo}]\n  ${e.message}\n`);
  else console.error(`\n✗ ${(e as Error).message}\n`);
  process.exitCode = 1;
});
