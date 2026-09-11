import type { Metadata } from "next";
import Link from "next/link";
import { cx } from "@/components/ui";
import { DetalleOscuro, VentanaNord } from "@/components/marketing/VentanaNord";

export const metadata: Metadata = {
  title: "NORD · Plataforma operativa",
  description:
    "Plataforma operativa de Nordelta. Acceso restringido al personal autorizado.",
  robots: { index: false, follow: false },
};

/**
 * Portada.
 *
 * Es la entrada a una herramienta privada. Tiene cuatro cosas que
 * transmitir —que NORD es serio, que centraliza la operación, que
 * ordena trabajo, y que el acceso es privado— y ninguna más.
 *
 * **No explica cómo funciona por dentro.** Ni cifras de operación, ni
 * clientes, ni sistemas con los que se integra, ni reglas de negocio. Esa
 * información es de la empresa, y además una portada que explica el
 * proceso envejece con cada cambio del proceso.
 *
 * La composición es editorial a propósito: el titular ocupa su propia
 * franja sobre una grilla de doce, y el producto entra debajo recortado
 * por el borde de la pantalla. La alternativa —texto a la izquierda,
 * tarjeta a la derecha— es la que usa todo el mundo y no dice nada sobre
 * quién la hizo.
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-surface antialiased">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <Enunciado />
        <Capacidades />
        <Institucional />
        <CierreCta />
      </main>
      <Pie />
    </div>
  );
}

/* ── Piezas compartidas ─────────────────────────────────────── */

const MARCO = "mx-auto w-full max-w-[1280px] px-6 sm:px-10 lg:px-14";

/** Rejilla de doce columnas. Todo se alinea contra ella. */
const REJILLA = "grid grid-cols-4 md:grid-cols-8 lg:grid-cols-12 gap-x-6 lg:gap-x-8";

function Marca({ claro }: { claro?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span
        aria-hidden
        className={cx(
          "w-[26px] h-[26px] rounded-[7px] grid place-items-center font-mono text-[12px]",
          "font-semibold flex-none tracking-[-0.02em]",
          claro ? "bg-on-navy text-navy" : "bg-ink text-surface",
        )}
      >
        N
      </span>
      <span className="flex items-baseline gap-[7px]">
        <span
          className={cx(
            "text-[14px] font-semibold tracking-[-0.02em]",
            claro ? "text-on-navy" : "text-ink",
          )}
        >
          NORD
        </span>
        <span className={cx("text-[11.5px]", claro ? "text-on-navy-3" : "text-ink-4")}>
          by Nordelta
        </span>
      </span>
    </span>
  );
}

/**
 * Botón de la portada.
 *
 * Navy casi negro en lugar del azul de la aplicación: acá el azul es
 * acento, no acción, y un botón azul saturado es lo que hace que una
 * portada se parezca a todas las demás.
 */
function Boton({
  children,
  href,
  variante = "solida",
}: {
  children: React.ReactNode;
  href: string;
  variante?: "solida" | "linea";
}) {
  return (
    <Link
      href={href}
      className={cx(
        "group inline-flex items-center gap-2 h-[42px] px-5 rounded-[10px]",
        "text-[13.5px] font-medium whitespace-nowrap",
        "transition-[background-color,border-color,color] duration-150",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        "focus-visible:outline-brand",
        variante === "solida"
          ? "bg-ink text-surface hover:bg-navy-2"
          : "border border-line-hard text-ink-2 hover:border-ink-4 hover:text-ink",
      )}
    >
      {children}
      <Flecha />
    </Link>
  );
}

/** Flecha fina que avanza apenas al pasar por encima. */
function Flecha() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="w-[14px] h-[14px] transition-transform duration-150 group-hover:translate-x-[2px]"
    >
      <path d="M2.5 8h11M9.5 4l4 4-4 4" />
    </svg>
  );
}

/* ── Barra ──────────────────────────────────────────────────── */

