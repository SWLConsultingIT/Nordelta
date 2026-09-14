"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ingresar } from "@/lib/auth/acciones";

/**
 * Ingreso.
 *
 * El formulario real es **el único camino**, también en modo demostración:
 * antes había una pantalla distinta con un botón que entraba sin
 * credenciales, y eso significaba que el camino que se probaba todos los
 * días no era el que iba a usar nadie en producción.
 *
 * En demostración se ofrece una entrada rápida, pero como acción secundaria
 * y claramente rotulada.
 *
 * Los campos se escriben acá y no se toman de `components/ui`: ese juego
 * está dibujado para la aplicación, que es clara, y sobre el azul de esta
 * pantalla hay que pelearle cada color. Son dos inputs.
 */

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

const CAMPO = cx(
  "mt-2.5 h-[48px] w-full rounded-[3px] border bg-white/[0.04] px-3.5",
  "text-[15px] text-white placeholder:text-on-navy-3",
  "outline-none transition-colors duration-150",
  "focus:border-white/55 focus:bg-white/[0.07]",
);

const ROTULO = "block text-[11px] font-medium uppercase tracking-[0.14em] text-on-navy-2";

export function LoginForm({ demo }: { demo: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const volver = params.get("volver");
  const expirada = params.get("expirada") === "1";

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  const destino =
    volver && volver.startsWith("/") && !volver.startsWith("//") ? volver : "/inicio";

  function entrar(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    iniciar(async () => {
      const r = await ingresar(email, pass);
      if (!r.ok) return setError(r.mensaje);
      router.push(destino);
      router.refresh();
    });
  }

  const vacio = email.trim() === "" || pass === "";

  return (
    <>
      {expirada && (
        <p
          role="status"
          className="mt-8 rounded-[3px] border border-warn-hi/35 bg-warn-hi/10 px-3.5 py-2.5 text-[13px] text-warn-hi"
        >
          Tu sesión venció por inactividad. Ingresá de nuevo para continuar.
        </p>
      )}

      <form onSubmit={entrar} className="mt-10 flex flex-col gap-6" noValidate>
        <label className="block">
          <span className={ROTULO}>Correo</span>
          <input
            type="email"
            name="email"
            autoComplete="username"
            placeholder="nombre@nordelta.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={error ? true : undefined}
            className={cx(CAMPO, error ? "border-[#F0A99A]/55" : "border-white/20")}
            autoFocus
          />
        </label>

        <label className="block">
          <span className={ROTULO}>Contraseña</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            aria-invalid={error ? true : undefined}
            className={cx(CAMPO, error ? "border-[#F0A99A]/55" : "border-white/20")}
          />
        </label>

        {error && (
          <p
            role="alert"
            aria-live="polite"
            className="rounded-[3px] border border-[#F0A99A]/35 bg-[#F0A99A]/10 px-3.5 py-2.5 text-[13px] text-[#F0A99A]"
          >
            {error}
          </p>
        )}

        {/* Blanco sólido sobre el azul: el acento de toda la marca es el
            blanco, así que la acción principal no necesita otro color. */}
        <button
          type="submit"
          disabled={enviando || vacio}
          className={cx(
            "group mt-2 inline-flex h-[50px] items-center justify-center gap-2.5 rounded-[3px]",
            "bg-white px-7 text-[15px] font-semibold text-navy",
            "transition-colors duration-200 hover:bg-on-navy",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4",
            "focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          {enviando ? "Ingresando…" : "Ingresar"}
          {!enviando && (
            <svg viewBox="0 0 16 10" fill="none" className="h-[9px] w-[15px]" aria-hidden>
              <path
                d="M0 5h14M10 1l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-transform duration-200 group-hover:translate-x-[2px]"
              />
            </svg>
          )}
        </button>
      </form>

      {demo && (
        <div className="mt-10 border-t border-white/16 pt-6">
          <button
            type="button"
            disabled={enviando}
            onClick={() => entrar()}
            className="text-[13px] text-on-navy underline-offset-4 transition-colors duration-150 hover:underline disabled:opacity-50"
          >
            Entrar con datos de demostración
          </button>
          <p className="mt-2 max-w-[46ch] text-[12.5px] leading-[1.55] text-on-navy-3">
            Datos sintéticos. Los cambios se guardan localmente y se pueden restablecer
            desde Ajustes.
          </p>
        </div>
      )}
    </>
  );
}
