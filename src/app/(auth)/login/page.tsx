import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "./LoginForm";
import { esDemo } from "@/lib/data";

// La plantilla del layout raíz completa « · Pagos Nordelta».
export const metadata: Metadata = { title: "Ingresar" };

/**
 * Pantalla de ingreso.
 *
 * Sobria y del mismo registro que la portada: quien llega acá ya sabe qué
 * es Pagos Nordelta. Una pantalla de login con argumentos de venta al lado es una
 * pantalla que no confía en que el usuario sepa dónde está.
 */
export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <header className="border-b border-line">
        <div className="mx-auto max-w-[1080px] px-6 h-[62px] flex items-center">
          <Link href="/" className="flex items-center gap-2.5 group">
            <span
              className="w-[26px] h-[26px] rounded-lg grid place-items-center font-mono text-[12px]
                         font-semibold text-white flex-none bg-navy"
            >
              N
            </span>
            <span className="text-[14px] font-semibold tracking-[-0.015em] text-ink group-hover:text-brand whitespace-nowrap">
              Pagos Nordelta
            </span>
          </Link>
        </div>
      </header>

      <main className="flex-1 grid place-items-center px-6 py-16">
        <div className="w-full max-w-[360px]">
          <h1 className="m-0 text-[26px] leading-[1.15] font-semibold tracking-[-0.024em] text-ink">
            Acceder
          </h1>
          <p className="mt-2 mb-0 text-[13.5px] text-ink-2">
            Ingresá con tu cuenta de Nordelta.
          </p>

          <Suspense fallback={<div className="mt-6 h-[248px]" aria-hidden />}>
            <LoginForm demo={esDemo} />
          </Suspense>
        </div>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-[1080px] px-6 h-[54px] flex items-center gap-4 text-[12px] text-ink-4">
          <span>Acceso restringido al personal autorizado</span>
        </div>
      </footer>
    </div>
  );
}
