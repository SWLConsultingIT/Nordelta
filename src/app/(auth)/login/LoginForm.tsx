"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Field, Input, cx } from "@/components/ui";
import { ingresar } from "@/lib/auth/acciones";

/**
 * Ingreso.
 *
 * El formulario real es **el único camino**, también en modo demostración:
 * antes había una pantalla distinta con un botón que entraba sin
 * credenciales, y eso significaba que el camino que se probaba todos los
 * días no era el que iba a usar nadie en producción.
 *
 * En demostración se ofrece una entrada rápida, pero como acción
 * secundaria y claramente rotulada.
 */
export function LoginForm({ demo }: { demo: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const volver = params.get("volver");
  const expirada = params.get("expirada") === "1";

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  const destino = volver && volver.startsWith("/") && !volver.startsWith("//")
    ? volver
    : "/inicio";

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

  return (
    <>
      {expirada && (
        <p
          role="status"
          className="mt-5 mb-0 text-[12.5px] text-warn bg-warn-wash border border-warn-line
                     rounded-lg px-3 py-2"
        >
          Tu sesión venció por inactividad. Ingresá de nuevo para continuar.
        </p>
      )}

      <form onSubmit={entrar} className="mt-6 flex flex-col gap-4" noValidate>
        <Field label="Correo">
          <Input
            type="email"
            name="email"
            autoComplete="username"
            placeholder="nombre@nordelta.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={error ? true : undefined}
            className={cx("h-10", error && "border-neg")}
            autoFocus
          />
        </Field>

        <Field label="Contraseña">
          <Input
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            aria-invalid={error ? true : undefined}
            className={cx("h-10", error && "border-neg")}
          />
        </Field>

        {error && (
          <p
            role="alert"
            aria-live="polite"
            className="m-0 text-[12.5px] text-neg bg-neg-wash border border-neg-line
                       rounded-lg px-3 py-2"
          >
            {error}
          </p>
        )}

        <Button
          type="submit"
          variant="primary"
          disabled={enviando || email.trim() === "" || pass === ""}
          className="h-10 mt-1"
        >
          {enviando ? "Ingresando…" : "Ingresar"}
        </Button>
      </form>

      {demo && (
        <div className="mt-6 pt-5 border-t border-line">
          <button
            type="button"
            disabled={enviando}
            onClick={() => entrar()}
            className="text-[12.5px] text-brand hover:underline disabled:opacity-50"
          >
            Entrar con datos de demostración
          </button>
          <p className="mt-1.5 mb-0 text-[11.5px] text-ink-4 max-w-[46ch]">
            Datos sintéticos. Los cambios se guardan localmente y se pueden
            restablecer desde Ajustes.
          </p>
        </div>
      )}
    </>
  );
}
