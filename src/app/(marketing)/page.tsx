import type { Metadata } from "next";
import Link from "next/link";
import { Emblema } from "@/components/marketing/Composicion";

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
 * Tres bloques y un pie. Es la puerta de una herramienta privada: tiene que
 * decir qué es, transmitir que la empresa detrás es seria, y dejar entrar.
 *
 * **No muestra el producto.** Ni pantallas, ni tablas, ni indicadores. Una
 * portada que enseña la aplicación publica cómo trabaja la empresa y además
 * la disfraza de producto de software, que no es lo que Nordelta es.
 *
 * No importa nada de la aplicación —ni siquiera los componentes de interfaz
 * compartidos, que a su vez importan el dominio—. El aislamiento es
 * estructural y hay un test que lo sostiene.
 */
export default function PortadaPage() {
  return (
    <div className="flex min-h-screen flex-col bg-surface text-ink antialiased">
      <Encabezado />
      <main className="flex-1">
        <Hero />
        <Propuesta />
        <Cierre />
      </main>
      <Pie />
    </div>
  );
}

/* ── Medidas comunes ───────────────────────────────────────────
   Un solo ancho y un solo padding para toda la página: la
   alineación entre bloques no se revisa a ojo, es la misma
   constante.                                                    */

const MARCO = "mx-auto w-full max-w-[1200px] px-6 sm:px-8 lg:px-10";

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

function Marca({ claro }: { claro?: boolean }) {
  return (
    <span
      className={cx(
        "whitespace-nowrap text-[16px] font-semibold tracking-[-0.022em]",
        claro ? "text-on-navy" : "text-ink",
      )}
    >
      Pagos Nordelta
    </span>
  );
}

/* ── 1 · Encabezado ───────────────────────────────────────── */

function Encabezado() {
  return (
    <header className="border-b border-line bg-surface">
      <div className={cx(MARCO, "flex h-[74px] items-center justify-between")}>
        <Marca />
        <Link
          href="/login"
          className={cx(
            "inline-flex h-[38px] items-center rounded-[3px] border border-navy px-5",
            "text-[13.5px] font-medium text-navy transition-colors duration-150",
            "hover:bg-navy hover:text-surface focus-visible:outline focus-visible:outline-2",
            "focus-visible:outline-offset-2 focus-visible:outline-navy",
          )}
        >
          Ingresar
        </Link>
      </div>
    </header>
  );
}

/* ── 2 · Hero ─────────────────────────────────────────────── */

function Hero() {
  return (
    <section className={cx(MARCO, "pt-[88px] pb-[96px] lg:pt-[104px] lg:pb-[112px]")}>
      <div className="grid grid-cols-1 items-center gap-x-8 gap-y-16 lg:grid-cols-12">
        <div className="lg:col-span-7">
          {/* Dos líneas fijas. El quiebre parte el sujeto del predicado y
              se mantiene igual en todos los anchos: un titular que se
              reacomoda solo se lee distinto en cada pantalla. */}
          <h1 className="text-[40px] font-semibold leading-[1.06] tracking-[-0.03em] text-ink sm:text-[50px] lg:text-[56px]">
            Pagos y operaciones,
            <br />
            en un solo lugar.
          </h1>

          <p className="mt-8 max-w-[520px] text-[17px] leading-[1.58] text-ink-2">
            Conciliaciones, movimientos, clientes y seguimiento en una sola plataforma,
            con el historial completo de cada operación.
          </p>

          <div className="mt-11">
            <Link
              href="/login"
              className={cx(
                "inline-flex h-[50px] items-center rounded-[3px] bg-navy px-8",
                "text-[15px] font-medium text-surface transition-colors duration-150",
                "hover:bg-navy-2 focus-visible:outline focus-visible:outline-2",
                "focus-visible:outline-offset-2 focus-visible:outline-navy",
              )}
            >
              Ingresar
            </Link>
          </div>
        </div>

        <div className="lg:col-span-5 lg:col-start-8">
          <Emblema />
        </div>
      </div>
    </section>
  );
}

/* ── 3 · Propuesta de valor ───────────────────────────────── */

const CONCEPTOS = [
  {
    titulo: "Centralización",
    texto: "Toda la información operativa en un solo lugar.",
  },
  {
    titulo: "Automatización",
    texto: "Menos tareas repetitivas y más foco en lo que requiere una decisión.",
  },
  {
    titulo: "Trazabilidad",
    texto: "Cada operación conserva su origen, su estado y su historial.",
  },
];

function Propuesta() {
  return (
    <section className="border-y border-line bg-ground">
      <div className={cx(MARCO, "py-[88px] lg:py-[100px]")}>
        <h2 className="max-w-[640px] text-[30px] font-semibold leading-[1.16] tracking-[-0.026em] text-ink lg:text-[36px]">
          Una sola plataforma para toda la operación.
        </h2>

        {/* Tres columnas separadas por una regla superior, sin tarjetas:
            con tres ideas de una línea, encerrar cada una en una caja es
            ponerle marco a una frase. */}
        <div className="mt-14 grid grid-cols-1 gap-x-10 gap-y-12 sm:grid-cols-3">
          {CONCEPTOS.map((c) => (
            <div key={c.titulo} className="border-t-2 border-navy pt-5">
              <h3 className="text-[17px] font-semibold tracking-[-0.016em] text-ink">
                {c.titulo}
              </h3>
              <p className="mt-2.5 max-w-[300px] text-[14.5px] leading-[1.6] text-ink-2">
                {c.texto}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── 4 · Cierre ───────────────────────────────────────────── */

function Cierre() {
  return (
    <section className="bg-navy">
      <div className={cx(MARCO, "py-[80px] lg:py-[92px]")}>
        <div className="flex flex-col items-start gap-10 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-[30px] font-semibold leading-[1.16] tracking-[-0.026em] text-on-navy lg:text-[36px]">
            Accedé a Pagos Nordelta.
          </h2>
          <Link
            href="/login"
            className={cx(
              "inline-flex h-[50px] flex-none items-center rounded-[3px] bg-surface px-8",
              "text-[15px] font-semibold text-navy transition-colors duration-150",
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

/* ── Pie ──────────────────────────────────────────────────── */

function Pie() {
  return (
    <footer className="border-t border-line bg-surface">
      <div
        className={cx(
          MARCO,
          "flex flex-col gap-3 py-8 sm:h-[86px] sm:flex-row sm:items-center sm:justify-between sm:gap-0 sm:py-0",
        )}
      >
        <Marca />
        <p className="text-[13px] text-ink-3">Acceso restringido al personal autorizado.</p>
      </div>
    </footer>
  );
}
