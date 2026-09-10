/**
 * INDEPENDENT RECONCILIATION BENCHMARK
 *
 * Segunda conciliación, escrita desde cero, que replica el procedimiento
 * manual conocido. **No es ground truth humano** y no se llama así: es una
 * implementación deliberadamente simple para comprobar si el matcher
 * automático llega al mismo lugar por otro camino.
 *
 * ## Qué se reutiliza y qué no
 *
 * Permitido y usado:
 *   · `leerXlsx` y `leerLibro` — lectores de bytes, nada de lógica;
 *   · `normalizarCuit` y `verificaDigito` — aritmética del dígito verificador;
 *   · `redondear` — el dominio financiero;
 *   · `serialAFecha` — conversión de serial de Excel.
 *
 * **Prohibido y NO importado:** `conciliar`, `emparejar`, `cuitsParecidos`,
 * `acreditacionesConciliables`, `parsearInforme`, `parsearPlanillaCliente`,
 * `analizarIdentificacion`, ni ningún resultado previo.
 *
 * Este archivo mapea las columnas por su cuenta, extrae el CUIT del campo
 * Observación por su cuenta y clasifica la identificación por su cuenta.
 *
 * ## Orden de ejecución, que es parte del método
 *
 * El benchmark se calcula, **se escribe a disco y se le saca el SHA-256
 * antes** de que este proceso cargue el matcher. La carga del matcher es un
 * `import()` dinámico posterior al congelamiento: no es una convención, es
 * una imposibilidad de que el resultado anterior influya en este.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { clave as claveXls, leerLibro } from "../src/lib/fullcarga/xls";
import { clave as claveXlsx, leerXlsx } from "../src/lib/planillas/xlsx";
import { normalizarCuit, verificaDigito } from "../src/lib/fullcarga/cuit";
import { redondear } from "../src/lib/domain/dinero";

/* ── Utilidades propias del benchmark ───────────────────────── */

const centavos = (n: number) => Math.round(redondear(n, 2) * 100);

const enmascarar = (id: string) =>
  id.length <= 4 ? "•".repeat(id.length) : `${id.slice(0, 2)}${"•".repeat(id.length - 4)}${id.slice(-2)}`;

const normalizarEncabezado = (t: string) =>
  t.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[.\s]+/g, " ").trim().toUpperCase();

/** `YYYY-MM-DD` desde `YYYY-MM-DD HH:MM:SS.mmm`. Recorte, sin `Date`. */
const soloFecha = (t: string): string | null => /^(\d{4}-\d{2}-\d{2})/.exec(t)?.[1] ?? null;

/**
 * Prefijos de persona física, listados acá por cuenta propia.
 *
 * Es a propósito: el benchmark no importa `esPersonaFisica`. Si las dos
 * implementaciones coinciden, coinciden dos listas escritas por separado.
 */
const PREFIJOS_PERSONA = new Set(["20", "23", "24", "27"]);

/** ¿El CUIT es de una persona física? */
const esPersona = (cuit: string) => PREFIJOS_PERSONA.has(cuit.slice(0, 2));

/** Clasificación propia, mínima: once dígitos que validan, o siete/ocho. */
function tipoDeIdentificacion(digitos: string): "CUIT" | "DNI" | "OTRO" {
  if (digitos.length === 11) return verificaDigito(digitos) ? "CUIT" : "OTRO";
  if (digitos.length >= 7 && digitos.length <= 8) return "DNI";
  return "OTRO";
}

