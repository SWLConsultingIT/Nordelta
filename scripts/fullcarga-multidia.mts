/**
 * Corre el parser sobre varios informes y compara.
 *
 *   npm run fullcarga:multidia -- .tmp/fullcarga/*.xls
 *
 * **No modifica ninguna regla del parser**: lo usa tal como está para
 * detectar si el resultado del primer día se sostiene. Imprime solo
 * agregados; los patrones de observación salen con dígitos y nombres
 * enmascarados.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  acreditacionesConciliables,
  medirCobertura,
  parsearInforme,
  type Acreditacion,
  type Clasificacion,
  type FilaInforme,
  type InformeParseado,
} from "../src/lib/fullcarga/informe";
import { diferenciaEnDias } from "../src/lib/fullcarga/matching";
import { OPERACIONES_CONOCIDAS } from "../src/lib/fullcarga/observacion";
import { ErrorFullcarga } from "../src/lib/fullcarga/errores";

/** Los dos únicos tipos de movimiento vistos en el primer informe. */
const TIPOS_CONOCIDOS = new Set([
  "Depósito bancario",
  "Gestión Habilitación y Mantenimiento de Plataforma",
]);

const OPERACION_CVU = "Transf Recibida Cvu Dif Titular";

function esqueleto(texto: string): string {
  return texto
    .replace(/\d/g, "#")
    .replace(/(?<= )\p{Lu}\p{Ll}+(?: \p{Lu}\p{Ll}+)*/gu, "<NOMBRE>")
    .replace(/\s+/g, " ")
    .trim();
}

interface Colisiones {
  claves: number;
  filasEnColision: number;
}

