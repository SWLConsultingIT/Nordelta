"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { IcoReloj } from "@/components/ui/icons";
import { usarAvisos } from "@/components/ui/Toast";
import { accionActualizar } from "@/app/(app)/conciliacion/acciones";

/**
 * «Actualizar conciliación», disponible desde cualquier pantalla.
 *
 * Un solo botón que trae el informe de Fullcarga, incorpora lo nuevo y
 * vuelve a conciliar. Quien concilia no tiene por qué saber que son
 * cuatro pasos del sistema.
 */
export function BotonActualizar({
  variant = "default",
  size = "md",
}: {
  variant?: "primary" | "default" | "ghost";
  size?: "sm" | "md";
}) {
  const [pendiente, iniciar] = useTransition();
  const { avisar } = usarAvisos();
  const router = useRouter();

  const actualizar = () =>
    iniciar(async () => {
      const r = await accionActualizar();
      if (!r.ok) return avisar(r.mensaje, { tono: "error" });

      const { corrida, fullcarga } = r.datos;
      const n = corrida.nuevasAcreditadas;
      const partes = [`${corrida.pendientesAlCierre} siguen pendientes`];
      if (fullcarga === "SIN_CREDENCIALES") partes.push("Fullcarga no está conectado");
      if (fullcarga === "FALLO") partes.push("Fullcarga no respondió");

      avisar(
        n > 0
          ? `${n} ${n === 1 ? "operación encontró" : "operaciones encontraron"} acreditación`
          : "Sin novedades",
        { tono: n > 0 ? "ok" : fullcarga === "FALLO" ? "error" : "info", detalle: partes.join(" · ") },
      );
      router.refresh();
    });

  return (
    <Button variant={variant} size={size} onClick={actualizar} disabled={pendiente}>
      <IcoReloj className={size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"} />
      {pendiente ? "Actualizando…" : "Actualizar conciliación"}
    </Button>
  );
}
