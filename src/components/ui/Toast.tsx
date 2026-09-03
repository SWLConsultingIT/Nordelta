"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { cx } from "./index";

/**
 * Avisos de feedback.
 *
 * Compactos, abajo a la derecha, y se van solos. Confirman que algo pasó sin
 * interrumpir: un modal para decir «guardado» detiene el trabajo por nada.
 */

export type TonoAviso = "ok" | "error" | "info";

interface Aviso {
  id: number;
  tono: TonoAviso;
  texto: string;
  detalle?: string;
}

interface Ctx {
  avisar: (texto: string, opciones?: { tono?: TonoAviso; detalle?: string }) => void;
}

const Contexto = createContext<Ctx>({ avisar: () => {} });

// Es un hook: la regla de nombres de React espera «use», pero el resto del
// código está en castellano y romper eso por el linter sería peor.
// eslint-disable-next-line react-hooks/rules-of-hooks
export const usarAvisos = () => useContext(Contexto);

const DURACION = 3600;

export function ProveedorDeAvisos({ children }: { children: React.ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  const avisar = useCallback<Ctx["avisar"]>((texto, opciones) => {
    const id = Date.now() + Math.random();
    setAvisos((xs) => [...xs.slice(-2), { id, texto, tono: opciones?.tono ?? "ok", detalle: opciones?.detalle }]);
    setTimeout(() => setAvisos((xs) => xs.filter((a) => a.id !== id)), DURACION);
  }, []);

  const valor = useMemo(() => ({ avisar }), [avisar]);

  return (
    <Contexto.Provider value={valor}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none"
      >
        {avisos.map((a) => (
          <div
            key={a.id}
            role="status"
            className={cx(
              "anim-toast pointer-events-auto flex items-start gap-2.5 min-w-[248px] max-w-[380px]",
              "rounded-xl border px-3.5 py-2.5 shadow-e3 bg-surface",
              a.tono === "ok" && "border-pos-line",
              a.tono === "error" && "border-neg-line",
              a.tono === "info" && "border-brand-line",
            )}
          >
            <span
              className={cx(
                "w-[6px] h-[6px] rounded-full flex-none mt-[6px]",
                a.tono === "ok" && "bg-pos",
                a.tono === "error" && "bg-neg",
                a.tono === "info" && "bg-brand",
              )}
            />
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-ink">{a.texto}</span>
              {a.detalle && <span className="block t-secondary mt-0.5">{a.detalle}</span>}
            </span>
          </div>
        ))}
      </div>
    </Contexto.Provider>
  );
}
