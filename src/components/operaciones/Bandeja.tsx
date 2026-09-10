import Link from "next/link";
import { Estado, Monto, TablaShell, Th, Vacio, cx } from "@/components/ui";
import { ESTADOS, tonoDe } from "@/lib/operaciones/buckets";
import { fechaCorta } from "@/lib/operaciones/fechas";
import type { OperacionVista } from "@/lib/data/operaciones";
import type { Bucket } from "@/lib/operaciones/tipos";

/**
 * La bandeja de trabajo.
 *
 * No es una lista de alertas: es lo que Mati tiene que resolver, ordenado
 * por antigüedad. Cada fila dice **qué pasa** y **qué hacer**, que son las
 * dos preguntas que se contestan antes de abrir nada.
 *
 * El orden por antigüedad no clasifica: las dos filas son problema desde
 * el día cero. Ordena para priorizar, que es distinto.
 */

const ACCION: Record<Bucket, string> = {
  CONCILIADA: "—",
  RESUELTA: "—",
  PENDIENTE: "Monitorear",
  REVISION: "Revisar",
  ERROR: "Avisar al cliente",
};

export function Bandeja({
  operaciones,
  limite = 6,
  href = "/conciliacion",
}: {
  operaciones: readonly OperacionVista[];
  limite?: number;
  href?: string;
}) {
  if (operaciones.length === 0) {
    return (
      <Vacio
        titulo="No hay nada esperándote"
        texto="Todo lo que los clientes enviaron está conciliado o resuelto. Va a volver a llenarse cuando entre la próxima planilla."
        compacto
      />
    );
  }

  return (
    <TablaShell minWidth={760}>
      <thead className="bg-raised border-b border-line">
        <tr>
          <Th>Cliente</Th>
          <Th>Qué pasa</Th>
          <Th>Depósito</Th>
          <Th derecha>Días</Th>
          <Th derecha>Importe</Th>
          <Th>Qué hacer</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line-soft">
        {operaciones.slice(0, limite).map((o) => (
          <tr key={o.id} className="hover:bg-raised transition-colors duration-150">
            <td className="px-4 py-2.5 whitespace-nowrap">
              <Link href={href} className="text-ink font-medium hover:text-brand">
                {o.cliente.nombre}
              </Link>
            </td>
            <td className="px-4 py-2.5">
              <Estado tono={tonoDe(o.estado)}>{ESTADOS[o.estado].etiqueta}</Estado>
            </td>
            <td className="px-4 py-2.5 t-num text-ink-3 whitespace-nowrap">
              {fechaCorta(o.fechaDeposito)}
            </td>
            <td className="px-4 py-2.5 text-right">
              <span className={cx("t-num", o.diasPendiente >= 15 ? "text-warn font-semibold" : "text-ink-2")}>
                {o.diasPendiente}
              </span>
            </td>
            <td className="px-4 py-2.5 text-right">
              <Monto valor={o.importe} moneda="ARS" tamano="sm" className="text-ink" />
            </td>
            <td className="px-4 py-2.5 text-[12px] text-ink-3 whitespace-nowrap">
              {ACCION[o.bucket]}
            </td>
          </tr>
        ))}
      </tbody>
    </TablaShell>
  );
}
