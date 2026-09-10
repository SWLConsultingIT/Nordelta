/**
 * Configuración de Supabase.
 *
 * Un solo lugar resuelve los nombres de variable, porque Supabase renombró
 * sus claves —`anon` pasó a llamarse *publishable*, `service_role` pasó a
 * *secret*— y en el medio conviven las dos convenciones. Aceptar ambas acá
 * evita que cada archivo tenga su propio `??`.
 *
 * La regla que importa, y la única que no se negocia:
 *
 *     LA CLAVE SECRETA NUNCA SE LEE FUERA DEL SERVIDOR.
 *
 * No alcanza con no usarla en el navegador: si un componente cliente
 * importa un módulo que la menciona, el bundler la inlinea. Por eso vive
 * en su propio archivo marcado `server-only` y hay un test que revisa el
 * bundle generado.
 */

/** URL del proyecto. Es pública: aparece en cada request del navegador. */
export function urlSupabase(entorno: NodeJS.ProcessEnv = process.env): string | null {
  return entorno.NEXT_PUBLIC_SUPABASE_URL || entorno.SUPABASE_URL || null;
}

/**
 * Clave publicable. Es pública por diseño: el navegador la manda en cada
 * request y toda la seguridad la aplica la seguridad por fila de Postgres.
 */
export function clavePublicable(entorno: NodeJS.ProcessEnv = process.env): string | null {
  return (
    entorno.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    entorno.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    null
  );
}

/** ¿Está lo mínimo para hablar con Supabase desde el navegador? */
export function haySupabase(entorno: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(urlSupabase(entorno) && clavePublicable(entorno));
}

/**
 * Qué falta, en una frase para quien despliega.
 *
 * Nunca devuelve un valor: solo nombres de variable. Un mensaje de error
 * que imprime la clave que falta es la forma más tonta de filtrarla.
 */
export function faltantes(entorno: NodeJS.ProcessEnv = process.env): string[] {
  const falta: string[] = [];
  if (!urlSupabase(entorno)) falta.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!clavePublicable(entorno)) falta.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  return falta;
}
