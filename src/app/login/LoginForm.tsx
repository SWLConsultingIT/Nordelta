"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input } from "@/components/ui";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);

    const configurado = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
    if (!configurado) {
      router.push("/inicio");
      return;
    }

    try {
      const { createClient } = await import("@/lib/supabase/client");
      const { error } = await createClient().auth.signInWithPassword({ email, password: pass });
      if (error) {
        setError("No pudimos validar esos datos. Revisá el correo y la contraseña.");
        setCargando(false);
        return;
      }
      router.push("/inicio");
    } catch {
      setError("No pudimos conectar con el servidor. Probá de nuevo en un momento.");
      setCargando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="mt-6 flex flex-col gap-4">
      <Field label="Correo">
        <Input
          type="email"
          autoComplete="username"
          placeholder="nombre@nordelta.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-10"
        />
      </Field>

      <Field label="Contraseña">
        <Input
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          className="h-10"
        />
      </Field>

      {error && (
        <p role="alert" className="text-[13px] text-neg bg-neg-wash border border-neg/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <Button type="submit" variant="primary" disabled={cargando} className="h-10 mt-1">
        {cargando ? "Ingresando…" : "Ingresar"}
      </Button>
    </form>
  );
}
