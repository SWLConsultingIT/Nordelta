import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button, Card, PageHead } from "@/components/ui";
import { getContraparte, getMovimientosDeContraparte, getOficinas } from "@/lib/data";
import { construirCtaCte } from "@/lib/domain/saldos";
import { LibroCtaCte, type FilaLibro } from "./Libro";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const c = await getContraparte(Number((await params).id));
  return { title: c?.nombre ?? "Cuenta corriente" };
}

export default async function CuentaPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const [contraparte, movimientos, oficinas] = await Promise.all([
    getContraparte(id),
    getMovimientosDeContraparte(id),
    getOficinas(),
  ]);
  if (!contraparte) notFound();

  const ctaCte = construirCtaCte(movimientos);
  const oficina = (oid: number) => oficinas.find((o) => o.id === oid)?.nombre ?? "—";

  const filas: FilaLibro[] = ctaCte.map((f) => ({
    id: f.movimiento.id,
    fecha: f.movimiento.fecha,
    oficina: oficina(f.movimiento.oficina_id),
    concepto: f.movimiento.concepto,
    categoria: f.movimiento.categoria,
    convirtio: f.movimiento.partidas.some((p) => p.tipo_cambio !== null && p.tipo_cambio > 0),
    delta: f.delta,
    saldo: f.saldo,
    esCierre: f.esCierre,
  }));

  return (
    <>
      <PageHead
        title={contraparte.nombre}
        sub="Cuenta corriente · saldo corrido y cierres detectados automáticamente"
        actions={
          <>
            <Link href="/cuentas"><Button>Volver</Button></Link>
            <Button variant="primary">Exportar Excel</Button>
          </>
        }
      />
      <LibroCtaCte filas={filas} />
      <p className="mt-4 text-[12.5px] text-ink-3 max-w-[80ch]">
        El saldo corrido lo calcula la base con una función de ventana, así que{" "}
        <span className="text-ink-2 font-medium">está siempre al día y no hay ningún botón que tarde minutos</span>
        . El cierre se marca cuando las cuatro monedas quedan en cero al mismo
        tiempo — es la misma regla que corre hoy en producción.
      </p>
    </>
  );
}

export const dynamic = "force-dynamic";
