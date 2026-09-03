"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input } from "@/components/ui";
import { IcoArrow } from "@/components/ui/icons";
import { ingresar } from "@/lib/auth/acciones";

export function LoginForm({ demo }: { demo: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  function entrar(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    iniciar(async () => {
      const r = await ingresar(email, pass);
      if (!r.ok) { setError(r.mensaje); return; }
      router.push("/inicio");
    });
  }

  // En demostración no hay nada que validar: un solo botón y adentro.
  if (demo) {
    return (
      <div className="mt-7">
        <Button
          variant="primary"
          disabled={enviando}
          onClick={() => entrar()}
          className="w-full h-11 text-[14.5px]"
        >
          {enviando ? "Entrando…" : "Ingresar a la demostración"}
          {!enviando && <IcoArrow className="w-4 h-4" />}
        </Button>
        <p className="mt-3 text-[12.5px] text-ink-3 leading-relaxed">
          Los datos son ficticios y los cambios que hagas duran mientras la
          aplicación esté corriendo. Se pueden restablecer desde{" "}
          <span className="text-ink-2 font-medium">Ajustes de cuenta</span>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={entrar} className="mt-7 flex flex-col gap-4" noValidate>
      <Field label="Correo">
        <Input type="email" name="email" autoComplete="username" placeholder="nombre@nordelta.com"
               value={email} onChange={(e) => setEmail(e.target.value)}
               aria-invalid={error ? true : undefined} className="h-10" />
      </Field>
      <Field label="Contraseña">
        <Input type="password" name="password" autoComplete="current-password" placeholder="Contraseña"
               value={pass} onChange={(e) => setPass(e.target.value)}
               aria-invalid={error ? true : undefined} className="h-10" />
      </Field>
      {error && (
        <p role="alert" aria-live="polite"
           className="text-[13px] text-neg bg-neg-wash border border-neg/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={enviando} className="h-10 mt-1">
        {enviando ? "Ingresando…" : "Ingresar"}
      </Button>
    </form>
  );
}
