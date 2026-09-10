import type { Metadata } from "next";
import Link from "next/link";
import { Button, Monto, PageHeader, cx } from "@/components/ui";
import { IcoDescargar, IcoMas } from "@/components/ui/icons";
import { HeroConciliacion } from "@/components/operaciones/Banda";
import { Consola } from "@/components/operaciones/Consola";
import {
  getClientes, getFlujo, getInformes, getOperaciones, getResumenOperativo,
} from "@/lib/data/operaciones";
import { desdeHace, fmtFechaLarga } from "@/lib/format";

// Estado operativo: cambia con cada corrida, cada resolución y cada
// planilla importada. Prerenderizarla la dejaría mostrando los números
// del momento del build.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Conciliación" };

/**
 * La pantalla donde Mati trabaja.
 *
 * Arriba, el estado en una lectura. Abajo, la cola filtrable arrancando por
 * lo que requiere atención. En el medio, una sola línea con los importes:
 * la plata importa, pero no compite con el trabajo.
 */
export default async function ConciliacionPage() {
  const [resumen, flujo, operaciones, clientes, informes] = await Promise.all([
    getResumenOperativo(),
    getFlujo(),
    getOperaciones(),
    getClientes(),
    getInformes(),
  ]);

  const ultimo = informes[0] ?? null;

  return (
    <>
      <PageHeader
        titulo="Conciliación"
        contexto={[
          `${resumen.total} operaciones procesadas`,
          resumen.ultimaCorrida
            ? `actualizada ${desdeHace(resumen.ultimaCorrida.momento)}`
            : "sin corridas todavía",
          ultimo ? `informe hasta el ${fmtFechaLarga(ultimo.hasta)}` : "sin informe cargado",
        ]}
        acciones={
          <>
            <Link href="/planillas/importar">
              <Button>
                <IcoMas className="w-4 h-4" />
                Importar planilla
              </Button>
            </Link>
            <Link href="/fullcarga">
              <Button>
                <IcoDescargar className="w-4 h-4" />
                Informe de Fullcarga
              </Button>
            </Link>
          </>
        }
      />

      <HeroConciliacion
        titulo="Estado de la conciliación"
        total={resumen.total}
        conciliadas={resumen.conciliadas}
        resueltas={resumen.resueltas}
        pendientes={resumen.pendientes}
        revision={resumen.revision}
        errores={resumen.errores}
        tasaAutomatica={resumen.tasaAutomatica}
        masAntigua={resumen.masAntigua}
        mostrarCta={false}
      />

      {/* Importes y movimiento de la cola: una línea, sin tarjeta. Son
          contexto, no el trabajo. */}
      <div className="flex flex-wrap items-baseline gap-x-7 gap-y-2 px-1 mt-4 mb-6 text-[12.5px]">
        <Renglon etiqueta="Enviado" valor={resumen.montoEnviado} />
        <Renglon etiqueta="Acreditado" valor={resumen.montoAcreditado} tono="text-pos" />
        <Renglon etiqueta="Sin acreditar" valor={resumen.montoEnRiesgo} tono="text-warn" />
        <span className="ml-auto text-ink-4">
          {flujo.acreditadosHoy > 0 || flujo.nuevosHoy > 0 ? (
            <>
              Hoy: <span className="t-num text-ink-2">{flujo.nuevosHoy}</span> nuevas ·{" "}
              <span className="t-num text-pos">{flujo.acreditadosHoy}</span> acreditadas ·{" "}
              <span className={cx("t-num", flujo.variacion > 0 ? "text-warn" : "text-pos")}>
                {flujo.variacion > 0 ? "+" : ""}{flujo.variacion}
              </span>{" "}
              {flujo.variacion > 0 ? "en la cola" : flujo.variacion < 0 ? "menos en la cola" : "sin cambio"}
              {flujo.porMapeoHoy > 0 && (
                <> · <span className="t-num text-brand">{flujo.porMapeoHoy}</span> por identidades que confirmaste</>
              )}
            </>
          ) : (
            "Sin movimiento en la cola hoy"
          )}
        </span>
      </div>

      <Consola operaciones={operaciones} clientes={clientes} />
    </>
  );
}

function Renglon({ etiqueta, valor, tono }: { etiqueta: string; valor: number; tono?: string }) {
  return (
    <span className="flex items-baseline gap-2">
      <span className="text-ink-3">{etiqueta}</span>
      <Monto valor={valor} moneda="ARS" tamano="sm" className={cx("text-[13px] font-medium", tono ?? "text-ink")} />
    </span>
  );
}
