"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Buscador, Card, CardBar, Estado, Monto, SinValor, TablaShell, Th, TiraDeSaldos, Toggle, Vacio, cx,
} from "@/components/ui";
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
      <TiraDeSaldos
        titulo={soloConSaldo ? "Total por moneda · cuentas con saldo" : "Total por moneda · todas las cuentas"}
        className="mb-5"
        items={MONEDAS.map((m) => ({
          moneda: m,
          valor: totales[m],
          nota: totales[m] === 0 ? "Sin saldo" : totales[m] > 0 ? "A favor" : "En contra",
        }))}
      />

      <Card>
        <CardBar>
          <Buscador
            placeholder="Buscar contraparte"
            aria-label="Buscar contraparte"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-8 text-[12.5px]"
          />
          <Toggle checked={soloConSaldo} onChange={setSoloConSaldo}>
            Solo con saldo
          </Toggle>
          <span className="ml-auto t-num text-[11.5px] text-ink-4">
            {visibles.length} de {filas.length}
          </span>
        </CardBar>

        {visibles.length === 0 ? (
          <Vacio
            titulo="Ninguna contraparte coincide"
            texto={q ? `No encontramos «${q}».` : "Probá desactivando el filtro de saldo."}
          />
        ) : (
          <TablaShell minWidth={820}>
            <thead>
              <tr className="border-b border-line bg-raised">
                <Th>Contraparte</Th>
                {MONEDAS.map((m) => (
                  <Th key={m} derecha>{m}</Th>
                ))}
                <Th>Último cierre</Th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((f) => (
                <tr key={f.id} className="border-b border-line-soft last:border-0 hover:bg-raised group">
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <Link
                      href={`/cuentas/${f.id}`}
                      className="text-[13.5px] font-semibold text-ink group-hover:text-brand"
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
                          className={cx("text-[13px]", f.saldo[m] < 0 ? "text-neg" : "text-ink")}
                        />
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {f.ultimoCierre ? (
                      <Estado tono="pos">{fmtFecha(f.ultimoCierre)}</Estado>
                    ) : (
                      <SinValor />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </TablaShell>
        )}
      </Card>

      <p className="mt-4 t-secondary max-w-[80ch]">
        Una fila por contraparte, y una sola: la restricción de unicidad de la
        base hace imposible que la misma aparezca dos veces por estar escrita
        distinto.{" "}
        <span className="text-ink-2 font-medium">
          Los totales van por moneda y nunca se suman entre sí.
        </span>
      </p>
    </>
  );
}
