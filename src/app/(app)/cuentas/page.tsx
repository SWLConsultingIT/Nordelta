import type { Metadata } from "next";
import { PageHead } from "@/components/ui";
import { getContrapartesConSaldo } from "@/lib/data";
import { TablaCuentas } from "./Tabla";

export const metadata: Metadata = { title: "Cuentas" };

export default async function CuentasPage() {
  const cuentas = await getContrapartesConSaldo();
  return (
    <>
      <PageHead
        title="Cuentas"
        sub="Clientes y proveedores, con su saldo por moneda"
      />
      <TablaCuentas cuentas={cuentas} />
    </>
  );
}
