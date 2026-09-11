import type { Metadata } from "next";
import Link from "next/link";
import { Button, cx } from "@/components/ui";
import { IcoArrow } from "@/components/ui/icons";
import { ModulosPlataforma, VistaPlataforma } from "@/components/marketing/VistaPlataforma";

export const metadata: Metadata = {
  title: "NORD · Plataforma operativa",
  description:
    "Plataforma operativa de Nordelta. Acceso restringido al personal autorizado.",
  robots: { index: false, follow: false },
};

/**
 * Portada.
 *
 * Es la entrada a una herramienta privada, no un sitio que vende. Su
 * trabajo es transmitir que del otro lado hay una plataforma seria y
 * dejar el acceso donde se lo busca.
 *
 * **No dice cómo funciona NORD por dentro.** Nada de cifras de operación,
 * ni nombres de clientes, ni sistemas con los que se integra, ni reglas
 * de negocio. Dos razones: eso es información de la empresa y no tiene
 * por qué ser pública, y una portada que explica el proceso envejece con
 * cada cambio del proceso.
 *
 * La garantía de que no se filtre nada es estructural: este archivo y el
 * componente de vista no importan nada de la capa de datos, y hay un test
 * que lo verifica.
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <Capacidades />
        <Plataforma />
        <CierreCta />
      </main>
      <Pie />
    </div>
  );
}

/* ── Marca ──────────────────────────────────────────────────── */

function Marca({ claro }: { claro?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span
        aria-hidden
        className={cx(
          "w-[27px] h-[27px] rounded-lg grid place-items-center font-mono text-[12.5px]",
          "font-semibold flex-none",
          claro ? "bg-on-navy text-navy" : "bg-navy text-white",
        )}
      >
        N
      </span>
      <span className="flex items-baseline gap-1.5">
        <span
          className={cx(
            "text-[14.5px] font-semibold tracking-[-0.018em]",
            claro ? "text-on-navy" : "text-ink",
          )}
        >
          Nordelta
        </span>
        <span
          className={cx(
            "font-mono text-[9.5px] tracking-[0.13em] uppercase",
            claro ? "text-on-navy-3" : "text-ink-4",
          )}
        >
          Nord
        </span>
      </span>
    </span>
  );
}

/* ── Barra ──────────────────────────────────────────────────── */

function Navbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/88 backdrop-blur-sm">
      <div className="mx-auto max-w-[1240px] px-6 lg:px-10 h-[62px] flex items-center">
        <Link href="/" className="rounded-lg"><Marca /></Link>
        <Link href="/login" className="ml-auto">
          <Button size="sm">Ingresar</Button>
        </Link>
      </div>
    </header>
  );
}

/* ── Hero ───────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-line">
      {/* Profundidad sobria: una veladura fría y una retícula apenas
          perceptible. Nada de degradados de color ni resplandores. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0
                   bg-[linear-gradient(175deg,var(--color-surface)_0%,var(--color-ground)_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.55]
                   [background-image:linear-gradient(to_right,var(--color-line-soft)_1px,transparent_1px)]
                   [background-size:88px_100%]"
      />

      <div className="relative mx-auto max-w-[1240px] px-6 lg:px-10 py-16 lg:py-[88px]">
        <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)] gap-12 lg:gap-14 items-center">
          <div>
            <p className="m-0 font-mono text-[10px] tracking-[0.17em] uppercase text-ink-4">
              Plataforma operativa
            </p>

            <h1 className="mt-5 mb-0 text-[36px] sm:text-[40px] lg:text-[44px] leading-[1.08]
                           font-semibold tracking-[-0.03em] text-ink">
              Operaciones financieras,
              <br />
              <span className="text-ink-3">en un solo lugar.</span>
            </h1>

            <p className="mt-6 mb-0 text-[16px] leading-[1.62] text-ink-2 max-w-[46ch]">
              Centralizá conciliaciones, clientes, movimientos y cuentas corrientes
              con trazabilidad de punta a punta.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link href="/login">
                <Button variant="primary">
                  Ingresar a NORD <IcoArrow className="w-4 h-4" />
                </Button>
              </Link>
              <span className="text-[12.5px] text-ink-4">Acceso restringido</span>
            </div>
          </div>

          {/* El producto, en capas. La superficie de atrás da profundidad
              sin recurrir a efectos. */}
          <div className="relative lg:-mr-2">
            <div
              aria-hidden
              className="absolute left-10 -right-3 top-9 -bottom-3 rounded-xl border border-line bg-raised/70"
            />
            <VistaPlataforma className="relative" />
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
    texto: "Reduce las tareas operativas repetitivas y concentra la intervención donde hace falta.",
  },
  {
    titulo: "Control",
    texto: "Toda la operación queda centralizada en una única plataforma.",
  },
  {
    titulo: "Trazabilidad",
    texto: "Cada movimiento conserva su origen, su estado y su historial.",
  },
];

