import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./LoginForm";
import { esDemo } from "@/lib/data";

export const metadata: Metadata = { title: "Ingresar" };

export default function LoginPage() {
  return (
    <div className="min-h-screen grid place-items-center bg-ground px-6 py-10">
      <div className="w-full max-w-[380px]">
        <Link href="/" className="flex items-center gap-2.5 w-fit">
          <span className="w-[30px] h-[30px] rounded-lg grid place-items-center font-mono text-[13px]
                           font-bold text-white bg-gradient-to-br from-brand-hi to-brand">
            N
          </span>
          <span className="font-semibold tracking-[-0.015em]">Nordelta</span>
        </Link>

        <h1 className="mt-8 text-[24px] font-bold tracking-[-0.024em] leading-tight">Ingresar</h1>
        <p className="mt-1.5 text-[13.5px] text-ink-2">
          {esDemo
            ? "Estás en la versión de demostración."
            : "Usá tu cuenta de Nordelta para acceder."}
        </p>

        <LoginForm demo={esDemo} />
      </div>

      <footer className="absolute bottom-6 font-mono text-[10.5px] text-ink-4">
        ¿Problemas para entrar? Escribile a SWL Consulting.
      </footer>
    </div>
  );
}
