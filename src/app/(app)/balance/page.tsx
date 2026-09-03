import type { Metadata } from "next";
import { PageHead, Button, Card } from "@/components/ui";
import { getContrapartes, getTodosLosMovimientos } from "@/lib/data";
import { construirCtaCte, indiceUltimoCierre, saldoFinal } from "@/lib/domain/saldos";
import { TablaBalance, type FilaBalance } from "./TablaBalance";

export const metadata: Metadata = { title: "Balance general" };

export default async function BalancePage() {
  const [contrapartes, movimientos] = await Promise.all([
    getContrapartes(),
    getTodosLosMovimientos(),
  ]);

  const filas: FilaBalance[] = contrapartes.map((c) => {
    const ctaCte = construirCtaCte(movimientos.filter((m) => m.contraparte_id === c.id));
    const saldo = saldoFinal(ctaCte);
    const iCierre = indiceUltimoCierre(ctaCte);
    return {
      id: c.id,
      nombre: c.nombre,
      ars: saldo.ARS,
      usd: saldo.USD,
      eur: saldo.EUR,
      brl: saldo.BRL,
      ultimoCierre: iCierre >= 0 ? ctaCte[iCierre].movimiento.fecha : null,
    };
  });

  return (
    <>
      <PageHead
        title="Balance general"
        sub="Saldo por contraparte y por moneda, calculado en vivo"
        actions={<Button>Exportar Excel</Button>}
      />
      <Card>
        <TablaBalance filas={filas} />
      </Card>
      <p className="mt-4 text-[12.5px] text-ink-3 max-w-[80ch]">
        Una fila por contraparte, y una sola:{" "}
        <span className="text-ink-2 font-medium">
          la restricción de unicidad de la base hace imposible que vuelvan a existir
          «Bonomi» y «bonomi» como dos clientes distintos
        </span>
        . La fila de totales suma todas las contrapartes.
      </p>
    </>
  );
}
