"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge, Card, CardBar, Input, Monto, Segmented, SinValor, Vacio, cx } from "@/components/ui";
import { MONEDAS } from "@/lib/domain/types";
import { fmtFecha } from "@/lib/format";
import type { ContraparteConSaldo } from "@/lib/data";

type Filtro = "todas" | "con_saldo" | "cerradas";

export function TablaCuentas({ cuentas }: { cuentas: ContraparteConSaldo[] }) {
  const [filtro, setFiltro] = useState<Filtro>("con_saldo");
  const [q, setQ] = useState("");

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return cuentas
      .filter((c) => {
        if (t && !c.nombre.toLowerCase().includes(t)) return false;
        if (filtro === "con_saldo") return MONEDAS.some((m) => c.saldo[m] !== 0);
        if (filtro === "cerradas") return c.cerrada;
        return true;
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [cuentas, filtro, q]);

  const conSaldo = cuentas.filter((c) => MONEDAS.some((m) => c.saldo[m] !== 0)).length;
  const cerradas = cuentas.filter((c) => c.cerrada).length;

  return (
    <Card>
      <CardBar>
        <Segmented
          label="Filtro"
          value={filtro}
          onChange={setFiltro}
          options={[
            { value: "todas", label: `Todas · ${cuentas.length}` },
            { value: "con_saldo", label: `Con saldo · ${conSaldo}` },
            { value: "cerradas", label: `Cerradas · ${cerradas}` },
          ]}
        />
        <div className="ml-auto flex items-center gap-3">
          <Input
            type="search"
            placeholder="Buscar contraparte"
            aria-label="Buscar contraparte"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="min-w-[230px]"
          />
          <span className="font-mono text-[11px] text-ink-3 whitespace-nowrap tabular-nums">
            {visibles.length}
          </span>
        </div>
      </CardBar>

      {visibles.length === 0 ? (
        <Vacio
          titulo="Ninguna cuenta coincide"
          texto={
            q
              ? `No encontramos una contraparte que contenga «${q}».`
              : "Probá con otro filtro."
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[880px]">
            <thead>
              <tr className="border-b border-line bg-raised">
                <th className="text-left label-mono font-medium px-4 py-2.5">Contraparte</th>
                {MONEDAS.map((m) => (
                  <th key={m} className="text-right label-mono font-medium px-4 py-2.5">{m}</th>
                ))}
                <th className="text-left label-mono font-medium px-4 py-2.5 whitespace-nowrap">
                  Último movimiento
                </th>
                <th className="text-left label-mono font-medium px-4 py-2.5">Estado</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((c) => (
                <tr key={c.id} className="border-b border-line-soft last:border-0 hover:bg-raised group">
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <Link
                      href={`/cuentas/${c.id}`}
                      className="text-ink font-semibold group-hover:text-brand group-hover:underline"
                    >
                      {c.nombre}
                    </Link>
                    <span className="ml-2 font-mono text-[10.5px] text-ink-4">
                      {c.movimientos} mov.
                    </span>
                  </td>
                  {MONEDAS.map((m) => (
                    <td key={m} className="px-4 py-2.5 text-right">
                      {c.saldo[m] === 0 ? (
                        <SinValor />
                      ) : (
                        <Monto
                          valor={c.saldo[m]}
                          moneda={m}
                          className={cx("text-[13px]", c.saldo[m] < 0 ? "text-neg" : "text-ink")}
                        />
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 whitespace-nowrap font-mono text-[12px] text-ink-3">
                    {c.ultimoMovimiento ? fmtFecha(c.ultimoMovimiento) : <SinValor />}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {c.cerrada ? (
                      <Badge tone="pos">Cerrada</Badge>
                    ) : c.ultimoCierre ? (
                      <span className="font-mono text-[10.5px] text-ink-4">
                        cerró {fmtFecha(c.ultimoCierre)}
                      </span>
                    ) : (
                      <Badge>Abierta</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
