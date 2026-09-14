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
 * Mismo registro que la portada: azul profundo, los detalles en blanco, las
 * mismas reglas finas y la misma tipografía. Quien llega acá viene de la
 * portada y no tiene por qué sentir que cambió de producto.
 *
 * Sobria a propósito: quien llega ya sabe qué es Pagos Nordelta. Una
 * pantalla de ingreso con argumentos de venta al lado es una pantalla que no
 * confía en que el usuario sepa dónde está.
 */
export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-navy text-on-navy antialiased">
      <header className="border-b border-white/16">
        <div className="mx-auto flex h-[76px] w-full max-w-[1280px] items-center justify-between px-6 sm:px-10 lg:px-14">
          <Link
            href="/"
            className="text-[15.5px] font-semibold tracking-[-0.022em] text-on-navy transition-colors duration-200 hover:text-white"
          >
            Pagos Nordelta
          </Link>
          <Link
            href="/"
            className="text-[13.5px] text-on-navy-2 transition-colors duration-200 hover:text-on-navy"
          >
            Volver
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center px-6 py-20 sm:px-10">
        <div className="anim-surgir mx-auto w-full max-w-[400px]">
          <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-on-navy-2">
            Acceso
          </span>
          <span aria-hidden className="mt-5 block h-px w-full bg-white/22" />

          <h1 className="mt-8 text-[38px] font-semibold leading-[1.06] tracking-[-0.032em] text-white">
            Ingresar
          </h1>
          <p className="mt-4 text-[15px] leading-[1.6] text-on-navy-2">
            Con tu cuenta de Nordelta. El acceso es nominal y está limitado al
            personal autorizado.
          </p>

          <Suspense fallback={<div className="mt-10 h-[268px]" aria-hidden />}>
            <LoginForm demo={esDemo} />
          </Suspense>
        </div>
      </main>

      <footer className="border-t border-white/16">
        <div className="mx-auto flex h-[76px] w-full max-w-[1280px] items-center justify-between px-6 text-[13px] sm:px-10 lg:px-14">
          <span className="font-medium text-on-navy-2">Pagos Nordelta</span>
          <span className="text-on-navy-2">Acceso restringido al personal autorizado</span>
        </div>
      </footer>
    </div>
  );
}
