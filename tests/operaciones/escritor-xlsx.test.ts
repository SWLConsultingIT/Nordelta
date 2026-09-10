/**
 * El escritor de `.xlsx`, contra el lector del propio proyecto.
 *
 * Escribir y volver a leer con dos piezas independientes es la única forma
 * honesta de probar un formato binario: si las dos comparten el error, el
 * test pasaría igual. Acá el lector ya existía y se escribió contra archivos
 * reales de Excel, así que sirve de juez.
 */

import { describe, expect, it } from "vitest";
import { escribirXlsx, letraColumna } from "../../src/lib/planillas/escritor-xlsx";
import { leerXlsx, clave } from "../../src/lib/planillas/xlsx";
import { parsearPlanillaCliente } from "../../src/lib/planillas/cliente";

describe("letras de columna", () => {
  it("sigue la numeración de Excel", () => {
    expect(letraColumna(0)).toBe("A");
    expect(letraColumna(25)).toBe("Z");
    expect(letraColumna(26)).toBe("AA");
    expect(letraColumna(27)).toBe("AB");
  });
});

describe("ida y vuelta", () => {
  it("lo que se escribe es lo que se lee", () => {
    const bytes = escribirXlsx([["Texto", 42, null], ["", -1.5, "Último"]], "Prueba");
    const [hoja] = leerXlsx(bytes);
    expect(hoja.nombre).toBe("Prueba");
    expect(hoja.celdas.get(clave(0, 0))?.valor).toBe("Texto");
    expect(hoja.celdas.get(clave(0, 1))?.valor).toBe(42);
    expect(hoja.celdas.get(clave(1, 1))?.valor).toBe(-1.5);
    expect(hoja.celdas.get(clave(1, 2))?.valor).toBe("Último");
  });

  it("las celdas vacías no ocupan lugar", () => {
    const [hoja] = leerXlsx(escribirXlsx([["a", null, null]]));
    expect(hoja.celdas.has(clave(0, 1))).toBe(false);
  });

  it("escapa lo que rompería el XML", () => {
    const [hoja] = leerXlsx(escribirXlsx([['Ferre & Cía <"S.A.">']]));
    expect(hoja.celdas.get(clave(0, 0))?.valor).toBe('Ferre & Cía <"S.A.">');
  });

  it("sobrevive a los acentos y la eñe", () => {
    const [hoja] = leerXlsx(escribirXlsx([["Muñoz Iturbe", "Año 2026"]]));
    expect(hoja.celdas.get(clave(0, 0))?.valor).toBe("Muñoz Iturbe");
    expect(hoja.celdas.get(clave(0, 1))?.valor).toBe("Año 2026");
  });

  it("aguanta una planilla del tamaño de una real", () => {
    const filas = Array.from({ length: 600 }, (_, i) => [`fila ${i}`, i, i * 1.5]);
    const [hoja] = leerXlsx(escribirXlsx(filas));
    expect(hoja.maxFila).toBe(599);
    expect(hoja.celdas.get(clave(599, 1))?.valor).toBe(599);
  });
});

describe("una planilla de cliente escrita así se puede importar", () => {
  const ENCABEZADO = [
    "BANCO", "FECHA DEPOSITO", "IMPORTE", "NOMBRE",
    "DNI/CUIT DEPOSITANTE", "NRO DEPOSITO", "TIPO", "COMENTARIO",
  ];

  it("se ubica el encabezado aunque no esté en la primera fila", () => {
    const bytes = escribirXlsx([
      ["Planilla de transferencias"],
      [],
      ENCABEZADO,
      ["BANCO GALICIA", "2026-09-08", 153500, "Ana Inventada", "20305555550", "4123456", "TRANSFERENCIA", ""],
    ]);
    const p = parsearPlanillaCliente(bytes, { sourceFile: "x.xlsx" });
    expect(p.filaEncabezado).toBe(2);
    expect(p.columnasFaltantes).toEqual([]);
    expect(p.transferencias).toHaveLength(1);
    expect(p.transferencias[0].validationStatus).toBe("VALIDA");
  });

  it("una columna de más se ignora sin romper nada", () => {
    const bytes = escribirXlsx([
      [...ENCABEZADO, "OBSERVACIONES INTERNAS"],
      ["BANCO MACRO", "2026-09-08", 185000, "Luis Inventado", "30555555", "4123457", "TRANSFERENCIA", "", "nota"],
    ]);
    const p = parsearPlanillaCliente(bytes, { sourceFile: "x.xlsx" });
    expect(p.columnasDesconocidas).toEqual(["OBSERVACIONES INTERNAS"]);
    expect(p.transferencias[0].tipoIdentificacion).toBe("DNI_PROBABLE");
  });

  it("un importe con formato argentino se normaliza", () => {
    const bytes = escribirXlsx([
      ENCABEZADO,
      ["BBVA", "2026-09-09", "245.000,00", "Malena Inventada", "20305555550", "4123458", "TRANSFERENCIA", ""],
    ]);
    const p = parsearPlanillaCliente(bytes, { sourceFile: "x.xlsx" });
    expect(p.transferencias[0].importe).toBe(245000);
  });

  it("un CUIT con el verificador mal sale marcado, no corregido", () => {
    const bytes = escribirXlsx([
      ENCABEZADO,
      ["BANCO NACION", "2026-09-09", 799000, "Ezequiel Inventado", "20305555551", "4123459", "TRANSFERENCIA", ""],
    ]);
    const p = parsearPlanillaCliente(bytes, { sourceFile: "x.xlsx" });
    const t = p.transferencias[0];
    expect(t.tipoIdentificacion).toBe("IDENTIFICACION_INVALIDA");
    // Lo que mandó el cliente se conserva intacto.
    expect(t.identificacionNormalizada).toBe("20305555551");
  });
});