/** Ubica una columna por su encabezado, en la fila que más reconoce. */
function mapearColumnas(
  valorEn: (f: number, c: number) => string | number | null,
  maxFila: number,
  maxColumna: number,
  esperados: readonly string[],
): { fila: number; indices: Map<string, number> } {
  let mejor = { fila: -1, aciertos: 0 };
  const buscados = new Set(esperados.map(normalizarEncabezado));
  for (let f = 0; f <= Math.min(maxFila, 20); f++) {
    let aciertos = 0;
    for (let c = 0; c <= maxColumna; c++) {
      const v = valorEn(f, c);
      if (typeof v === "string" && buscados.has(normalizarEncabezado(v))) aciertos++;
    }
    if (aciertos > mejor.aciertos) mejor = { fila: f, aciertos };
  }
  const indices = new Map<string, number>();
  for (let c = 0; c <= maxColumna; c++) {
    const v = valorEn(mejor.fila, c);
    if (typeof v === "string" && buscados.has(normalizarEncabezado(v))) {
      indices.set(normalizarEncabezado(v), c);
    }
  }
  return { fila: mejor.fila, indices };
}

/* ── Lado Fullcarga, leído por cuenta propia ────────────────── */

interface AcreditacionBench {
  fila: number;
  cuit: string | null;
  fechaIngreso: string | null;
  incremento: number | null;
  tipoIncremento: string | null;
  observacion: string;
}

/** El CUIT es el **último** grupo de once dígitos de la observación. */
function cuitDeObservacion(obs: string): string | null {
  const encontrados = obs.match(/(?<!\d)\d{11}(?!\d)/g);
  if (!encontrados) return null;
  const ultimo = encontrados[encontrados.length - 1];
  return verificaDigito(ultimo) ? ultimo : null;
}

async function leerFullcarga(ruta: string): Promise<AcreditacionBench[]> {
  const hoja = leerLibro(await readFile(ruta))[0];
  const valor = (f: number, c: number) => hoja.celdas.get(claveXls(f, c)) ?? null;
  const { fila, indices } = mapearColumnas(valor, hoja.maxFila, hoja.maxColumna, [
    "INCREMENTO", "FECHA INGRESO", "TIPO INCREMENTO", "OBSERVACION",
  ]);

  const dato = (f: number, nombre: string) => {
    const c = indices.get(nombre);
    return c === undefined ? null : valor(f, c);
  };

  const salida: AcreditacionBench[] = [];
  for (let f = fila + 1; f <= hoja.maxFila; f++) {
    const obs = String(dato(f, "OBSERVACION") ?? "").trim();
    const inc = dato(f, "INCREMENTO");
    const fi = dato(f, "FECHA INGRESO");
    if (obs === "" && inc === null) continue;
    salida.push({
      fila: f,
      cuit: cuitDeObservacion(obs),
      fechaIngreso: typeof fi === "string" ? soloFecha(fi) : null,
      incremento: typeof inc === "number" ? redondear(inc, 2) : null,
      tipoIncremento: typeof dato(f, "TIPO INCREMENTO") === "string" ? String(dato(f, "TIPO INCREMENTO")) : null,
      observacion: obs,
    });
  }
  return salida;
}

/* ── Lado cliente, leído por cuenta propia ──────────────────── */

interface FilaCliente {
  filaPlanilla: number;
  digitos: string;
  tipo: "CUIT" | "DNI" | "OTRO";
  fechaDeposito: string | null;
  importe: number | null;
  numeroDeposito: string | null;
}

async function leerCliente(ruta: string): Promise<FilaCliente[]> {
  const hoja = leerXlsx(await readFile(ruta))[0];
  const celda = (f: number, c: number) => hoja.celdas.get(claveXlsx(f, c));
  const valor = (f: number, c: number) => celda(f, c)?.valor ?? null;
  const { fila, indices } = mapearColumnas(valor, hoja.maxFila, hoja.maxColumna, [
    "FECHA DEPOSITO", "IMPORTE", "DNI/CUIT DEPOSITANTE", "NRO DEPOSITO",
  ]);
  const idx = (n: string) => indices.get(normalizarEncabezado(n));

  const salida: FilaCliente[] = [];
  for (let f = fila + 1; f <= hoja.maxFila; f++) {
    let vacia = true;
    for (let c = 0; c <= hoja.maxColumna; c++) {
      const v = valor(f, c);
      if (v !== null && String(v).trim() !== "") { vacia = false; break; }
    }
    if (vacia) continue;

    const cFecha = idx("FECHA DEPOSITO");
    const cel = cFecha === undefined ? undefined : celda(f, cFecha);
    const cImporte = idx("IMPORTE");
    const importeCrudo = cImporte === undefined ? null : valor(f, cImporte);
    const cId = idx("DNI/CUIT DEPOSITANTE");
    const digitos = normalizarCuit(String(cId === undefined ? "" : valor(f, cId) ?? ""));
    const cNro = idx("NRO DEPOSITO");
    const nro = cNro === undefined ? null : valor(f, cNro);

    salida.push({
      filaPlanilla: f,
      digitos,
      tipo: tipoDeIdentificacion(digitos),
      fechaDeposito: cel?.fecha ?? (typeof cel?.valor === "string" ? soloFecha(cel.valor) : null),
      importe: typeof importeCrudo === "number" ? redondear(importeCrudo, 2) : null,
      numeroDeposito: nro === null || String(nro).trim() === "" ? null : String(nro).trim(),
    });
  }
  return salida;
}

