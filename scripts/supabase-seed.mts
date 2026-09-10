/**
 * Siembra el proyecto de staging con datos sintéticos.
 *
 *     npm run supabase:seed
 *
 * Usa **el mismo generador** que la demostración local, así que los
 * números que muestra la aplicación contra Postgres son los mismos que
 * contra el archivo: 497 operaciones, 455 conciliadas automáticamente, 24
 * pendientes, 11 en revisión, 7 con error. No están escritos en ningún
 * lado: los produce el matcher.
 *
 * Todo es inventado. Ni un nombre, ni un CUIT, ni un importe sale de un
 * archivo real de cliente.
 *
 * Corre con la clave secreta porque tiene que crear usuarios y saltear la
 * seguridad por fila para sembrar. **Es lo único que puede hacerlo**, y
 * por eso vive en un script y no en la aplicación.
 */

import { clienteAdmin } from "../src/lib/supabase/admin";
import { generarOperaciones } from "../src/lib/data/dataset-operaciones";
import { bucketDe } from "../src/lib/operaciones/buckets";

const ORG = { nombre: "Nordelta", slug: "nordelta" };
const USUARIO = { email: "mati@nordelta.demo", password: "nordelta-staging-2026" };

const CENTAVOS = (n: number) => Math.round(n * 100);

function exigirCredenciales() {
  if (!process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      "\nFaltan credenciales.\n\n" +
        "  SUPABASE_URL=...\n  SUPABASE_SECRET_KEY=...\n\n" +
        "Van en .env.local, que no se commitea.\n",
    );
    process.exit(1);
  }
}

