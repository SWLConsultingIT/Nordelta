import type { Metadata } from "next";
import Link from "next/link";
import { Button, PageHeader } from "@/components/ui";
import { Importador } from "./Importador";
import { getClientes } from "@/lib/data/operaciones";

// Estado operativo: cambia con cada corrida, cada resolución y cada
// planilla importada. Prerenderizarla la dejaría mostrando los números
// del momento del build.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Importar planilla" };

export default async function ImportarPage() {
  const clientes = await getClientes();
  return (
    <>
      <PageHeader
        titulo="Importar planilla"
        contexto="Seleccionar · normalizar · validar · confirmar"
        acciones={<Link href="/planillas"><Button variant="ghost">Cancelar</Button></Link>}
      />
      <Importador clientes={clientes} />
    </>
  );
}
