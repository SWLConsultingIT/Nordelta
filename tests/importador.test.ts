import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { importar, separarDelimitado, cuantificar, sinExplicar } from "@/lib/migracion/importador";
import { ESTADOS, resumenEsConsistente, type Estado } from "@/lib/migracion/estados";
import { generarReportes } from "@/lib/migracion/reportes";

const MUESTRA = readFileSync(
  join(import.meta.dirname, "fixtures", "legacy-muestra.csv"), "utf8",
);

const OPCIONES = {
  sourceSystem: "sheets-caja-diaria",
  sourceFile: "legacy-muestra.csv",
  sourceSheet: "Nordelta 03/09/26",
  encabezados: 1,
};

function correr(texto = MUESTRA) {
  return importar(separarDelimitado(texto.replace(/^﻿/, "")), OPCIONES);
}

describe("separarDelimitado", () => {
  it("detecta el punto y coma, que es lo que exporta Excel argentino", () => {
    expect(separarDelimitado("a;b;c")).toEqual([["a", "b", "c"]]);
  });
  it("detecta el tabulador", () => {
    expect(separarDelimitado("a\tb")).toEqual([["a", "b"]]);
  });
  it("respeta el entrecomillado del delimitador", () => {
    expect(separarDelimitado('a;"b;c";d')).toEqual([["a", "b;c", "d"]]);
  });
  it("desdobla las comillas escapadas", () => {
    expect(separarDelimitado('a;"con ""comillas""";c')).toEqual([["a", 'con "comillas"', "c"]]);
  });
  it("conserva las celdas vacías", () => {
    expect(separarDelimitado("a;;c")).toEqual([["a", "", "c"]]);
  });
});

describe("cero pérdida silenciosa", () => {
  const { filas, resumen } = correr();

  it("toda fila analizada tiene exactamente un estado válido", () => {
    for (const f of filas) {
      expect(ESTADOS).toContain(f.estado);
    }
    expect(filas).toHaveLength(resumen.filasAnalizadas);
  });

  it("la suma de los estados da el total de filas analizadas", () => {
    const suma = ESTADOS.reduce((a, e) => a + resumen.porEstado[e], 0);
    expect(suma).toBe(resumen.filasAnalizadas);
  });

  it("analizadas más vacías da el total del archivo", () => {
    expect(resumen.filasAnalizadas + resumen.filasVacias).toBe(resumen.totalFilas);
  });

  it("el resumen se declara consistente", () => {
    expect(resumenEsConsistente(resumen)).toBe(true);
  });

  it("ninguna fila con contenido se cuenta como vacía", () => {
    const conContenido = separarDelimitado(MUESTRA)
      .slice(1)
      .filter((c) => c.some((x) => x.trim() !== "")).length;
    expect(resumen.filasAnalizadas).toBe(conContenido);
  });
});

describe("clasificación en los cinco estados", () => {
  const { filas, resumen } = correr();
  const de = (e: Estado) => filas.filter((f) => f.estado === e);

  it("clasifica como IMPORTED lo que no difiere del legacy", () => {
    expect(resumen.porEstado.IMPORTED).toBeGreaterThan(0);
    expect(de("IMPORTED").every((f) => f.diferencias.length === 0)).toBe(true);
    expect(de("IMPORTED").every((f) => f.movimiento !== null)).toBe(true);
  });

  it("clasifica como EXPECTED_DIFFERENCE lo que difiere por un bug conocido", () => {
    const e = de("EXPECTED_DIFFERENCE");
    expect(e.length).toBe(2);
    expect(e.every((f) => f.diferencias.length > 0)).toBe(true);
    expect(e.every((f) => f.diferencias.every((d) => d.motivo !== "sin_explicar"))).toBe(true);
  });

  it("clasifica como BLOCKED_BUSINESS_RULE la fila de Egresos, por D3", () => {
    const b = de("BLOCKED_BUSINESS_RULE");
    expect(b).toHaveLength(1);
    expect(b[0].decision).toBe("D3");
    expect(b[0].contraparte).toBe("Ibarra y Asociados");
  });

  it("clasifica como INVALID_SOURCE lo que no se puede interpretar, con el motivo", () => {
    const i = de("INVALID_SOURCE");
    expect(i).toHaveLength(5);
    expect(i.every((f) => f.movimiento === null)).toBe(true);
    expect(i.every((f) => f.errores.length > 0)).toBe(true);

    const campos = i.flatMap((f) => f.errores.map((e) => e.campo));
    expect(campos).toContain("Fecha");
    expect(campos).toContain("Tipo de Movimiento");
    expect(campos).toContain("Cliente/Proveedor");
    expect(campos).toContain("pesos");
  });

  it("no hay ninguna diferencia sin explicar en la muestra", () => {
    expect(resumen.porEstado.UNEXPLAINED_DIFFERENCE).toBe(0);
    expect(sinExplicar(filas)).toHaveLength(0);
  });

  it("una fecha inexistente se rechaza, no se corrige sola", () => {
    const f = filas.find((x) => x.errores.some((e) => e.valor === "31/02/2026"));
    expect(f?.estado).toBe("INVALID_SOURCE");
  });
});

