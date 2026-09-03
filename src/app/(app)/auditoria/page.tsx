import type { Metadata } from "next";
import { Card, PageHead } from "@/components/ui";
import { getAuditoria } from "@/lib/data";
import { TablaAuditoria } from "./Tabla";

export const metadata: Metadata = { title: "Auditoría" };

export default async function AuditoriaPage() {
  const entradas = await getAuditoria();
  return (
    <>
      <PageHead
        title="Auditoría"
        sub="Todo cambio sobre un movimiento, con nombre y apellido"
      />
      <Card>
        <TablaAuditoria entradas={entradas} />
      </Card>
      <p className="mt-4 text-[12.5px] text-ink-3 max-w-[80ch]">
        La tabla se escribe por trigger y es de solo agregado: nadie —tampoco la
        aplicación— puede modificarla ni borrarla.{" "}
        <span className="text-ink-2 font-medium">
          El sistema actual no registra absolutamente nada de esto
        </span>
        : si un saldo cambia, no hay forma de saber quién lo cambió ni cuándo.
      </p>
    </>
  );
}
