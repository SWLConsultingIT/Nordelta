/**
 * Comprueba que un usuario real ve lo que tiene que ver.
 *
 *     npm run supabase:verificar
 *
 * Entra con correo y contraseña, con la **clave publicable**, y consulta a
 * través de los mismos repositorios que usa la aplicación. Si esto pasa,
 * la aplicación funciona: no hay ninguna otra vía por la que lea datos.
 *
 * Deliberadamente no usa la clave secreta. Verificar con una clave que
 * saltea la seguridad por fila demostraría que los datos existen, no que
 * el usuario puede verlos, que es la pregunta.
 */

import { createClient } from "@supabase/supabase-js";
import { clavePublicable, urlSupabase } from "../src/lib/supabase/config";
import { repositoriosSupabase } from "../src/lib/data/supabase";
import { bucketDe } from "../src/lib/operaciones/buckets";

const USUARIO = { email: "mati@nordelta.demo", password: "nordelta-staging-2026" };

async function main() {
  if (typeof process.loadEnvFile === "function") {
    try { process.loadEnvFile(".env.local"); } catch { /* sin archivo */ }
  }
  const url = urlSupabase();
  const clave = clavePublicable();
  if (!url || !clave) {
    console.error("\nFaltan la URL y la clave publicable de Supabase.\n");
    process.exit(1);
  }

  const sb = createClient(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const paso = (t: string) => console.log(`\n\x1b[1m${t}\x1b[0m`);

  paso("1 · Ingreso");
  const { data: sesion, error } = await sb.auth.signInWithPassword(USUARIO);
  if (error) throw new Error(`No se pudo ingresar: ${error.message}`);
  console.log(`  ${sesion.user.email}`);

  paso("2 · Perfil y organización");
  const { data: perfil, error: e2 } = await sb
    .from("perfiles").select("nombre, rol, organizaciones ( nombre )")
    .eq("id", sesion.user.id).maybeSingle();
  if (e2) throw new Error(`No se pudo leer el perfil: ${e2.message}`);
  const p = perfil as unknown as {
    nombre: string; rol: string; organizaciones: { nombre: string } | null;
  } | null;
  if (!p?.organizaciones) throw new Error("El perfil no tiene organización");
  console.log(`  ${p.nombre || "(sin nombre)"} · ${p.rol} · ${p.organizaciones.nombre}`);

  paso("3 · Lo que ve a través de los repositorios de la aplicación");
  const repos = repositoriosSupabase(sb);
  const [clientes, planillas, operaciones, acreditaciones, corridas] = await Promise.all([
    repos.clientes.listar(),
    repos.planillas.listar(),
    repos.transferencias.listar(),
    repos.acreditaciones.listar(),
    repos.conciliacion.corridas(1),
  ]);
  console.log(`  ${clientes.length} clientes · ${planillas.length} planillas`);
  console.log(`  ${operaciones.length} operaciones · ${acreditaciones.length} acreditaciones`);
  console.log(`  última corrida: ${corridas[0]?.momento ?? "—"}`);

  paso("4 · La partición, calculada sobre datos de la base");
  const cuenta: Record<string, number> = {};
  for (const o of operaciones) cuenta[bucketDe(o.estado)] = (cuenta[bucketDe(o.estado)] ?? 0) + 1;
  for (const [k, v] of Object.entries(cuenta).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(12)} ${v}`);
  }
  const auto = cuenta.CONCILIADA ?? 0;
  const atencion = (cuenta.PENDIENTE ?? 0) + (cuenta.REVISION ?? 0) + (cuenta.ERROR ?? 0);
  const suma = Object.values(cuenta).reduce((a, b) => a + b, 0);

  paso("5 · Invariantes");
  const ok = (t: string, c: boolean) =>
    console.log(`  ${c ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${t}`);
  ok("los grupos suman el total", suma === operaciones.length);
  ok("ninguna acreditación se cobró dos veces", (() => {
    const usadas = operaciones.map((o) => o.acreditacionId).filter(Boolean);
    return new Set(usadas).size === usadas.length;
  })());
  ok("toda operación acreditada tiene su registro", operaciones.every(
    (o) => !["ACREDITADA_EXACTA_CUIT", "ACREDITADA_EXACTA_DNI", "ACREDITADA_MANUAL"]
      .includes(o.estado) || Boolean(o.acreditacionId),
  ));

  console.log(
    `\n  \x1b[32m${((auto / operaciones.length) * 100).toFixed(1)} % conciliado automáticamente` +
    `\x1b[0m · ${atencion} requieren atención\n`,
  );
  await sb.auth.signOut();
}

main().catch((e) => {
  console.error("\n\x1b[31mFalló la verificación\x1b[0m\n ", e instanceof Error ? e.message : e, "\n");
  process.exit(1);
});
