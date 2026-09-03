import type { Metadata } from "next";
import { Button, PageHead } from "@/components/ui";
import { getContrapartesConSaldo } from "@/lib/data";
import { TablaBalance } from "./TablaBalance";

export const metadata: Metadata = { title: "Balance" };

export default async function BalancePage() {
  const cuentas = await getContrapartesConSaldo();
  return (
    <>
      <PageHead
        title="Balance"
        sub="Saldo de cada contraparte, calculado en vivo"
        actions={
          <a href="/api/export?tipo=balance" download>
            <Button>Exportar CSV</Button>
          </a>
        }
      />
      <TablaBalance
        filas={cuentas.map((c) => ({
          id: c.id, nombre: c.nombre, saldo: c.saldo, ultimoCierre: c.ultimoCierre,
        }))}
      />
      <p className="mt-4 text-[12.5px] text-ink-3 max-w-[80ch]">
        Una fila por contraparte, y una sola: la restricción de unicidad de la
        base hace imposible que la misma contraparte aparezca dos veces por
        estar escrita distinto.{" "}
        <span className="text-ink-2 font-medium">
          Los totales van por moneda y nunca se suman entre sí.
        </span>
      </p>
    </>
  );
}
