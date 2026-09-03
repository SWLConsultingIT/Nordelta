import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button, PageHead } from "@/components/ui";
import {
  getContraparte, getMovimientosDeContraparte, getOficinas,
} from "@/lib/data";
import { construirCtaCte } from "@/lib/domain/saldos";
import { calcularImpacto } from "@/lib/domain/fx";
import { ErrorNoEncontrado } from "@/lib/domain/errors";
import { Libro, type FilaLibro } from "./Libro";

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  try {
    const c = await getContraparte(Number((await params).id));
    return { title: c.nombre };
  } catch {
    return { title: "Cuenta" };
  }
}

export default async function CuentaPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);

  let contraparte;
  try {
    contraparte = await getContraparte(id);
  } catch (e) {
    if (e instanceof ErrorNoEncontrado) notFound();
    throw e;
  }

  const [movimientos, oficinas] = await Promise.all([
    getMovimientosDeContraparte(id),
    getOficinas(),
  ]);

  const ctaCte = construirCtaCte(movimientos);
  const oficina = (oid: number) => oficinas.find((o) => o.id === oid)?.nombre ?? "—";

  const filas: FilaLibro[] = ctaCte.map((f) => ({
    id: f.movimiento.id,
    fecha: f.movimiento.fecha,
    oficina: oficina(f.movimiento.oficina_id),
    concepto: f.movimiento.concepto,
    categoria: f.movimiento.categoria,
    delta: f.delta,
    saldo: f.saldo,
    esCierre: f.esCierre,
    partidas: f.movimiento.partidas.map((p) => {
      const i = calcularImpacto(p);
      return {
        medio_pago: p.medio_pago,
        moneda_nominal: p.moneda_nominal,
        monto_nominal: p.monto_nominal,
        tipo_cambio: p.tipo_cambio,
        comision_pct: p.comision_pct,
        moneda_impacto: i.moneda,
        monto_impacto: i.monto,
      };
    }),
  }));

  return (
    <>
      <PageHead
        title={contraparte.nombre}
        sub="Cuenta corriente"
        actions={
          <>
            <Link href="/cuentas"><Button>Volver a cuentas</Button></Link>
            <a href={`/api/export?tipo=cta&id=${id}`} download>
              <Button variant="primary">Exportar CSV</Button>
            </a>
          </>
        }
      />
      <Libro filas={filas} contraparte={contraparte.nombre} />
    </>
  );
}

export const dynamic = "force-dynamic";
