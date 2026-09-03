import type { Metadata } from "next";
import { PageHead } from "@/components/ui";
import { getContrapartes, getTodosLosMovimientos } from "@/lib/data";
import { hoyISO } from "@/lib/format";
import { construirCtaCte, saldoFinal } from "@/lib/domain/saldos";
import { FormAjuste, type SaldoContraparte } from "./Form";

export const metadata: Metadata = { title: "Ajustes de cuenta" };

export default async function AjustesPage() {
  const [contrapartes, movimientos] = await Promise.all([
    getContrapartes(),
    getTodosLosMovimientos(),
  ]);

  const saldos: SaldoContraparte[] = contrapartes.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    saldo: saldoFinal(construirCtaCte(movimientos.filter((m) => m.contraparte_id === c.id))),
  }));

  return (
    <>
      <PageHead
        title="Ajustes de cuenta"
        sub="Corrección para llevar la cuenta corriente de una contraparte a cero"
      />
      <FormAjuste saldos={saldos} oficinaId={1} fecha={hoyISO()} />
      <p className="mt-4 text-[12.5px] text-ink-3 max-w-[80ch]">
        Reemplaza los seis Sheets de cierre. Un ajuste es un movimiento como
        cualquier otro, con categoría <span className="text-ink-2 font-medium">ajuste de cuenta</span>, así que
        entra al mismo libro mayor y queda en la auditoría.{" "}
        <span className="text-ink-2 font-medium">
          Cuando las cuatro monedas quedan en cero, el cierre se marca solo
        </span>{" "}
        — no hay que registrarlo aparte.
      </p>
    </>
  );
}
