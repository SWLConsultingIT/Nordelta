"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Badge, Button, Card, CardBar, Field, Input, Monto, SinValor, Vacio, cx,
} from "@/components/ui";
import { IcoArrow } from "@/components/ui/icons";
import { MONEDAS, type Moneda } from "@/lib/domain/types";
import type { Oficina } from "@/lib/domain/types";
import { fmtFecha, parseMonto } from "@/lib/format";
import { registrarAjuste } from "./acciones";

export interface CuentaAjustable {
  id: number;
  nombre: string;
  saldo: Record<Moneda, number>;
  cerrada: boolean;
}

type Montos = Record<Moneda, string>;
const VACIO: Montos = { ARS: "", USD: "", EUR: "", BRL: "" };

/**
 * Flujo del ajuste:
 *
 *   elegir contraparte → ver saldo → el sistema propone el asiento →
 *   previsualizar el resultado → confirmar
 *
 * El paso de previsualización es el que importa: antes de guardar, se ve
 * exactamente qué saldo va a quedar en cada moneda.
 */
export function FormAjuste({
  cuentas,
  oficinas,
  fecha,
}: {
  cuentas: CuentaAjustable[];
  oficinas: Oficina[];
  fecha: string;
}) {
  const router = useRouter();
  const [id, setId] = useState<number | null>(null);
  const [oficinaId, setOficinaId] = useState(oficinas[0]?.id ?? 1);
  const [montos, setMontos] = useState<Montos>(VACIO);
  const [concepto, setConcepto] = useState("");
  const [hecho, setHecho] = useState<{ patas: number; contraparte: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, guardar] = useTransition();

  const elegida = cuentas.find((c) => c.id === id) ?? null;
  const conSaldo = useMemo(
    () => cuentas.filter((c) => MONEDAS.some((m) => c.saldo[m] !== 0)),
    [cuentas],
  );

  /** El ajuste que lleva cada moneda a cero es el negativo del saldo. */
  const propuesta = useMemo<Montos>(() => {
    if (!elegida) return VACIO;
    const out = { ...VACIO };
    for (const m of MONEDAS) if (elegida.saldo[m]) out[m] = String(-elegida.saldo[m]);
    return out;
  }, [elegida]);

  const invalidas = MONEDAS.filter((m) => parseMonto(montos[m]) === null);

  const resultante = useMemo(() => {
    const out = {} as Record<Moneda, number>;
    for (const m of MONEDAS) {
      out[m] = (elegida?.saldo[m] ?? 0) + (parseMonto(montos[m]) ?? 0);
    }
    return out;
  }, [elegida, montos]);

  const quedaEnCero = elegida !== null && MONEDAS.every((m) => resultante[m] === 0);
  const hayAlgo = MONEDAS.some((m) => (parseMonto(montos[m]) ?? 0) !== 0);
  const puedeGuardar = elegida !== null && hayAlgo && invalidas.length === 0;

  function elegir(v: number | null) {
    setId(v);
    setMontos(VACIO);
    setConcepto("");
    setHecho(null);
    setError(null);
  }

  function confirmar() {
    if (!elegida) return;
    setError(null);
    setHecho(null);
    guardar(async () => {
      // Se manda el saldo a cancelar; la acción invierte el signo y arma el
      // asiento. La pantalla nunca toca un saldo.
      const aCancelar: Partial<Record<Moneda, number>> = {};
      for (const m of MONEDAS) {
        const v = parseMonto(montos[m]);
        if (v) aCancelar[m] = -v;
      }
      const r = await registrarAjuste({
        contraparteId: elegida.id, oficinaId, fecha, concepto, montos: aCancelar,
      });
      if (!r.ok) { setError(r.mensaje); return; }
      setHecho({ patas: r.datos.patas, contraparte: elegida.id });
      setMontos(VACIO);
      router.refresh();
    });
  }

  if (conSaldo.length === 0) {
    return (
      <Card>
        <Vacio
          titulo="No hay cuentas con saldo"
          texto="Todas las cuentas están en cero, así que no hay nada que ajustar."
          accion={<Link href="/cuentas"><Button size="sm">Ver cuentas</Button></Link>}
        />
      </Card>
    );
  }

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_368px] gap-5 items-start">
      <Card>
        <CardBar>
          <span className="label-mono">Nuevo ajuste</span>
          {elegida && (
            <span className="ml-auto font-mono text-[11px] text-ink-3">
              {fmtFecha(fecha)}
            </span>
          )}
        </CardBar>

        <div className="p-4 flex flex-col gap-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Contraparte">
              <select
                value={id ?? ""}
                onChange={(e) => elegir(e.target.value ? Number(e.target.value) : null)}
                className="h-9 rounded-lg bg-surface border border-line px-2.5 text-[13.5px]
                           text-ink shadow-e1 focus:border-brand"
              >
                <option value="">Elegí una contraparte…</option>
                {conSaldo.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </Field>

            <Field label="Oficina">
              <select
                value={oficinaId}
                onChange={(e) => setOficinaId(Number(e.target.value))}
                className="h-9 rounded-lg bg-surface border border-line px-2.5 text-[13.5px]
                           text-ink shadow-e1 focus:border-brand"
              >
                {oficinas.map((o) => (
                  <option key={o.id} value={o.id}>{o.nombre}</option>
                ))}
              </select>
            </Field>
          </div>

          {!elegida ? (
            <p className="text-[13px] text-ink-3 py-8 text-center">
              Elegí una contraparte para ver su saldo y armar el ajuste.
            </p>
          ) : (
            <>
              <div>
                <span className="label-mono">Saldo actual</span>
                <div className="mt-1.5 grid gap-2"
                     style={{ gridTemplateColumns: "repeat(auto-fit,minmax(132px,1fr))" }}>
                  {MONEDAS.map((m) => {
                    const v = elegida.saldo[m];
                    return (
                      <div key={m} className="bg-raised border border-line rounded-lg px-3 py-2">
                        <span className="label-mono">{m}</span>
                        <div className="mt-0.5">
                          {v === 0 ? (
                            <SinValor />
                          ) : (
                            <Monto valor={v} moneda={m}
                                   className={cx("text-[15px] font-semibold",
                                                 v > 0 ? "text-pos" : "text-neg")} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm" variant="primary" onClick={() => { setMontos(propuesta); setHecho(null); }}>
                  Proponer ajuste a cero
                </Button>
                <span className="text-[12.5px] text-ink-3">
                  Completa el asiento con el negativo de cada saldo.
                </span>
              </div>

              <div>
                <span className="label-mono">Monto del ajuste</span>
                <div className="mt-1.5 grid gap-2"
                     style={{ gridTemplateColumns: "repeat(auto-fit,minmax(148px,1fr))" }}>
                  {MONEDAS.map((m) => {
                    const malo = parseMonto(montos[m]) === null;
                    const aplica = elegida.saldo[m] !== 0 || montos[m] !== "";
                    return (
                      <label key={m} className="flex flex-col gap-1">
                        <span className={cx("font-mono text-[10px] tracking-wider",
                                            aplica ? "text-ink-3" : "text-ink-4")}>
                          {m}
                        </span>
                        <input
                          inputMode="decimal"
                          placeholder={aplica ? "0,00" : "—"}
                          value={montos[m]}
                          onChange={(e) => { setMontos({ ...montos, [m]: e.target.value }); setHecho(null); }}
                          className={cx(
                            "h-9 rounded-lg border px-2.5 text-[13.5px] font-mono tnum text-right shadow-e1",
                            malo
                              ? "bg-neg-wash border-neg text-neg"
                              : "bg-surface border-line text-ink focus:border-brand",
                          )}
                        />
                      </label>
                    );
                  })}
                </div>
                {invalidas.length > 0 && (
                  <p role="alert" className="mt-2 text-[12.5px] text-neg">
                    {invalidas.join(", ")}: eso no es un número.
                  </p>
                )}
              </div>

              <Field label="Detalle del asiento">
                <Input
                  placeholder="Cierre de cuenta corriente"
                  value={concepto}
                  onChange={(e) => setConcepto(e.target.value)}
                />
              </Field>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button variant="primary" disabled={!puedeGuardar || guardando} onClick={confirmar}>
                  {guardando ? "Registrando…" : "Registrar ajuste"}
                </Button>

                {hecho && (
                  <span role="status" aria-live="polite"
                        className="flex items-center gap-2 text-[13px] text-pos font-medium">
                    <span className="w-[7px] h-[7px] rounded-full bg-pos" />
                    Ajuste registrado con {hecho.patas === 1 ? "1 partida" : `${hecho.patas} partidas`}
                    <Link href={`/cuentas/${hecho.contraparte}`}
                          className="text-brand hover:underline inline-flex items-center gap-1">
                      Ver la cuenta <IcoArrow className="w-3.5 h-3.5" />
                    </Link>
                  </span>
                )}
                {error && (
                  <span role="alert" className="flex items-center gap-2 text-[13px] text-neg font-medium">
                    <span className="w-[7px] h-[7px] rounded-full bg-neg" />
                    {error}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Previsualización */}
      <Card>
        <CardBar>
          <span className="label-mono">Cómo queda</span>
        </CardBar>

        {!elegida ? (
          <Vacio titulo="Sin contraparte elegida" texto="La previsualización aparece acá." />
        ) : (
          <>
            <div className="px-4 pt-3.5 pb-1 grid text-[10px] font-mono tracking-[0.1em]
                            uppercase text-ink-4"
                 style={{ gridTemplateColumns: "34px 1fr 14px 1fr 14px 1fr" }}>
              <span />
              <span className="text-right">Actual</span>
              <span />
              <span className="text-right">Ajuste</span>
              <span />
              <span className="text-right">Queda</span>
            </div>

            <ul className="divide-y divide-line-soft">
              {MONEDAS.map((m) => {
                const antes = elegida.saldo[m];
                const ajuste = parseMonto(montos[m]) ?? 0;
                const despues = resultante[m];
                if (antes === 0 && ajuste === 0) return null;
                return (
                  <li key={m} className="px-4 py-2.5 grid items-baseline gap-x-1 text-[12.5px]"
                      style={{ gridTemplateColumns: "34px 1fr 14px 1fr 14px 1fr" }}>
                    <span className="font-mono text-[10px] tracking-wider text-ink-3">{m}</span>
                    <span className="text-right font-mono tnum text-ink-3">
                      {antes === 0 ? "—" : antes.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-center text-ink-4">→</span>
                    <span className={cx("text-right font-mono tnum",
                                        ajuste === 0 ? "text-ink-4" : "text-brand")}>
                      {ajuste === 0 ? "—" : ajuste.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-center text-ink-4">→</span>
                    <span className={cx("text-right font-mono tnum font-semibold",
                                        despues === 0 ? "text-pos" : despues < 0 ? "text-neg" : "text-ink")}>
                      {despues.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className={cx(
              "px-4 py-3 border-t text-[12.5px] leading-relaxed",
              quedaEnCero ? "bg-pos-wash border-pos/25 text-pos" : "bg-raised border-line text-ink-3",
            )}>
              {quedaEnCero ? (
                <>
                  <span className="font-semibold">La cuenta queda cerrada.</span> Las cuatro
                  monedas dan cero, así que el cierre se va a marcar solo en el
                  libro de la cuenta.
                </>
              ) : hayAlgo ? (
                <>Todavía queda saldo en alguna moneda: el cierre se marca cuando las cuatro dan cero.</>
              ) : (
                <>Cargá el ajuste, o usá <span className="text-ink-2 font-medium">Proponer ajuste a cero</span>.</>
              )}
            </div>

            {elegida.cerrada && (
              <div className="px-4 py-2.5 border-t border-line">
                <Badge tone="pos">Esta cuenta ya estaba cerrada</Badge>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
