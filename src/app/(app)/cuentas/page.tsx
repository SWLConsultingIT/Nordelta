import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { getContrapartesConSaldo } from "@/lib/data";
import { MONEDAS } from "@/lib/domain/types";
import { TablaCuentas } from "./Tabla";

export const metadata: Metadata = { title: "Cuentas" };

export default async function CuentasPage() {
  const cuentas = await getContrapartesConSaldo();
  const conSaldo = cuentas.filter((c) => MONEDAS.some((m) => c.saldo[m] !== 0)).length;

  return (
    <>
      <PageHeader
        titulo="Cuentas corrientes"
        contexto={[
          `${cuentas.length} contrapartes`,
          `${conSaldo} con saldo`,
        ]}
      />
      <TablaCuentas cuentas={cuentas} />
    </>
  );
}

export const dynamic = "force-dynamic";
