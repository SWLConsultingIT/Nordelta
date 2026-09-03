"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input } from "@/components/ui";
import { ingresar } from "@/lib/auth/acciones";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    iniciar(async () => {
      const r = await ingresar(email, pass);
      if (!r.ok) {
        setError(r.mensaje);
        return;
      }
      router.push("/inicio");
    });
  }

  return (
    <form onSubmit={enviar} className="mt-6 flex flex-col gap-4" noValidate>
      <Field label="Correo">
        <Input
          type="email"
          name="email"
          autoComplete="username"
          placeholder="nombre@nordelta.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={error ? true : undefined}
          className="h-10"
        />
      </Field>

      <Field label="Contraseña">
        <Input
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="Contraseña"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          aria-invalid={error ? true : undefined}
          className="h-10"
        />
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