/* ── El procedimiento manual ────────────────────────────────── */

type EstadoBench =
  | "BENCHMARK_ACREDITADA_CUIT"
  | "BENCHMARK_ACREDITADA_DNI"
  | "BENCHMARK_AMBIGUA"
  | "BENCHMARK_REVISION"
  | "BENCHMARK_NO_ENCONTRADA"
  | "BENCHMARK_CONFLICTO"
  | "BENCHMARK_DNI_AMBIGUO"
  | "BENCHMARK_DNI_SIN_CANDIDATO"
  | "BENCHMARK_IDENTIDAD_INVALIDA"
  | "BENCHMARK_DATOS_INVALIDOS";

interface ResultadoBench {
  rowId: string;
  filaCliente: FilaCliente;
  estado: EstadoBench;
  candidatos: number;
  filaFullcarga: number | null;
  motivo: string;
}

const idFila = (i: number) => `ROW_${String(i + 1).padStart(2, "0")}`;

function ejecutarBenchmark(
  cliente: readonly FilaCliente[],
  fullcarga: readonly AcreditacionBench[],
): ResultadoBench[] {
  // Lista propia de registros ya usados. Uno a uno, sin excepciones.
  const usadas = new Set<number>();
  const salida: ResultadoBench[] = [];

  // ── Paso 1 · filas con CUIT, según el procedimiento manual ──
  const conDni: { i: number; f: FilaCliente }[] = [];
  const pendientes: { i: number; f: FilaCliente }[] = [];

  cliente.forEach((f, i) => {
    if (f.fechaDeposito === null || f.importe === null) {
      salida[i] = {
        rowId: idFila(i), filaCliente: f, estado: "BENCHMARK_DATOS_INVALIDOS",
        candidatos: 0, filaFullcarga: null, motivo: "Falta fecha o importe",
      };
      return;
    }
    if (f.tipo === "DNI") { conDni.push({ i, f }); return; }
    if (f.tipo === "OTRO") {
      salida[i] = {
        rowId: idFila(i), filaCliente: f, estado: "BENCHMARK_IDENTIDAD_INVALIDA",
        candidatos: 0, filaFullcarga: null,
        motivo: `${f.digitos.length} dígitos: no es CUIT ni DNI`,
      };
      return;
    }
    pendientes.push({ i, f });
  });

  for (const { i, f } of pendientes) {
    // PASO B · todas las de ese CUIT
    const porCuit = fullcarga.filter((a) => a.cuit === f.digitos && !usadas.has(a.fila));
    // PASO C · de esas, las de la misma fecha
    const porFecha = porCuit.filter((a) => a.fechaIngreso === f.fechaDeposito);
    // PASO D · de esas, las del mismo importe
    const porImporte = porFecha.filter(
      (a) => a.incremento !== null && centavos(a.incremento) === centavos(f.importe!),
    );

    if (porImporte.length === 1) {
      usadas.add(porImporte[0].fila);
      salida[i] = {
        rowId: idFila(i), filaCliente: f, estado: "BENCHMARK_ACREDITADA_CUIT",
        candidatos: 1, filaFullcarga: porImporte[0].fila,
        motivo: "CUIT, fecha e importe coinciden con un solo registro",
      };
    } else if (porImporte.length > 1) {
      salida[i] = {
        rowId: idFila(i), filaCliente: f, estado: "BENCHMARK_AMBIGUA",
        candidatos: porImporte.length, filaFullcarga: null,
        motivo: `${porImporte.length} registros con el mismo CUIT, fecha e importe`,
      };
    } else if (porFecha.length > 0) {
      salida[i] = {
        rowId: idFila(i), filaCliente: f, estado: "BENCHMARK_REVISION",
        candidatos: porFecha.length, filaFullcarga: null,
        motivo: "CUIT y fecha coinciden, el importe no",
      };
    } else {
      salida[i] = {
        rowId: idFila(i), filaCliente: f, estado: "BENCHMARK_NO_ENCONTRADA",
        candidatos: porCuit.length, filaFullcarga: null,
        motivo: porCuit.length > 0
          ? `El CUIT aparece ${porCuit.length} vez/veces pero con otra fecha`
          : "El CUIT no aparece en el informe",
      };
    }
  }

  // ── Paso 2 · filas con DNI · regla confirmada por NORD ──────
  // Corre después del CUIT: la identidad directa consume primero.
  // Se calculan todas las pretensiones y recién después se asigna, para que
  // dos filas que apunten al mismo registro no se resuelvan por orden.
  const pretensiones = new Map<number, AcreditacionBench[]>();
  for (const { i, f } of conDni) {
    pretensiones.set(
      i,
      fullcarga.filter(
        (a) =>
          !usadas.has(a.fila) &&
          a.cuit !== null &&
          esPersona(a.cuit) &&
          a.cuit.slice(2, 10) === f.digitos.padStart(8, "0") &&
          a.fechaIngreso === f.fechaDeposito &&
          a.incremento !== null &&
          centavos(a.incremento) === centavos(f.importe!),
      ),
    );
  }
  const pretendientes = new Map<number, number[]>();
  for (const [i, cands] of pretensiones) {
    if (cands.length !== 1) continue;
    const k = cands[0].fila;
    pretendientes.set(k, [...(pretendientes.get(k) ?? []), i]);
  }

  for (const { i, f } of conDni) {
    const cands = pretensiones.get(i) ?? [];
    const compiten = cands.length === 1 ? (pretendientes.get(cands[0].fila) ?? []).length : 0;

    if (cands.length === 1 && compiten === 1) {
      usadas.add(cands[0].fila);
      salida[i] = {
        rowId: idFila(i), filaCliente: f, estado: "BENCHMARK_ACREDITADA_DNI",
        candidatos: 1, filaFullcarga: cands[0].fila,
        motivo: "Documento de un CUIT de persona física, fecha e importe coinciden con un solo registro",
      };
    } else if (cands.length > 1 || compiten > 1) {
      salida[i] = {
        rowId: idFila(i), filaCliente: f, estado: "BENCHMARK_DNI_AMBIGUO",
        candidatos: Math.max(cands.length, compiten), filaFullcarga: null,
        motivo: compiten > 1 ? "Otra fila pretende el mismo registro" : `${cands.length} registros encajan`,
      };
    } else {
      salida[i] = {
        rowId: idFila(i), filaCliente: f, estado: "BENCHMARK_DNI_SIN_CANDIDATO",
        candidatos: 0, filaFullcarga: null,
        motivo: "Ningún CUIT de persona física con ese documento, esa fecha y ese importe",
      };
    }
  }

  return salida;
}

