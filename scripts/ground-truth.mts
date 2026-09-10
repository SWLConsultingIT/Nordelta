/**
 * Arnés de validación contra el resultado humano.
 *
 *   # 1 · generar la planilla ciega para Mati y el resultado del sistema
 *   npm run ground-truth -- preparar <planilla.xlsx> <informe.xls> --out <dir>
 *
 *   # 2 · cuando Mati la devuelva, medir
 *   npm run ground-truth -- evaluar <planilla.xlsx> <informe.xls> <mati.csv> --out <dir>
 *
 * La planilla que va a Mati **no lleva el resultado del sistema**: si lo
 * viera, dejaría de ser una medición independiente y pasaría a ser una
 * revisión de lo que hizo la máquina.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { acreditacionesConciliables, parsearInforme } from "../src/lib/fullcarga/informe";
import { parsearPlanillaCliente } from "../src/lib/planillas/cliente";
import { conciliar, type ResultadoFila } from "../src/lib/conciliacion";
import {
  acreditaAutomaticamente,
  filasACsv,
  idDeFila,
  leerRespuestas,
  medir,
  RESULTADOS_HUMANOS,
  type Metricas,
} from "../src/lib/conciliacion/ground-truth";

function enmascarar(id: string): string {
  if (id.length <= 4) return "•".repeat(id.length);
  return `${id.slice(0, 2)}${"•".repeat(id.length - 4)}${id.slice(-2)}`;
}

const pesos = (n: number | null) =>
  n === null ? "—" : n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function resolver(rutaPlanilla: string, rutaInforme: string): Promise<ResultadoFila[]> {
  const planilla = parsearPlanillaCliente(await readFile(rutaPlanilla), {
    sourceFile: path.basename(rutaPlanilla),
  });
  const informe = parsearInforme(await readFile(rutaInforme), {
    sourceFile: path.basename(rutaInforme),
  });
  return conciliar(planilla.transferencias, acreditacionesConciliables(informe));
}

function tabla(m: Metricas): string[] {
  return [
    `  filas evaluadas          ${m.filas}`,
    `  acreditadas por Mati     ${m.acreditadasPorMati}`,
    `  acreditadas por sistema  ${m.acreditadasPorSistema}`,
    "",
    `  verdaderos positivos     ${m.verdaderosPositivos}`,
    `  FALSOS POSITIVOS         ${m.falsosPositivos}${m.falsosPositivos > 0 ? "   ⚠️ plata dada por cobrada" : ""}`,
    `  falsos negativos         ${m.falsosNegativos}`,
    `  abstenciones correctas   ${m.verdaderosNegativos}`,
    "",
    `  precisión                ${m.precision === null ? "no definida" : `${m.precision} %`}`,
    `  recall                   ${m.recall === null ? "no definida" : `${m.recall} %`}`,
    `  tasa automática          ${m.tasaAutomatica} %`,
    `  revisión manual          ${m.tasaRevision} %`,
    "",
    `  ¿apto para automatizar?  ${m.aptoParaAutomatizar ? "SÍ · cero falsos positivos" : "NO"}`,
  ];
}

async function preparar(rutaPlanilla: string, rutaInforme: string, destino: string): Promise<void> {
  const resultados = await resolver(rutaPlanilla, rutaInforme);
  await mkdir(destino, { recursive: true });

  // A · lo que ve Mati. Sin una sola pista del resultado del sistema.
  const ciego = filasACsv(
    ["row_id", "fila_planilla", "fecha", "importe", "identificacion", "tipo_identificacion", "resultado"],
    resultados.map((r, i) => [
      idDeFila(i),
      r.transfer.sourceRow,
      r.transfer.fechaDeposito,
      r.transfer.importe,
      enmascarar(r.transfer.identificacionNormalizada),
      r.transfer.tipoIdentificacion,
      "", // ← lo completa Mati
    ]),
  );
  const rutaCiego = path.join(destino, "mati-ground-truth-input.csv");
  await writeFile(rutaCiego, ciego);

  // B · lo que hizo el sistema. Este archivo NO se le muestra a Mati.
  const automatico = filasACsv(
    [
      "row_id", "fila_planilla", "fecha", "importe", "identificacion",
      "tipo_identificacion", "estado_automatico", "acredita_solo_cuit",
      "acredita_confirmado", "candidatos", "motivo",
    ],
    resultados.map((r, i) => [
      idDeFila(i),
      r.transfer.sourceRow,
      r.transfer.fechaDeposito,
      r.transfer.importe,
      enmascarar(r.transfer.identificacionNormalizada),
      r.transfer.tipoIdentificacion,
      r.estado,
      acreditaAutomaticamente(r.estado, "SOLO_CUIT") ? "SI" : "NO",
      acreditaAutomaticamente(r.estado, "CONFIRMADO") ? "SI" : "NO",
      r.candidatos.length,
      r.motivo,
    ]),
  );
  const rutaAuto = path.join(destino, "automation-result.csv");
  await writeFile(rutaAuto, automatico);

  const conActual = resultados.filter((r) => acreditaAutomaticamente(r.estado, "SOLO_CUIT")).length;
  const conDni = resultados.filter((r) => acreditaAutomaticamente(r.estado, "CONFIRMADO")).length;

  console.log(
    [
      "",
      "DATASET DE VALIDACIÓN PREPARADO",
      "",
      `  para Mati    ${rutaCiego}`,
      `               ${resultados.length} filas · columna «resultado» vacía`,
      `               valores admitidos: ${RESULTADOS_HUMANOS.join(" · ")}`,
      "",
      `  del sistema  ${rutaAuto}`,
      `               ⚠️ NO compartir con Mati hasta que devuelva el suyo`,
      "",
      "  qué acreditaría cada reglamento",
      `    SOLO_CUIT   ${conActual} de ${resultados.length}  (${Math.round((conActual / resultados.length) * 100)} %)`,
      `    CONFIRMADO  ${conDni} de ${resultados.length}  (${Math.round((conDni / resultados.length) * 100)} %)   ← regla confirmada por NORD`,
      "",
      "  Instrucción para Mati: conciliar como siempre y escribir en la",
      "  columna «resultado» qué pasó con cada fila. Nada más.",
      "",
    ].join("\n"),
  );
}

async function evaluar(
  rutaPlanilla: string,
  rutaInforme: string,
  rutaMati: string,
  destino: string,
): Promise<void> {
  const resultados = await resolver(rutaPlanilla, rutaInforme);
  const { respuestas, desconocidos, sinResponder } = leerRespuestas(
    await readFile(rutaMati, "utf8"),
  );

  if (respuestas.size === 0) {
    console.error("\n✗ El archivo no trae ninguna respuesta reconocible.\n");
    process.exitCode = 1;
    return;
  }

  const actual = medir(resultados, respuestas, "SOLO_CUIT");
  const conDni = medir(resultados, respuestas, "CONFIRMADO");

  console.log(
    [
      "",
      "VALIDACIÓN CONTRA EL RESULTADO HUMANO",
      "",
      `  respuestas leídas    ${respuestas.size} de ${resultados.length}`,
      sinResponder.length ? `  sin responder        ${sinResponder.join(", ")}` : "",
      desconocidos.length
        ? `  ⚠️ no reconocidas    ${desconocidos.map((d) => `${d.rowId}="${d.valor}"`).join(", ")}`
        : "",
      "",
      "REGLAMENTO ANTERIOR · solo match exacto por CUIT",
      ...tabla(actual),
      "",
      "REGLAMENTO CONFIRMADO · agrega DNI → documento de CUIT de persona física",
      ...tabla(conDni),
      "",
      "COMPARACIÓN",
      `  automatización   ${actual.tasaAutomatica} %  →  ${conDni.tasaAutomatica} %`,
      `  revisión manual  ${actual.tasaRevision} %  →  ${conDni.tasaRevision} %`,
      `  falsos positivos ${actual.falsosPositivos}  →  ${conDni.falsosPositivos}`,
      "",
      conDni.falsosPositivos > 0
        ? "  ⚠️ La regla de DNI produjo falsos positivos: hay que revisarla con NORD."
        : conDni.aptoParaAutomatizar
          ? "  La regla de DNI no produjo ningún falso positivo en esta muestra.\n  Sigue haciendo falta la confirmación de NORD y una muestra más grande."
          : "  Sin evidencia suficiente sobre la regla de DNI.",
      "",
    ]
      .filter((l) => l !== "")
      .join("\n"),
  );

  await mkdir(destino, { recursive: true });
  const salida = path.join(destino, "ground-truth-metrics.json");
  await writeFile(
    salida,
    JSON.stringify(
      {
        generadoEn: new Date().toISOString(),
        respuestas: respuestas.size,
        sinResponder,
        noReconocidas: desconocidos,
        reglamentos: { ACTUAL: actual, CON_DNI: conDni },
        porFila: resultados.map((r, i) => ({
          rowId: idDeFila(i),
          estadoAutomatico: r.estado,
          acreditaActual: acreditaAutomaticamente(r.estado, "SOLO_CUIT"),
          acreditaConDni: acreditaAutomaticamente(r.estado, "CONFIRMADO"),
          resultadoMati: respuestas.get(idDeFila(i)) ?? null,
          importe: r.transfer.importe,
        })),
      },
      null,
      2,
    ),
  );

  // Detalle por fila, para ver dónde discrepan.
  console.log("DETALLE · fila por fila");
  resultados.forEach((r, i) => {
    const rowId = idDeFila(i);
    const mati = respuestas.get(rowId);
    if (mati === undefined) return;
    const a = acreditaAutomaticamente(r.estado, "SOLO_CUIT");
    const d = acreditaAutomaticamente(r.estado, "CONFIRMADO");
    const acuerdoActual = a === (mati === "ACREDITADA");
    const acuerdoDni = d === (mati === "ACREDITADA");
    console.log(
      `  ${rowId}  ${r.estado.padEnd(28)} mati=${mati.padEnd(14)} ` +
        `actual ${acuerdoActual ? "✅" : a ? "❌ FALSO POSITIVO" : "· falso negativo"}   ` +
        `con DNI ${acuerdoDni ? "✅" : d ? "❌ FALSO POSITIVO" : "· falso negativo"}   ` +
        `$ ${pesos(r.transfer.importe)}`,
    );
  });
  console.log(`\n  métricas en ${salida}\n`);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const modo = argv[0];
  const iOut = argv.indexOf("--out");
  const destino = iOut >= 0 ? argv[iOut + 1] : ".tmp/conciliacion";
  const rutas = argv
    .slice(1)
    .filter((a, i) => !a.startsWith("--") && !(iOut >= 1 && i === iOut));

  if (modo === "preparar" && rutas.length === 2) {
    await preparar(rutas[0], rutas[1], destino);
    return;
  }
  if (modo === "evaluar" && rutas.length === 3) {
    await evaluar(rutas[0], rutas[1], rutas[2], destino);
    return;
  }

  console.error(
    [
      "",
      "Uso:",
      "  npm run ground-truth -- preparar <planilla.xlsx> <informe.xls> --out <dir>",
      "  npm run ground-truth -- evaluar  <planilla.xlsx> <informe.xls> <mati.csv> --out <dir>",
      "",
    ].join("\n"),
  );
  process.exitCode = 1;
}

main().catch((e: unknown) => {
  console.error(`\n✗ ${(e as Error).message}\n`);
  process.exitCode = 1;
});
