import type { Metadata } from "next";
import Link from "next/link";
import {
  Badge, Button, Card, Estado, Monto, PageHeader, SinValor,
  TablaShell, Th, Vacio, type Tono,
} from "@/components/ui";
import { IcoMas } from "@/components/ui/icons";
import { getPlanillas } from "@/lib/data/operaciones";
import type { EstadoPlanilla } from "@/lib/operaciones/tipos";
import { fmtFecha } from "@/lib/format";

// Estado operativo: cambia con cada corrida, cada resolución y cada
// planilla importada. Prerenderizarla la dejaría mostrando los números
// del momento del build.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Planillas" };

/** Seis estados y ni uno más. Cada estado visual extra hay que aprenderlo. */
export const ESTADO_PLANILLA: Record<EstadoPlanilla, { texto: string; tono: Tono }> = {
  RECIBIDA: { texto: "Recibida", tono: "neutral" },
  CON_ERRORES: { texto: "Con errores", tono: "neg" },
  LISTA: { texto: "Lista", tono: "brand" },
  ENVIADA: { texto: "Enviada", tono: "brand" },
  PENDIENTE: { texto: "Pendiente", tono: "warn" },
  ACREDITADA: { texto: "Acreditada", tono: "pos" },
};

export default async function PlanillasPage() {
  const planillas = await getPlanillas();
  const totales = planillas.reduce(
    (a, p) => ({
      enviado: a.enviado + p.enviado,
      acreditado: a.acreditado + p.acreditado,
      operaciones: a.operaciones + p.operaciones,
    }),
    { enviado: 0, acreditado: 0, operaciones: 0 },
  );

  return (
    <>
      <PageHeader
        titulo="Planillas"
        contexto={[
          `${planillas.length} ${planillas.length === 1 ? "planilla" : "planillas"}`,
          `${totales.operaciones} operaciones`,
          <span key="m">
            Acreditado <Monto valor={totales.acreditado} moneda="ARS" tamano="sm" className="text-pos" />
            {" de "}
            <Monto valor={totales.enviado} moneda="ARS" tamano="sm" className="text-ink-2" />
          </span>,
        ]}
        acciones={
          <Link href="/planillas/importar">
            <Button variant="primary">
              <IcoMas className="w-4 h-4" />
              Importar planilla
            </Button>
          </Link>
        }
      />

      <Card>
        {planillas.length === 0 ? (
          <Vacio
            titulo="Todavía no hay planillas"
            texto="Importá el archivo que mandó un cliente: el sistema lo normaliza, lo valida y lo concilia contra Fullcarga."
            accion={
              <Link href="/planillas/importar">
                <Button size="sm" variant="primary">Importar planilla</Button>
              </Link>
            }
          />
        ) : (
        <TablaShell minWidth={1080}>
          <thead className="bg-raised border-b border-line">
            <tr>
              {/* El orden no es cosmético: a 1366 px la tabla scrollea, y
                  lo que se corta tiene que ser lo prescindible. El estado
                  es lo primero que se busca de un barrido; el nombre del
                  archivo, lo último. */}
              <Th>Cliente</Th>
              <Th>Estado</Th>
              <Th>Recibida</Th>
              <Th>Acreditadas</Th>
              <Th derecha>Enviado</Th>
              <Th derecha>Acreditado</Th>
              <Th derecha>Pendiente</Th>
              <Th derecha>Problemas</Th>
              <Th>Archivo</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {planillas.map((p) => {
              const e = ESTADO_PLANILLA[p.estado];
              return (
                <tr key={p.id} className="hover:bg-raised transition-colors duration-150 group">
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <Link href={`/planillas/${p.id}`} className="text-ink font-medium group-hover:text-brand">
                      {p.cliente.nombre}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Estado tono={e.tono}>{e.texto}</Estado>
                      {p.listaParaCtaCte && <Badge tono="brand">cta cte</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 t-num text-ink-3 whitespace-nowrap">{fmtFecha(p.fecha)}</td>
                  <td className="px-4 py-2.5 min-w-[128px]">
                    {/* «40 de 46» dice más que dos columnas de números
                        sueltos: es la pregunta que se hace al mirar una
                        planilla. */}
                    <div className="flex items-center gap-2.5">
                      <span className="t-num text-[12.5px] whitespace-nowrap">
                        <span className="text-ink font-medium">{p.acreditadas}</span>
                        <span className="text-ink-4"> de {p.operaciones}</span>
                      </span>
                      <span className="flex-1 h-[4px] rounded-full bg-line-soft overflow-hidden min-w-[32px]">
                        <span
                          className="block h-full bg-pos"
                          style={{ width: `${p.operaciones === 0 ? 0 : (p.acreditadas / p.operaciones) * 100}%` }}
                        />
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Monto valor={p.enviado} moneda="ARS" tamano="sm" className="text-ink" />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {p.acreditado > 0
                      ? <Monto valor={p.acreditado} moneda="ARS" tamano="sm" className="text-pos" />
                      : <SinValor />}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {p.pendiente > 0
                      ? <Monto valor={p.pendiente} moneda="ARS" tamano="sm" className="text-warn" />
                      : <SinValor />}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {p.errores > 0
                      ? <span className="t-num text-neg font-semibold">{p.errores}</span>
                      : <SinValor />}
                  </td>
                  <td className="px-4 py-2.5 text-ink-4 text-[12px] max-w-[190px] truncate" title={p.archivo}>
                    {p.archivo}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </TablaShell>
        )}
      </Card>
    </>
  );
}
