import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { clavePublicable, urlSupabase } from "./config";

/** Cliente de Supabase para Server Components y Server Actions. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    urlSupabase()!,
    clavePublicable()!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Los Server Components no pueden escribir cookies; el
            // middleware se encarga de refrescar la sesión.
          }
        },
      },
    },
  );
}