function colisiones(items: readonly Acreditacion[], clave: (a: Acreditacion) => string): Colisiones {
  const m = new Map<string, number>();
  for (const a of items) {
    const k = clave(a);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  const filasEnColision = [...m.values()].filter((n) => n > 1).reduce((a, b) => a + b, 0);
  return { claves: m.size, filasEnColision };
}

interface Dia {
  archivo: string;
  fechaInforme: string;
  informe: InformeParseado;
  cobertura: ReturnType<typeof medirCobertura>;
  conciliables: Acreditacion[];
  tiposDesconocidos: string[];
  negativos: number;
  cvu: number;
}

/** La fecha del informe: la de FECHA, que es igual en todas las filas. */
function fechaDelInforme(informe: InformeParseado, archivo: string): string {
  const fechas = new Set(informe.filas.map((f) => f.fechaMovimiento).filter(Boolean));
  if (fechas.size === 1) return [...fechas][0] as string;
  const m = /(\d{4}-\d{2}-\d{2})/.exec(archivo);
  return m ? m[1] : "(desconocida)";
}

function pct(n: number, total: number): string {
  return total === 0 ? "—" : `${Math.round((n / total) * 1000) / 10} %`;
}

async function main(): Promise<void> {
  const rutas = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (rutas.length === 0) {
    console.error("\nUso: npm run fullcarga:multidia -- <archivo.xls> [...]\n");
    process.exitCode = 1;
    return;
  }

  const dias: Dia[] = [];
  for (const ruta of rutas) {
    const bytes = await readFile(ruta);
    const informe = parsearInforme(bytes, { sourceFile: path.basename(ruta) });
    const tipos = new Set<string>();
    let negativos = 0;
    let cvu = 0;
    for (const f of informe.filas) {
      if (f.tipoIncremento && !TIPOS_CONOCIDOS.has(f.tipoIncremento)) tipos.add(f.tipoIncremento);
      if (f.importe !== null && f.importe < 0) negativos += 1;
      if (f.observacion.operacion === OPERACION_CVU) cvu += 1;
    }
    dias.push({
      archivo: path.basename(ruta),
      fechaInforme: fechaDelInforme(informe, ruta),
      informe,
      cobertura: medirCobertura(informe),
      conciliables: acreditacionesConciliables(informe),
      tiposDesconocidos: [...tipos],
      negativos,
      cvu,
    });
  }
  dias.sort((a, b) => a.fechaInforme.localeCompare(b.fechaInforme));

  /* ── Por día ─────────────────────────────────────────────── */
  console.log("\nPOR INFORME\n");
  const cab = [
    "fecha".padEnd(12),
    "filas".padStart(6),
    "acred".padStart(6),
    "transf".padStart(7),
    "cuit".padStart(6),
    "cob.tr".padStart(8),
    "inval".padStart(6),
    "sinCU".padStart(6),
    "multi".padStart(6),
    "patrón?".padStart(8),
    "tipo?".padStart(6),
    "negs".padStart(5),
  ].join(" ");
  console.log("  " + cab);
  console.log("  " + "─".repeat(cab.length));
  for (const d of dias) {
    const c = d.cobertura;
    console.log(
      "  " +
        [
          d.fechaInforme.padEnd(12),
          String(c.totalFilas).padStart(6),
          String(c.filasRelevantes).padStart(6),
          String(c.transferencias).padStart(7),
          String(c.conCuitValido).padStart(6),
          pct(c.conCuitValido, c.transferencias).padStart(8),
          String(c.cuitInvalido).padStart(6),
          String(c.sinCuit).padStart(6),
          String(c.conVariosCuit).padStart(6),
          String(c.patronesDesconocidos).padStart(8),
          String(d.tiposDesconocidos.length).padStart(6),
          String(d.negativos).padStart(5),
        ].join(" "),
    );
  }

  /* ── Agregado ────────────────────────────────────────────── */
  const totalFilas = dias.reduce((a, d) => a + d.cobertura.totalFilas, 0);
  const totalRelevantes = dias.reduce((a, d) => a + d.cobertura.filasRelevantes, 0);
  const totalCuit = dias.reduce((a, d) => a + d.cobertura.conCuitValido, 0);
  const totalTransferencias = dias.reduce((a, d) => a + d.cobertura.transferencias, 0);
  const totalDepositos = dias.reduce((a, d) => a + d.cobertura.depositos, 0);
  const conCobertura100 = dias.filter(
    (d) => d.cobertura.transferencias > 0 && d.cobertura.conCuitValido === d.cobertura.transferencias,
  ).length;
  const conExcepciones = dias.filter(
    (d) =>
      d.cobertura.cuitInvalido > 0 ||
      d.cobertura.sinCuit > 0 ||
      d.cobertura.patronesDesconocidos > 0 ||
      d.tiposDesconocidos.length > 0,
  ).length;

  const patrones = new Map<string, number>();
  const operaciones = new Map<string, number>();
  const clasificaciones = new Map<Clasificacion, number>();
  const todasLasFilas: FilaInforme[] = [];
  for (const d of dias) {
    for (const f of d.informe.filas) {
      todasLasFilas.push(f);
      const e = esqueleto(f.observacionOriginal);
      patrones.set(e, (patrones.get(e) ?? 0) + 1);
      if (f.observacion.operacion) {
        operaciones.set(f.observacion.operacion, (operaciones.get(f.observacion.operacion) ?? 0) + 1);
      }
      clasificaciones.set(f.clasificacion, (clasificaciones.get(f.clasificacion) ?? 0) + 1);
    }
  }
  const patronesDesconocidos = dias.reduce((a, d) => a + d.cobertura.patronesDesconocidos, 0);

  console.log(
    [
      "",
      "AGREGADO",
      `  informes analizados        ${dias.length}`,
      `  filas totales              ${totalFilas}`,
      `  acreditaciones relevantes  ${totalRelevantes}`,
      `    de las cuales transfer.  ${totalTransferencias}`,
      `    depósitos en efectivo    ${totalDepositos}  (sin CUIT por naturaleza)`,
      `  CUIT extraídos             ${totalCuit} / ${totalTransferencias}`,
      `  cobertura sobre transfer.  ${pct(totalCuit, totalTransferencias)}`,
      `  cobertura sobre relevantes ${pct(totalCuit, totalRelevantes)}`,
      `  días con cobertura 100 %   ${conCobertura100} / ${dias.length}`,
      `  días con excepciones       ${conExcepciones}`,
      `  patrones de observación    ${patrones.size} distintos`,
      `  patrones desconocidos      ${patronesDesconocidos}`,
      "",
      "CLASIFICACIÓN ACUMULADA",
      ...[...clasificaciones]
        .sort((a, b) => b[1] - a[1])
        .map(([k, n]) => `  ${k.padEnd(28)} ${String(n).padStart(5)}`),
      "",
      "OPERACIONES BANCARIAS",
      ...[...operaciones]
        .sort((a, b) => b[1] - a[1])
        .map(([k, n]) => {
          const conocida =
            (OPERACIONES_CONOCIDAS as readonly string[]).includes(k) ||
            k === "Mantenimiento de plataforma";
          return `  ${conocida ? " " : "★"} ${k.padEnd(38)} ${String(n).padStart(5)}`;
        }),
      "  ★ = no estaba catalogada en el primer informe",
      "",
    ].join("\n"),
  );

  /* ── Atraso ──────────────────────────────────────────────── */
  const conAmbas = todasLasFilas.filter((f) => f.fechaMovimiento && f.fechaIngreso);
  const atrasos = conAmbas.map((f) => {
    const d = diferenciaEnDias(f.fechaMovimiento!, f.fechaIngreso!);
    return f.fechaIngreso! > f.fechaMovimiento! ? -d : d;
  });
  const cubeta = { mismoDia: 0, d1: 0, d2a7: 0, d8a30: 0, mas30: 0, negativo: 0 };
  for (const a of atrasos) {
    if (a < 0) cubeta.negativo += 1;
    else if (a === 0) cubeta.mismoDia += 1;
    else if (a === 1) cubeta.d1 += 1;
    else if (a <= 7) cubeta.d2a7 += 1;
    else if (a <= 30) cubeta.d8a30 += 1;
    else cubeta.mas30 += 1;
  }
  const ingresos = conAmbas.map((f) => f.fechaIngreso!).sort();
  const n = atrasos.length;

  console.log(
    [
      "FECHA vs FECHA INGRESO",
      `  filas con ambas fechas     ${n}`,
      `  rango de FECHA INGRESO     ${ingresos[0] ?? "—"} … ${ingresos[ingresos.length - 1] ?? "—"}`,
      `  atraso máximo              ${n ? Math.max(...atrasos) : 0} días`,
      "",
      `  mismo día  (0)             ${String(cubeta.mismoDia).padStart(5)}  ${pct(cubeta.mismoDia, n)}`,
      `  D+1                        ${String(cubeta.d1).padStart(5)}  ${pct(cubeta.d1, n)}`,
      `  2 a 7 días                 ${String(cubeta.d2a7).padStart(5)}  ${pct(cubeta.d2a7, n)}`,
      `  8 a 30 días                ${String(cubeta.d8a30).padStart(5)}  ${pct(cubeta.d8a30, n)}`,
      `  más de 30 días             ${String(cubeta.mas30).padStart(5)}  ${pct(cubeta.mas30, n)}`,
      `  fecha ingreso posterior    ${String(cubeta.negativo).padStart(5)}  ${pct(cubeta.negativo, n)}`,
      "",
    ].join("\n"),
  );

  /* ── CVU distinto titular ────────────────────────────────── */
  const cvuFilas = todasLasFilas.filter((f) => f.observacion.operacion === OPERACION_CVU);
  const cvuConCuit = cvuFilas.filter((f) => f.cuitExtraido !== null).length;
  const cvuPatrones = new Set(cvuFilas.map((f) => esqueleto(f.observacionOriginal)));
  console.log(
    [
      `CVU DISTINTO TITULAR · «${OPERACION_CVU}»`,
      `  filas                      ${cvuFilas.length}  (${pct(cvuFilas.length, totalRelevantes)} de las acreditaciones)`,
      `  con CUIT extraído          ${cvuConCuit} / ${cvuFilas.length}`,
      `  patrones distintos         ${cvuPatrones.size}`,
      `  por informe                ${dias.map((d) => `${d.fechaInforme.slice(5)}:${d.cvu}`).join("  ")}`,
      "  ⚠ TO VALIDATE WITH NORD: si el CUIT es del depositante o del titular de la cuenta",
      "",
    ].join("\n"),
  );

  /* ── Colisiones ──────────────────────────────────────────── */
  console.log("COLISIONES · filas indistinguibles con cada clave\n");
  const cabC = [
    "fecha".padEnd(12),
    "acred".padStart(6),
    "importe".padStart(9),
    "CUIT".padStart(9),
    "CUIT+fec".padStart(9),
    "CUIT+f+imp".padStart(11),
  ].join(" ");
  console.log("  " + cabC);
  console.log("  " + "─".repeat(cabC.length));
  const totales = { a: 0, b: 0, c: 0, d: 0, n: 0 };
  for (const dia of dias) {
    const x = dia.conciliables;
    const a = colisiones(x, (v) => String(v.importe));
    const b = colisiones(x, (v) => v.cuit);
    const c = colisiones(x, (v) => `${v.cuit}|${v.fecha}`);
    const e = colisiones(x, (v) => `${v.cuit}|${v.fecha}|${v.importe}`);
    totales.a += a.filasEnColision;
    totales.b += b.filasEnColision;
    totales.c += c.filasEnColision;
    totales.d += e.filasEnColision;
    totales.n += x.length;
    console.log(
      "  " +
        [
          dia.fechaInforme.padEnd(12),
          String(x.length).padStart(6),
          String(a.filasEnColision).padStart(9),
          String(b.filasEnColision).padStart(9),
          String(c.filasEnColision).padStart(9),
          String(e.filasEnColision).padStart(11),
        ].join(" "),
    );
  }
  console.log(
    "  " +
      [
        "TOTAL".padEnd(12),
        String(totales.n).padStart(6),
        String(totales.a).padStart(9),
        String(totales.b).padStart(9),
        String(totales.c).padStart(9),
        String(totales.d).padStart(11),
      ].join(" "),
  );
  console.log(
    [
      "",
      "  unicidad (100 % = ninguna fila ambigua)",
      `    solo importe             ${pct(totales.n - totales.a, totales.n)}`,
      `    solo CUIT                ${pct(totales.n - totales.b, totales.n)}`,
      `    CUIT + fecha ingreso     ${pct(totales.n - totales.c, totales.n)}`,
      `    CUIT + fecha + importe   ${pct(totales.n - totales.d, totales.n)}`,
      "",
      "PATRONES DE OBSERVACIÓN · dígitos y nombres enmascarados",
      ...[...patrones]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([e, c]) => `  ${String(c).padStart(4)}  ${e.slice(0, 96)}`),
      "",
    ].join("\n"),
  );
}

main().catch((e: unknown) => {
  if (e instanceof ErrorFullcarga) console.error(`\n✗ ${e.name} [${e.codigo}]\n  ${e.message}\n`);
  else console.error(`\n✗ ${(e as Error).message}\n`);
  process.exitCode = 1;
});
