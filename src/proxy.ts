import { NextResponse, type NextRequest } from "next/server";

/**
 * Refresco de sesión y control de acceso.
 *
 * En Next.js 16 la convención `middleware` quedó deprecada y se renombró a
 * `proxy` (ver node_modules/next/dist/docs · file-conventions/proxy).
 *
 * Sin Supabase configurado no se bloquea nada: la aplicación corre en modo
 * demostración y trabar el acceso dejaría afuera a todo el mundo. En cuanto
 * hay credenciales, toda ruta de `RUTAS_PROTEGIDAS` exige sesión.
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

export async function proxy(request: NextRequest) {
  const configurado = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  if (!configurado) return NextResponse.next();

  const protegida = RUTAS_PROTEGIDAS.some(
    (r) => request.nextUrl.pathname === r || request.nextUrl.pathname.startsWith(r + "/"),
  );

  const respuesta = NextResponse.next({ request });

  const { createServerClient } = await import("@supabase/ssr");
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

  if (protegida && !data.user) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/login";
    destino.searchParams.set("volver", request.nextUrl.pathname);
    return NextResponse.redirect(destino);
  }

  return respuesta;
}

export const config = {
  // Se excluyen estáticos e imágenes: sin esto el control de acceso puede
  // llegar a bloquear el CSS y el JavaScript de la propia aplicación.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
