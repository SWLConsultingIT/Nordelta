"use client";

import { useMemo, useState } from "react";
import { Badge, Card, CardBar, Cifra, Toggle, cx, Segmented } from "@/components/ui";
import { fmtFecha, partirMonto } from "@/lib/format";
import { MONEDAS, type Categoria, type Moneda } from "@/lib/domain/types";

export interface FilaLibro {
  id: string;
  fecha: string;
  oficina: string;
  concepto: string;
  categoria: Categoria;
  convirtio: boolean;
  delta: Partial<Record<Moneda, number>>;
  saldo: Record<Moneda, number>;
  esCierre: boolean;
}

const ETIQUETA: Record<Categoria, string> = {
  ingreso: "Ingreso",
  pago_proveedor: "Pago proveedor",
  full_pago: "Full pago",
  compra: "Compra",
  venta: "Venta",
  impuesto: "Impuesto",
  ajuste_cierre: "Ajuste",
};

export function LibroCtaCte({ filas }: { filas: FilaLibro[] }) {
  const [soloDesdeCierre, setSoloDesdeCierre] = useState(false);
  const [moneda, setMoneda] = useState<Moneda>(() => {
    const ultimo = filas.at(-1)?.saldo;
    return (MONEDAS.find((m) => ultimo?.[m]) ?? "USD") as Moneda;
  });

  const visibles = useMemo(() => {
    if (!soloDesdeCierre) return filas;
    const i = filas.reduce((acc, f, idx) => (f.esCierre ? idx : acc), -1);
    return i >= 0 ? filas.slice(i + 1) : filas;
  }, [filas, soloDesdeCierre]);

  const saldoFinal = filas.at(-1)?.saldo ?? { ARS: 0, USD: 0, EUR: 0, BRL: 0 };
  const hayCierre = filas.some((f) => f.esCierre);

  return (
    <>
      {/* Saldos por moneda */}
      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))" }}>
        {MONEDAS.map((m) => {
          const v = saldoFinal[m];
          const { entero, decimal } = partirMonto(v, m);
          const principal = m === moneda;
          return (
            <button
              key={m}
              type="button"
              onClick={() => setMoneda(m)}
              className={cx(
                "text-left bg-surface border rounded-xl px-4 py-3.5 transition-shadow relative overflow-hidden",
                principal ? "border-brand-line shadow-e3" : "border-line shadow-e2 hover:shadow-e3",
              )}
            >
              {principal && <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-brand to-brand-hi" />}
              <span className="label-mono">Saldo {m}</span>
              <div className="mt-1">
                <Cifra
                  entero={entero}
                  decimal={decimal}
                  className={cx(
                    "text-[23px] font-semibold tracking-[-0.028em]",
                    v > 0 ? "text-pos" : v < 0 ? "text-neg" : "text-ink-4",
                  )}
                />
              </div>
              <span className="text-[11.5px] text-ink-4">
                {v === 0 ? "Sin saldo" : v > 0 ? "Nos deben" : "Le debemos"}
              </span>
            </button>
          );
        })}
      </div>

      <Card>
        <CardBar>
          <Segmented
            label="Moneda"
            value={moneda}
            onChange={setMoneda}
            options={MONEDAS.map((m) => ({ value: m, label: m }))}
          />
          <div className="ml-auto">
            {hayCierre ? (
              <Toggle checked={soloDesdeCierre} onChange={setSoloDesdeCierre}>
                Solo desde el último cierre
              </Toggle>
            ) : (
              <span className="font-mono text-[11px] text-ink-4">Sin cierres registrados</span>
            )}
          </div>
        </CardBar>

        <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[780px]">
            <thead>
              <tr className="border-b border-line bg-raised">
                <th className="text-left label-mono font-medium px-4 py-2.5">Fecha</th>
                <th className="text-left label-mono font-medium px-4 py-2.5">Oficina</th>
                <th className="text-left label-mono font-medium px-4 py-2.5">Concepto</th>
                <th className="text-left label-mono font-medium px-4 py-2.5">Categoría</th>
                <th className="text-right label-mono font-medium px-4 py-2.5 whitespace-nowrap">Monto {moneda}</th>
                <th className="text-right label-mono font-medium px-4 py-2.5 whitespace-nowrap">Saldo corrido</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((f) => {
                const d = f.delta[moneda] ?? 0;
                const s = f.saldo[moneda];
                return (
                  <tr
                    key={f.id}
                    className={cx(
                      "border-b border-line-soft last:border-0",
                      f.esCierre ? "bg-pos-wash" : "hover:bg-raised",
                    )}
                  >
                    <td className="px-4 py-2.5 font-mono text-[12px] whitespace-nowrap text-ink-3">{fmtFecha(f.fecha)}</td>
                    <td className="px-4 py-2.5 text-ink-3 whitespace-nowrap">{f.oficina}</td>
                    <td className={cx("px-4 py-2.5 font-medium", f.esCierre ? "text-pos" : "text-ink")}>
                      {f.concepto}
                      {f.convirtio && <span className="ml-2"><Badge tone="brand">convertido</Badge></span>}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {f.esCierre ? <Badge tone="pos">Cuenta cerrada</Badge> : <Badge>{ETIQUETA[f.categoria]}</Badge>}
                    </td>
                    <Monto valor={d} moneda={moneda} />
                    <Monto valor={s} moneda={moneda} tenue={!d} />
                  </tr>
                );
              })}
              {visibles.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-ink-3">
                    No hay movimientos posteriores al último cierre.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function Monto({ valor, moneda, tenue }: { valor: number; moneda: Moneda; tenue?: boolean }) {
  if (!valor) return <td className="px-4 py-2.5 text-right font-mono text-ink-4">—</td>;
  const { entero, decimal } = partirMonto(valor, moneda);
  return (
    <td className="px-4 py-2.5 text-right whitespace-nowrap">
      <Cifra entero={entero} decimal={decimal} className={cx(valor < 0 ? "text-neg" : tenue ? "text-ink-2" : "text-ink")} />
    </td>
  );
}