describe("trazabilidad al origen", () => {
  const { filas } = correr();

  it("cada movimiento conserva archivo, hoja y fila de origen", () => {
    for (const f of filas) {
      if (!f.movimiento) continue;
      expect(f.movimiento.origen).toMatchObject({
        source_system: "sheets-caja-diaria",
        source_file: "legacy-muestra.csv",
        source_sheet: "Nordelta 03/09/26",
        source_row: f.fila,
      });
    }
  });

  it("el legacy_id es único por fila: es la clave de idempotencia", () => {
    const ids = filas.filter((f) => f.movimiento).map((f) => f.movimiento!.origen.legacy_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("volver a correr el mismo archivo da los mismos legacy_id", () => {
    const a = correr().filas.filter((f) => f.movimiento).map((f) => f.movimiento!.origen.legacy_id);
    const b = correr().filas.filter((f) => f.movimiento).map((f) => f.movimiento!.origen.legacy_id);
    expect(a).toEqual(b);
  });

  it("se puede responder de qué fila salió un movimiento sin investigar", () => {
    const objetivo = filas.find((f) => f.movimiento?.concepto === "Operacion mixta")!;
    expect(objetivo.movimiento!.origen.source_row).toBe(objetivo.fila);
    expect(objetivo.movimiento!.origen.legacy_id).toBe(`Nordelta 03/09/26:${objetivo.fila}`);
  });
});

describe("contrapartes", () => {
  const { resumen, filas } = correr();

  it("cuenta las contrapartes nuevas", () => {
    expect(resumen.contrapartesNuevas).toBeGreaterThan(0);
  });

  it("detecta la variante en mayúsculas que colapsa en una sola", () => {
    expect(resumen.contrapartesNormalizadas).toBe(1);
    const variantes = filas
      .filter((f) => f.contraparte.toLowerCase() === "comercial del plata sa")
      .map((f) => f.contraparte);
    expect(new Set(variantes).size).toBeGreaterThan(1);
  });

  it("no cuenta como nueva una que ya existe en la base", () => {
    const r = importar(separarDelimitado(MUESTRA), {
      ...OPCIONES,
      contrapartesExistentes: ["comercial del plata sa", "Distribuidora Andina SRL"],
    });
    expect(r.resumen.contrapartesNuevas).toBeLessThan(resumen.contrapartesNuevas);
  });
});

describe("cuantificación de los bugs · por moneda, sin mezclar", () => {
  const { resumen } = correr();
  const bug5 = resumen.cuantificacion.find((c) => c.bug === "bug5")!;
  const bug6 = resumen.cuantificacion.find((c) => c.bug === "bug6")!;

  it("bug 5: una fila, en pesos, con la pata descartada nombrada", () => {
    expect(bug5.filasAfectadas).toBe(1);
    expect(bug5.porMoneda).toEqual([{ moneda: "ARS", filas: 1, monto: 100000 }]);
    expect(bug5.patasDescartadas).toEqual({ PESOS: 1 });
    expect(bug5.contrapartes).toEqual(["Ibarra y Asociados"]);
  });

  it("bug 6: una fila, en dólares, con los 67,34 que el legacy descarta", () => {
    expect(bug6.filasAfectadas).toBe(1);
    expect(bug6.porMoneda).toEqual([{ moneda: "USD", filas: 1, monto: 67.34 }]);
    expect(bug6.patasDescartadas).toEqual({ "PESOS convertido": 1 });
  });

  it("informa el período afectado", () => {
    expect(bug5.fechaMinima).toBe("2026-09-04");
    expect(bug5.fechaMaxima).toBe("2026-09-04");
  });

  it("nunca produce un único número mezclando monedas", () => {
    for (const c of resumen.cuantificacion) {
      const monedas = c.porMoneda.map((d) => d.moneda);
      expect(new Set(monedas).size).toBe(monedas.length);
    }
  });

  it("una fila afectada por los dos bugs no duplica el daño", () => {
    // Fila con PESOS sin TC, transferencia convertida, y dólar nominal:
    // el legacy anula pesos (bug 5) y descarta la pata convertida (bug 6).
    const doble = [
      "Fecha;C;D;T;PESOS;TC;DOLARES;E;R;PF;Com;TCT;TrP;TrD;TrE;TrR",
      "03/09/2026;Doble SA;Doble bug;Ingresos;100.000;;90.000;;;;0,02;1.485;50.000;20.000;;",
    ].join("\n");
    const r = correr(doble);
    expect(r.resumen.filasConAmbosBugs).toBe(1);

    const q = cuantificar(r.filas);
    const c5 = q.find((x) => x.bug === "bug5")!;
    const c6 = q.find((x) => x.bug === "bug6")!;
    // Cada bug cuenta la fila una vez.
    expect(c5.filasAfectadas).toBe(1);
    expect(c6.filasAfectadas).toBe(1);
    // Y el dinero se atribuye a monedas distintas: no hay solapamiento.
    const monedas5 = new Set(c5.porMoneda.map((d) => d.moneda));
    const monedas6 = new Set(c6.porMoneda.map((d) => d.moneda));
    expect([...monedas5].some((m) => monedas6.has(m))).toBe(false);
  });
});

describe("reportes", () => {
  const { filas, resumen } = correr();
  const r = generarReportes(filas, resumen, { archivo: "x.csv", hoja: "h" });

  it("genera los seis CSV y el resumen en Markdown", () => {
    for (const clave of [
      "summary.csv", "expected-differences.csv", "unexplained.csv",
      "invalid-source.csv", "blocked-business-rules.csv", "por-contraparte.csv", "RESUMEN.md",
    ] as const) {
      expect(r[clave].length).toBeGreaterThan(0);
    }
  });

  it("summary.csv tiene una línea por fila analizada, más el encabezado", () => {
    const lineas = r["summary.csv"].trimEnd().split("\r\n");
    expect(lineas).toHaveLength(resumen.filasAnalizadas + 1);
  });

  it("los CSV arrancan con BOM y usan punto y coma", () => {
    expect(r["summary.csv"].charCodeAt(0)).toBe(0xfeff);
    expect(r["summary.csv"].split("\r\n")[0]).toContain(";");
  });

  it("por-contraparte.csv no mezcla monedas: una fila por moneda", () => {
    const lineas = r["por-contraparte.csv"].trimEnd().split("\r\n").slice(1);
    for (const l of lineas) {
      const moneda = l.split(";")[1];
      expect(["ARS", "USD", "EUR", "BRL"]).toContain(moneda);
    }
  });

  it("el resumen declara que la clasificación cierra", () => {
    expect(r["RESUMEN.md"]).toContain("Ninguna fila desapareció");
  });

  it("el resumen avisa que no se escribió nada", () => {
    expect(r["RESUMEN.md"]).toContain("no se escribió nada");
  });
});
