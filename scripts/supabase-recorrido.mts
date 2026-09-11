/**
 * El recorrido completo contra staging, con una sesión real.
 *
 *     npm run supabase:recorrido
 *
 * Es la demostración escrita como código: entra, importa una planilla,
 * concilia, resuelve una excepción y comprueba que la decisión sobrevive
 * a volver a conciliar. Todo con la **clave publicable**, así que lo que
 * pasa acá es exactamente lo que puede hacer la aplicación.
 *
 * Al terminar deja el proyecto como estaba: la planilla de prueba se
 * borra con la clave de administración, que es la única que puede.
 */

import { createClient } from "@supabase/supabase-js";
import { clavePublicable, urlSupabase } from "../src/lib/supabase/config";
import { clienteAdmin } from "../src/lib/supabase/admin";
import { repositoriosSupabase } from "../src/lib/data/supabase";
import { correrConciliacion } from "../src/lib/servicios/conciliacion";
import { escribirXlsx } from "../src/lib/planillas/escritor-xlsx";
import { parsearPlanillaCliente } from "../src/lib/planillas/cliente";
import { validarArchivo, sha256 } from "../src/lib/data/almacenamiento";
import { digitoVerificador } from "../src/lib/fullcarga/cuit";
import { bucketDe } from "../src/lib/operaciones/buckets";
import { sumarDias } from "../src/lib/operaciones/fechas";
import { hoyISO } from "../src/lib/format";

const USUARIO = { email: "mati@nordelta.demo", password: "nordelta-staging-2026" };
const BUCKET = "originales";

