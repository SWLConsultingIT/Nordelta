/**
 * Las políticas de archivos, contra Postgres de verdad.
 *
 * El aislamiento de los originales no puede depender del nombre del
 * archivo, que lo elige quien sube. Depende de la ruta: el primer
 * segmento es la organización, y la política lo compara contra la
 * organización de quien consulta.
 *
 * Acá se prueba la **forma de la ruta y la expresión de la política**
 * contra el motor. El comportamiento de punta a punta —subir, bajar,
 * listar— se verifica contra Supabase real con `npm run supabase:rls`,
 * porque el almacenamiento no es solo SQL.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { pgConMigraciones } from "./_pg";
import { rutaDe } from "../src/lib/data/almacenamiento";

let db: PGlite;
const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_B = "22222222-2222-4222-8222-222222222222";

beforeAll(async () => {
  db = await pgConMigraciones();
});
afterAll(async () => db?.close());

describe("la ruta separa por organización", () => {
  it("el primer segmento es la organización", () => {
    const ruta = rutaDe(ORG_A, "planillas", "Transferencias.xlsx", "abc123");
    expect(ruta.split("/")[0]).toBe(ORG_A);
  });

  it("distingue planillas de informes", () => {
    expect(rutaDe(ORG_A, "planillas", "x.xlsx", "h").split("/")[1]).toBe("planillas");
    expect(rutaDe(ORG_A, "fullcarga", "x.xls", "h").split("/")[1]).toBe("fullcarga");
  });

  it("el mismo archivo cae siempre en la misma ruta", () => {
    expect(rutaDe(ORG_A, "planillas", "x.xlsx", "huella"))
      .toBe(rutaDe(ORG_A, "planillas", "x.xlsx", "huella"));
  });

  it("un nombre con ruta adentro no puede escapar de su carpeta", () => {
    // Es el caso que importa: el nombre lo elige quien sube el archivo.
    const ruta = rutaDe(ORG_A, "planillas", "../../../otra-org/robado.xlsx", "h");
    expect(ruta.split("/")[0]).toBe(ORG_A);
    expect(ruta).not.toContain("..");
    expect(ruta.split("/")).toHaveLength(4);
  });

  it("dos organizaciones nunca comparten prefijo", () => {
    const a = rutaDe(ORG_A, "planillas", "igual.xlsx", "misma-huella");
    const b = rutaDe(ORG_B, "planillas", "igual.xlsx", "misma-huella");
    expect(a).not.toBe(b);
    expect(a.split("/")[0]).not.toBe(b.split("/")[0]);
  });
});

describe("la función que parte la ruta", () => {
  it("devuelve los segmentos de carpeta, sin el archivo", async () => {
    const r = await db.query<{ segmentos: string[] }>(
      `select storage.foldername($1) as segmentos`,
      [rutaDe(ORG_A, "planillas", "x.xlsx", "huella")],
    );
    expect(r.rows[0].segmentos).toEqual([ORG_A, "planillas", "huella"]);
  });

  it("el primer segmento es lo que compara la política", async () => {
    const r = await db.query<{ org: string }>(
      `select (storage.foldername($1))[1] as org`,
      [rutaDe(ORG_B, "fullcarga", "informe.xls", "h")],
    );
    expect(r.rows[0].org).toBe(ORG_B);
  });
});

describe("las políticas existen y son las que tienen que ser", () => {
  it("hay lectura, escritura y actualización sobre los objetos", async () => {
    const r = await db.query<{ policyname: string; cmd: string }>(
      `select policyname, cmd from pg_policies
       where schemaname = 'storage' and tablename = 'objects' order by policyname`,
    );
    expect(r.rows.map((f) => f.cmd).sort()).toEqual(["INSERT", "SELECT", "UPDATE"]);
  });

  it("no hay política de borrado: un original no se borra", async () => {
    const r = await db.query<{ n: number }>(
      `select count(*)::int as n from pg_policies
       where schemaname = 'storage' and tablename = 'objects' and cmd = 'DELETE'`,
    );
    expect(r.rows[0].n).toBe(0);
  });

  it("todas comparan el primer segmento contra fn_org()", async () => {
    const r = await db.query<{ policyname: string; qual: string | null; wc: string | null }>(
      `select policyname, qual, with_check as wc from pg_policies
       where schemaname = 'storage' and tablename = 'objects'`,
    );
    for (const p of r.rows) {
      const expr = `${p.qual ?? ""} ${p.wc ?? ""}`;
      expect(expr, p.policyname).toContain("fn_org()");
      expect(expr, p.policyname).toContain("foldername");
      expect(expr, p.policyname).toContain("originales");
    }
  });
});
