/**
 * Validación y guardado de los archivos originales.
 *
 * Lo que se prueba acá es la frontera menos confiable del sistema: un
 * archivo que sube un usuario. Nombre, extensión y tipo declarado los
 * elige quien sube; lo único que no puede falsificar sin esfuerzo es el
 * contenido, y eso es lo que se mira.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  TAMANO_MAXIMO, almacenDeArchivos, nombreSeguro, sha256, validarArchivo,
} from "../../src/lib/data/almacenamiento";
import { escribirXlsx } from "../../src/lib/planillas/escritor-xlsx";
import { ErrorValidacion } from "../../src/lib/domain/errors";

const DIR = mkdtempSync(join(tmpdir(), "nord-files-"));
process.env.NORD_DATA_DIR = DIR;
afterAll(() => rmSync(DIR, { recursive: true, force: true }));

const XLSX = escribirXlsx([["a", 1]]);
const XLS = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]);

describe("nombres", () => {
  it("descarta cualquier ruta que venga en el nombre", () => {
    // Un archivo llamado así no puede escribir fuera de su carpeta.
    expect(nombreSeguro("../../etc/passwd")).toBe("passwd");
    expect(nombreSeguro("C:\\Windows\\system32\\x.xlsx")).toBe("x.xlsx");
  });

  it("saca acentos y caracteres raros", () => {
    expect(nombreSeguro("Transferencias Ñandú (2026).xlsx"))
      .toBe("Transferencias-Nandu-2026-.xlsx");
  });

  it("un nombre que queda vacío no rompe", () => {
    expect(nombreSeguro("///")).toBe("archivo");
    expect(nombreSeguro("...")).toBe("archivo");
  });

  it("acota el largo", () => {
    expect(nombreSeguro("x".repeat(500)).length).toBeLessThanOrEqual(120);
  });
});

describe("validación", () => {
  it("acepta un .xlsx real", () => {
    expect(validarArchivo("planilla.xlsx", XLSX).extension).toBe(".xlsx");
  });

  it("acepta un .xls real", () => {
    expect(validarArchivo("informe.xls", XLS).extension).toBe(".xls");
  });

  it("rechaza un archivo vacío", () => {
    expect(() => validarArchivo("x.xlsx", Buffer.alloc(0))).toThrow(ErrorValidacion);
  });

  it("rechaza lo que supera el máximo", () => {
    const grande = Buffer.concat([XLSX, Buffer.alloc(TAMANO_MAXIMO)]);
    expect(() => validarArchivo("x.xlsx", grande)).toThrow(/MB/);
  });

  it("rechaza una extensión que no manejamos", () => {
    expect(() => validarArchivo("script.js", XLSX)).toThrow(/xlsx|xls/i);
  });

  it("rechaza un ejecutable disfrazado de planilla", () => {
    // El caso que importa: la extensión miente y el contenido no.
    const falso = Buffer.from("MZ\x90\x00ejecutable", "latin1");
    expect(() => validarArchivo("planilla.xlsx", falso)).toThrow(/contenido/i);
  });

  it("rechaza un .xls que en realidad es un .xlsx", () => {
    expect(() => validarArchivo("informe.xls", XLSX)).toThrow(/dice ser/i);
  });
});

describe("guardado local", () => {
  it("devuelve ruta, huella y tamaño", async () => {
    const almacen = await almacenDeArchivos();
    const g = await almacen.guardar("planillas", "una.xlsx", XLSX);
    expect(g.sha256).toBe(sha256(XLSX));
    expect(g.bytes).toBe(XLSX.length);
    expect(g.ruta).toContain("una.xlsx");
  });

  it("lo guardado se puede volver a leer byte por byte", async () => {
    const almacen = await almacenDeArchivos();
    const g = await almacen.guardar("planillas", "otra.xlsx", XLSX);
    expect(await almacen.leer(g.ruta)).toEqual(XLSX);
  });

  it("el mismo archivo cae siempre en la misma ruta", async () => {
    const almacen = await almacenDeArchivos();
    const a = await almacen.guardar("planillas", "igual.xlsx", XLSX);
    const b = await almacen.guardar("planillas", "igual.xlsx", XLSX);
    expect(b.ruta).toBe(a.ruta);
  });

  it("dos archivos distintos con el mismo nombre no se pisan", async () => {
    const almacen = await almacenDeArchivos();
    const a = await almacen.guardar("planillas", "choque.xlsx", XLSX);
    const b = await almacen.guardar("planillas", "choque.xlsx", escribirXlsx([["b", 2]]));
    expect(b.ruta).not.toBe(a.ruta);
    expect(await almacen.leer(a.ruta)).toEqual(XLSX);
  });

  it("no se puede leer fuera de la carpeta de archivos", async () => {
    const almacen = await almacenDeArchivos();
    expect(await almacen.leer("../../../../etc/passwd")).toBeNull();
  });

  it("una ruta que no existe devuelve null", async () => {
    const almacen = await almacenDeArchivos();
    expect(await almacen.leer("planillas/no-existe.xlsx")).toBeNull();
  });
});