/* ── Diagnóstico de la fila sin candidato ───────────────────── */

function diagnosticar(f: FilaCliente, fullcarga: readonly AcreditacionBench[]): string[] {
  const doc = f.digitos.padStart(8, "0");
  const a = fullcarga.filter((x) => x.cuit !== null && x.cuit.slice(2, 10) === doc);
  const b = fullcarga.filter(
    (x) => x.fechaIngreso === f.fechaDeposito && x.incremento !== null && centavos(x.incremento) === centavos(f.importe!),
  );
  const c = fullcarga.filter((x) => x.incremento !== null && centavos(x.incremento) === centavos(f.importe!));
  // D · CUIT que difieren en un dígito del que tendría ese documento.
  const d = fullcarga.filter((x) => {
    if (x.cuit === null) return false;
    const suyo = x.cuit.slice(2, 10);
    let dif = 0;
    for (let k = 0; k < 8; k++) if (suyo[k] !== doc[k]) dif++;
    return dif === 1;
  });

  return [
    `  A · mismo documento, cualquier fecha      ${a.length}`,
    `  B · misma fecha + mismo importe           ${b.length}`,
    `  C · mismo importe, cualquier fecha        ${c.length}`,
    `  D · documento a un dígito de distancia    ${d.length}`,
    "",
    `  veredicto: ${
      a.length === 0 && d.length === 0
        ? "OUTSIDE RANGE o IDENTITY ISSUE — el documento no aparece en el informe, ni siquiera con otra fecha"
        : a.length > 0
          ? "DATA DIFFERENCE — el documento sí aparece; no coinciden fecha o importe"
          : "IDENTITY ISSUE — hay documentos parecidos"
    }`,
  ];
}

