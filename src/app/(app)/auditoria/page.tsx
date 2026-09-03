import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { getAuditoria } from "@/lib/data";
import { TablaAuditoria } from "./Tabla";

export const metadata: Metadata = { title: "Auditoría" };

export default async function AuditoriaPage() {
  const entradas = await getAuditoria(300);
  return (
    <>
      <PageHeader
        titulo="Auditoría"
        contexto={[
          "Solo agregado · nadie lo puede editar",
          `${entradas.length} ${entradas.length === 1 ? "registro" : "registros"}`,
        ]}
      />
      <TablaAuditoria entradas={entradas} />
      <p className="mt-4 t-secondary max-w-[82ch]">
        El registro es de solo agregado: nadie —tampoco un administrador— puede
        modificarlo ni borrarlo desde la aplicación.{" "}
        <span className="text-ink-2 font-medium">
          El sistema anterior no registraba nada de esto
        </span>
        : si un saldo cambiaba, no había forma de saber quién lo cambió.
      </p>
    </>
  );
}

export const dynamic = "force-dynamic";
