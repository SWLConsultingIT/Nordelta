import type { Metadata } from "next";
import Link from "next/link";
import { AplicacionPreview, PanelTrazabilidad } from "@/components/marketing/Producto";

export const metadata: Metadata = {
  // Absoluto: sin esto la plantilla del layout raíz lo duplicaría.
  title: { absolute: "Pagos Nordelta" },
  description:
    "Plataforma operativa de Nordelta: planillas, conciliación, clientes y trazabilidad en un solo lugar. Acceso restringido al personal autorizado.",
  robots: { index: false, follow: false },
};

/**
 * Portada.
 *
 * Es la entrada a una herramienta privada, no una página de venta. Tiene que
 * hacer tres cosas: decir qué resuelve Pagos Nordelta, mostrar que el
 * producto existe y es serio, y dejar entrar. Cuatro bloques y ninguno más.
 *
 * **No explica cómo funciona por dentro**: ni cifras de la operación, ni
 * clientes, ni sistemas con los que se integra, ni reglas de negocio. Esa
 * información es de la empresa; además, una portada que describe el proceso
 * queda vieja con cada cambio del proceso.
 *
 * No importa nada de la aplicación —ni siquiera los componentes de interfaz
 * compartidos, que a su vez importan el dominio—. El aislamiento es
 * estructural y hay un test que lo sostiene.
 */
export default function PortadaPage() {
  return (
    <div className="flex min-h-screen flex-col bg-surface text-ink antialiased">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <Capacidades />
        <Trazabilidad />
        <Cierre />
      </main>
      <Pie />
    </div>
  );
}

/* ── Medidas comunes ───────────────────────────────────────────
   Un solo ancho y un solo padding para toda la página: la
   alineación entre secciones no se revisa a ojo, es la misma
   constante.                                                    */

const MARCO = "mx-auto w-full max-w-[1200px] px-6 sm:px-8 lg:px-10";

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

function Marca({ claro }: { claro?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span
        aria-hidden
        className={cx(
          "grid h-[27px] w-[27px] flex-none place-items-center rounded-[7px] text-[12px] font-bold",
          claro ? "bg-surface text-navy" : "bg-navy text-surface",
        )}
      >
        P
      </span>
      <span
        className={cx(
          "whitespace-nowrap text-[15px] font-semibold tracking-[-0.021em]",
          claro ? "text-on-navy" : "text-ink",
        )}
      >
        Pagos Nordelta
      </span>
    </span>
  );
}