function Capacidades() {
  return (
    <section className="border-b border-line">
      <div className="mx-auto max-w-[1240px] px-6 lg:px-10 py-16 lg:py-20">
        <div className="grid md:grid-cols-3 gap-px bg-line rounded-xl overflow-hidden border border-line">
          {CAPACIDADES.map((c, i) => (
            <div key={c.titulo} className="bg-surface px-7 py-7">
              <span className="font-mono text-[10px] tracking-[0.14em] text-ink-4">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h2 className="mt-3 mb-0 text-[17px] font-semibold tracking-[-0.016em] text-ink">
                {c.titulo}
              </h2>
              <p className="mt-2.5 mb-0 text-[13.5px] leading-[1.6] text-ink-2">{c.texto}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Plataforma ─────────────────────────────────────────────── */

function Plataforma() {
  return (
    <section className="bg-navy text-on-navy relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.4]
                   [background-image:linear-gradient(to_right,var(--color-navy-2)_1px,transparent_1px)]
                   [background-size:88px_100%]"
      />
      <div className="relative mx-auto max-w-[1240px] px-6 lg:px-10 py-16 lg:py-24">
        <div className="max-w-[640px]">
          <h2 className="m-0 text-[30px] sm:text-[36px] leading-[1.12] font-semibold
                         tracking-[-0.028em] text-on-navy">
            Una operación.
            <br />
            <span className="text-on-navy-2">Un solo sistema.</span>
          </h2>
          <p className="mt-5 mb-0 text-[15px] leading-[1.65] text-on-navy-2 max-w-[52ch]">
            Desde la carga hasta el control financiero, NORD mantiene la operación
            conectada y trazable.
          </p>
        </div>

        <ModulosPlataforma className="mt-10" />
      </div>
    </section>
  );
}

/* ── Cierre ─────────────────────────────────────────────────── */

function CierreCta() {
  return (
    <section>
      <div className="mx-auto max-w-[1240px] px-6 lg:px-10 py-16 lg:py-20">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          <div>
            <h2 className="m-0 text-[24px] leading-[1.2] font-semibold tracking-[-0.024em] text-ink">
              Accedé a la plataforma.
            </h2>
            <p className="mt-2 mb-0 text-[13.5px] text-ink-3">
              Con tu cuenta de Nordelta.
            </p>
          </div>
          <Link href="/login" className="sm:ml-auto">
            <Button variant="primary">
              Ingresar <IcoArrow className="w-4 h-4" />
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
      <div className="mx-auto max-w-[1240px] px-6 lg:px-10 h-[60px] flex flex-wrap
                      items-center gap-x-4 gap-y-1 text-[12px] text-ink-4">
        <span className="text-ink-3 font-medium">Nordelta</span>
        <span className="ml-auto">Acceso restringido al personal autorizado</span>
      </div>
    </footer>
  );
}
