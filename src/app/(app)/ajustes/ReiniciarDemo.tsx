"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardBar } from "@/components/ui";
import { reiniciarDatosDemo } from "./reinicio";

/**
 * Restablece los datos de demostración.
 *
 * Pide confirmación porque borra todo lo que se cargó en la sesión, que
 * durante una demo puede ser justo lo que se acaba de mostrar.
 */
export function ReiniciarDemo() {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [corriendo, correr] = useTransition();

  return (
    <Card className="mt-8 max-w-[560px]">
      <CardBar>
        <span className="label-mono">Modo demostración</span>
      </CardBar>
      <div className="p-4">
        <p className="text-[13px] text-ink-2 leading-relaxed">
          Restablecer devuelve los datos al estado inicial: se pierden los
          movimientos, las ediciones y los ajustes que hayas cargado en esta
          sesión. Sirve para repetir un recorrido de demostración.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {!confirmando ? (
            <Button size="sm" onClick={() => { setConfirmando(true); setListo(false); }}>
              Restablecer datos de demostración
            </Button>
          ) : (
            <>
              <span className="text-[13px] text-ink font-medium">
                ¿Restablecer? Esto no se puede deshacer.
              </span>
              <Button
                size="sm"
                variant="danger"
                disabled={corriendo}
                onClick={() =>
                  correr(async () => {
                    const r = await reiniciarDatosDemo();
                    setConfirmando(false);
                    if (!r.ok) { setError(r.mensaje); return; }
                    setListo(true);
                    router.refresh();
                  })
                }
              >
                {corriendo ? "Restableciendo…" : "Sí, restablecer"}
              </Button>
              <Button size="sm" onClick={() => setConfirmando(false)}>Cancelar</Button>
            </>
          )}

          {listo && (
            <span role="status" className="flex items-center gap-2 text-[13px] text-pos font-medium">
              <span className="w-[7px] h-[7px] rounded-full bg-pos" />
              Datos restablecidos
            </span>
          )}
          {error && (
            <span role="alert" className="text-[13px] text-neg font-medium">{error}</span>
          )}
        </div>
      </div>
    </Card>
  );
}
