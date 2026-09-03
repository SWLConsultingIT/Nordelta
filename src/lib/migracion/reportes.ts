import type { Moneda } from "../domain/types";
import { formatear } from "../domain/dinero";
import { MONEDAS } from "../domain/types";
import type { Cuantificacion, FilaClasificada, Resumen } from "./estados";
import { resumenEsConsistente } from "./estados";

/**
 * Reportes de conciliación.
 *
 * CSV con punto y coma y BOM UTF-8, igual que el export de la aplicación:
 * es lo que hace que Excel en configuración regional argentina los abra con
 * las columnas separadas y la coma decimal en su lugar.
 */

function csv(filas: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + filas.map((f) => f.map(esc).join(";")).join("\r\n") + "\r\n";
}

const monto = (n: number) => formatear(n, 2);

export interface Reportes {
  "summary.csv": string;
  "expected-differences.csv": string;
  "unexplained.csv": string;
  "invalid-source.csv": string;
  "blocked-business-rules.csv": string;
  "por-contraparte.csv": string;
  "RESUMEN.md": string;
}

export function generarReportes(
  filas: readonly FilaClasificada[],
  resumen: Resumen,
  contexto: { archivo: string; hoja: string },
): Reportes {
  return {
    "summary.csv": resumenCsv(filas),
    "expected-differences.csv": diferenciasCsv(filas, "EXPECTED_DIFFERENCE"),
    "unexplained.csv": diferenciasCsv(filas, "UNEXPLAINED_DIFFERENCE"),
    "invalid-source.csv": invalidasCsv(filas),
    "blocked-business-rules.csv": bloqueadasCsv(filas),
    "por-contraparte.csv": porContraparteCsv(filas),
    "RESUMEN.md": resumenMarkdown(resumen, filas, contexto),
  };
}

function resumenCsv(filas: readonly FilaClasificada[]): string {
  return csv([
    ["fila", "estado", "fecha", "contraparte", "partidas", "diferencias", "decision"],
    ...filas.map((f) => [
      f.fila, f.estado, f.fecha ?? "", f.contraparte,
      f.movimiento?.partidas.length ?? 0, f.diferencias.length, f.decision ?? "",
    ]),
  ]);
}

function diferenciasCsv(filas: readonly FilaClasificada[], estado: string): string {
  const cuerpo = filas
    .filter((f) => f.estado === estado)
    .flatMap((f) =>
      f.diferencias.map((d) => [
        f.fila, f.fecha ?? "", f.contraparte, d.moneda,
        d.legacy === null ? "(anulado)" : monto(d.legacy),
        monto(d.nuevo),
        d.legacy === null ? monto(d.nuevo) : monto(d.nuevo - d.legacy),
        d.motivo,
        (d.patasDescartadas ?? []).join(" | "),
      ]),
    );
  return csv([
    ["fila", "fecha", "contraparte", "moneda", "legacy", "nuevo", "diferencia", "motivo", "patas descartadas"],
    ...cuerpo,
  ]);
}

function invalidasCsv(filas: readonly FilaClasificada[]): string {
  const cuerpo = filas
    .filter((f) => f.estado === "INVALID_SOURCE")
    .flatMap((f) => f.errores.map((e) => [f.fila, f.contraparte, e.campo, e.valor, e.motivo]));
  return csv([["fila", "contraparte", "campo", "valor", "motivo"], ...cuerpo]);
}

function bloqueadasCsv(filas: readonly FilaClasificada[]): string {
  return csv([
    ["fila", "fecha", "contraparte", "decision", "detalle"],
    ...filas
      .filter((f) => f.estado === "BLOCKED_BUSINESS_RULE")
      .map((f) => [
        f.fila, f.fecha ?? "", f.contraparte, f.decision ?? "",
        "Ver docs/OPEN_BUSINESS_DECISIONS.md",
      ]),
  ]);
}

/**
 * Saldo por contraparte y moneda: legacy, nuevo y diferencia.
 * Una fila por moneda. Nunca se suman monedas distintas entre sí.
 */
function porContraparteCsv(filas: readonly FilaClasificada[]): string {
  const acum = new Map<string, Record<Moneda, { legacy: number; nuevo: number }>>();

  for (const f of filas) {
    if (!f.movimiento) continue;
    const clave = f.contraparte;
    const fila = acum.get(clave) ?? {
      ARS: { legacy: 0, nuevo: 0 }, USD: { legacy: 0, nuevo: 0 },
      EUR: { legacy: 0, nuevo: 0 }, BRL: { legacy: 0, nuevo: 0 },
    };
    // Solo se puede reconstruir el lado legacy desde las diferencias, así
    // que el nuevo se toma del importe y el legacy se deriva restando.
    for (const d of f.diferencias) {
      fila[d.moneda].nuevo += d.nuevo;
      fila[d.moneda].legacy += d.legacy ?? 0;
    }
    acum.set(clave, fila);
  }

  const cuerpo: (string | number)[][] = [];
  for (const [contraparte, porMoneda] of [...acum].sort((a, b) => a[0].localeCompare(b[0], "es"))) {
    for (const m of MONEDAS) {
      const { legacy, nuevo } = porMoneda[m];
      if (legacy === 0 && nuevo === 0) continue;
      cuerpo.push([contraparte, m, monto(legacy), monto(nuevo), monto(nuevo - legacy)]);
    }
  }
  return csv([["contraparte", "moneda", "legacy", "nuevo", "diferencia"], ...cuerpo]);
}

