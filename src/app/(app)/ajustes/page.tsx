import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { esDemo, getContrapartesConSaldo, getOficinas } from "@/lib/data";
import { HOY_DEMO } from "@/lib/data/dataset";
import { fmtFechaLarga } from "@/lib/format";
import { FormAjuste } from "./Form";
import { ReiniciarDemo } from "./ReiniciarDemo";

export const metadata: Metadata = { title: "Ajustes de cuenta" };

export default async function AjustesPage({
  searchParams,
}: {
  searchParams: Promise<{ cuenta?: string }>;
}) {
  const [cuentas, oficinas, params] = await Promise.all([
    getContrapartesConSaldo(),
    getOficinas(),
    searchParams,
  ]);

  // Se puede llegar acá desde el libro de una cuenta con la contraparte ya
  // elegida: ?cuenta=<id>.
  const pedida = Number(params.cuenta);
  const inicial = Number.isInteger(pedida) && cuentas.some((c) => c.id === pedida) ? pedida : null;

  return (
    <>
      <PageHeader
        titulo="Ajuste de cuenta"
        contexto={["Lleva una cuenta corriente a cero", fmtFechaLarga(HOY_DEMO)]}
      />

      <FormAjuste
        cuentas={cuentas
          .filter((c) => c.movimientos > 0)
          .map((c) => ({ id: c.id, nombre: c.nombre, saldo: c.saldo, cerrada: c.cerrada }))}
        oficinas={oficinas}
        fecha={HOY_DEMO}
        inicial={inicial}
      />

      <p className="mt-4 t-secondary max-w-[82ch]">
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