function Navbar() {
  return (
    <header className="sticky top-0 z-30 bg-surface/85 backdrop-blur-[6px] border-b border-line-soft">
      <div className={cx(MARCO, "h-[64px] flex items-center")}>
        <Link href="/" className="rounded-lg -m-1 p-1"><Marca /></Link>
        <Link
          href="/login"
          className="ml-auto group inline-flex items-center gap-1.5 text-[13px] font-medium
                     text-ink-2 hover:text-ink transition-colors duration-150"
        >
          Ingresar
          <Flecha />
        </Link>
      </div>
    </header>
  );
}

/* ── Hero ───────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-ground">
      {/* Retícula vertical apenas perceptible, alineada a la rejilla. No
          decora: da una referencia de estructura. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70
                   [background-image:linear-gradient(to_right,var(--color-line-soft)_1px,transparent_1px)]
                   [background-size:100px_100%]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40
                   bg-[linear-gradient(to_bottom,var(--color-surface),transparent)]"
      />

      <div className={cx(MARCO, "relative pt-20 lg:pt-28")}>
        <div className={REJILLA}>
          <div className="col-span-4 md:col-span-8 lg:col-span-7">
            <p className="m-0 text-[12px] text-ink-4 tracking-[0.01em]">
              Plataforma operativa
            </p>

            <h1
              className="mt-6 mb-0 text-[36px] sm:text-[44px] lg:text-[48px] xl:text-[58px]
                         leading-[1.05] font-semibold tracking-[-0.038em] text-ink"
            >
              NORD organiza el trabajo
              <br />
              <span className="text-ink-3">que no debería ser manual.</span>
            </h1>
          </div>

          {/* Columna de contexto, al modo de una ficha editorial. */}
          <div className="col-span-4 md:col-span-8 lg:col-span-4 lg:col-start-9
                          mt-8 lg:mt-0 lg:self-end lg:pb-[6px]">
            <p className="m-0 text-[14.5px] leading-[1.62] text-ink-2">
              Conciliaciones, clientes, movimientos y cuentas corrientes en una única
              plataforma, con trazabilidad completa de cada operación.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Boton href="/login">Ingresar a NORD</Boton>
            </div>
          </div>
        </div>

        {/* El producto entra desde abajo y se recorta contra el borde
            derecho: se lee como una aplicación en uso, no como una
            captura centrada. */}
        <div className="mt-14 lg:mt-[72px]">
          {/* Se desborda del marco por la derecha y queda cortada contra
              el borde de la pantalla. Una ventana que entra en cuadro se
              lee como una aplicación abierta; una centrada, como una
              captura. */}
          {/* El margen negativo está atado al ancho de la ventana del
              navegador, no a un número fijo: así el corte ocurre igual a
              1366 que a 1728. Con un valor fijo, en pantallas anchas la
              ventana dejaba de cortarse y volvía a leerse como una
              tarjeta centrada. */}
          <div className="relative lg:mr-[calc(50%_-_50vw_-_56px)]">
            <VentanaNord />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Enunciado ──────────────────────────────────────────────── */

const SECUENCIA = ["Entrada", "Operación", "Control"];

