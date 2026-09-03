import type { Metadata } from "next";
import { PageHead } from "@/components/ui";
import { Pendiente } from "@/components/shell/Pendiente";

export const metadata: Metadata = { title: "Auditoría" };

export default function AuditoriaPage() {
  return (
    <>
      <PageHead title="Auditoría" sub="Capacidad nueva: hoy el sistema no registra nada" />
      <Pendiente
        titulo="Cada cambio, con nombre y apellido"
        texto="La tabla de auditoría se escribe por trigger y es de solo agregado: usuario, fecha, entidad, campo, valor anterior, valor nuevo y motivo. Falta definir con el negocio qué debe pasar al editar un movimiento histórico y si existe un cierre de período."
      />
    </>
  );
}
