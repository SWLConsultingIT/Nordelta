import type { Metadata } from "next";
import Link from "next/link";
import { Flujo } from "@/components/marketing/Composicion";

export const metadata: Metadata = {
  // Absoluto: sin esto la plantilla del layout raíz lo duplicaría.
  title: { absolute: "Pagos Nordelta" },
  description:
    "Plataforma operativa de Nordelta. Acceso restringido al personal autorizado.",
  robots: { index: false, follow: false },
};

/**
 * Portada.
 *
 * Tres bloques y un pie. Es la puerta de una herramienta privada: dice qué
 * es, transmite que la empresa detrás es seria, y deja entrar.
 *
 * **Una sola familia de color.** Toda la página es azul y lo que la ordena
 * son los tonos: el hero en el más profundo, la declaración un paso más
 * claro, el cierre otro. No hay un segundo color haciendo de acento —el
 * acento es el blanco—, y esa restricción es la que le da el registro
 * institucional.
 *
 * **No muestra el producto.** Una portada que enseña la aplicación publica
 * cómo trabaja la empresa y además la disfraza de producto de software, que
 * no es lo que Nordelta es.
 *
 * La composición no está apilada sino desfasada: el titular ocupa las
 * primeras siete columnas y el texto con el acceso vive en las últimas
 * cuatro, alineado al pie del titular y no debajo. Ese desfasaje es casi
 * todo lo que separa una página compuesta de una página alineada.
 *
 * No importa nada de la aplicación —ni siquiera los componentes de interfaz
 * compartidos, que a su vez importan el dominio—. El aislamiento es
 * estructural y hay un test que lo sostiene.
 */
export default function PortadaPage() {
  return (
    <div className="flex min-h-screen flex-col bg-navy text-on-navy antialiased">
      <Navegacion />
      <main className="flex-1">
        <Hero />
        <Declaracion />
      </main>
      <Cierre />
      <Pie />
    </div>
  );
}

/* ── Medidas comunes ───────────────────────────────────────────
   Un solo ancho y un solo padding para toda la página: la
   alineación entre bloques no se revisa a ojo, es la misma
   constante.                                                    */

const MARCO = "mx-auto w-full max-w-[1280px] px-6 sm:px-10 lg:px-14";
const REJILLA = "grid grid-cols-4 gap-x-6 md:grid-cols-8 lg:grid-cols-12 lg:gap-x-8";

/** Las reglas finas. Blanco muy bajo: sobre azul, un gris se ensucia. */
const REGLA = "block h-px w-full bg-white/12";

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

/** Rótulo pequeño. El único lugar donde se usan versalitas. */
function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-on-navy-2">
      {children}
    </span>
  );
}

