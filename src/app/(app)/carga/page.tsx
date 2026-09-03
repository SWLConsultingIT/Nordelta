import type { Metadata } from "next";
import { CargaGrid, type FilaCarga } from "@/components/grid/CargaGrid";
import { Card, CardBar, CardFoot, PageHead, Button } from "@/components/ui";
import { getContrapartes, getMovimientosDelDia, getOficinas } from "@/lib/data";
import { fmtFechaLarga, hoyISO } from "@/lib/format";
import { FiltrosCarga } from "./Filtros";

export const metadata: Metadata = { title: "Carga diaria" };

export default async function CargaPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; oficina?: string }>;
}) {
  const sp = await searchParams;
  const fecha = sp.fecha ?? hoyISO();
  const oficinaId = Number(sp.oficina ?? 1);

  const [oficinas, contrapartes, movimientos] = await Promise.all([
    getOficinas(),
    getContrapartes(),
    getMovimientosDelDia(fecha, oficinaId),
  ]);

  const nombre = (id: number | null) =>
    contrapartes.find((c) => c.id === id)?.nombre ?? "";

  /** Una fila de grilla por partida: es el modelo real de la base. */
  const filas: FilaCarga[] = movimientos.flatMap((m) =>
    m.partidas.map((p) => ({
      key: p.id,
      contraparte: nombre(m.contraparte_id),
      concepto: m.concepto,
      categoria: m.categoria,
      medio_pago: p.medio_pago,
      moneda: p.moneda_nominal,
      monto: String(p.monto_nominal),
      tipo_cambio: p.tipo_cambio ? String(p.tipo_cambio) : "",
      comision: p.comision_pct ? String(p.comision_pct * 100) : "",
    })),
  );

  const oficina = oficinas.find((o) => o.id === oficinaId)?.nombre ?? "";

  return (
    <>
      <PageHead
        title="Carga diaria"
        sub={`${fmtFechaLarga(fecha)} · ${oficina}`}
        actions={
          <a href={`/api/export?tipo=carga&fecha=${fecha}&oficina=${oficinaId}`} download>
            <Button>Exportar Excel</Button>
          </a>
        }
      />

      <Card>
        <CardBar>
          <FiltrosCarga oficinas={oficinas} fecha={fecha} oficinaId={oficinaId} />
        </CardBar>
        <CargaGrid filasIniciales={filas} contrapartes={contrapartes} />
        <CardFoot>
          <span><Kbd>Tab</Kbd> celda</span>
          <span><Kbd>Enter</Kbd> fila</span>
          <span>Pegá un bloque desde Excel sobre cualquier celda</span>
        </CardFoot>
      </Card>

      <p className="mt-4 text-[12.5px] text-ink-3 max-w-[80ch]">
        Una fila por partida: un solo monto con su moneda y su medio de pago, en
        lugar de las dieciséis columnas de la planilla. Un movimiento que combina
        efectivo y transferencia son dos filas —{" "}
        <span className="text-ink-2 font-medium">
          y por eso ninguna pata puede perderse cuando la otra tiene tipo de cambio
        </span>
        . Los egresos van en negativo.
      </p>
    </>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="font-mono text-[10.5px] bg-surface border border-line border-b-2 rounded px-1.5 text-ink-2">
      {children}
    </kbd>
  );
}