const pasos: { nombre: string; ok: boolean; detalle?: string }[] = [];
const paso = (nombre: string, ok: boolean, detalle?: string) => {
  pasos.push({ nombre, ok, detalle });
  console.log(`  ${ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${nombre}${detalle ? `  \x1b[2m${detalle}\x1b[0m` : ""}`);
};

const cuit = (prefijo: string, doc: string) => {
  const diez = prefijo + doc.padStart(8, "0");
  return diez + String(digitoVerificador(diez));
};

async function main() {
  if (typeof process.loadEnvFile === "function") {
    try { process.loadEnvFile(".env.local"); } catch { /* sin archivo */ }
  }
  const url = urlSupabase();
  const clave = clavePublicable();
  if (!url || !clave) throw new Error("Faltan la URL y la clave publicable.");

  const sb = createClient(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = clienteAdmin();
  let planillaId: string | null = null;
  let rutaOriginal: string | null = null;

  try {
    /* ── 1 · Ingreso ── */
    console.log("\n\x1b[1m1 · Ingreso\x1b[0m");
    const { data: sesion, error: e1 } = await sb.auth.signInWithPassword(USUARIO);
    paso("entra con correo y contraseña", !e1, sesion?.user?.email);
    if (e1) throw new Error(e1.message);

    const { data: perfil } = await sb
      .from("perfiles").select("organizaciones ( id, nombre )")
      .eq("id", sesion.user.id).maybeSingle();
    const org = (perfil as unknown as { organizaciones: { id: string; nombre: string } | null })
      ?.organizaciones;
    paso("resuelve perfil y organización", Boolean(org), org?.nombre);
    if (!org) throw new Error("sin organización");

    const repos = repositoriosSupabase(sb);

    /* ── 2 · Estado inicial ── */
    console.log("\n\x1b[1m2 · Estado inicial\x1b[0m");
    const antes = await repos.transferencias.listar();
    const clientes = await repos.clientes.listar();
    paso("lee las operaciones de la base", antes.length > 0, `${antes.length} operaciones`);
    paso("lee los clientes de la base", clientes.length > 0, `${clientes.length} clientes`);

    /* ── 3 · Importar una planilla ── */
    console.log("\n\x1b[1m3 · Importar una planilla\x1b[0m");
    const hoy = hoyISO();
    const fecha = sumarDias(hoy, -1);
    const doc = String(30_000_000 + Math.floor(Math.random() * 9_000_000));
    const cuitBueno = cuit("20", doc);
    const cuitRoto = cuitBueno.slice(0, 10) + String((Number(cuitBueno[10]) + 1) % 10);

    const bytes = escribirXlsx([
      ["BANCO", "FECHA DEPOSITO", "IMPORTE", "NOMBRE", "DNI/CUIT DEPOSITANTE",
       "NRO DEPOSITO", "TIPO", "COMENTARIO"],
      ["BANCO GALICIA", fecha, 153500, "Depositante Uno", cuitBueno, "9000001", "TRANSFERENCIA", ""],
      ["BANCO MACRO", fecha, 245000, "Depositante Dos", cuitRoto, "9000002", "TRANSFERENCIA", ""],
    ]);
    paso("el archivo pasa la validación por contenido",
      validarArchivo("recorrido.xlsx", bytes).extension === ".xlsx");

    // Se guarda el original en el mismo lugar que lo haría la aplicación.
    const huella = sha256(bytes);
    rutaOriginal = `${org.id}/planillas/${huella}/recorrido.xlsx`;
    const { error: eSubida } = await sb.storage
      .from(BUCKET).upload(rutaOriginal, new Blob([new Uint8Array(bytes)]), { upsert: true });
    paso("guarda el original en su carpeta", !eSubida, rutaOriginal.slice(0, 48) + "…");

    const parseada = parsearPlanillaCliente(bytes, { sourceFile: "recorrido.xlsx" });
    const planilla = await repos.planillas.crear({
      clienteId: clientes[0].id, archivo: "recorrido.xlsx", fecha,
      sha256: huella, storagePath: rutaOriginal,
    });
    planillaId = planilla.id;
    const creadas = await repos.transferencias.crearLote(planilla.id,
      parseada.transferencias.map((t) => ({
        fila: t.sourceRow + 1, fechaDeposito: t.fechaDeposito ?? "", banco: t.banco,
        nombreDepositante: t.nombreDepositante,
        identificacionOriginal: t.identificacionOriginal,
        identificacionNormalizada: t.identificacionNormalizada,
        tipoIdentificacion: t.tipoIdentificacion,
        importe: t.importe ?? 0, numeroDeposito: t.numeroDeposito,
      })));
    paso("persiste la planilla y sus operaciones", creadas.length === 2, `${creadas.length} filas`);

    const guardada = await repos.planillas.obtener(planilla.id);
    paso("de la fila se puede llegar al archivo fuente",
      guardada?.storagePath === rutaOriginal && guardada?.sha256 === huella);

    /* ── 4 · El informe y la conciliación ── */
    console.log("\n\x1b[1m4 · Conciliación\x1b[0m");
    const informe = await repos.informes.registrar({
      archivo: "recorrido.xls", desde: fecha, hasta: hoy, origen: "MANUAL",
    });
    // Dos acreditaciones para el mismo CUIT, fecha e importe: el sistema
    // no elige ninguna y queda una excepción para resolver.
    await repos.acreditaciones.incorporar(informe.id, [
      { cuit: cuitBueno, fecha, importe: 153500, banco: "BANCO GALICIA",
        descripcion: "Transf Recibida A", row: 9001 },
      { cuit: cuitBueno, fecha, importe: 153500, banco: "BANCO GALICIA",
        descripcion: "Transf Recibida B", row: 9002 },
    ]);

    await correrConciliacion(repos, "IMPORTACION_INFORME");
    const trasPrimera = await repos.transferencias.listar({ planillaId: planilla.id });
    const ambigua = trasPrimera.find((o) => o.estado === "MATCH_AMBIGUO");
    const conError = trasPrimera.find((o) => bucketDe(o.estado) === "ERROR");
    paso("el CUIT mal escrito queda marcado, no corregido",
      Boolean(conError) && conError!.identificacionNormalizada === cuitRoto,
      conError?.estado);
    paso("dos candidatos idénticos no se eligen solos", Boolean(ambigua),
      `${ambigua?.candidatoIds.length ?? 0} candidatos`);

    /* ── 5 · Resolver la excepción ── */
    console.log("\n\x1b[1m5 · Resolución\x1b[0m");
    if (!ambigua) throw new Error("no apareció la excepción esperada");
    const elegida = ambigua.candidatoIds[0];
    await repos.conciliacion.registrarResolucion({
      operacionId: ambigua.id, decision: "CONFIRMAR_MATCH", origen: "HUMANA",
      estadoPrevio: ambigua.estado, acreditacionId: elegida,
      actor: sesion.user.id, momento: new Date().toISOString().slice(0, 19),
      motivo: "recorrido de verificación", mapeoId: null,
    });
    await correrConciliacion(repos, "MANUAL");
    const resuelta = await repos.transferencias.obtener(ambigua.id);
    paso("la decisión cierra la operación", resuelta?.estado === "ACREDITADA_MANUAL",
      resuelta?.estado);
    paso("queda contra el registro que eligió la persona",
      resuelta?.acreditacionId === elegida);
    paso("no cuenta como automática", resuelta?.automatico === false);

    /* ── 6 · Persiste al recargar ── */
    console.log("\n\x1b[1m6 · Persistencia\x1b[0m");
    await correrConciliacion(repos, "MANUAL");
    // Sesión nueva: es lo que pasa al recargar la página.
    const sb2 = createClient(url, clave, { auth: { persistSession: false } });
    await sb2.auth.signInWithPassword(USUARIO);
    const repos2 = repositoriosSupabase(sb2);
    const relectura = await repos2.transferencias.obtener(ambigua.id);
    paso("la decisión sobrevive a recargar", relectura?.estado === "ACREDITADA_MANUAL");
    paso("y a volver a conciliar", relectura?.acreditacionId === elegida);

    const historial = await repos2.conciliacion.eventos(ambigua.id);
    paso("queda el historial de lo que pasó", historial.length > 0,
      `${historial.length} eventos`);
    const resoluciones = (await repos2.conciliacion.resoluciones())
      .filter((r) => r.operacionId === ambigua.id);
    paso("con autor, motivo y estado previo",
      resoluciones[0]?.actor === sesion.user.id &&
      resoluciones[0]?.motivo === "recorrido de verificación" &&
      resoluciones[0]?.estadoPrevio === "MATCH_AMBIGUO");
    await sb2.auth.signOut();

    /* ── 7 · Nada se borra ── */
    console.log("\n\x1b[1m7 · Nada se borra\x1b[0m");
    await sb.from("transferencias").delete().eq("id", ambigua.id);
    const sigue = await repos.transferencias.obtener(ambigua.id);
    paso("una operación no se puede borrar", Boolean(sigue));

    await sb.auth.signOut();
  } finally {
    /* ── Limpieza ── */
    console.log("\n\x1b[1mLimpiando lo del recorrido\x1b[0m");
    if (planillaId) {
      await admin.from("transferencia_eventos").delete().in(
        "transferencia_id",
        ((await admin.from("transferencias").select("id").eq("planilla_id", planillaId)).data ?? [])
          .map((f) => (f as { id: string }).id),
      );
      await admin.from("resoluciones").delete().in(
        "transferencia_id",
        ((await admin.from("transferencias").select("id").eq("planilla_id", planillaId)).data ?? [])
          .map((f) => (f as { id: string }).id),
      );
      await admin.from("transferencias").delete().eq("planilla_id", planillaId);
      await admin.from("planillas").delete().eq("id", planillaId);
    }
    await admin.from("acreditaciones").delete().gte("fila_origen", 9000);
    await admin.from("informes_fullcarga").delete().eq("archivo", "recorrido.xls");
    if (rutaOriginal) await admin.storage.from(BUCKET).remove([rutaOriginal]);
    console.log("  listo");
  }

  const fallaron = pasos.filter((p) => !p.ok);
  console.log(
    fallaron.length === 0
      ? `\n  \x1b[32m${pasos.length}/${pasos.length} · el recorrido completo funciona contra Postgres\x1b[0m\n`
      : `\n  \x1b[31m${fallaron.length} de ${pasos.length} fallaron\x1b[0m\n`,
  );
  if (fallaron.length > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error("\n\x1b[31mFalló el recorrido\x1b[0m\n ", e instanceof Error ? e.message : e);
  const ctx = (e as { contexto?: Record<string, unknown> })?.contexto;
  if (ctx) console.error("  causa:", JSON.stringify(ctx));
  console.error();
  process.exit(1);
});
