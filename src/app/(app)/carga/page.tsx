import type { Metadata } from "next";
import { CargaGrid, type FilaCarga } from "@/components/grid/CargaGrid";
import { Button, PageHeader } from "@/components/ui";
import { IcoDescargar } from "@/components/ui/icons";
import { getContrapartes, getMovimientosDelDia, getOficinas } from "@/lib/data";
import { HOY_DEMO } from "@/lib/data/dataset";
import { esFechaISOValida, fmtFechaLarga } from "@/lib/format";

export const metadata: Metadata = { title: "Carga" };

export default async function CargaPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; oficina?: string }>;
}) {
  const sp = await searchParams;
  const fecha = sp.fecha && esFechaISOValida(sp.fecha) ? sp.fecha : HOY_DEMO;
  const oficinaId = Number(sp.oficina ?? 1) || 1;

  const [oficinas, contrapartes, movimientos] = await Promise.all([
    getOficinas(),
    getContrapartes(),
    getMovimientosDelDia(fecha, oficinaId),
  ]);

  const nombre = (id: number | null) => contrapartes.find((c) => c.id === id)?.nombre ?? "";

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
      <PageHeader
        titulo="Carga de movimientos"
        contexto={[fmtFechaLarga(fecha), oficina]}
        acciones={
          <a href={`/api/export?tipo=carga&fecha=${fecha}&oficina=${oficinaId}`} download>
            <Button>
              <IcoDescargar className="w-[14px] h-[14px]" />
              Exportar
            </Button>
          </a>
        }
      />

      <CargaGrid
        filasIniciales={filas}
        contrapartes={contrapartes}
        fecha={fecha}
        oficinaId={oficinaId}
        oficinas={oficinas}
      />
    </>
  );
}

export const dynamic = "force-dynamic";
