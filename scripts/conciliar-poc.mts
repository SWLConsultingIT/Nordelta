/**
 * Concilia una planilla de cliente contra un informe de Fullcarga.
 *
 *   npm run conciliar -- <planilla.xlsx> <informe.xls> [--out .tmp/...] [--alias X]
 *
 * Escribe `summary.json`, `exceptions.csv` y los normalizados en la carpeta
 * de salida, que tiene que estar fuera de git.
 *
 * **En pantalla no sale ningún dato de nadie**: solo conteos, montos
 * agregados y estados. Las identificaciones se muestran enmascaradas.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { acreditacionesConciliables, parsearInforme } from "../src/lib/fullcarga/informe";
import { parsearPlanillaCliente } from "../src/lib/planillas/cliente";
import { conciliar, resumir } from "../src/lib/conciliacion";

/** Deja visibles los dos primeros dígitos y los dos últimos. */
function enmascarar(id: string): string {
  if (id.length <= 4) return "•".repeat(id.length);
  return `${id.slice(0, 2)}${"•".repeat(id.length - 4)}${id.slice(-2)}`;
}

const pesos = (n: number) =>
  n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Escapa un campo para CSV. Punto y coma, que es lo que abre Excel argentino. */
function csv(v: string | number | null): string {
  const t = v === null ? "" : String(v);
  return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const valor = (b: string) => {
    const i = argv.indexOf(b);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const destino = valor("--out") ?? ".tmp/conciliacion";
  const alias = valor("--alias") ?? "CLIENT_SAMPLE_01";
  const banderas = new Set(["--out", "--alias"]);
  const indicesValor = new Set(
    [...banderas].map((b) => argv.indexOf(b)).filter((i) => i >= 0).map((i) => i + 1),
  );
  const rutas = argv.filter((a, i) => !a.startsWith("--") && !indicesValor.has(i));

  if (rutas.length !== 2) {
    console.error("\nUso: npm run conciliar -- <planilla.xlsx> <informe.xls> [--out dir] [--alias X]\n");
    process.exitCode = 1;
    return;
  }

  const planilla = parsearPlanillaCliente(await readFile(rutas[0]), {
    sourceFile: path.basename(rutas[0]),
    clientAlias: alias,
  });
  const informe = parsearInforme(await readFile(rutas[1]), { sourceFile: path.basename(rutas[1]) });
  const acreditaciones = acreditacionesConciliables(informe);

  /* ── La planilla ──────────────────────────────────────────── */
  const t = planilla.transferencias;
  const porTipoId = t.reduce<Record<string, number>>((a, x) => {
    a[x.tipoIdentificacion] = (a[x.tipoIdentificacion] ?? 0) + 1;
    return a;
  }, {});
  const conComprobante = t.filter((x) => x.numeroDeposito !== null).length;
  const fechas = [...new Set(t.map((x) => x.fechaDeposito).filter(Boolean))].sort();
  const importes = t.map((x) => x.importe ?? 0);

  console.log(
    [
      "",
      `PLANILLA DEL CLIENTE · ${alias}`,
      `  archivo             ${planilla.sourceFile}`,
      `  hoja                ${planilla.sourceSheet}`,
      `  fila de encabezado  ${planilla.filaEncabezado}`,
      `  columnas ubicadas   ${Object.keys(planilla.columnas).length}/8` +
        (planilla.columnasFaltantes.length ? `  faltan: ${planilla.columnasFaltantes.join(", ")}` : ""),
      `  columnas nuevas     ${planilla.columnasDesconocidas.join(", ") || "ninguna"}`,
      `  filas ocultas       ${planilla.filasOcultas.length}`,
      `  columnas ocultas    ${planilla.columnasOcultas.length}`,
      `  celdas combinadas   ${planilla.celdasCombinadas.length}`,
      `  celdas con fórmula  ${planilla.celdasConFormula}`,
      "",
      `  operaciones         ${t.length}`,
      ...Object.entries(porTipoId).map(([k, n]) => `    ${k.padEnd(24)} ${n}`),
      `  con nº comprobante  ${conComprobante}`,
      `  sin nº comprobante  ${t.length - conComprobante}`,
      `  fechas de depósito  ${fechas[0]} … ${fechas[fechas.length - 1]}  (${fechas.length} días)`,
      `  importes distintos  ${new Set(importes).size} de ${importes.length}`,
      `  total enviado       $ ${pesos(importes.reduce((a, b) => a + b, 0))}`,
      "",
      `INFORME DE FULLCARGA`,
      `  archivo             ${informe.sourceFile}`,
      `  filas               ${informe.filas.length}`,
      `  acreditaciones      ${acreditaciones.length}`,
      `  rango FECHA INGRESO ${[...acreditaciones].map((a) => a.fecha).sort()[0]} … ${[...acreditaciones].map((a) => a.fecha).sort().at(-1)}`,
      "",
    ].join("\n"),
  );

  /* ── Conciliación ─────────────────────────────────────────── */
  const resultados = conciliar(t, acreditaciones);
  const resumen = resumir(resultados, alias);

  // Invariante: ninguna fila se pierde.
  const suma = Object.values(resumen.porEstado).reduce((a, b) => a + b, 0);
  if (suma !== t.length) {
    console.error(`\n✗ INVARIANTE ROTA: ${suma} estados para ${t.length} filas\n`);
    process.exitCode = 1;
    return;
  }

  console.log(
    [
      "CONCILIACIÓN",
      ...Object.entries(resumen.porEstado)
        .filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([k, n]) => `  ${k.padEnd(34)} ${String(n).padStart(3)}`),
      `  ${"".padEnd(34)} ───`,
      `  ${"total".padEnd(34)} ${String(suma).padStart(3)}   ✅ ninguna fila perdida`,
      "",
      `  acreditadas         ${resumen.acreditadasTotal} · $ ${pesos(resumen.montoAcreditado)}`,
      `    por CUIT          ${resumen.acreditadasPorCuit}`,
      `    por DNI           ${resumen.acreditadasPorDni}`,
      `  pendientes          ${resumen.pendientes} · $ ${pesos(resumen.montoPendiente)}`,
      `  total enviado       $ ${pesos(resumen.totalEnviado)}`,
      "",
      `  cierra solo         ${resumen.automaticas} · ${resumen.tasaAutomatica} %`,
      `  revisa una persona  ${resumen.requierenRevision} · ${resumen.tasaRevision} %`,
      "",
      "DETALLE POR FILA · identificaciones enmascaradas",
    ].join("\n"),
  );

  for (const r of resultados) {
    const id = enmascarar(r.transfer.identificacionNormalizada);
    console.log(
      `  r${String(r.transfer.sourceRow).padStart(2)}  ${r.estado.padEnd(34)} ` +
        `${(r.transfer.tipoIdentificacion === "CUIT_VALIDO" ? "CUIT" : r.transfer.tipoIdentificacion === "DNI_PROBABLE" ? "DNI " : "??? ")} ${id.padEnd(13)} ` +
        `${r.transfer.fechaDeposito ?? "—"}  $ ${pesos(r.transfer.importe ?? 0).padStart(12)}`,
    );
  }

  /* ── Salidas ──────────────────────────────────────────────── */
  await mkdir(destino, { recursive: true });

  await writeFile(
    path.join(destino, "summary.json"),
    JSON.stringify(
      {
        clientAlias: alias,
        generadoEn: new Date().toISOString(),
        planilla: {
          hoja: planilla.sourceSheet,
          filas: t.length,
          porTipoIdentificacion: porTipoId,
          conComprobante,
          sinComprobante: t.length - conComprobante,
          rangoFechas: [fechas[0], fechas[fechas.length - 1]],
          importesDistintos: new Set(importes).size,
        },
        informe: {
          filas: informe.filas.length,
          acreditaciones: acreditaciones.length,
        },
        conciliacion: resumen,
      },
      null,
      2,
    ),
  );

  const excepciones = resultados.filter((r) => !r.automatico);
  const filas = [
    ["source_row", "status", "reason", "masked_id", "id_type", "date", "amount", "candidates"].join(";"),
    ...excepciones.map((r) =>
      [
        r.transfer.sourceRow,
        r.estado,
        r.motivo,
        enmascarar(r.transfer.identificacionNormalizada),
        r.transfer.tipoIdentificacion,
        r.transfer.fechaDeposito,
        r.transfer.importe,
        r.candidatos.length,
      ]
        .map(csv)
        .join(";"),
    ),
  ];
  await writeFile(path.join(destino, "exceptions.csv"), "﻿" + filas.join("\r\n"));

  await writeFile(
    path.join(destino, "client-normalized.json"),
    JSON.stringify(t, null, 2),
  );
  await writeFile(
    path.join(destino, "fullcarga-normalized.json"),
    JSON.stringify(acreditaciones, null, 2),
  );

  console.log(
    [
      "",
      "SALIDAS",
      `  ${path.join(destino, "summary.json")}`,
      `  ${path.join(destino, "exceptions.csv")}          ${excepciones.length} filas para revisar`,
      `  ${path.join(destino, "client-normalized.json")}`,
      `  ${path.join(destino, "fullcarga-normalized.json")}`,
      "",
    ].join("\n"),
  );
}

main().catch((e: unknown) => {
  console.error(`\n✗ ${(e as Error).message}\n`);
  process.exitCode = 1;
});