/* ── Principal ──────────────────────────────────────────────── */

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const iOut = argv.indexOf("--out");
  const destino = iOut >= 0 ? argv[iOut + 1] : ".tmp/conciliacion";
  const rutas = argv.filter((a, i) => !a.startsWith("--") && !(iOut >= 0 && i === iOut + 1));
  if (rutas.length !== 2) {
    console.error("\nUso: npm run benchmark -- <planilla.xlsx> <informe.xls> --out <dir>\n");
    process.exitCode = 1;
    return;
  }

  const cliente = await leerCliente(rutas[0]);
  const fullcarga = await leerFullcarga(rutas[1]);
  const conCuitFc = fullcarga.filter((a) => a.cuit !== null).length;

  console.log(
    [
      "",
      "INDEPENDENT RECONCILIATION BENCHMARK",
      "  Implementación separada del procedimiento manual. No es ground truth humano.",
      "",
      `  cliente             ${path.basename(rutas[0])} · ${cliente.length} filas`,
      `  Fullcarga           ${path.basename(rutas[1])} · ${fullcarga.length} filas · ${conCuitFc} con CUIT`,
      `  filas con CUIT      ${cliente.filter((f) => f.tipo === "CUIT").length}`,
      `  filas con DNI       ${cliente.filter((f) => f.tipo === "DNI").length}`,
      "",
    ].join("\n"),
  );

  const bench = ejecutarBenchmark(cliente, fullcarga);

  /* ── Congelar ANTES de mirar la automatización ───────────── */
  await mkdir(destino, { recursive: true });
  const csv =
    "﻿" +
    [
      ["row_id", "source_row", "identity_type", "masked_identity", "deposit_date",
       "amount", "candidate_count", "benchmark_status", "fullcarga_row_if_unique", "reason"].join(";"),
      ...bench.map((r) =>
        [
          r.rowId, r.filaCliente.filaPlanilla, r.filaCliente.tipo,
          enmascarar(r.filaCliente.digitos), r.filaCliente.fechaDeposito ?? "",
          r.filaCliente.importe ?? "", r.candidatos, r.estado,
          r.filaFullcarga ?? "", `"${r.motivo}"`,
        ].join(";"),
      ),
    ].join("\r\n") +
    "\r\n";

  const rutaCsv = path.join(destino, "independent-benchmark.csv");
  await writeFile(rutaCsv, csv);
  const hash = createHash("sha256").update(csv).digest("hex");

  console.log("RESULTADO DEL BENCHMARK · fila por fila");
  for (const r of bench) {
    console.log(
      `  ${r.rowId}  ${r.filaCliente.tipo.padEnd(4)} ${enmascarar(r.filaCliente.digitos).padEnd(13)} ` +
        `${r.filaCliente.fechaDeposito}  ${r.estado.padEnd(31)} ` +
        `cand ${String(r.candidatos).padStart(2)}  ${r.filaFullcarga !== null ? `fc:${r.filaFullcarga}` : "—"}`,
    );
  }
  console.log(
    [
      "",
      "  CONGELADO",
      `  archivo   ${rutaCsv}`,
      `  SHA-256   ${hash}`,
      `  INDEPENDENT_BENCHMARK_HASH: ${hash.slice(0, 12)}`,
      "",
    ].join("\n"),
  );

  /* ── Recién ahora se carga el matcher ────────────────────── */
  const { conciliar } = await import("../src/lib/conciliacion/index");
  const { parsearPlanillaCliente } = await import("../src/lib/planillas/cliente");
  const { parsearInforme, acreditacionesConciliables } = await import("../src/lib/fullcarga/informe");

  const pl = parsearPlanillaCliente(await readFile(rutas[0]), { sourceFile: path.basename(rutas[0]) });
  const inf = parsearInforme(await readFile(rutas[1]), { sourceFile: path.basename(rutas[1]) });
  const auto = conciliar(pl.transferencias, acreditacionesConciliables(inf));

  /* ── Comparación · CUIT ──────────────────────────────────── */
  const idxCuit = bench.map((r, i) => ({ r, i })).filter(({ r }) => r.filaCliente.tipo === "CUIT");
  let mismasDecisiones = 0;
  let mismosRegistros = 0;
  const discrepancias: string[] = [];

  for (const { r, i } of idxCuit) {
    const a = auto[i];
    const benchAcredita = r.estado === "BENCHMARK_ACREDITADA_CUIT";
    const autoAcredita = a.estado === "ACREDITADA_EXACTA_CUIT";
    if (benchAcredita === autoAcredita) mismasDecisiones += 1;
    else discrepancias.push(`${r.rowId}: benchmark=${r.estado} · automatización=${a.estado}`);

    if (benchAcredita && autoAcredita) {
      if (r.filaFullcarga === a.acreditacion?.row) mismosRegistros += 1;
      else discrepancias.push(`${r.rowId}: apuntan a filas distintas · benchmark=${r.filaFullcarga} automatización=${a.acreditacion?.row}`);
    }
  }

  const benchAcreditadas = idxCuit.filter(({ r }) => r.estado === "BENCHMARK_ACREDITADA_CUIT").length;
  const autoExactas = idxCuit.filter(({ i }) => auto[i].estado === "ACREDITADA_EXACTA_CUIT").length;
  const pctDec = idxCuit.length === 0 ? 0 : Math.round((mismasDecisiones / idxCuit.length) * 1000) / 10;
  const pctReg = benchAcreditadas === 0 ? 0 : Math.round((mismosRegistros / benchAcreditadas) * 1000) / 10;

  console.log(
    [
      "COMPARACIÓN · filas con CUIT",
      `  filas con CUIT                 ${idxCuit.length}`,
      `  benchmark acreditó             ${benchAcreditadas}`,
      `  automatización acreditó        ${autoExactas}`,
      `  mismas decisiones              ${mismasDecisiones}`,
      `  decisiones distintas           ${idxCuit.length - mismasDecisiones}`,
      `  mismo registro de Fullcarga    ${mismosRegistros}`,
      `  acuerdo de decisión            ${pctDec} %`,
      `  acuerdo de registro exacto     ${pctReg} %`,
      "",
      `  INDEPENDENT CUIT VALIDATION: ${pctDec === 100 && pctReg === 100 ? "PASS" : "FAIL"}`,
      ...(discrepancias.length ? ["", "  ⚠️ DISCREPANCIAS", ...discrepancias.map((d) => `     ${d}`)] : []),
      "",
    ].join("\n"),
  );

  /* ── Comparación · DNI ───────────────────────────────────── */
  const idxDni = bench.map((r, i) => ({ r, i })).filter(({ r }) => r.filaCliente.tipo === "DNI");
  const unicos = idxDni.filter(({ r }) => r.estado === "BENCHMARK_ACREDITADA_DNI");
  const ambiguos = idxDni.filter(({ r }) => r.estado === "BENCHMARK_DNI_AMBIGUO").length;
  const sinCand = idxDni.filter(({ r }) => r.estado === "BENCHMARK_DNI_SIN_CANDIDATO").length;
  const autoPotenciales = idxDni.filter(({ i }) => auto[i].estado === "ACREDITADA_EXACTA_DNI").length;

  let mismoCandidato = 0;
  const difDni: string[] = [];
  for (const { r, i } of unicos) {
    const a = auto[i];
    if (a.estado === "ACREDITADA_EXACTA_DNI" && a.acreditacion?.row === r.filaFullcarga) {
      mismoCandidato += 1;
    } else {
      difDni.push(`${r.rowId}: benchmark=fc:${r.filaFullcarga} · automatización=${a.estado} (${a.candidatos.map((c) => `fc:${c.row}`).join(",") || "sin candidatos"})`);
    }
  }
  const pctCand = unicos.length === 0 ? 0 : Math.round((mismoCandidato / unicos.length) * 1000) / 10;

  console.log(
    [
      "COMPARACIÓN · filas con DNI · regla confirmada, acreditan",
      `  filas con DNI                  ${idxDni.length}`,
      `  acreditadas por DNI            ${unicos.length}`,
      `  ambiguos                       ${ambiguos}`,
      `  sin candidato                  ${sinCand}`,
      `  acreditadas por la automatización  ${autoPotenciales}`,
      `  mismo registro elegido         ${mismoCandidato}`,
      `  acuerdo de registro            ${pctCand} %`,
      ...(difDni.length ? ["", "  ⚠️ DIFERENCIAS", ...difDni.map((d) => `     ${d}`)] : []),
      "",
      "  DNI BUSINESS RULE: CONFIRMED BY NORD",
      "",
      "  verificación de cada acreditación por DNI",
      ...unicos.map(({ r }) => {
        const a = fullcarga.find((x) => x.fila === r.filaFullcarga)!;
        const doc = a.cuit!.slice(2, 10) === r.filaCliente.digitos.padStart(8, "0");
        const fecha = a.fechaIngreso === r.filaCliente.fechaDeposito;
        const monto = centavos(a.incremento!) === centavos(r.filaCliente.importe!);
        return `     ${r.rowId}  documento ${doc ? "✅" : "❌"} · fecha ${fecha ? "✅" : "❌"} · importe ${monto ? "✅" : "❌"} · persona física ${esPersona(a.cuit!) ? "✅" : "❌"}`;
      }),
      "",
    ].join("\n"),
  );

  /* ── Diagnóstico de la fila sin candidato ────────────────── */
  const huerfanas = idxDni.filter(({ r }) => r.estado === "BENCHMARK_DNI_SIN_CANDIDATO");
  for (const { r } of huerfanas) {
    console.log([`DIAGNÓSTICO · ${r.rowId} · DNI sin candidato`, ...diagnosticar(r.filaCliente, fullcarga), ""].join("\n"));
  }

  await writeFile(
    path.join(destino, "benchmark-comparison.json"),
    JSON.stringify(
      {
        generadoEn: new Date().toISOString(),
        benchmarkHash: hash,
        cuit: {
          filas: idxCuit.length, benchmarkAcreditadas: benchAcreditadas, automatizacionExactas: autoExactas,
          mismasDecisiones, mismosRegistros, acuerdoDecision: pctDec, acuerdoRegistro: pctReg,
          discrepancias,
        },
        dni: {
          filas: idxDni.length, candidatosUnicos: unicos.length, ambiguos, sinCandidato: sinCand,
          potencialesAutomatizacion: autoPotenciales, mismoCandidato, acuerdoCandidato: pctCand,
          diferencias: difDni,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((e: unknown) => {
  console.error(`\n✗ ${(e as Error).message}\n`);
  process.exitCode = 1;
});
