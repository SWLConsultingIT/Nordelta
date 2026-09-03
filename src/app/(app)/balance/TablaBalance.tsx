"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge, CardBar, Cifra, Input, cx } from "@/components/ui";
import { fmtFecha, partirMonto } from "@/lib/format";
import type { Moneda } from "@/lib/domain/types";

export interface FilaBalance {
  id: number;
  nombre: string;
  ars: number;
  usd: number;
  eur: number;
  brl: number;
  ultimoCierre: string | null;
}

const COLS: { key: keyof Pick<FilaBalance, "ars" | "usd" | "eur" | "brl">; moneda: Moneda }[] = [
  { key: "ars", moneda: "ARS" },
  { key: "usd", moneda: "USD" },
  { key: "eur", moneda: "EUR" },
  { key: "brl", moneda: "BRL" },
];

export function TablaBalance({ filas }: { filas: FilaBalance[] }) {
  const [q, setQ] = useState("");

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? filas.filter((f) => f.nombre.toLowerCase().includes(t)) : filas;
  }, [filas, q]);

  const totales = useMemo(
    () =>
      visibles.reduce(
        (a, f) => ({ ars: a.ars + f.ars, usd: a.usd + f.usd, eur: a.eur + f.eur, brl: a.brl + f.brl }),
        { ars: 0, usd: 0, eur: 0, brl: 0 },
      ),
    [visibles],
  );

  return (
    <>
      <CardBar>
        <Input
          type="search"
          placeholder="Buscar contraparte"
          aria-label="Buscar contraparte"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-[220px]"
        />
        <span className="ml-auto font-mono text-[11px] text-ink-3">
          {visibles.length} de {filas.length}
        </span>
      </CardBar>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px] min-w-[760px]">
          <thead>
            <tr className="border-b border-line bg-raised">
              <th className="text-left label-mono font-medium px-4 py-2.5">Contraparte</th>
              {COLS.map((c) => (
                <th key={c.key} className="text-right label-mono font-medium px-4 py-2.5">{c.moneda}</th>
              ))}
              <th className="text-left label-mono font-medium px-4 py-2.5 whitespace-nowrap">Último cierre</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((f) => (
              <tr key={f.id} className="border-b border-line-soft hover:bg-raised">
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <Link href={`/cuentas/${f.id}`} className="text-ink font-semibold hover:text-brand hover:underline">
                    {f.nombre}
                  </Link>
                </td>
                {COLS.map((c) => (
                  <Celda key={c.key} valor={f[c.key]} moneda={c.moneda} />
                ))}
                <td className="px-4 py-2.5 whitespace-nowrap">
                  {f.ultimoCierre ? <Badge tone="pos">{fmtFecha(f.ultimoCierre)}</Badge> : <span className="text-ink-4">—</span>}
                </td>
              </tr>
            ))}
            {visibles.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-3">
                  Ninguna contraparte coincide con la búsqueda.
                </td>
              </tr>
            )}
          </tbody>
          {visibles.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-line bg-raised">
                <td className="px-4 py-2.5 label-mono !text-ink-2">Totales</td>
                {COLS.map((c) => (
                  <Celda key={c.key} valor={totales[c.key]} moneda={c.moneda} fuerte />
                ))}
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}

function Celda({ valor, moneda, fuerte }: { valor: number; moneda: Moneda; fuerte?: boolean }) {
  if (!valor) return <td className="px-4 py-2.5 text-right font-mono text-ink-4">—</td>;
  const { entero, decimal } = partirMonto(valor, moneda);
  return (
    <td className="px-4 py-2.5 text-right whitespace-nowrap">
      <Cifra entero={entero} decimal={decimal} className={cx(fuerte && "font-semibold", valor < 0 ? "text-neg" : "text-ink")} />
    </td>
  );
}
