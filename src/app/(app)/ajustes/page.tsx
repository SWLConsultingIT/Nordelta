import type { Metadata } from "next";
import { PageHead } from "@/components/ui";
import { Pendiente } from "@/components/shell/Pendiente";

export const metadata: Metadata = { title: "Ajustes de cuenta" };

export default function AjustesPage() {
  return (
    <>
      <PageHead title="Ajustes de cuenta" sub="Dentro del alcance, sin construir todavía" />
      <Pendiente
        titulo="Reemplaza los seis Sheets de cierre"
        texto="Un ajuste es un movimiento como cualquier otro, con categoría «ajuste de cuenta»: se carga desde la misma grilla y se lleva el saldo del cliente a cero. Queda pendiente definir por qué hoy son seis planillas distintas."
      />
    </>
  );
}
