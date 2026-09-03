"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Buscador, Card, CardBar, Estado, FilterTabs, Monto, SinValor, TablaShell, Th, Vacio, cx,
} from "@/components/ui";
import { MONEDAS } from "@/lib/domain/types";
import { fmtFecha } from "@/lib/format";
import type { ContraparteConSaldo } from "@/lib/data";

type Filtro = "todas" | "con_saldo" | "cerradas";

export function TablaCuentas({ cuentas }: { cuentas: ContraparteConSaldo[] }) {
  const [filtro, setFiltro] = useState<Filtro>("con_saldo");
  const [q, setQ] = useState("");

  const conSaldo = cuentas.filter((c) => MONEDAS.some((m) => c.saldo[m] !== 0)).length;
  const cerradas = cuentas.filter((c) => c.cerrada).length;

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

  return (
    <Card>
      <CardBar>
        <Buscador
          placeholder="Buscar contraparte"
          aria-label="Buscar contraparte"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-8 text-[12.5px]"
        />
        <FilterTabs
          label="Filtro"
          value={filtro}
          onChange={setFiltro}
          options={[
            { value: "con_saldo", label: "Con saldo", cuenta: conSaldo },
            { value: "cerradas", label: "Cerradas", cuenta: cerradas },
            { value: "todas", label: "Todas", cuenta: cuentas.length },
          ]}
        />
        <span className="ml-auto t-num text-[11.5px] text-ink-4">
          {visibles.length} {visibles.length === 1 ? "resultado" : "resultados"}
        </span>
      </CardBar>

      {visibles.length === 0 ? (
        <Vacio
          titulo="Ninguna cuenta coincide"
          texto={
            q
              ? `No encontramos una contraparte que contenga «${q}».`
              : "Probá con otro filtro para ver más cuentas."
          }
        />
      ) : (
        <TablaShell minWidth={880}>
          <thead>
            <tr className="border-b border-line bg-raised">
              <Th>Contraparte</Th>
              {MONEDAS.map((m) => (
                <Th key={m} derecha>{m}</Th>
              ))}
              <Th>Último movimiento</Th>
              <Th>Estado</Th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((c) => (
              <tr key={c.id} className="border-b border-line-soft last:border-0 hover:bg-raised group">
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <Link
                    href={`/cuentas/${c.id}`}
                    className="text-[13.5px] font-semibold text-ink group-hover:text-brand"
                  >
                    {c.nombre}
                  </Link>
                  <span className="ml-2 t-num text-[10.5px] text-ink-4">
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

                <td className="px-4 py-2.5 whitespace-nowrap t-num text-[12px] text-ink-3">
                  {c.ultimoMovimiento ? fmtFecha(c.ultimoMovimiento) : <SinValor />}
                </td>

                <td className="px-4 py-2.5 whitespace-nowrap">
                  {c.cerrada ? (
                    <Estado tono="pos">Cerrada</Estado>
                  ) : c.ultimoCierre ? (
                    <Estado tono="neutral">Cerró {fmtFecha(c.ultimoCierre)}</Estado>
                  ) : (
                    <Estado tono="brand">Abierta</Estado>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </TablaShell>
      )}
    </Card>
  );
}
