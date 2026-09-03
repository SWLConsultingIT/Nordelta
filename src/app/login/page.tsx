import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./LoginForm";
import { esDemo } from "@/lib/data";
import { IcoArrow, IcoBolt, IcoLock, IcoScale, IcoShield } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Ingresar" };

const ARGUMENTOS = [
  { Icon: IcoBolt, texto: "Se carga con el teclado, igual que la planilla" },
  { Icon: IcoScale, texto: "El saldo se recalcula en cada consulta" },
  { Icon: IcoShield, texto: "Todo cambio queda registrado con su autor" },
];

/**
 * Ingreso.
 *
 * Dos paneles: el formulario a la izquierda, sobre fondo claro, y la
 * identidad a la derecha sobre el azul oscuro. En pantalla angosta el panel
 * oscuro desaparece — es acompañamiento, no contenido.
 */
export default function LoginPage() {
  return (
    <div className="min-h-screen grid lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)] bg-ground">
      {/* ── Formulario ── */}
      <div className="flex flex-col px-6 py-8 sm:px-12 lg:px-16">
        <Link href="/" className="flex items-center gap-2.5 w-fit group">
          <span className="w-[30px] h-[30px] rounded-lg grid place-items-center font-mono
                           text-[13px] font-bold text-white bg-gradient-to-br from-brand-hi to-brand">
            N
          </span>
          <span className="font-semibold tracking-[-0.02em] group-hover:text-brand">Nordelta</span>
        </Link>

        <div className="flex-1 grid place-items-center py-10">
          <div className="w-full max-w-[368px]">
            <h1 className="t-page !text-[27px] m-0">
              {esDemo ? "Entrá a la demostración" : "Ingresar"}
            </h1>
            <p className="mt-2 t-body text-ink-2 m-0">
              {esDemo
                ? "Treinta días hábiles de operación cargados, con datos sintéticos."
                : "Usá tu cuenta de Nordelta para acceder a la plataforma."}
            </p>

            <LoginForm demo={esDemo} />

            <p className="mt-7 pt-5 border-t border-line flex items-center gap-2 t-secondary m-0">
              <IcoLock className="w-3.5 h-3.5 flex-none" />
              Acceso restringido al personal autorizado
            </p>
          </div>
        </div>

        <p className="t-secondary m-0">
          ¿Problemas para entrar? Escribile a SWL&nbsp;Consulting.
        </p>
      </div>

      {/* ── Identidad ── */}
      <aside className="relative hidden lg:flex flex-col justify-center overflow-hidden
                        bg-navy px-12 py-12">
        <div className="absolute inset-0 opacity-[0.06] reticula" aria-hidden />
        <div className="absolute -top-32 -right-24 w-[460px] h-[460px] rounded-full
                        bg-brand/30 blur-3xl" aria-hidden />
        <div className="absolute -bottom-40 -left-32 w-[420px] h-[420px] rounded-full
                        bg-brand-hi/12 blur-3xl" aria-hidden />

        <div className="relative">
          <span className="t-label !text-on-navy-3">Plataforma interna</span>
          <p className="mt-3 text-[28px] font-bold tracking-[-0.032em] leading-[1.12]
                        text-on-navy mx-0 mb-0 max-w-[19ch]">
            La operación diaria, sin planillas.
          </p>
        </div>

        <ul className="relative mt-9 flex flex-col gap-3.5 mx-0 mb-0 p-0 list-none">
          {ARGUMENTOS.map(({ Icon, texto }) => (
            <li key={texto} className="flex items-start gap-3">
              <span className="w-8 h-8 rounded-xl bg-navy-3 text-brand-hi grid place-items-center flex-none">
                <Icon className="w-[15px] h-[15px]" />
              </span>
              <span className="text-[13.5px] leading-[1.45] text-on-navy-2 pt-1.5">{texto}</span>
            </li>
          ))}
        </ul>

        <div className="absolute bottom-12 left-12 flex items-center gap-2 text-[12px] text-on-navy-3">
          <Link href="/" className="inline-flex items-center gap-1.5 hover:text-on-navy-2">
            <IcoArrow className="w-3.5 h-3.5 rotate-180" />
            Volver a la portada
          </Link>
        </div>
      </aside>
    </div>
  );
}
