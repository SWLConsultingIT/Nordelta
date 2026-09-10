import "server-only";
import { createClient } from "@supabase/supabase-js";
import { urlSupabase } from "./config";

/**
 * Cliente con la clave secreta.
 *
 * **Salta la seguridad por fila.** Por eso vive aislado en su propio
 * archivo, marcado `server-only`, y por eso existe esta advertencia:
 *
 *   · no se usa nunca para servir una pantalla;
 *   · no se usa nunca para demostrar que el aislamiento funciona —probar
 *     RLS con un cliente que la evita no prueba nada—;
 *   · se usa solo para tareas de administración que corren fuera de la
 *     aplicación: sembrar datos, migrar, crear usuarios de prueba.
 *
 * `server-only` hace fallar la compilación si un componente cliente lo
 * importa, aunque sea por accidente a través de una cadena de imports.
 */
export function clienteAdmin() {
  const url = urlSupabase();
  const secreta = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secreta) {
    throw new Error(
      "Faltan SUPABASE_URL y SUPABASE_SECRET_KEY. El cliente de administración " +
        "solo existe para tareas fuera de la aplicación.",
    );
  }
  return createClient(url, secreta, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
