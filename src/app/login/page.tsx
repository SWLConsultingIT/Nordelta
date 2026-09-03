import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./LoginForm";
import { usaSupabase } from "@/lib/data";

export const metadata: Metadata = { title: "Ingresar" };

export default function LoginPage() {
  return (
    <div className="min-h-screen grid lg:grid-cols-[minmax(0,1fr)_44%]">
      {/* Panel de acceso */}
      <div className="flex flex-col px-6 py-8">
        <Link href="/" className="flex items-center gap-2.5 w-fit">
          <span className="w-[30px] h-[30px] rounded-lg grid place-items-center font-mono text-[13px] font-bold text-white
                           bg-gradient-to-br from-brand-hi to-brand shadow-[0_2px_8px_-2px_rgba(30,95,209,.6)]">
            N
          </span>
          <span className="font-semibold tracking-[-0.015em]">Nordelta</span>
        </Link>

        <div className="flex-1 grid place-items-center py-10">
          <div className="w-full max-w-[368px]">
            <h1 className="text-[26px] font-bold tracking-[-0.025em] leading-tight">Ingresar</h1>
            <p className="mt-2 text-[14px] text-ink-2">
              Usá tu cuenta de Nordelta para acceder a la plataforma.
            </p>

            {!usaSupabase && (
              <div className="mt-5 rounded-lg border border-brand-line bg-brand-wash px-3.5 py-3 text-[12.5px] text-ink-2">
                <span className="label-mono block mb-1 !text-brand">Modo demostración</span>
                Supabase todavía no está configurado, así que cualquier dato te
                deja entrar y la aplicación corre con datos de muestra.
              </div>
            )}

            <LoginForm />
          </div>
        </div>

        <p className="font-mono text-[11px] text-ink-3">
          ¿Problemas para entrar? Escribile a SWL Consulting.
        </p>
      </div>

      {/* Panel de marca */}
      <div className="hidden lg:flex flex-col justify-end bg-navy p-10 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "linear-gradient(var(--color-brand-hi) 1px, transparent 1px), linear-gradient(90deg, var(--color-brand-hi) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(ellipse at 70% 30%, black, transparent 72%)",
          }}
        />
        <blockquote className="relative max-w-[38ch]">
          <p className="text-on-navy text-[19px] leading-relaxed tracking-[-0.01em]">
            Un saldo solo sirve si se puede explicar. Cada número de esta
            plataforma se remonta a los movimientos que lo componen.
          </p>
          <footer className="mt-5 font-mono text-[10px] tracking-[0.13em] uppercase text-on-navy-3">
            Principio de diseño
          </footer>
        </blockquote>
      </div>
    </div>
  );
}