async function main() {
  if (typeof process.loadEnvFile === "function") {
    try { process.loadEnvFile(".env.local"); } catch { /* sin archivo */ }
  }
  exigirCredenciales();

  const sb = clienteAdmin();
  const paso = (t: string) => console.log(`\n\x1b[1m${t}\x1b[0m`);

  /* ── Organización ── */
  paso("1 · Organización");
  const { data: orgExistente } = await sb
    .from("organizaciones").select("id, nombre").eq("slug", ORG.slug).maybeSingle();
  let organizacionId = (orgExistente as { id: string } | null)?.id;
  if (!organizacionId) {
    const { data, error } = await sb
      .from("organizaciones").insert(ORG).select("id").single();
    if (error) throw new Error(`No se pudo crear la organización: ${error.message}`);
    organizacionId = (data as { id: string }).id;
  }
  console.log(`  ${ORG.nombre} · ${organizacionId}`);

  /* ── Usuario ── */
  paso("2 · Usuario");
  const { data: usuarios } = await sb.auth.admin.listUsers();
  let userId = usuarios?.users.find((u) => u.email === USUARIO.email)?.id;
  if (!userId) {
    const { data, error } = await sb.auth.admin.createUser({
      email: USUARIO.email,
      password: USUARIO.password,
      email_confirm: true,
      user_metadata: { nombre: "Mati", organizacion_id: organizacionId },
    });
    if (error) throw new Error(`No se pudo crear el usuario: ${error.message}`);
    userId = data.user.id;
  }
  // El trigger crea el perfil; se asegura organización y rol operativo.
  await sb.from("perfiles")
    .update({ organizacion_id: organizacionId, rol: "operador", nombre: "Mati" })
    .eq("id", userId);
  console.log(`  ${USUARIO.email} · rol operador`);

  /* ── Datos ── */
  paso("3 · Generando el dataset sintético");
  const datos = generarOperaciones();
  console.log(`  ${datos.clientes.length} clientes · ${datos.planillas.length} planillas · ` +
    `${datos.operaciones.length} operaciones · ${datos.acreditaciones.length} acreditaciones`);

  paso("4 · Limpiando lo sembrado antes (no toca otras organizaciones)");
  // El orden respeta las claves foráneas.
  for (const tabla of [
    "transferencia_eventos", "resoluciones", "conciliacion_corridas", "transferencias",
    "acreditaciones", "planillas", "mapeos_identidad", "informes_fullcarga",
    "cliente_emails", "clientes",
  ]) {
    const { error } = await sb.from(tabla).delete().eq("organizacion_id", organizacionId);
    if (error) throw new Error(`No se pudo limpiar ${tabla}: ${error.message}`);
  }
  console.log("  listo");

  /* ── Inserción ── */
  const base = { organizacion_id: organizacionId };
  const idCliente = new Map<string, string>();
  const idPlanilla = new Map<string, string>();
  const idInforme = new Map<string, string>();
  const idAcreditacion = new Map<string, string>();

  paso("5 · Clientes");
  for (const c of datos.clientes) {
    const { data, error } = await sb.from("clientes")
      .insert({ ...base, nombre: c.nombre, alias: c.alias })
      .select("id").single();
    if (error) throw new Error(`cliente ${c.alias}: ${error.message}`);
    idCliente.set(c.id, (data as { id: string }).id);
  }
  console.log(`  ${idCliente.size} creados`);

  paso("6 · Informes y acreditaciones");
  for (const i of datos.informes) {
    const { data, error } = await sb.from("informes_fullcarga")
      .insert({ ...base, archivo: i.archivo, desde: i.desde, hasta: i.hasta, origen: i.origen })
      .select("id").single();
    if (error) throw new Error(`informe: ${error.message}`);
    idInforme.set(i.id, (data as { id: string }).id);
  }
  for (const lote of enLotes(datos.acreditaciones, 500)) {
    const { data, error } = await sb.from("acreditaciones")
      .insert(lote.map((a) => ({
        ...base,
        informe_id: idInforme.get(a.informeId)!,
        fila_origen: a.row,
        cuit: a.cuit,
        fecha_ingreso: a.fecha,
        importe_centavos: CENTAVOS(a.importe),
        banco: a.banco,
        descripcion: a.descripcion,
      })))
      .select("id, informe_id, fila_origen");
    if (error) throw new Error(`acreditaciones: ${error.message}`);
    for (const f of data as { id: string; informe_id: string; fila_origen: number }[]) {
      const original = [...idInforme.entries()].find(([, v]) => v === f.informe_id)![0];
      idAcreditacion.set(`${original}|${f.fila_origen}`, f.id);
    }
  }
  console.log(`  ${idInforme.size} informes · ${idAcreditacion.size} acreditaciones`);

  paso("7 · Planillas y transferencias");
  for (const p of datos.planillas) {
    const { data, error } = await sb.from("planillas")
      .insert({
        ...base, cliente_id: idCliente.get(p.clienteId)!, archivo: p.archivo,
        fecha: p.fecha, estado: "RECIBIDA",
      })
      .select("id").single();
    if (error) throw new Error(`planilla ${p.archivo}: ${error.message}`);
    idPlanilla.set(p.id, (data as { id: string }).id);
  }
  for (const lote of enLotes(datos.operaciones, 500)) {
    const { error } = await sb.from("transferencias").insert(lote.map((o) => ({
      ...base,
      planilla_id: idPlanilla.get(o.planillaId)!,
      cliente_id: idCliente.get(o.clienteId)!,
      fila: o.fila,
      fecha_deposito: o.fechaDeposito || null,
      banco: o.banco,
      nombre_depositante: o.nombreDepositante,
      identificacion_original: o.identificacionOriginal,
      identificacion_normalizada: o.identificacionNormalizada,
      tipo_identificacion: o.tipoIdentificacion,
      importe_centavos: CENTAVOS(o.importe),
      numero_deposito: o.numeroDeposito,
      // Nacen abiertas: el estado lo decide la conciliación, no la siembra.
      estado: "PENDIENTE_NO_ENCONTRADA_EN_RANGO",
      motivo: "Recién importada, sin conciliar",
    })));
    if (error) throw new Error(`transferencias: ${error.message}`);
  }
  console.log(`  ${idPlanilla.size} planillas · ${datos.operaciones.length} transferencias`);

  /* ── Conciliación ── */
  paso("8 · Conciliando contra Postgres");
  const { repositoriosSupabase } = await import("../src/lib/data/supabase");
  const { correrConciliacion } = await import("../src/lib/servicios/conciliacion");
  const { corrida } = await correrConciliacion(repositoriosSupabase(sb), "IMPORTACION_INFORME");
  console.log(`  evaluadas ${corrida.operacionesEvaluadas} · acreditadas ${corrida.nuevasAcreditadas} ` +
    `· pendientes ${corrida.pendientesAlCierre} · ${corrida.duracionMs} ms`);

  /* ── Verificación ── */
  paso("9 · Lo que quedó en la base");
  const repos = repositoriosSupabase(sb);
  const ops = await repos.transferencias.listar();
  const cuenta: Record<string, number> = {};
  for (const o of ops) cuenta[bucketDe(o.estado)] = (cuenta[bucketDe(o.estado)] ?? 0) + 1;
  for (const [k, v] of Object.entries(cuenta).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(12)} ${v}`);
  }
  const auto = cuenta.CONCILIADA ?? 0;
  console.log(`\n  tasa automática: ${((auto / ops.length) * 100).toFixed(1)} %`);
  console.log(`\n  Entrar con: ${USUARIO.email}\n`);
}

function* enLotes<T>(xs: readonly T[], n: number) {
  for (let i = 0; i < xs.length; i += n) yield xs.slice(i, i + n);
}

main().catch((e) => {
  console.error("\n\x1b[31mFalló la siembra\x1b[0m\n ", e instanceof Error ? e.message : e, "\n");
  process.exit(1);
});