function bloqueDeCuantificacion(c: Cuantificacion): string {
  const titulo = c.bug === "bug5"
    ? "Bug 5 · la columna de pesos se anula y pierde la pata sin convertir"
    : "Bug 6 · el o-exclusivo descarta la pata convertida";

  if (c.filasAfectadas === 0) {
    return `### ${titulo}\n\nNo se detectó ninguna fila afectada en este archivo.\n`;
  }

  const patas = Object.entries(c.patasDescartadas)
    .sort((a, b) => b[1] - a[1])
    .map(([p, n]) => `\`${p}\` (${n})`)
    .join(" · ");

  return `### ${titulo}

| | |
|---|---|
| Filas afectadas | **${c.filasAfectadas}** |
| Período | ${c.fechaMinima ?? "—"} → ${c.fechaMaxima ?? "—"} |
| Contrapartes | ${c.contrapartes.length} |
| Patas descartadas | ${patas || "—"} |

Monto que el legacy no contabilizó, **por moneda** (no se suman entre sí):

| Moneda | Filas | Monto no contabilizado |
|---|---:|---:|
${c.porMoneda.map((d) => `| ${d.moneda} | ${d.filas} | ${monto(d.monto)} |`).join("\n")}
`;
}

function resumenMarkdown(
  r: Resumen,
  filas: readonly FilaClasificada[],
  contexto: { archivo: string; hoja: string },
): string {
  const consistente = resumenEsConsistente(r);
  const sinExplicar = r.porEstado.UNEXPLAINED_DIFFERENCE;

  const contrapartesConVariantes = new Map<string, Set<string>>();
  for (const f of filas) {
    if (!f.movimiento) continue;
    const k = f.contraparte.trim().toLowerCase();
    const s = contrapartesConVariantes.get(k) ?? new Set<string>();
    s.add(f.contraparte.trim());
    contrapartesConVariantes.set(k, s);
  }

  return `# Conciliación de importación legacy

**Modo dry-run: no se escribió nada.**

| | |
|---|---|
| Archivo | \`${contexto.archivo}\` |
| Hoja | \`${contexto.hoja}\` |
| Generado | ${new Date().toISOString().slice(0, 19).replace("T", " ")} |

## Clasificación de filas

| Estado | Filas |
|---|---:|
| \`IMPORTED\` | ${r.porEstado.IMPORTED} |
| \`EXPECTED_DIFFERENCE\` | ${r.porEstado.EXPECTED_DIFFERENCE} |
| \`BLOCKED_BUSINESS_RULE\` | ${r.porEstado.BLOCKED_BUSINESS_RULE} |
| \`INVALID_SOURCE\` | ${r.porEstado.INVALID_SOURCE} |
| \`UNEXPLAINED_DIFFERENCE\` | ${r.porEstado.UNEXPLAINED_DIFFERENCE} |
| **Total analizadas** | **${r.filasAnalizadas}** |
| Filas vacías de plantilla | ${r.filasVacias} |
| **Total del archivo** | **${r.totalFilas}** |

${consistente
  ? "✅ La clasificación cierra: la suma de estados da el total de filas analizadas, y con las vacías da el total del archivo. **Ninguna fila desapareció.**"
  : "❌ **La clasificación NO cierra.** Hay filas sin estado: es un defecto del importador y hay que corregirlo antes de migrar."}

## Resultado de la transformación

| | |
|---|---:|
| Movimientos | ${r.movimientos} |
| Partidas | ${r.partidas} |
| Contrapartes nuevas | ${r.contrapartesNuevas} |
| Contrapartes con variantes que colapsan | ${r.contrapartesNormalizadas} |

${r.contrapartesNormalizadas > 0
  ? `> ${r.contrapartesNormalizadas} contrapartes venían escritas de más de una forma en el origen y colapsan en una sola. Es el problema que hoy rompe el agrupado del balance.`
  : ""}

## Cuantificación de los bugs legacy

${r.cuantificacion.map(bloqueDeCuantificacion).join("\n")}

${r.filasConAmbosBugs > 0
  ? `> **${r.filasConAmbosBugs} filas están afectadas por los dos bugs a la vez.** El dinero se atribuye por pata descartada, así que no se cuenta dos veces.`
  : "> Ninguna fila está afectada por los dos bugs simultáneamente."}

## Diferencias sin explicar

${sinExplicar === 0
  ? "✅ **Ninguna.** Toda diferencia con el legacy es atribuible a un defecto documentado."
  : `❌ **${sinExplicar} filas difieren por algo que no es un bug conocido.**

Estas son las únicas que hay que investigar como posible bug nuevo, en cualquiera de los dos sistemas. Están en \`unexplained.csv\`. **No avanzar con la migración hasta resolverlas.**`}

## Archivos generados

| Archivo | Contenido |
|---|---|
| \`summary.csv\` | Una fila por fila del origen, con su estado |
| \`expected-differences.csv\` | Diferencias atribuidas a bugs conocidos |
| \`unexplained.csv\` | Diferencias a investigar |
| \`invalid-source.csv\` | Filas que no se pudieron interpretar, con el campo y el motivo |
| \`blocked-business-rules.csv\` | Filas trabadas por una decisión abierta |
| \`por-contraparte.csv\` | Saldo legacy, nuevo y diferencia, por contraparte y moneda |
`;
}
