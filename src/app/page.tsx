import Link from "next/link";
import { Button, cx } from "@/components/ui";
import { IcoArrow, IcoBolt, IcoLock, IcoScale, IcoShield } from "@/components/ui/icons";
import { VistaCarga, VistaCuenta } from "@/components/marketing/VistaProducto";

/**
 * Portada.
 *
 * Es una página sin autenticación, así que no muestra ni un dato real: las
 * vistas del producto están armadas con los componentes de la aplicación y
 * los datos sintéticos del modo demostración.
 *
 * Lo que tiene que lograr es una cosa: que quien la abre entienda en cinco
 * segundos qué es esto y quiera entrar.
 */
export default function Landing() {
  return (
    <div className="min-h-screen bg-ground">
      <Encabezado />
      <Hero />
      <Pilares />
      <Detalle />
      <Cierre />
      <Pie />
    </div>
  );
}

/* ── Encabezado ─────────────────────────────────────────────── */

function Encabezado() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-ground/85 backdrop-blur-md">
      <div className="mx-auto max-w-[1180px] px-6 h-14 flex items-center gap-3">
        <Marca />
        <span className="ml-auto hidden sm:flex items-center gap-1.5 t-secondary">
          <IcoLock className="w-3.5 h-3.5" />
          Acceso restringido al personal autorizado
        </span>
        <Link href="/login" className="sm:ml-4">
          <Button variant="primary" size="sm">
            Ingresar <IcoArrow className="w-[13px] h-[13px]" />
          </Button>
        </Link>
      </div>
    </header>
  );
}

function Marca({ grande }: { grande?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className={cx(
        "rounded-xl grid place-items-center font-mono font-bold text-white",
        "bg-gradient-to-br from-brand-hi to-brand shadow-[0_3px_12px_-3px_rgba(29,90,208,.5)]",
        grande ? "w-11 h-11 text-[17px]" : "w-[30px] h-[30px] text-[13px]",
      )}>
        N
      </span>
      <span className={cx(
        "font-semibold tracking-[-0.02em]",
        grande ? "text-[20px]" : "text-[15px]",
      )}>
        Nordelta
      </span>
    </span>
  );
}

/* ── Hero ───────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-line">
      {/* Retícula tenue: da profundidad sin ensuciar el texto. */}
      <div className="absolute inset-0 reticula opacity-[0.45]" aria-hidden />
      <div className="absolute inset-x-0 top-0 h-[380px] bg-gradient-to-b
                      from-brand-wash/70 to-transparent" aria-hidden />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t
                      from-ground to-transparent" aria-hidden />

      <div className="relative mx-auto max-w-[1180px] px-6 pt-14 pb-16 lg:pt-20 lg:pb-24
                      grid lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)] gap-12 lg:gap-14 items-center">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-2 t-label
                           bg-surface border border-brand-line rounded-full px-2.5 py-1 shadow-e1">
            <span className="w-[5px] h-[5px] rounded-full bg-brand anim-latir" />
            <span className="!text-brand">Reemplaza la planilla</span>
          </span>

          <h1 className="mt-5 text-[38px] sm:text-[46px] font-bold tracking-[-0.034em]
                         leading-[1.04] text-ink m-0">
            La operación diaria,
            <br />
            <span className="text-brand">sin planillas.</span>
          </h1>

          <p className="mt-5 text-[16px] leading-[1.6] text-ink-2 max-w-[46ch] m-0">
            Cuentas corrientes en cuatro monedas, carga diaria con la misma
            velocidad del Excel y balance calculado en vivo. Un solo lugar, sin
            macros que corran de noche y sin saldos que se pisen.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href="/login">
              <Button variant="primary" className="h-11 px-5 text-[14.5px]">
                Ingresar al sistema <IcoArrow className="w-4 h-4" />
              </Button>
            </Link>
            <a href="#producto">
              <Button className="h-11 px-4 text-[14.5px]">Ver el producto</Button>
            </a>
          </div>

          <dl className="mt-9 grid grid-cols-3 gap-5 max-w-[430px] m-0">
            <Cifra valor="4" rotulo="monedas por cuenta" />
            <Cifra valor="1" rotulo="fila por partida" />
            <Cifra valor="0" rotulo="saldos escritos a mano" />
          </dl>
        </div>

        {/* El producto de verdad, no una ilustración. */}
        <div className="min-w-0 lg:-mr-16 xl:-mr-24">
          <VistaCuenta />
          <p className="mt-3 t-secondary text-center lg:text-left">
            Vista real de la aplicación · datos de demostración
          </p>
        </div>
      </div>
    </section>
  );
}

function Cifra({ valor, rotulo }: { valor: string; rotulo: string }) {
  return (
    <div>
      <dt className="sr-only">{rotulo}</dt>
      <dd className="m-0">
        <span className="block t-num text-[26px] font-semibold text-ink leading-none">{valor}</span>
        <span className="block mt-1.5 text-[11.5px] leading-tight text-ink-3">{rotulo}</span>
      </dd>
    </div>
  );
}

/* ── Pilares ────────────────────────────────────────────────── */

