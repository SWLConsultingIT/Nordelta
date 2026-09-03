"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardBar, Estado } from "@/components/ui";
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
        <span className="t-label">Modo demostración</span>
      </CardBar>
      <div className="p-4">
        <p className="t-body text-ink-2 mx-0 mt-0 mb-0">
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
            <span role="status"><Estado tono="pos">Datos restablecidos</Estado></span>
          )}
          {error && <span role="alert"><Estado tono="neg">{error}</Estado></span>}
        </div>
      </div>
    </Card>
  );
}
