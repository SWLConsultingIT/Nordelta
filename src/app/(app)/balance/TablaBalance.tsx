"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge, Card, CardBar, Input, Monto, SinValor, Toggle, Vacio, cx } from "@/components/ui";
import { MONEDAS, type Moneda } from "@/lib/domain/types";
import { fmtFecha } from "@/lib/format";

export interface FilaBalance {
  id: number;
  nombre: string;
  saldo: Record<Moneda, number>;
  ultimoCierre: string | null;
}

export function TablaBalance({ filas }: { filas: FilaBalance[] }) {
  const [q, setQ] = useState("");
  const [soloConSaldo, setSoloConSaldo] = useState(true);

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return filas
      .filter((f) => {
        if (t && !f.nombre.toLowerCase().includes(t)) return false;
        if (soloConSaldo) return MONEDAS.some((m) => f.saldo[m] !== 0);
        return true;
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [filas, q, soloConSaldo]);

  // Los totales se suman por moneda. Un total mezclando pesos, dólares,
  // euros y reales no significa nada.
  const totales = useMemo(() => {
    const t = { ARS: 0, USD: 0, EUR: 0, BRL: 0 } as Record<Moneda, number>;
    for (const f of visibles) for (const m of MONEDAS) t[m] += f.saldo[m];
    return t;
  }, [visibles]);

  return (
    <>
      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))" }}>
        {MONEDAS.map((m) => (
          <div key={m} className="bg-surface border border-line rounded-xl px-4 py-3.5 shadow-e2">
            <span className="label-mono">Total {m}</span>
            <div className="mt-1">
              {totales[m] === 0 ? (
                <span className="font-mono text-[22px] text-ink-4">—</span>
              ) : (
                <Monto
                  valor={totales[m]}
                  moneda={m}
                  tamano="grande"
                  className={cx(
                    "text-[22px] font-semibold tracking-[-0.028em]",
                    totales[m] > 0 ? "text-pos" : "text-neg",
                  )}
                />
              )}
            </div>
            <span className="text-[11.5px] text-ink-4">
              {totales[m] === 0 ? "Sin saldo" : totales[m] > 0 ? "A favor" : "En contra"}
            </span>
          </div>
        ))}
      </div>

      <Card>
        <CardBar>
          <Input
            type="search"
            placeholder="Buscar contraparte"
            aria-label="Buscar contraparte"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="min-w-[230px]"
          />
          <Toggle checked={soloConSaldo} onChange={setSoloConSaldo}>
            Solo con saldo
          </Toggle>
          <span className="ml-auto font-mono text-[11px] text-ink-3 tabular-nums">
            {visibles.length} de {filas.length}
          </span>
        </CardBar>

        {visibles.length === 0 ? (
          <Vacio
            titulo="Ninguna contraparte coincide"
            texto={q ? `No encontramos «${q}».` : "Probá desactivando el filtro de saldo."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] min-w-[820px]">
              <thead>
                <tr className="border-b border-line bg-raised">
                  <th className="text-left label-mono font-medium px-4 py-2.5">Contraparte</th>
                  {MONEDAS.map((m) => (
                    <th key={m} className="text-right label-mono font-medium px-4 py-2.5">{m}</th>
                  ))}
                  <th className="text-left label-mono font-medium px-4 py-2.5 whitespace-nowrap">
                    Último cierre
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((f) => (
                  <tr key={f.id} className="border-b border-line-soft last:border-0 hover:bg-raised group">
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <Link
                        href={`/cuentas/${f.id}`}
                        className="text-ink font-semibold group-hover:text-brand group-hover:underline"
                      >
                        {f.nombre}
                      </Link>
                    </td>
                    {MONEDAS.map((m) => (
                      <td key={m} className="px-4 py-2.5 text-right">
                        {f.saldo[m] === 0 ? (
                          <SinValor />
                        ) : (
                          <Monto
                            valor={f.saldo[m]}
                            moneda={m}
                            className={cx(f.saldo[m] < 0 ? "text-neg" : "text-ink")}
                          />
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {f.ultimoCierre ? (
                        <Badge tone="pos">{fmtFecha(f.ultimoCierre)}</Badge>
                      ) : (
                        <SinValor />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