function Boton({
  children,
  href,
  variante = "solido",
  tamano = "md",
}: {
  children: React.ReactNode;
  href: string;
  variante?: "solido" | "linea";
  tamano?: "sm" | "md";
}) {
  return (
    <Link
      href={href}
      className={cx(
        "inline-flex items-center justify-center rounded-[8px] font-medium whitespace-nowrap",
        "transition-colors duration-150 focus-visible:outline focus-visible:outline-2",
        "focus-visible:outline-offset-2 focus-visible:outline-brand",
        tamano === "sm" ? "h-[34px] px-3.5 text-[13px]" : "h-[44px] px-6 text-[14.5px]",
        variante === "solido"
          ? "bg-navy text-white hover:bg-navy-2 shadow-[0_1px_2px_rgba(11,25,48,.16)]"
          : "border border-line-hard text-ink-2 hover:border-ink-4 hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}

/* ── 1 · Navbar ───────────────────────────────────────────── */

const ANCLAS = [
  { texto: "Producto", href: "#producto" },
  { texto: "Trazabilidad", href: "#trazabilidad" },
];

function Navbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur-sm">
      <div className={cx(MARCO, "flex h-[62px] items-center gap-8")}>
        <Marca />
        <nav className="hidden items-center gap-7 md:flex">
          {ANCLAS.map((a) => (
            <a
              key={a.href}
              href={a.href}
              className="text-[13.5px] text-ink-2 transition-colors duration-150 hover:text-ink"
            >
              {a.texto}
            </a>
          ))}
        </nav>
        <span className="ml-auto">
          <Boton href="/login" tamano="sm">Ingresar</Boton>
        </span>
      </div>
    </header>
  );
}

/* ── 2 · Hero ─────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-line bg-ground">
      {/* Un lavado azul detrás del producto, muy contenido. Da profundidad
          sin gradientes de colores ni formas decorativas. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-[62%] bg-gradient-to-l from-brand-wash to-transparent lg:block"
      />

      <div className={cx(MARCO, "relative pt-[72px] pb-[84px] lg:pt-[84px] lg:pb-[96px]")}>
        {/* Dos columnas recién a partir de xl. Entre 1024 y 1280 el ancho
              no alcanza para las dos: la columna de texto se comprimía a
              330 px, el titular se partía en cuatro líneas y los botones
              se apilaban. Apilado a propósito se lee mucho mejor que
              apretado por accidente. */}
          <div className="grid grid-cols-1 items-center gap-y-14 xl:grid-cols-[minmax(0,492px)_1fr] xl:gap-x-12">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-brand-wash px-3 py-1 text-[12px] font-medium text-brand-lo">
              <span aria-hidden className="h-[5px] w-[5px] rounded-full bg-brand" />
              Plataforma operativa interna
            </span>

            <h1 className="mt-5 text-[40px] font-semibold leading-[1.05] tracking-[-0.032em] text-ink sm:text-[42px] lg:text-[44px] xl:text-[46px]">
              Menos trabajo manual.
              <br />
              <span className="text-brand-lo">Más control</span> de la operación.
            </h1>

            <p className="mt-6 max-w-[470px] text-[16px] leading-[1.6] text-ink-2">
              Pagos Nordelta reúne la carga de planillas, la conciliación, el estado de
              cada cliente y las cuentas corrientes en una sola plataforma, con el
              historial completo de cada operación.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Boton href="/login">Ingresar a la plataforma</Boton>
              <Boton href="#producto" variante="linea">Ver qué resuelve</Boton>
            </div>

            <p className="mt-7 text-[12.5px] text-ink-3">
              Uso interno · el acceso se otorga por organización
            </p>
          </div>

          {/* El producto sale por el borde derecho en pantallas grandes.
              La cuenta lleva el margen negativo justo hasta el borde de la
              ventana: el contenedor mide 1200 con 40 de aire, así que
              sobra `(100vw - 1200) / 2 + 40`. Se lee como una aplicación
              que sigue más allá del recorte y no como una lámina apoyada
              en el medio. La sección recorta, así que no hay scroll. */}
          <div className="min-w-0 xl:mr-[calc(560px_-_50vw)]">
            <AplicacionPreview />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── 3 · Capacidades ──────────────────────────────────────── */

const CAPACIDADES: { titulo: string; texto: string; icono: React.ReactElement }[] = [
  {
    titulo: "Centralización",
    texto:
      "Las planillas de todos los clientes entran por el mismo lugar, se normalizan y quedan asociadas a quien las envió.",
    icono: (
      <path d="M3 5.5h14M3 11h14M3 16.5h9" strokeLinecap="round" />
    ),
  },
  {
    titulo: "Automatización",
    texto:
      "El sistema cruza lo enviado contra lo acreditado y resuelve solo lo que puede resolver sin ayuda. Queda para revisar lo que de verdad necesita una decisión.",
    icono: (
      <path
        d="M10 3.5v3m0 7v3m6.5-6.5h-3m-7 0h-3m11-4.6-2.1 2.1m-5.8 5.8L5.5 15.4m9-.1-2.1-2.1M7.6 7.6 5.5 5.5"
        strokeLinecap="round"
      />
    ),
  },
  {
    titulo: "Trazabilidad",
    texto:
      "Cada operación guarda su historial: qué pasó, cuándo, y quién decidió. Nada cambia de estado sin dejar registro.",
    icono: (
      <path
        d="M10 5.5v5l3 1.8M10 17a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
];

function Capacidades() {
  return (
    <section id="producto" className="scroll-mt-[62px] border-b border-line bg-surface">
      <div className={cx(MARCO, "py-[76px] lg:py-[88px]")}>
        <div className="max-w-[620px]">
          <h2 className="text-[30px] font-semibold leading-[1.15] tracking-[-0.026em] text-ink lg:text-[34px]">
            Una sola plataforma para ordenar la operación.
          </h2>
          <p className="mt-4 text-[15.5px] leading-[1.6] text-ink-2">
            El trabajo que hoy se reparte entre planillas sueltas, correos y verificaciones
            a mano, hecho en un solo lugar y con registro de todo.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
          {CAPACIDADES.map((c) => (
            <div key={c.titulo} className="border-t border-line-hard pt-5">
              <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-brand-line bg-brand-wash text-brand-lo">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" className="h-[17px] w-[17px]" aria-hidden>
                  {c.icono}
                </svg>
              </span>
              <h3 className="mt-3.5 text-[15.5px] font-semibold tracking-[-0.014em] text-ink">
                {c.titulo}
              </h3>
              <p className="mt-2 text-[14px] leading-[1.6] text-ink-2">{c.texto}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── 4 · Trazabilidad ─────────────────────────────────────── */

const GARANTIAS = [
  "Cada cambio de estado queda registrado con su momento y su responsable.",
  "El archivo original que envió el cliente se conserva tal como llegó.",
  "Una decisión tomada por una persona no la pisa ningún proceso automático.",
];

function Trazabilidad() {
  return (
    <section id="trazabilidad" className="scroll-mt-[62px] border-b border-line bg-ground">
      <div className={cx(MARCO, "py-[76px] lg:py-[88px]")}>
        <div className="grid grid-cols-1 items-center gap-x-14 gap-y-12 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <h2 className="max-w-[440px] text-[28px] font-semibold leading-[1.16] tracking-[-0.024em] text-ink lg:text-[32px]">
              Si algo se discute, está escrito.
            </h2>
            <p className="mt-4 max-w-[460px] text-[15.5px] leading-[1.6] text-ink-2">
              La conciliación no termina en un número: termina en un historial que se puede
              revisar operación por operación.
            </p>

            <ul className="mt-8 space-y-4">
              {GARANTIAS.map((g) => (
                <li key={g} className="flex gap-3">
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    className="mt-[3px] h-[15px] w-[15px] flex-none text-pos"
                    aria-hidden
                  >
                    <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.2" opacity=".35" />
                    <path d="m5 8.2 2 2L11 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-[14.5px] leading-[1.55] text-ink-2">{g}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-6 lg:col-start-7">
            <div className="flex justify-center lg:justify-end">
              <PanelTrazabilidad />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── 5 · Cierre ───────────────────────────────────────────── */

function Cierre() {
  return (
    <section className="bg-navy">
      <div className={cx(MARCO, "py-[72px] lg:py-[84px]")}>
        <div className="flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-[28px] font-semibold leading-[1.16] tracking-[-0.024em] text-on-navy lg:text-[32px]">
              Entrá a Pagos Nordelta.
            </h2>
            <p className="mt-3 max-w-[440px] text-[15px] leading-[1.6] text-on-navy-2">
              El acceso es nominal y está limitado al personal autorizado de cada
              organización.
            </p>
          </div>
          <Link
            href="/login"
            className={cx(
              "inline-flex h-[46px] flex-none items-center rounded-[8px] bg-surface px-7",
              "text-[14.5px] font-semibold text-navy transition-colors duration-150",
              "hover:bg-on-navy focus-visible:outline focus-visible:outline-2",
              "focus-visible:outline-offset-2 focus-visible:outline-on-navy",
            )}
          >
            Ingresar
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ── 6 · Pie ──────────────────────────────────────────────── */

function Pie() {
  return (
    <footer className="border-t border-line bg-surface">
      <div
        className={cx(
          MARCO,
          "flex flex-col gap-3 py-7 sm:h-[72px] sm:flex-row sm:items-center sm:justify-between sm:gap-0 sm:py-0",
        )}
      >
        <Marca />
        <p className="text-[12.5px] text-ink-3">
          Uso interno · acceso restringido al personal autorizado
        </p>
      </div>
    </footer>
  );
}
