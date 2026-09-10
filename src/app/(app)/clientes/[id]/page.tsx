import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Badge, Button, Card, CardBar, Estado, Monto, PageHeader, SinValor,
  TablaShell, Th, Vacio,
} from "@/components/ui";
import { Cifra } from "@/components/operaciones/Banda";
import { Consola } from "@/components/operaciones/Consola";
import { ESTADO_PLANILLA } from "../../planillas/page";
import {
  getCliente, getClientes, getClientesConEstado, getOperaciones, getPlanillas,
} from "@/lib/data/operaciones";
import { fmtFecha } from "@/lib/format";

export const metadata: Metadata = { title: "Cliente" };

export default async function ClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    await getCliente(id);
  } catch {
    notFound();
  }

  const [todos, planillas, operaciones, clientes] = await Promise.all([
    getClientesConEstado(),
    getPlanillas(id),
    getOperaciones({ clienteId: id }),
    getClientes(),
  ]);
  const cliente = todos.find((c) => c.id === id)!;
  const listas = planillas.filter((p) => p.listaParaCtaCte);

  return (
    <>
      <PageHeader
        titulo={cliente.nombre}
        contexto={[
          cliente.alias,
          `${cliente.planillas} ${cliente.planillas === 1 ? "planilla" : "planillas"}`,
          `${cliente.operaciones} operaciones`,
        ]}
        acciones={<Link href="/clientes"><Button variant="ghost">Todos los clientes</Button></Link>}
      />

      <Card className="mb-5">
        <CardBar>
          <span className="t-label">Estado</span>
          {cliente.requierenAtencion > 0 && (
            <span className="ml-auto">
              <Badge tono="warn">{cliente.requierenAtencion} requieren atención</Badge>
            </span>
          )}
        </CardBar>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-5 py-4">
          <Cifra
            valor={<Monto valor={cliente.enviado} moneda="ARS" tamano="xl" className="text-[22px] font-semibold" />}
            etiqueta="Enviado"
          />
          <Cifra
            valor={<Monto valor={cliente.acreditado} moneda="ARS" tamano="xl" className="text-[22px] font-semibold text-pos" />}
            etiqueta="Acreditado"
          />
          <Cifra
            valor={<Monto valor={cliente.pendiente} moneda="ARS" tamano="xl" className="text-[22px] font-semibold text-warn" />}
            etiqueta="Pendiente"
          />
          <Cifra
            valor={cliente.errores}
            etiqueta="Con error"
            tono={cliente.errores > 0 ? "neg" : "ink"}
            nota={
              cliente.montoError > 0 ? (
                <Monto valor={cliente.montoError} moneda="ARS" tamano="sm" className="text-ink-4" />
              ) : undefined
            }
          />
        </div>
      </Card>

      <Card className="mb-5">
        <CardBar>
          <span className="t-label">Planillas</span>
          {listas.length > 0 && (
            <span className="ml-auto text-[11.5px] text-brand">
              {listas.length} {listas.length === 1 ? "lista" : "listas"} para cuenta corriente
            </span>
          )}
        </CardBar>
        {planillas.length === 0 ? (
          <Vacio titulo="Sin planillas todavía" compacto />
        ) : (
          <TablaShell minWidth={720}>
            <thead className="bg-raised border-b border-line">
              <tr>
                <Th>Archivo</Th>
                <Th>Fecha</Th>
                <Th derecha>Transf.</Th>
                <Th derecha>Enviado</Th>
                <Th derecha>Acreditado</Th>
                <Th>Estado</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {planillas.map((p) => {
                const e = ESTADO_PLANILLA[p.estado];
                return (
                  <tr key={p.id} className="hover:bg-raised transition-colors">
                    <td className="px-4 py-2.5 text-[12.5px] truncate max-w-[280px]">
                      <Link href={`/planillas/${p.id}`} className="text-ink hover:text-brand">
                        {p.archivo}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 t-num text-ink-2 whitespace-nowrap">{fmtFecha(p.fecha)}</td>
                    <td className="px-4 py-2.5 text-right t-num text-ink-2">{p.operaciones}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Monto valor={p.enviado} moneda="ARS" tamano="sm" className="text-ink" />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {p.acreditado > 0
                        ? <Monto valor={p.acreditado} moneda="ARS" tamano="sm" className="text-pos" />
                        : <SinValor />}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Estado tono={e.tono}>{e.texto}</Estado>
                        {p.listaParaCtaCte && <Badge tono="brand">cta cte</Badge>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TablaShell>
        )}
      </Card>

      <h2 className="t-section mb-3">Operaciones</h2>
      <Consola
        operaciones={operaciones}
        clientes={clientes}
        vistaInicial={cliente.requierenAtencion > 0 ? "ATENCION" : "TODAS"}
        clienteFijo={id}
        compacta
      />
    </>
  );
}
