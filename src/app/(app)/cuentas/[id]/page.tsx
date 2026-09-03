import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button, Estado, PageHeader } from "@/components/ui";
import { IcoArrow, IcoDescargar } from "@/components/ui/icons";
import {
  getContraparte, getMovimientosDeContraparte, getOficinas,
} from "@/lib/data";
import { construirCtaCte } from "@/lib/domain/saldos";
import { calcularImpacto } from "@/lib/domain/fx";
import { MONEDAS } from "@/lib/domain/types";
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
  const saldoFinal = ctaCte.at(-1)?.saldo;
  const tieneSaldo = saldoFinal ? MONEDAS.some((m) => saldoFinal[m] !== 0) : false;
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
      <PageHeader
        titulo={contraparte.nombre}
        contexto={[
          "Cuenta corriente",
          `${filas.length} ${filas.length === 1 ? "movimiento" : "movimientos"}`,
          filas.some((f) => f.esCierre) ? (
            <Estado tono="pos">Con cierre registrado</Estado>
          ) : (
            <Estado tono="brand">Sin cierres</Estado>
          ),
        ]}
        acciones={
          <>
            <Link href="/cuentas">
              <Button>
                <IcoArrow className="w-[14px] h-[14px] rotate-180" />
                Cuentas
              </Button>
            </Link>
            {tieneSaldo && (
              <Link href={`/ajustes?cuenta=${id}`}>
                <Button>Ajustar a cero</Button>
              </Link>
            )}
            <a href={`/api/export?tipo=cta&id=${id}`} download>
              <Button variant="primary">
                <IcoDescargar className="w-[14px] h-[14px]" />
                Exportar CSV
              </Button>
            </a>
          </>
        }
      />
      <Libro filas={filas} contraparte={contraparte.nombre} />
    </>
  );
}

export const dynamic = "force-dynamic";
