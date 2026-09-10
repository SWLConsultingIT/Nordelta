import type { Metadata } from "next";
import Link from "next/link";
import { Button, cx } from "@/components/ui";
import { IcoArrow } from "@/components/ui/icons";
import { VistaCliente, VistaConciliacion } from "@/components/marketing/VistaConciliacion";

export const metadata: Metadata = {
  title: "NORD · Conciliación de operaciones",
  description:
    "NORD centraliza las planillas de clientes, cruza las acreditaciones de Fullcarga y deja a la vista únicamente lo que necesita atención.",
};

/**
 * Portada.
 *
 * No vende un producto que se compra por internet: es una herramienta
 * interna y quien llega ya sabe qué es. Su trabajo es que se vea seria y
 * que se entienda el mecanismo en un scroll.
 *
 * La idea central, y todo lo demás está subordinado a ella:
 *
 *     NORD no digitaliza 497 revisiones. Elimina 455.
 *
 * Por eso el producto aparece en la primera pantalla y no una ilustración:
 * lo que hay que creer es que existe y funciona, y eso se muestra, no se
 * afirma. Sin precios, sin testimonios, sin logos: nada de eso es cierto
 * todavía y una portada que promete de más envejece mal.
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Navbar />

      <main className="flex-1">
        <Hero />
        <ComoFunciona />
        <Valor />
        <Plataforma />
        <CierreCta />
      </main>

      <Pie />
    </div>
  );
}

/* ── Barra ──────────────────────────────────────────────────── */

function Navbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-sm">
      <div className="mx-auto max-w-[1140px] px-6 h-[58px] flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2.5 group">
          <Marca />
          <span className="text-[14px] font-semibold tracking-[-0.015em] text-ink">Nordelta</span>
        </Link>
        <a
          href="#como-funciona"
          className="hidden sm:block ml-4 text-[13px] text-ink-3 hover:text-ink transition-colors duration-150"
        >
          Cómo funciona
        </a>
        <Link href="/login" className="ml-auto">
          <Button size="sm">Ingresar</Button>
        </Link>
      </div>
    </header>
  );
}

function Marca({ oscura }: { oscura?: boolean }) {
  return (
    <span
      className={cx(
        "w-[26px] h-[26px] rounded-lg grid place-items-center font-mono text-[12px]",
        "font-semibold flex-none",
        oscura ? "bg-on-navy text-navy" : "bg-navy text-white",
      )}
      aria-hidden
    >
      N
    </span>
  );
}

/* ── Hero ───────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-line">
      {/* Profundidad: una veladura fría muy tenue detrás del producto, y
          una retícula técnica apenas perceptible. Nada de degradados de
          colores ni resplandores. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,var(--color-surface)_0%,var(--color-ground)_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-1/2
                   bg-[linear-gradient(90deg,transparent,color-mix(in_oklab,var(--color-brand)_5%,transparent))]"
      />

      <div className="relative mx-auto max-w-[1140px] px-6 py-14 lg:py-20">
        <div className="grid lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] gap-12 lg:gap-14 items-center">
          <div className="max-w-[620px]">
            <p className="m-0 inline-flex items-center gap-2 rounded-full border border-line bg-surface
                          px-2.5 py-1 text-[11.5px] text-ink-3">
              <span className="w-[5px] h-[5px] rounded-full bg-pos" aria-hidden />
              Operaciones y conciliación
            </p>

            <h1 className="mt-5 mb-0 text-[34px] sm:text-[40px] lg:text-[44px] leading-[1.08]
                           font-semibold tracking-[-0.03em] text-ink text-balance">
              De cientos de transferencias{" "}
              <span className="text-ink-3">a unas pocas decisiones.</span>
            </h1>

            <p className="mt-5 mb-0 text-[16px] leading-[1.62] text-ink-2 max-w-[50ch]">
              NORD centraliza las planillas de tus clientes, cruza automáticamente las
              acreditaciones de Fullcarga y deja a la vista únicamente lo que necesita
              que alguien decida.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/login">
                <Button variant="primary">
                  Ingresar a NORD <IcoArrow className="w-4 h-4" />
                </Button>
              </Link>
              <a href="#como-funciona">
                <Button variant="ghost">Ver cómo funciona</Button>
              </a>
            </div>
          </div>

          {/* El producto, no una ilustración. Una segunda superficie
              detrás da profundidad sin recurrir a efectos. */}
          <div className="relative">
            <div
              aria-hidden
              className="absolute -inset-x-3 -bottom-3 top-6 rounded-xl border border-line bg-raised/70"
            />
            <VistaConciliacion className="relative" />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Cómo funciona ──────────────────────────────────────────── */

