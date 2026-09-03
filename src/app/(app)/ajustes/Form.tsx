"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardBar, Cifra, Field, Input, cx } from "@/components/ui";
import { MONEDAS, type Moneda } from "@/lib/domain/types";
import { fmtMonto, parseMonto, partirMonto } from "@/lib/format";
import { registrarAjuste } from "./acciones";

export interface SaldoContraparte {
  id: number;
  nombre: string;
  saldo: Record<Moneda, number>;
}

type Montos = Record<Moneda, string>;
const VACIO: Montos = { ARS: "", USD: "", EUR: "", BRL: "" };

export function FormAjuste({
  saldos,
  oficinaId,
  fecha,
}: {
  saldos: SaldoContraparte[];
  oficinaId: number;
  fecha: string;
}) {
  const router = useRouter();
  const [enviando, enviar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [id, setId] = useState<number | null>(null);
  const [montos, setMontos] = useState<Montos>(VACIO);
  const [concepto, setConcepto] = useState("");
  const [enviado, setEnviado] = useState<string | null>(null);

  const elegida = saldos.find((s) => s.id === id) ?? null;

  /** El ajuste que llevaría cada moneda a cero es el negativo del saldo. */
  const paraCerrar = useMemo<Montos>(() => {
    if (!elegida) return VACIO;
    const out = { ...VACIO };
    for (const m of MONEDAS) if (elegida.saldo[m]) out[m] = String(-elegida.saldo[m]);
    return out;
  }, [elegida]);

  const invalidas = MONEDAS.filter((m) => parseMonto(montos[m]) === null);

  /** Saldo que quedaría después de aplicar lo que está cargado. */
  const resultante = useMemo(() => {
    const out = {} as Record<Moneda, number>;
    for (const m of MONEDAS) {
      const v = parseMonto(montos[m]);
      out[m] = (elegida?.saldo[m] ?? 0) + (v ?? 0);
    }
    return out;
  }, [elegida, montos]);

  const quedaEnCero = elegida !== null && MONEDAS.every((m) => resultante[m] === 0);
  const hayAlgo = MONEDAS.some((m) => (parseMonto(montos[m]) ?? 0) !== 0);
  const puedeGuardar = elegida !== null && hayAlgo && invalidas.length === 0;

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
      <Card>
        <CardBar>
          <span className="label-mono">Nuevo ajuste</span>
        </CardBar>

        <div className="p-4 flex flex-col gap-4">
          <Field label="Contraparte">
            <select
              value={id ?? ""}
              onChange={(e) => {
                const v = e.target.value ? Number(e.target.value) : null;
                setId(v);
                setMontos(VACIO);
                setEnviado(null);
                setError(null);
              }}
              className="h-9 rounded-lg bg-surface border border-line px-2.5 text-[13.5px] text-ink shadow-e1 focus:border-brand"
            >
              <option value="">Elegí una contraparte…</option>
              {saldos.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          </Field>

          {elegida && (
            <>
              {/* Saldo actual */}
              <div>
                <span className="label-mono">Saldo actual</span>
                <div className="mt-1.5 grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))" }}>
                  {MONEDAS.map((m) => {
                    const v = elegida.saldo[m];
                    const { entero, decimal } = partirMonto(v, m);
                    return (
                      <div key={m} className="bg-raised border border-line rounded-lg px-3 py-2">
                        <span className="label-mono">{m}</span>
                        <div>
                          <Cifra
                            entero={entero}
                            decimal={decimal}
                            className={cx("text-[15px] font-semibold", v > 0 ? "text-pos" : v < 0 ? "text-neg" : "text-ink-4")}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  onClick={() => { setMontos(paraCerrar); setEnviado(null); setError(null); }}
                  disabled={MONEDAS.every((m) => !elegida.saldo[m])}
                >
                  Llevar el saldo a cero
                </Button>
                <span className="text-[12.5px] text-ink-3">
                  Completa el ajuste con el negativo de cada saldo.
                </span>
              </div>

              {/* Montos del ajuste */}
              <div>
                <span className="label-mono">Monto del ajuste</span>
                <div className="mt-1.5 grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))" }}>
                  {MONEDAS.map((m) => {
                    const malo = parseMonto(montos[m]) === null;
                    return (
                      <label key={m} className="flex flex-col gap-1">
                        <span className="font-mono text-[10px] tracking-wider text-ink-3">{m}</span>
                        <input
                          inputMode="decimal"
                          placeholder="0,00"
                          value={montos[m]}
                          onChange={(e) => { setMontos({ ...montos, [m]: e.target.value }); setEnviado(null); setError(null); }}
                          className={cx(
                            "h-9 rounded-lg border px-2.5 text-[13.5px] font-mono tnum text-right shadow-e1",
                            malo ? "bg-neg-wash border-neg text-neg" : "bg-surface border-line text-ink focus:border-brand",
                          )}
                        />
                      </label>
                    );
                  })}
                </div>
                {invalidas.length > 0 && (
                  <p role="alert" className="mt-2 text-[12.5px] text-neg">
                    {invalidas.join(", ")}: eso no es un número. La base no lo va a aceptar.
                  </p>
                )}
              </div>

              <Field label="Concepto">
                <Input
                  placeholder="Cierre de cuenta corriente"
                  value={concepto}
                  onChange={(e) => setConcepto(e.target.value)}
                />
              </Field>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button
                  variant="primary"
                  disabled={!puedeGuardar || enviando}
                  onClick={() => {
                    setError(null);
                    setEnviado(null);
                    enviar(async () => {
                      // Se manda el saldo a cancelar; la acción invierte el
                      // signo y arma el asiento. La pantalla nunca toca un saldo.
                      const aCancelar: Partial<Record<Moneda, number>> = {};
                      for (const m of MONEDAS) {
                        const v = parseMonto(montos[m]);
                        if (v) aCancelar[m] = -v;
                      }
                      const r = await registrarAjuste({
                        contraparteId: elegida.id,
                        oficinaId,
                        fecha,
                        concepto,
                        montos: aCancelar,
                      });
                      if (!r.ok) {
                        setError(r.mensaje);
                        return;
                      }
                      setMontos(VACIO);
                      setEnviado(
                        r.datos.patas === 1
                          ? "Ajuste registrado con 1 partida."
                          : `Ajuste registrado con ${r.datos.patas} partidas.`,
                      );
                      router.refresh();
                    });
                  }}
                >
                  {enviando ? "Registrando…" : "Registrar ajuste"}
                </Button>

                {enviado && (
                  <span role="status" aria-live="polite"
                        className="flex items-center gap-2 text-[13px] text-pos font-medium">
                    <span className="w-[7px] h-[7px] rounded-full bg-pos" />
                    {enviado}
                  </span>
                )}
                {error && (
                  <span role="alert"
                        className="flex items-center gap-2 text-[13px] text-neg font-medium">
                    <span className="w-[7px] h-[7px] rounded-full bg-neg" />
                    {error}
                  </span>
                )}
              </div>
            </>
          )}

          {!elegida && (
            <p className="text-[13px] text-ink-3 py-6 text-center">
              Elegí una contraparte para ver su saldo y cargar el ajuste.
            </p>
          )}
        </div>
      </Card>

      {/* Previsualización del resultado */}
      <Card>
        <CardBar>
          <span className="label-mono">Cómo queda</span>
        </CardBar>
        {elegida ? (
          <>
            <ul className="divide-y divide-line-soft">
              {MONEDAS.map((m) => {
                const antes = elegida.saldo[m];
                const despues = resultante[m];
                if (!antes && !despues) return null;
                return (
                  <li key={m} className="px-4 py-3 flex items-center gap-3 text-[13px]">
                    <span className="font-mono text-[10px] tracking-wider text-ink-3 w-9">{m}</span>
                    <span className="font-mono tnum text-ink-3">{fmtMonto(antes, m)}</span>
                    <span className="text-ink-4">→</span>
                    <span
                      className={cx(
                        "font-mono tnum ml-auto font-semibold",
                        despues === 0 ? "text-pos" : despues < 0 ? "text-neg" : "text-ink",
                      )}
                    >
                      {fmtMonto(despues, m)}
                    </span>
                  </li>
                );
              })}
              {MONEDAS.every((m) => !elegida.saldo[m] && !resultante[m]) && (
                <li className="px-4 py-6 text-center text-[13px] text-ink-3">
                  Esta cuenta ya está en cero.
                </li>
              )}
            </ul>

            <div
              className={cx(
                "px-4 py-3 border-t text-[12.5px]",
                quedaEnCero ? "bg-pos-wash border-pos/25 text-pos" : "bg-raised border-line text-ink-3",
              )}
            >
              {quedaEnCero ? (
                <>
                  <span className="font-semibold">La cuenta queda cerrada.</span> Las cuatro
                  monedas dan cero, así que el sistema va a marcar el cierre solo.
                </>
              ) : (
                <>El cierre se marca cuando las cuatro monedas queden en cero al mismo tiempo.</>
              )}
            </div>
          </>
        ) : (
          <p className="px-4 py-8 text-center text-[13px] text-ink-3">
            Sin contraparte elegida.
          </p>
        )}
      </Card>
    </div>
  );
}
