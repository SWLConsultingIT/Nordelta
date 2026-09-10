import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente de Supabase para componentes de cliente.
 *
 * Las variables se escriben **literales** y no a través de un helper, y no
 * es descuido: el bundler de Next reemplaza textualmente las apariciones
 * de `process.env.NEXT_PUBLIC_ALGO`. Si el valor se leyera con acceso
 * dinámico —`entorno[nombre]`, o `process.env` pasado como objeto— no hay
 * nada que reemplazar y en el navegador llega `undefined`. Falla en
 * ejecución, en producción, y el código se ve perfectamente bien.
 *
 * Se aceptan los dos nombres porque Supabase renombró `anon` a
 * *publishable* y conviven las dos convenciones.
 *
 * Ninguna de estas dos claves es secreta: el navegador las manda en cada
 * request y toda la seguridad la aplica la seguridad por fila de Postgres.
 */
export function createClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const clave =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "";
  return createBrowserClient(url, clave);
}