function Flecha({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 10" fill="none" className={cx("h-[9px] w-[15px]", className)} aria-hidden>
      <path
        d="M0 5h14M10 1l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Acceso. Un enlace con flecha, no un botón con caja. */
function Acceso({ grande }: { grande?: boolean }) {
  return (
    <Link
      href="/login"
      className={cx(
        "group inline-flex items-center gap-2.5 font-medium text-on-navy",
        "transition-colors duration-200 hover:text-white",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4",
        "focus-visible:outline-on-navy",
        grande ? "text-[16px]" : "text-[14px]",
      )}
    >
      Ingresar
      <Flecha className="transition-transform duration-200 group-hover:translate-x-[3px]" />
    </Link>
  );
}

/* ── 1 · Navegación ───────────────────────────────────────── */

function Navegacion() {
  return (
    <header className="border-b border-white/10">
      <div className={cx(MARCO, "flex h-[76px] items-center justify-between")}>
        <span className="text-[15.5px] font-semibold tracking-[-0.022em] text-on-navy">
          Pagos Nordelta
        </span>
        <Acceso />
      </div>
    </header>
  );
}

/* ── 2 · Hero ─────────────────────────────────────────────── */

function Hero() {
  return (
    // El hero ocupa el primer viewport. Con `min-h` y el bloque en el tercio
    // superior no hay que adivinar cuánto padding hace falta para que llene
    // la pantalla, que es distinto en cada monitor.
    <section
      className={cx(
        "relative flex overflow-hidden",
        "lg:min-h-[calc(100svh_-_77px)] lg:items-start",
      )}
    >
      {/* El haz de líneas barre el tercio inferior y se va por la derecha.
          Empieza por debajo del bloque de texto a propósito: cruzarlo
          costaba legibilidad y se leía como un accidente. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 top-[60%] lg:left-[22%]"
      >
        <Flujo />
      </div>

      <div className={cx(MARCO, "relative w-full pt-[96px] pb-[136px] lg:pt-[15vh] lg:pb-0")}>
        <div className={REJILLA}>
          <div className="col-span-4 md:col-span-8 lg:col-span-7">
            <Rotulo>Plataforma operativa</Rotulo>
            <span aria-hidden className={cx("mt-5", REGLA)} />

            {/* Dos líneas fijas: un titular que se reacomoda solo se lee
                distinto en cada pantalla. */}
            <h1
              className={cx(
                "mt-9 text-[46px] font-semibold leading-[1.02] tracking-[-0.035em] text-white",
                "sm:text-[58px] lg:text-[64px] xl:text-[68px]",
              )}
            >
              Claridad
              <br />
              en cada operación.
            </h1>
          </div>

          {/* Alineado al pie del titular, no debajo. */}
          <div className="col-span-4 mt-12 md:col-span-6 lg:col-span-4 lg:col-start-9 lg:mt-0 lg:self-end">
            <p className="text-[16px] leading-[1.6] text-on-navy-2">
              Pagos Nordelta centraliza conciliaciones, movimientos y seguimiento operativo
              en una única plataforma.
            </p>
            <span aria-hidden className={cx("mt-7", REGLA)} />
            <div className="mt-7">
              <Acceso grande />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── 3 · Declaración ──────────────────────────────────────── */

const CONCEPTOS = ["Centralización", "Automatización", "Trazabilidad"];

function Declaracion() {
  return (
    <section className="border-t border-white/10 bg-navy-2">
      <div className={cx(MARCO, "py-[96px] lg:py-[116px]")}>
        <div className={REJILLA}>
          <div className="col-span-4 md:col-span-2 lg:col-span-2">
            <Rotulo>Operación</Rotulo>
          </div>

          <h2
            className={cx(
              "col-span-4 mt-8 text-[30px] font-semibold leading-[1.14] tracking-[-0.028em] text-white",
              "md:col-span-6 md:mt-0 lg:col-span-6 lg:col-start-3 lg:text-[38px]",
            )}
          >
            Menos tareas repetitivas.
            <br />
            Más tiempo para decidir.
          </h2>

          <p
            className={cx(
              "col-span-4 mt-8 text-[15px] leading-[1.65] text-on-navy-2",
              "md:col-span-6 md:col-start-3 lg:col-span-3 lg:col-start-10 lg:mt-0 lg:self-end",
            )}
          >
            La plataforma reúne la información, automatiza los controles y mantiene el
            historial de cada operación en un mismo entorno.
          </p>
        </div>

        {/* Los tres conceptos como rótulos sueltos sobre una regla. No son
            tarjetas ni columnas: son el índice de lo que dice la frase. Van
            sobre la misma grilla de doce que el bloque de arriba, así la
            regla tiene tres puntos de apoyo en vez de un racimo. */}
        <div className="mt-[64px] border-t border-white/14 pt-6 lg:mt-[80px]">
          <ul className={cx(REJILLA, "gap-y-3")}>
            {CONCEPTOS.map((c) => (
              <li
                key={c}
                className="col-span-4 text-[14.5px] font-medium tracking-[-0.008em] text-on-navy md:col-span-8 lg:col-span-4"
              >
                {c}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ── 4 · Cierre ───────────────────────────────────────────── */

function Cierre() {
  return (
    <section className="border-t border-white/10 bg-navy-3">
      <div className={cx(MARCO, "py-[76px] lg:py-[84px]")}>
        <div className={cx(REJILLA, "items-end")}>
          <span
            className={cx(
              "col-span-4 text-[30px] font-semibold leading-[1.1] tracking-[-0.028em] text-white",
              "md:col-span-4 lg:col-span-5 lg:text-[36px]",
            )}
          >
            Pagos Nordelta
          </span>

          <div className="col-span-4 mt-10 md:col-span-4 lg:col-span-4 lg:col-start-9 lg:mt-0">
            <p className="text-[15px] leading-[1.6] text-on-navy-2">
              Una forma más clara de gestionar la operación.
            </p>
            <span aria-hidden className={cx("mt-6", REGLA)} />
            <div className="mt-6">
              <Acceso grande />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Pie ──────────────────────────────────────────────────── */

function Pie() {
  return (
    <footer className="border-t border-white/10 bg-navy">
      <div
        className={cx(
          MARCO,
          "flex flex-col gap-2 py-7 sm:h-[76px] sm:flex-row sm:items-center sm:justify-between sm:gap-0 sm:py-0",
        )}
      >
        <span className="text-[13px] font-medium text-on-navy-2">Pagos Nordelta</span>
        <span className="text-[13px] text-on-navy-2">Acceso restringido al personal autorizado</span>
      </div>
    </footer>
  );
}
