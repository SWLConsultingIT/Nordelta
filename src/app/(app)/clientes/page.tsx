import type { Metadata } from "next";
import Link from "next/link";
import {
  Card, Estado, Monto, PageHeader, SinValor, TablaShell, Th, Vacio,
} from "@/components/ui";
import { BarraProporcion } from "@/components/operaciones/Banda";
import { getClientesConEstado } from "@/lib/data/operaciones";
import { fmtFecha } from "@/lib/format";

// Estado operativo: cambia con cada corrida, cada resolución y cada
// planilla importada. Prerenderizarla la dejaría mostrando los números
// del momento del build.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Clientes" };

/**
 * Estado por cliente.
 *
 * Enviado, acreditado, pendiente y con error: las cuatro columnas que
 * responden «cómo venimos con este cliente» sin tener que abrir nada.
 * El orden lo decide **lo que requiere atención**, no el alfabeto: la
 * pantalla existe para trabajar, no para consultar un padrón.
 */
export default async function ClientesPage() {
  const clientes = await getClientesConEstado();

  return (
    <>
      <PageHeader
        titulo="Clientes"
        contexto={[
          `${clientes.length} ${clientes.length === 1 ? "cliente" : "clientes"}`,
          `${clientes.reduce((a, c) => a + c.requierenAtencion, 0)} operaciones requieren atención`,
        ]}
      />

      <Card>
        {clientes.length === 0 ? (
          <Vacio
            titulo="Todavía no hay clientes"
            texto="Un cliente aparece acá en cuanto se importa su primera planilla."
          />
        ) : (
          <TablaShell minWidth={1010}>
            <thead className="bg-raised border-b border-line">
              <tr>
                <Th>Cliente</Th>
                <Th derecha>Planillas</Th>
                <Th derecha>Operaciones</Th>
                <Th derecha>Enviado</Th>
                <Th derecha>Acreditado</Th>
                <Th derecha>Pendiente</Th>
                <Th derecha>Problemas</Th>
                <Th>Última actividad</Th>
                <Th>Atención</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {clientes.map((c) => (
                <tr key={c.id} className="hover:bg-raised transition-colors">
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <Link href={`/clientes/${c.id}`} className="text-ink hover:text-brand font-medium">
                      {c.nombre}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-right t-num text-ink-2">{c.planillas}</td>
                  <td className="px-4 py-2.5 text-right t-num text-ink-2">{c.operaciones}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Monto valor={c.enviado} moneda="ARS" tamano="sm" className="text-ink" />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Monto valor={c.acreditado} moneda="ARS" tamano="sm" className="text-pos" />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {c.pendiente > 0
                      ? <Monto valor={c.pendiente} moneda="ARS" tamano="sm" className="text-warn" />
                      : <SinValor />}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {c.errores > 0
                      ? <span className="t-num text-neg font-semibold">{c.errores}</span>
                      : <SinValor />}
                  </td>
                  <td className="px-4 py-2.5 t-num text-[12px] text-ink-3 whitespace-nowrap">
                    {c.ultimaActividad ? fmtFecha(c.ultimaActividad) : <SinValor />}
                  </td>
                  <td className="px-4 py-2.5 min-w-[140px]">
                    {c.requierenAtencion === 0 ? (
                      <Estado tono="pos">Al día</Estado>
                    ) : (
                      <div className="flex items-center gap-2.5">
                        <span className="t-num text-[12.5px] text-warn font-semibold w-[26px]">
                          {c.requierenAtencion}
                        </span>
                        <BarraProporcion
                          className="flex-1 max-w-[84px]"
                          segmentos={[
                            { clave: "ok", etiqueta: "cerradas", valor: c.operaciones - c.requierenAtencion, clase: "bg-pos" },
                            { clave: "at", etiqueta: "atención", valor: c.requierenAtencion, clase: "bg-warn" },
                          ]}
                        />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </TablaShell>
        )}
      </Card>
    </>
  );
}
