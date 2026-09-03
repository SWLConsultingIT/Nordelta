import type { Metadata } from "next";
import { PageHead } from "@/components/ui";
import { esDemo, getContrapartesConSaldo, getOficinas } from "@/lib/data";
import { HOY_DEMO } from "@/lib/data/dataset";
import { FormAjuste } from "./Form";
import { ReiniciarDemo } from "./ReiniciarDemo";

export const metadata: Metadata = { title: "Ajustes de cuenta" };

export default async function AjustesPage() {
  const [cuentas, oficinas] = await Promise.all([getContrapartesConSaldo(), getOficinas()]);

  return (
    <>
      <PageHead
        title="Ajustes de cuenta"
        sub="Corrección para llevar la cuenta corriente de una contraparte a cero"
      />

      <FormAjuste
        cuentas={cuentas
          .filter((c) => c.movimientos > 0)
          .map((c) => ({ id: c.id, nombre: c.nombre, saldo: c.saldo, cerrada: c.cerrada }))}
        oficinas={oficinas}
        fecha={HOY_DEMO}
      />

      <p className="mt-4 text-[12.5px] text-ink-3 max-w-[82ch]">
        Un ajuste no toca ningún saldo: genera un{" "}
        <span className="text-ink-2 font-medium">movimiento contable explícito</span> con categoría
        de ajuste y una partida por cada moneda con saldo. Cuando las cuatro
        quedan en cero, el cierre se marca solo en la cuenta.
      </p>

      {esDemo && <ReiniciarDemo />}
    </>
  );
}

export const dynamic = "force-dynamic";
