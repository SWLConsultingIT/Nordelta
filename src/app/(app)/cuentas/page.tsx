import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardBar, Cifra, PageHead, cx } from "@/components/ui";
import { IcoArrow } from "@/components/ui/icons";
import { getContrapartes, getTodosLosMovimientos } from "@/lib/data";
import { construirCtaCte, saldoFinal } from "@/lib/domain/saldos";
import { MONEDAS } from "@/lib/domain/types";
import { partirMonto } from "@/lib/format";

export const metadata: Metadata = { title: "Contrapartes" };

export default async function CuentasPage() {
  const [contrapartes, movimientos] = await Promise.all([
    getContrapartes(),
    getTodosLosMovimientos(),
  ]);

  const conSaldo = contrapartes.map((c) => {
    const propios = movimientos.filter((m) => m.contraparte_id === c.id);
    return { ...c, saldo: saldoFinal(construirCtaCte(propios)), movimientos: propios.length };
  });

  return (
    <>
      <PageHead title="Contrapartes" sub="Clientes y proveedores. Comparten un mismo directorio, igual que en el sistema actual." />

      <Card>
        <CardBar>
          <span className="label-mono">{conSaldo.length} contrapartes activas</span>
        </CardBar>
        <ul className="divide-y divide-line-soft">
          {conSaldo.map((c) => (
            <li key={c.id}>
              <Link href={`/cuentas/${c.id}`} className="flex flex-wrap items-center gap-4 px-4 py-3 hover:bg-raised group">
                <span className="w-8 h-8 rounded-full bg-brand-wash text-brand grid place-items-center font-semibold text-[11px] flex-none">
                  {c.nombre.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold text-ink group-hover:text-brand">{c.nombre}</span>
                  <span className="block font-mono text-[11px] text-ink-4">
                    {c.movimientos} {c.movimientos === 1 ? "movimiento" : "movimientos"}
                  </span>
                </span>

                <span className="ml-auto flex flex-wrap items-center gap-4">
                  {MONEDAS.filter((m) => c.saldo[m]).map((m) => {
                    const { entero, decimal } = partirMonto(c.saldo[m], m);
                    return (
                      <span key={m} className="text-right">
                        <span className="block label-mono">{m}</span>
                        <Cifra
                          entero={entero}
                          decimal={decimal}
                          className={cx("text-[13.5px] font-medium", c.saldo[m] < 0 ? "text-neg" : "text-pos")}
                        />
                      </span>
                    );
                  })}
                  {!MONEDAS.some((m) => c.saldo[m]) && (
                    <span className="font-mono text-[11px] text-ink-4">saldo cero</span>
                  )}
                  <IcoArrow className="w-4 h-4 text-ink-4 group-hover:text-brand" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
