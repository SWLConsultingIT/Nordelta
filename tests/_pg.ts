import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = join(import.meta.dirname, "..", "supabase", "migrations");

/**
 * Postgres real (WASM) con las migraciones aplicadas.
 *
 * Permite verificar contra el motor de verdad lo que de otro modo serían
 * suposiciones: que las columnas generadas dan el mismo número que el
 * TypeScript, que las restricciones rechazan lo que tienen que rechazar, y
 * que las vistas calculan el saldo y el cierre como el dominio.
 *
 * Lo que Supabase aporta y acá hay que emular: el esquema `auth`, la tabla
 * `auth.users` y `auth.uid()`.
 */
export async function pgConMigraciones(): Promise<PGlite> {
  const db = await PGlite.create();

  await db.exec(`
    -- Roles que provee Supabase.
    create role anon;
    create role authenticated;
    create role service_role;

    create schema if not exists auth;
    create table auth.users (
      id uuid primary key default gen_random_uuid(),
      email text,
      raw_user_meta_data jsonb
    );
    -- Sustituto de auth.uid(): lee un ajuste de sesión.
    create or replace function auth.uid() returns uuid
    language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
  `);

  // Concesiones que Supabase aplica por defecto, para que las pruebas de
  // seguridad por fila sean representativas.
  const grants = `
    grant usage on schema public to authenticated, anon;
    grant select, insert, update, delete on all tables in schema public to authenticated;
    grant usage, select on all sequences in schema public to authenticated;
  `;

  for (const archivo of readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = readFileSync(join(DIR, archivo), "utf8");
    try {
      await db.exec(sql);
    } catch (e) {
      throw new Error(`Falló ${archivo}: ${(e as Error).message}`);
    }
  }
  await db.exec(grants);
  return db;
}

/** Actúa como el usuario dado en las siguientes consultas. */
export async function actuarComo(db: PGlite, uid: string | null) {
  await db.exec(
    uid === null
      ? `select set_config('request.jwt.claim.sub', '', false)`
      : `select set_config('request.jwt.claim.sub', '${uid}', false)`,
  );
}

/** Crea un usuario de auth y devuelve su id; el trigger le arma el perfil. */
export async function crearUsuario(
  db: PGlite,
  opciones: { rol?: string; oficinaId?: number | null; todas?: boolean } = {},
): Promise<string> {
  const r = await db.query<{ id: string }>(
    `insert into auth.users (email) values ('u' || gen_random_uuid() || '@test') returning id`,
  );
  const id = r.rows[0].id;
  await db.query(
    `update perfiles set rol = $2::rol, oficina_id = $3, todas_las_oficinas = $4 where id = $1`,
    [id, opciones.rol ?? "operador", opciones.oficinaId ?? null, opciones.todas ?? false],
  );
  return id;
}

export const num = (v: unknown): number => Number(v);
