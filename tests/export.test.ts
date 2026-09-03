import { describe, expect, it } from "vitest";

/**
 * El CSV se genera del lado del servidor para que el archivo sea idéntico
 * siempre. Estas pruebas cubren el escapado, que es donde un export se
 * rompe en silencio: un punto y coma dentro de un concepto corre todas las
 * columnas y nadie lo nota hasta que el cliente pregunta.
 */

// Misma implementación que src/app/api/export/route.ts.
function csv(filas: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + filas.map((f) => f.map(esc).join(";")).join("\r\n");
}

const sinBom = (s: string) => s.replace(/^﻿/, "");

describe("csv · compatibilidad con Excel argentino", () => {
  it("arranca con BOM UTF-8, que es lo que hace que Excel lea los acentos", () => {
    expect(csv([["a"]]).charCodeAt(0)).toBe(0xfeff);
  });

  it("separa con punto y coma, no con coma", () => {
    // La coma es el separador decimal en es-AR: con coma como delimitador,
    // 1.234,56 se parte en dos columnas.
    expect(sinBom(csv([["a", "b"]]))).toBe("a;b");
  });

  it("termina las líneas con CRLF", () => {
    expect(sinBom(csv([["a"], ["b"]]))).toBe("a\r\nb");
  });

  it("conserva tildes y eñes sin escaparlas", () => {
    expect(sinBom(csv([["Gutiérrez, Peña & Cía."]]))).toBe("Gutiérrez, Peña & Cía.");
  });

  it("entrecomilla cuando el valor tiene punto y coma", () => {
    expect(sinBom(csv([["Pago; parcial", "x"]]))).toBe('"Pago; parcial";x');
  });

  it("duplica las comillas internas, como manda el formato", () => {
    expect(sinBom(csv([['Concepto "especial"']]))).toBe('"Concepto ""especial"""');
  });

  it("entrecomilla los saltos de línea internos", () => {
    expect(sinBom(csv([["dos\nlíneas"]]))).toBe('"dos\nlíneas"');
  });

  it("deja pasar la coma sin entrecomillar: es el decimal, no un separador", () => {
    expect(sinBom(csv([["1.234,56"]]))).toBe("1.234,56");
  });

  it("no rompe con celdas vacías", () => {
    expect(sinBom(csv([["a", "", "c"]]))).toBe("a;;c");
  });

  it("mantiene los montos en formato argentino", () => {
    const fila = ["Alvarez, J.", "2.400.000,00", "", "14/02/2026"];
    // El nombre lleva coma pero no punto y coma, así que no se entrecomilla.
    expect(sinBom(csv([fila]))).toBe("Alvarez, J.;2.400.000,00;;14/02/2026");
  });

  it("es estable: la misma entrada da exactamente la misma salida", () => {
    const filas = [["Cliente", "ARS"], ["Peña, R.", "1.500,50"]];
    expect(csv(filas)).toBe(csv(filas));
  });
});
