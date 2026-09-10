import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Badge, Button, Card, CardBar, Estado, Monto, PageHeader, Vacio,
} from "@/components/ui";
import { IcoArrow } from "@/components/ui/icons";
import { Cifra, BarraProporcion } from "@/components/operaciones/Banda";
import { Consola } from "@/components/operaciones/Consola";
import { ESTADO_PLANILLA } from "../page";
import { getClientes, getOperaciones, getPlanilla } from "@/lib/data/operaciones";
import { bucketDe } from "@/lib/operaciones/buckets";
import { fmtFechaLarga } from "@/lib/format";

export const metadata: Metadata = { title: "Planilla" };

/**
 * Detalle de una planilla.
 *
 * La planilla es **la unidad contable**: NORD lo confirmó. Una transferencia
 * suelta no genera asiento; lo que llega a la cuenta corriente es el total
 * de la planilla una vez que todo acreditó. Por eso el puente vive acá y no
 * en la operación.
 */
export default async function PlanillaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let planilla;
  try {
    planilla = await getPlanilla(id);
  } catch {
    notFound();
  }

  const [operaciones, clientes] = await Promise.all([
    getOperaciones({ planillaId: id }),
    getClientes(),
  ]);

  const conteo = { CONCILIADA: 0, RESUELTA: 0, PENDIENTE: 0, REVISION: 0, ERROR: 0 };
  for (const o of operaciones) conteo[bucketDe(o.estado)] += 1;
  const atencion = conteo.PENDIENTE + conteo.REVISION + conteo.ERROR;
  const e = ESTADO_PLANILLA[planilla.estado];

  return (
    <>
      <PageHeader
        titulo={planilla.cliente.nombre}
        contexto={[
          planilla.archivo,
          fmtFechaLarga(planilla.fecha),
          <Estado key="e" tono={e.tono}>{e.texto}</Estado>,
        ]}
        acciones={
          <Link href="/planillas">
            <Button variant="ghost">Todas las planillas</Button>
          </Link>
        }
      />

      <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-4 mb-5 items-start">
        <Card>
          <CardBar>
            <span className="t-label">Resumen</span>
            <span className="ml-auto t-num text-[11.5px] text-ink-4">
              {planilla.operaciones} operaciones
            </span>
          </CardBar>
          <div className="px-5 pt-3.5">
            <BarraProporcion
              segmentos={[
                { clave: "c", etiqueta: "conciliadas", valor: conteo.CONCILIADA, clase: "bg-pos" },
                { clave: "r", etiqueta: "resueltas", valor: conteo.RESUELTA, clase: "bg-brand" },
                { clave: "p", etiqueta: "pendientes", valor: conteo.PENDIENTE, clase: "bg-warn/55" },
                { clave: "v", etiqueta: "revisión", valor: conteo.REVISION, clase: "bg-warn" },
                { clave: "e", etiqueta: "error", valor: conteo.ERROR, clase: "bg-neg" },
              ]}
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-5 py-4">
            <Cifra
              valor={<Monto valor={planilla.enviado} moneda="ARS" tamano="xl" className="text-[22px] font-semibold" />}
              etiqueta="Enviado"
            />
            <Cifra
              valor={<Monto valor={planilla.acreditado} moneda="ARS" tamano="xl" className="text-[22px] font-semibold text-pos" />}
              etiqueta="Acreditado"
            />
            <Cifra
              valor={<Monto valor={planilla.pendiente} moneda="ARS" tamano="xl" className="text-[22px] font-semibold text-warn" />}
              etiqueta="Sin acreditar"
            />
            <Cifra
              valor={planilla.errores}
              etiqueta="Con error"
              tono={planilla.errores > 0 ? "neg" : "ink"}
              nota={
                planilla.montoError > 0 ? (
                  <Monto valor={planilla.montoError} moneda="ARS" tamano="sm" className="text-ink-4" />
                ) : undefined
              }
            />
          </div>
        </Card>

        {/* Puente a cuenta corriente. Visual y accionado por una persona: la
            regla contable no está aprobada, así que no se genera nada solo. */}
        <Card>
          <CardBar><span className="t-label">Cuenta corriente</span></CardBar>
          <div className="px-4 py-4">
            {planilla.listaParaCtaCte ? (
              <>
                <Estado tono="pos">Lista para cuenta corriente</Estado>
                <p className="mt-2 mb-3 text-[12.5px] text-ink-2">
                  Las {planilla.operaciones} operaciones acreditaron. El total de la planilla
                  puede impactar en la cuenta de {planilla.cliente.nombre}.
                </p>
                <Monto
                  valor={planilla.acreditado}
                  moneda="ARS"
                  tamano="xl"
                  className="text-[24px] font-semibold text-pos"
                />
                <Button className="mt-3 w-full" disabled>
                  Preparar para cuenta corriente
                  <IcoArrow className="w-4 h-4" />
                </Button>
                <p className="mt-2 mb-0 text-[11px] text-ink-4">
                  No genera el asiento. La regla contable la define NORD; hasta entonces el
                  puente lo acciona una persona.
                </p>
              </>
            ) : (
              <>
                <Estado tono="warn">{atencion} sin cerrar</Estado>
                <p className="mt-2 mb-0 text-[12.5px] text-ink-2">
                  La unidad contable es la planilla entera: no pasa a cuenta corriente hasta
                  que acrediten todas.
                </p>
                <p className="mt-2 mb-0 text-[11.5px] text-ink-4">
                  Faltan <span className="t-num">{atencion}</span> de{" "}
                  <span className="t-num">{planilla.operaciones}</span>.
                </p>
              </>
            )}
          </div>
        </Card>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <h2 className="t-section m-0">Operaciones</h2>
        {atencion > 0 && <Badge tono="warn">{atencion} requieren atención</Badge>}
      </div>

      {operaciones.length === 0 ? (
        <Card><Vacio titulo="La planilla no tiene operaciones" /></Card>
      ) : (
        <Consola
          operaciones={operaciones}
          clientes={clientes}
          vistaInicial="TODAS"
          clienteFijo={planilla.clienteId}
          compacta
        />
      )}
    </>
  );
}
