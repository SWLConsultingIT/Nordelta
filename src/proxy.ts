import { NextResponse, type NextRequest } from "next/server";
import { clavePublicable, haySupabase, urlSupabase } from "./lib/supabase/config";

/**
 * Refresco de sesión y control de acceso.
 *
 * En Next.js 16 la convención `middleware` quedó deprecada y se renombró a
 * `proxy` (ver node_modules/next/dist/docs · file-conventions/proxy).
 *
 * Corre sobre dos mundos con reglas opuestas:
 *
 *   · **Público** (`/`, `/login`, estáticos) — sale antes de mirar nada.
 *     Ni Supabase, ni base, ni perfil, ni organización, ni Fullcarga. Una
 *     variable de backend mal cargada no puede voltear la portada.
 *   · **Protegido** (`RUTAS_PROTEGIDAS`) — exige sesión, y si la
 *     configuración está rota manda al ingreso en lugar de fallar.
 *
 * Sin Supabase configurado no se bloquea nada: la aplicación corre en modo
 * demostración y trabar el acceso dejaría afuera a todo el mundo.
 *
 * Esto es una conveniencia de navegación, NO la frontera de seguridad. La
 * frontera son la seguridad por fila de Postgres y el `exigirSesion()` al
 * principio de cada Server Action.
 */
/**
 * Todo lo que vive detrás del ingreso.
 *
 * La lista tiene que crecer con cada ruta nueva de la aplicación, y por eso
 * hay un test que la compara contra las carpetas de `app/(app)`: agregar una
 * pantalla y olvidarse de protegerla es el error silencioso más fácil de
 * cometer acá.
 */
const RUTAS_PROTEGIDAS = [
  "/inicio",
  // Operación
  "/conciliacion",
  "/planillas",
  "/clientes",
  "/fullcarga",
  // Finanzas
  "/carga",
  "/cuentas",
  "/balance",
  // Control
  "/ajustes",
  "/auditoria",
  // Endpoints que devuelven datos o archivos
  "/api",
];

export const RUTAS_PROTEGIDAS_TEST = RUTAS_PROTEGIDAS;

/**
 * ¿Esta ruta vive detrás del ingreso?
 *
 * Todo lo que no está en la lista es público, y público significa que **no
 * puede depender de nada de backend para responder**.
 */
function esProtegida(pathname: string): boolean {
  return RUTAS_PROTEGIDAS.some((r) => pathname === r || pathname.startsWith(r + "/"));
}

export async function proxy(request: NextRequest) {
  const protegida = esProtegida(request.nextUrl.pathname);

  // ── Ruta pública: se sale antes de tocar Supabase ──
  //
  // Esto es lo primero que pasa, y el orden es la corrección. Antes el
  // proxy construía el cliente y llamaba a `getUser()` en **toda** ruta,
  // incluida la portada estática y el propio ingreso. Consecuencia
  // medida: con `NEXT_PUBLIC_SUPABASE_URL` sin esquema —un pegado
  // incompleto en el panel de Vercel— el constructor tiraba
  // «Invalid supabaseUrl» y `/`, `/login` e `/inicio` devolvían 500 los
  // tres. Una variable del backend volteaba la página pública.
  //
  // Una portada prerenderizada no tiene sesión que refrescar ni acceso
  // que controlar. La sesión se refresca cuando el usuario entra a la
  // aplicación, que es donde importa.
  if (!protegida) return NextResponse.next();

  // Sin Supabase configurado no se bloquea nada: la aplicación corre en
  // modo demostración y trabar el acceso dejaría afuera a todo el mundo.
  //
  // Los nombres los resuelve `supabase/config`, que acepta la convención
  // nueva y la vieja. Comprobarlos acá por separado hacía que el proxy
  // creyera que Supabase no estaba configurado y **dejara pasar todo**.
  if (!haySupabase()) return NextResponse.next();

  const respuesta = NextResponse.next({ request });

  try {
    const { createServerClient } = await import("@supabase/ssr");
    const supabase = createServerClient(
      urlSupabase()!,
      clavePublicable()!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (cookies) => {
            cookies.forEach(({ name, value, options }) =>
              respuesta.cookies.set(name, value, options),
            );
          },
        },
      },
    );

    // getUser() valida el token contra el servidor de auth y refresca la
    // sesión si hace falta. getSession() solo lee la cookie y no alcanza.
    const { data } = await supabase.auth.getUser();

    if (!data.user) return alIngreso(request);
  } catch {
    // Configuración rota o auth caído. Acá se falla **cerrado**: no se
    // deja pasar a una pantalla con datos, se manda al ingreso. Nunca un
    // 500, que además de feo no dice nada.
    //
    // No se registra el error con su mensaje a propósito: el mensaje
    // puede traer la URL del proyecto y esto corre en cada request.
    return alIngreso(request);
  }

  return respuesta;
}

/** Al ingreso, recordando a dónde quería ir. */
function alIngreso(request: NextRequest) {
  const destino = request.nextUrl.clone();
  destino.pathname = "/login";
  destino.searchParams.set("volver", request.nextUrl.pathname);
  return NextResponse.redirect(destino);
}

export const config = {
  // Se excluyen estáticos e imágenes: sin esto el control de acceso puede
  // llegar a bloquear el CSS y el JavaScript de la propia aplicación.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