function Enunciado() {
  return (
    <section className="border-t border-line bg-surface">
      <div className={cx(MARCO, "py-24 lg:py-32")}>
        <div className={REJILLA}>
          <div className="col-span-4 md:col-span-8 lg:col-span-5">
            <h2 className="m-0 text-[28px] lg:text-[32px] xl:text-[38px] leading-[1.12] font-semibold
                           tracking-[-0.03em] text-ink">
              Una operación.
              <br />
              <span className="text-ink-3">Un solo sistema.</span>
            </h2>
          </div>

          <div className="col-span-4 md:col-span-8 lg:col-span-5 lg:col-start-8 mt-6 lg:mt-2">
            <p className="m-0 text-[15px] leading-[1.68] text-ink-2">
              Desde la carga hasta el control financiero, NORD mantiene cada operación
              conectada, trazable y disponible para quien la necesita.
            </p>

            <div className="mt-9 flex items-center gap-3">
              {SECUENCIA.map((p, i) => (
                <span key={p} className="flex items-center gap-3">
                  {i > 0 && (
                    <span aria-hidden className="w-8 h-px bg-line-hard" />
                  )}
                  <span className="text-[12.5px] text-ink-3 whitespace-nowrap">{p}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Capacidades ────────────────────────────────────────────── */

const CAPACIDADES = [
  {
    titulo: "Automatización",
    texto: "Reduce las tareas repetitivas y concentra la intervención en lo que realmente necesita criterio.",
  },
  {
    titulo: "Control",
    texto: "Centraliza la operación en una única vista, sin perder el detalle.",
  },
  {
    titulo: "Trazabilidad",
    texto: "Cada movimiento mantiene su origen, su historial y su estado.",
  },
];

/**
 * Tabla editorial, no tres tarjetas.
 *
 * Tres filas separadas por una línea fina se leen como un índice y dejan
 * que el ojo baje. Tres cajas iguales se leen como un formulario.
 */
function Capacidades() {
  return (
    <section className="border-t border-line bg-ground">
      <div className={cx(MARCO, "py-20 lg:py-24")}>
        {CAPACIDADES.map((c, i) => (
          <div
            key={c.titulo}
            className={cx(
              REJILLA,
              "items-baseline py-8 lg:py-10",
              i > 0 && "border-t border-line",
            )}
          >
            <span className="col-span-4 md:col-span-1 font-mono text-[11px] text-ink-4 tabular-nums">
              {String(i + 1).padStart(2, "0")}
            </span>
            <h3 className="col-span-4 md:col-span-3 lg:col-span-3 mt-2 md:mt-0 mb-0
                           text-[20px] lg:text-[22px] font-semibold tracking-[-0.022em] text-ink">
              {c.titulo}
            </h3>
            <p className="col-span-4 md:col-span-4 lg:col-span-6 lg:col-start-6 mt-2 md:mt-0 mb-0
                          text-[14.5px] leading-[1.64] text-ink-2">
              {c.texto}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Institucional ──────────────────────────────────────────── */

function Institucional() {
  return (
    <section className="relative isolate overflow-hidden bg-navy text-on-navy">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60
                   [background-image:linear-gradient(to_right,var(--color-navy-2)_1px,transparent_1px)]
                   [background-size:100px_100%]"
      />
      <div className={cx(MARCO, "relative py-24 lg:py-32")}>
        <div className={cx(REJILLA, "items-center gap-y-12")}>
          <div className="col-span-4 md:col-span-8 lg:col-span-6">
            <h2 className="m-0 text-[26px] lg:text-[30px] xl:text-[36px] leading-[1.16] font-semibold
                           tracking-[-0.028em] text-on-navy">
              Diseñado para operaciones
              <br />
              <span className="text-on-navy-2">que no pueden perder contexto.</span>
            </h2>
            <p className="mt-6 mb-0 text-[14.5px] leading-[1.68] text-on-navy-2 max-w-[46ch]">
              NORD mantiene conectados los datos, las decisiones y el historial dentro de
              una única plataforma.
            </p>
          </div>

          <div className="col-span-4 md:col-span-8 lg:col-span-5 lg:col-start-8">
            <DetalleOscuro />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Cierre ─────────────────────────────────────────────────── */

function CierreCta() {
  return (
    <section className="bg-surface">
      <div className={cx(MARCO, "py-24 lg:py-28")}>
        <div className={cx(REJILLA, "items-end gap-y-8")}>
          <div className="col-span-4 md:col-span-8 lg:col-span-7">
            <h2 className="m-0 text-[24px] lg:text-[28px] xl:text-[32px] leading-[1.18] font-semibold
                           tracking-[-0.028em] text-ink">
              NORD mantiene la operación conectada.
            </h2>
            <p className="mt-3 mb-0 text-[14.5px] text-ink-3">
              Accedé a la plataforma con tu cuenta de Nordelta.
            </p>
          </div>
          <div className="col-span-4 md:col-span-8 lg:col-span-4 lg:col-start-9">
            <Boton href="/login">Ingresar</Boton>
          </div>
        </div>
      </div>
    </section>
  );
}

function Pie() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className={cx(MARCO, "py-8 flex flex-wrap items-center gap-x-6 gap-y-3")}>
        <span className="text-[12.5px] text-ink-3 font-medium">NORD</span>
        <span className="text-[12.5px] text-ink-4">Nordelta</span>
        <span className="ml-auto text-[12px] text-ink-4">
          Acceso restringido al personal autorizado
        </span>
      </div>
    </footer>
  );
}
