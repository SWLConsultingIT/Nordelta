/**
 * Valida el aislamiento entre organizaciones contra la base real.
 *
 *     npm run supabase:rls
 *
 * Es la única forma honesta de comprobar que la seguridad por fila
 * funciona. Un test con un doble no prueba nada: lo que se está
 * verificando es el comportamiento de Postgres, no el de nuestro código.
 *
 * **Todas las consultas se hacen con la clave publicable y una sesión de
 * usuario real.** La clave secreta se usa solo para crear el escenario y
 * limpiarlo: usarla para leer saltearía exactamente lo que se quiere
 * probar, y el script diría que todo está bien cuando no lo está.
 *
 * Todo el contenido es sintético y se borra al terminar.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { clienteAdmin } from "../src/lib/supabase/admin";
import { clavePublicable, urlSupabase } from "../src/lib/supabase/config";

interface Caso { nombre: string; ok: boolean; detalle: string }
const casos: Caso[] = [];
const registrar = (nombre: string, ok: boolean, detalle = "") =>
  casos.push({ nombre, ok, detalle });

const SUFIJO = Date.now().toString(36);
const ORGS = [
  { slug: `rls-a-${SUFIJO}`, nombre: "Organización A (prueba)", alias: "RLSA" },
  { slug: `rls-b-${SUFIJO}`, nombre: "Organización B (prueba)", alias: "RLSB" },
];
const CLAVE = `rls-${SUFIJO}-Xq7!`;

async function main() {
  if (typeof process.loadEnvFile === "function") {
    try { process.loadEnvFile(".env.local"); } catch { /* sin archivo */ }
  }
  const url = urlSupabase();
  const publicable = clavePublicable();
  if (!url || !publicable) {
    console.error("\nFaltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.\n");
    process.exit(1);
  }

  const admin = clienteAdmin();
  const creados: { orgs: string[]; usuarios: string[] } = { orgs: [], usuarios: [] };

  try {
    /* ── Escenario ── */
    console.log("\n\x1b[1mPreparando dos organizaciones\x1b[0m");
    const contexto: {
      orgId: string; userId: string; email: string; clienteId: string; sb: SupabaseClient;
    }[] = [];

    for (const org of ORGS) {
      const { data: o, error: e1 } = await admin
        .from("organizaciones").insert({ nombre: org.nombre, slug: org.slug })
        .select("id").single();
      if (e1) throw new Error(`organización ${org.slug}: ${e1.message}`);
      const orgId = (o as { id: string }).id;
      creados.orgs.push(orgId);

      const email = `${org.slug}@nordelta.test`;
      const { data: u, error: e2 } = await admin.auth.admin.createUser({
        email, password: CLAVE, email_confirm: true,
        user_metadata: { nombre: org.nombre, organizacion_id: orgId },
      });
      if (e2) throw new Error(`usuario ${email}: ${e2.message}`);
      creados.usuarios.push(u.user.id);
      await admin.from("perfiles")
        .update({ organizacion_id: orgId, rol: "operador" }).eq("id", u.user.id);

      const { data: c, error: e3 } = await admin
        .from("clientes")
        .insert({ organizacion_id: orgId, nombre: `Cliente de ${org.alias}`, alias: org.alias })
        .select("id").single();
      if (e3) throw new Error(`cliente de ${org.slug}: ${e3.message}`);

      // Sesión real, con la clave publicable. Es la que ve un usuario.
      const sb = createClient(url, publicable, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error: e4 } = await sb.auth.signInWithPassword({ email, password: CLAVE });
      if (e4) throw new Error(`ingreso de ${email}: ${e4.message}`);

      contexto.push({ orgId, userId: u.user.id, email, clienteId: (c as { id: string }).id, sb });
      console.log(`  ${org.alias} · organización, usuario y cliente listos`);
    }

    const [A, B] = contexto;

    /* ── Lectura ── */
    console.log("\n\x1b[1mLectura\x1b[0m");
    for (const [quien, ctx, propio, ajeno] of [
      ["A", A, A.clienteId, B.clienteId] as const,
      ["B", B, B.clienteId, A.clienteId] as const,
    ]) {
      const { data } = await ctx.sb.from("clientes").select("id");
      const ids = (data ?? []).map((x) => (x as { id: string }).id);
      registrar(`${quien} ve su propio cliente`, ids.includes(propio));
      registrar(`${quien} NO ve el cliente de la otra`, !ids.includes(ajeno),
        ids.includes(ajeno) ? "FILTRACIÓN" : "");
    }

    // Lectura dirigida: pedir el id exacto del otro tampoco puede funcionar.
    const { data: dirigida } = await A.sb.from("clientes").select("id").eq("id", B.clienteId);
    registrar("A no puede leer el cliente de B ni pidiéndolo por id",
      (dirigida ?? []).length === 0);

    /* ── Escritura cruzada ── */
    console.log("\x1b[1mEscritura\x1b[0m");
    const { error: cruzado } = await A.sb
      .from("clientes")
      .insert({ organizacion_id: B.orgId, nombre: "Intruso", alias: "INTRUSO" });
    registrar("A no puede escribir en la organización de B", Boolean(cruzado),
      cruzado ? "" : "FILTRACIÓN: el insert cruzado pasó");

    // Clave foránea cruzada: una planilla propia apuntando al cliente de la
    // otra organización. Las FK no pasan por las políticas, así que esto lo
    // tiene que frenar la clave compuesta (id, organizacion_id).
    const { error: fk } = await A.sb.from("planillas").insert({
      organizacion_id: A.orgId, cliente_id: B.clienteId,
      archivo: "cruzada.xlsx", fecha: "2026-09-10",
    });
    registrar("A no puede apuntar a un cliente de B", Boolean(fk),
      fk ? "" : "FILTRACIÓN: la clave foránea cruzada pasó");

    /* ── Suplantación de autor ── */
    console.log("\x1b[1mAutoría\x1b[0m");
    const { data: planillaA } = await A.sb.from("planillas")
      .insert({ organizacion_id: A.orgId, cliente_id: A.clienteId,
                archivo: "propia.xlsx", fecha: "2026-09-10" })
      .select("id").single();
    const { data: transfA } = await A.sb.from("transferencias").insert({
      organizacion_id: A.orgId, planilla_id: (planillaA as { id: string }).id,
      cliente_id: A.clienteId, fila: 1, fecha_deposito: "2026-09-10",
      identificacion_original: "20305555550", identificacion_normalizada: "20305555550",
      tipo_identificacion: "CUIT_VALIDO", importe_centavos: 100000,
    }).select("id").single();

    const { error: suplanta } = await A.sb.from("resoluciones").insert({
      organizacion_id: A.orgId, transferencia_id: (transfA as { id: string }).id,
      decision: "MANTENER_PENDIENTE", origen: "HUMANA",
      estado_previo: "PENDIENTE_NO_ENCONTRADA_EN_RANGO",
      // Se intenta anotar a B como autor de una decisión de A.
      actor: B.userId,
    });
    registrar("A no puede anotar a B como autor de una decisión", Boolean(suplanta),
      suplanta ? "" : "FILTRACIÓN: la suplantación de autor pasó");

    const { error: propia } = await A.sb.from("resoluciones").insert({
      organizacion_id: A.orgId, transferencia_id: (transfA as { id: string }).id,
      decision: "MANTENER_PENDIENTE", origen: "HUMANA",
      estado_previo: "PENDIENTE_NO_ENCONTRADA_EN_RANGO", actor: A.userId,
    });
    registrar("A sí puede registrar su propia decisión", !propia, propia?.message ?? "");

    /* ── Borrado ── */
    console.log("\x1b[1mBorrado\x1b[0m");
    const { error: borra, count } = await A.sb
      .from("transferencias").delete({ count: "exact" }).eq("id", (transfA as { id: string }).id);
    // Sin política de delete, la operación no encuentra ninguna fila.
    registrar("nadie borra transferencias", !borra && count === 0,
      count ? `borró ${count} filas` : "");

    /* ── Resultado ── */
    console.log("\n\x1b[1mResultado\x1b[0m");
    for (const c of casos) {
      const marca = c.ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
      console.log(`  ${marca} ${c.nombre}${c.detalle ? `  \x1b[31m${c.detalle}\x1b[0m` : ""}`);
    }
    const fallaron = casos.filter((c) => !c.ok);
    console.log(
      fallaron.length === 0
        ? `\n  \x1b[32m${casos.length}/${casos.length} · el aislamiento funciona\x1b[0m\n`
        : `\n  \x1b[31m${fallaron.length} de ${casos.length} fallaron\x1b[0m\n`,
    );
    if (fallaron.length > 0) process.exitCode = 1;
  } finally {
    /* ── Limpieza ── */
    console.log("\x1b[1mLimpiando\x1b[0m");
    for (const tabla of [
      "resoluciones", "transferencias", "planillas", "clientes",
    ]) {
      for (const orgId of creados.orgs) {
        await admin.from(tabla).delete().eq("organizacion_id", orgId);
      }
    }
    for (const userId of creados.usuarios) await admin.auth.admin.deleteUser(userId);
    for (const orgId of creados.orgs) await admin.from("organizaciones").delete().eq("id", orgId);
    console.log("  escenario de prueba eliminado\n");
  }
}

main().catch((e) => {
  console.error("\n\x1b[31mFalló la validación\x1b[0m\n ", e instanceof Error ? e.message : e, "\n");
  process.exit(1);
});