const PASOS = [
  {
    n: "01",
    titulo: "Recibí",
    texto: "Las planillas que mandan tus clientes, tal como llegan. Sin limpiarlas a mano.",
  },
  {
    n: "02",
    titulo: "Conciliá",
    texto: "NORD cruza cada transferencia contra los informes de Fullcarga y cierra lo que coincide sin ambigüedad.",
  },
  {
    n: "03",
    titulo: "Resolvé",
    texto: "Solo las operaciones que de verdad necesitan una decisión, con el motivo a la vista.",
  },
];

const TUBERIA = ["Planilla", "NORD", "Fullcarga", "Conciliación", "Excepciones"];

function ComoFunciona() {
  return (
    <section id="como-funciona" className="border-b border-line scroll-mt-[58px]">
      <div className="mx-auto max-w-[1140px] px-6 py-16 lg:py-20">
        <h2 className="m-0 text-[26px] leading-[1.15] font-semibold tracking-[-0.024em] text-ink">
          Cómo funciona
        </h2>

        {/* La tubería, en una línea. Es el producto entero explicado sin
            párrafos. */}
        <div className="mt-8 flex flex-wrap items-center gap-x-2.5 gap-y-2">
          {TUBERIA.map((p, i) => (
            <span key={p} className="flex items-center gap-2.5">
              {i > 0 && <span className="text-ink-4 text-[13px]" aria-hidden>→</span>}
              <span
                className={cx(
                  "inline-flex items-center h-[30px] px-3 rounded-lg border text-[12.5px] whitespace-nowrap",
                  i === 1
                    ? "border-brand-line bg-brand-wash text-brand font-medium"
                    : i === TUBERIA.length - 1
                      ? "border-warn-line bg-warn-wash text-warn"
                      : "border-line bg-surface text-ink-2",
                )}
              >
                {p}
              </span>
            </span>
          ))}
        </div>

        <div className="mt-10 grid md:grid-cols-3 gap-px bg-line rounded-xl overflow-hidden border border-line">
          {PASOS.map((p) => (
            <div key={p.n} className="bg-surface px-6 py-6">
              <span className="t-num text-[11px] text-ink-4">{p.n}</span>
              <h3 className="mt-2.5 mb-0 text-[16px] font-semibold tracking-[-0.014em] text-ink">
                {p.titulo}
              </h3>
              <p className="mt-2 mb-0 text-[13.5px] leading-[1.6] text-ink-2">{p.texto}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── El valor ───────────────────────────────────────────────── */

function Valor() {
  return (
    <section className="bg-navy text-on-navy">
      <div className="mx-auto max-w-[1140px] px-6 py-16 lg:py-20">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-10 lg:gap-16 items-center">
          <div>
            <h2 className="m-0 text-[26px] sm:text-[30px] leading-[1.15] font-semibold
                           tracking-[-0.025em] text-on-navy">
              NORD no digitaliza 497 revisiones.
              <br />
              <span className="text-on-navy-2">Elimina 455.</span>
            </h2>
            <p className="mt-5 mb-0 text-[14.5px] leading-[1.65] text-on-navy-2 max-w-[46ch]">
              La diferencia entre una herramienta que ordena el trabajo y una que lo hace.
              Sobre una operación de 497 transferencias en un día, esto es lo que queda
              para una persona.
            </p>
          </div>

          <div className="grid gap-px bg-navy-3 rounded-xl overflow-hidden border border-navy-3">
            <Barra n="497" t="operaciones procesadas" ancho="100%" clase="bg-navy-4" />
            <Barra n="455" t="resueltas automáticamente" ancho="91.5%" clase="bg-pos" destacada />
            <Barra n="42" t="requieren atención" ancho="8.5%" clase="bg-warn" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Barra({
  n, t, ancho, clase, destacada,
}: { n: string; t: string; ancho: string; clase: string; destacada?: boolean }) {
  return (
    <div className="bg-navy-2 px-5 py-4">
      <div className="flex items-baseline gap-2.5">
        <span
          className={cx(
            "t-num font-semibold tracking-[-0.025em]",
            destacada ? "text-[30px] text-on-navy" : "text-[22px] text-on-navy-2",
          )}
        >
          {n}
        </span>
        <span className="text-[12.5px] text-on-navy-3">{t}</span>
      </div>
      <span className="mt-2.5 block h-[4px] rounded-full bg-navy-3 overflow-hidden" aria-hidden>
        <span className={cx("block h-full rounded-full", clase)} style={{ width: ancho }} />
      </span>
    </div>
  );
}

/* ── Plataforma ─────────────────────────────────────────────── */

function Plataforma() {
  return (
    <section className="border-b border-line">
      <div className="mx-auto max-w-[1140px] px-6 py-16 lg:py-20">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-12 items-center">
          <div className="lg:order-2 max-w-[460px]">
            <h2 className="m-0 text-[26px] leading-[1.15] font-semibold tracking-[-0.024em] text-ink">
              Una operación, de punta a punta.
            </h2>
            <p className="mt-4 mb-0 text-[14.5px] leading-[1.65] text-ink-2">
              Planillas, acreditaciones, clientes y conciliación en el mismo sistema.
              Cada operación conserva de dónde vino, qué se decidió sobre ella y cuándo,
              con el archivo original guardado.
            </p>
            <ul className="mt-5 mb-0 flex flex-col gap-2 list-none p-0">
              {[
                "El estado de cada cliente, siempre al día",
                "Historial completo de cada transferencia",
                "Lo que resolvés una vez, no vuelve a preguntarse",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-[13.5px] text-ink-2">
                  <span className="mt-[7px] w-[5px] h-[5px] rounded-full bg-brand flex-none" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:order-1">
            <VistaCliente />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Cierre ─────────────────────────────────────────────────── */

function CierreCta() {
  return (
    <section>
      <div className="mx-auto max-w-[1140px] px-6 py-16 lg:py-20 text-center">
        <h2 className="m-0 mx-auto max-w-[34ch] text-[26px] sm:text-[30px] leading-[1.18]
                       font-semibold tracking-[-0.025em] text-ink text-balance">
          Menos operaciones para revisar.
          <br />
          <span className="text-ink-3">Más control sobre lo que importa.</span>
        </h2>
        <div className="mt-7 flex justify-center">
          <Link href="/login">
            <Button variant="primary">
              Ingresar a NORD <IcoArrow className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

function Pie() {
  return (
    <footer className="border-t border-line bg-raised">
      <div className="mx-auto max-w-[1140px] px-6 h-[56px] flex items-center gap-4 text-[12px] text-ink-4">
        <span className="flex items-center gap-2">
          <span className="w-[16px] h-[16px] rounded grid place-items-center font-mono text-[8px]
                           font-semibold bg-line-hard text-surface" aria-hidden>N</span>
          Nordelta
        </span>
        <span className="ml-auto">Acceso restringido al personal autorizado</span>
      </div>
    </footer>
  );
}
