import type { Metadata } from "next";
import { Button, PageHeader } from "@/components/ui";
import { IcoDescargar } from "@/components/ui/icons";
import { getContrapartesConSaldo } from "@/lib/data";
import { HOY_DEMO } from "@/lib/data/dataset";
import { fmtFechaLarga } from "@/lib/format";
import { TablaBalance } from "./TablaBalance";

export const metadata: Metadata = { title: "Balance" };

export default async function BalancePage() {
  const cuentas = await getContrapartesConSaldo();
  return (
    <>
      <PageHeader
        titulo="Balance general"
        contexto={[fmtFechaLarga(HOY_DEMO), "Saldo calculado en vivo"]}
        acciones={
          <a href="/api/export?tipo=balance" download>
            <Button>
              <IcoDescargar className="w-[14px] h-[14px]" />
              Exportar
            </Button>
          </a>
        }
      />
      <TablaBalance
        filas={cuentas.map((c) => ({
          id: c.id, nombre: c.nombre, saldo: c.saldo, ultimoCierre: c.ultimoCierre,
        }))}
      />
    </>
  );
}

export const dynamic = "force-dynamic";