const PILARES = [
  {
    Icon: IcoBolt,
    titulo: "Se carga como el Excel",
    texto:
      "Tab entre celdas, Enter para bajar, Ctrl+Z para deshacer y pegado directo de un bloque de Excel. El operador no tiene que aprender nada nuevo.",
    detalle: "Pegá filas enteras desde la planilla",
  },
  {
    Icon: IcoScale,
    titulo: "El saldo no se guarda: se calcula",
    texto:
      "Cada consulta recalcula la cuenta corriente desde los movimientos. No hay un número escrito en una celda que pueda quedar viejo o pisado.",
    detalle: "Cuatro monedas, nunca sumadas entre sí",
  },
  {
    Icon: IcoShield,
    titulo: "Todo cambio queda registrado",
    texto:
      "Quién, cuándo, qué campo y con qué valor anterior. El registro es de solo agregado: nadie lo puede editar ni borrar desde la aplicación.",
    detalle: "Auditoría que el sistema anterior no tenía",
  },
];

function Pilares() {
  return (
    <section className="mx-auto max-w-[1180px] px-6 py-16 lg:py-20">
      <h2 className="t-page m-0">Tres cosas que hoy no se pueden hacer</h2>
      <p className="mt-2 t-secondary max-w-[62ch] m-0">
        No es la planilla con otro color. Son las tres limitaciones del sistema
        actual, resueltas de raíz.
      </p>

      <div className="mt-8 grid md:grid-cols-3 gap-4">
        {PILARES.map(({ Icon, titulo, texto, detalle }) => (
          <article key={titulo} className="flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-e2">
            <span className="w-9 h-9 rounded-xl bg-brand-wash text-brand grid place-items-center">
              <Icon className="w-[17px] h-[17px]" />
            </span>
            <h3 className="mt-3.5 t-section m-0">{titulo}</h3>
            <p className="t-body text-ink-2 mx-0 mt-2 mb-4">{texto}</p>
            <p className="mt-auto pt-3.5 border-t border-line-soft t-label m-0">{detalle}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ── Detalle del producto ───────────────────────────────────── */

function Detalle() {
  return (
    <section id="producto" className="border-y border-line bg-surface scroll-mt-14">
      <div className="mx-auto max-w-[1180px] px-6 py-16 lg:py-20">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,336px)] gap-10 lg:gap-12 items-center">
          <div className="min-w-0 order-2 lg:order-1 lg:-ml-6 xl:-ml-14">
            <VistaCarga />
          </div>

          <div className="min-w-0 order-1 lg:order-2">
            <span className="t-label">La pantalla de carga</span>
            <h2 className="mt-2 text-[28px] font-bold tracking-[-0.028em] leading-[1.12] m-0">
              Una fila por partida, y el impacto a la vista
            </h2>
            <p className="mt-4 t-body text-ink-2 m-0">
              En la planilla, el medio de pago estaba codificado en cuál de las
              dieciséis columnas llenabas. Acá es un campo, y la última columna
              muestra en vivo cómo va a impactar en la cuenta corriente —
              incluida la conversión de pesos a dólares al tipo de cambio del día.
            </p>

            <ul className="mt-5 flex flex-col gap-2.5 m-0 p-0 list-none">
              <Punto>El total del día se muestra por moneda, nunca sumado.</Punto>
              <Punto>Un texto en una columna de importe se marca en el momento.</Punto>
              <Punto>La conversión se destaca en azul: se ve que hubo un cambio de moneda.</Punto>
              <Punto>La contraparte no se escribe libre, así que no se duplica.</Punto>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function Punto({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 t-body text-ink-2">
      <span className="w-[17px] h-[17px] rounded-full bg-brand-wash text-brand
                       grid place-items-center flex-none mt-[3px]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
             strokeLinecap="round" strokeLinejoin="round" className="w-[11px] h-[11px]">
          <path d="m5 13 5 5L20 7" />
        </svg>
      </span>
      {children}
    </li>
  );
}

/* ── Cierre ─────────────────────────────────────────────────── */

function Cierre() {
  return (
    <section className="mx-auto max-w-[1180px] px-6 py-16 lg:py-20">
      <div className="relative overflow-hidden rounded-2xl bg-navy px-6 py-12 sm:px-12 shadow-e4">
        <div className="absolute inset-0 opacity-[0.09] reticula" aria-hidden />
        <div className="absolute -top-28 -right-16 w-[420px] h-[420px] rounded-full
                        bg-brand/25 blur-3xl" aria-hidden />

        <div className="relative max-w-[54ch]">
          <h2 className="text-[28px] sm:text-[32px] font-bold tracking-[-0.03em]
                         leading-[1.1] text-on-navy m-0">
            Entrá y probalo con datos de demostración
          </h2>
          <p className="mt-4 text-[15px] leading-[1.6] text-on-navy-2 m-0">
            Treinta días hábiles de operación cargados, cuentas con saldo en
            varias monedas, un cierre completo y el registro de auditoría. Todo
            sintético: no hay ni un dato real.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-4">
            <Link href="/login">
              <Button variant="primary" className="h-11 px-5 text-[14.5px]">
                Ingresar <IcoArrow className="w-4 h-4" />
              </Button>
            </Link>
            <span className="flex items-center gap-1.5 text-[12.5px] text-on-navy-3">
              <IcoLock className="w-3.5 h-3.5" />
              No hace falta contraseña en la demostración
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Pie ────────────────────────────────────────────────────── */

function Pie() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-[1180px] px-6 py-8 flex flex-wrap items-center gap-4">
        <Marca />
        <span className="t-secondary">Plataforma interna de gestión financiera</span>
        <span className="ml-auto t-label">Desarrollado por SWL Consulting</span>
      </div>
    </footer>
  );
}
