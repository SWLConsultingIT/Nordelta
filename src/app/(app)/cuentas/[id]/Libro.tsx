"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import {
  Badge, Button, Card, CardBar, Dato, Field, Input, Monto, Panel,
  Segmented, SinValor, Toggle, Vacio, cx,
} from "@/components/ui";
import { MONEDAS, type Categoria, type MedioPago, type Moneda } from "@/lib/domain/types";
import { ETIQUETA_CATEGORIA, ETIQUETA_MEDIO } from "@/lib/domain/parseo";
import { fmtFecha, fmtMonto, fmtPct } from "@/lib/format";
import { editarMovimiento } from "./acciones";

export interface PartidaLibro {
  medio_pago: MedioPago;
  moneda_nominal: Moneda;
  monto_nominal: number;
  tipo_cambio: number | null;
  comision_pct: number | null;
  moneda_impacto: Moneda;
  monto_impacto: number;
}

export interface FilaLibro {
  id: string;
  fecha: string;
  oficina: string;
  concepto: string;
  categoria: Categoria;
  delta: Partial<Record<Moneda, number>>;
  saldo: Record<Moneda, number>;
  esCierre: boolean;
  partidas: PartidaLibro[];
}

const TONO_CATEGORIA: Partial<Record<Categoria, "pos" | "neg" | "warn" | "brand" | "neutral">> = {
  ingreso: "pos",
  pago_proveedor: "neg",
  full_pago: "brand",
  ajuste_cierre: "warn",
};

export function Libro({ filas, contraparte }: { filas: FilaLibro[]; contraparte: string }) {
  const saldoFinal = filas.at(-1)?.saldo ?? { ARS: 0, USD: 0, EUR: 0, BRL: 0 };
  const conSaldo = MONEDAS.filter((m) => saldoFinal[m] !== 0);
  const hayCierre = filas.some((f) => f.esCierre);

  const [moneda, setMoneda] = useState<Moneda>(conSaldo[0] ?? "ARS");
  const [soloDesdeCierre, setSoloDesdeCierre] = useState(false);
  const [abierto, setAbierto] = useState<FilaLibro | null>(null);

  const visibles = useMemo(() => {
    if (!soloDesdeCierre) return filas;
    const i = filas.reduce((acc, f, idx) => (f.esCierre ? idx : acc), -1);
    return i >= 0 ? filas.slice(i + 1) : filas;
  }, [filas, soloDesdeCierre]);

  // Solo se listan las monedas que esta cuenta usó alguna vez: no tiene
  // sentido ofrecer reales en una cuenta que nunca operó en reales.
  const monedasUsadas = useMemo(() => {
    const usadas = new Set<Moneda>();
    for (const f of filas) for (const m of MONEDAS) if (f.delta[m]) usadas.add(m);
    return MONEDAS.filter((m) => usadas.has(m));
  }, [filas]);

  return (
    <>
      {/* Saldos por moneda */}
      <div
        className="grid gap-3 mb-5"
        style={{ gridTemplateColumns: "repeat(auto-fit,minmax(186px,1fr))" }}
      >
        {(conSaldo.length > 0 ? conSaldo : (["ARS"] as Moneda[])).map((m) => {
          const v = saldoFinal[m];
          return (
            <div key={m} className="bg-surface border border-line rounded-xl px-4 py-3.5 shadow-e2">
              <span className="label-mono">Saldo {m}</span>
              <div className="mt-1">
                {v === 0 ? (
                  <span className="font-mono text-[23px] text-ink-4">—</span>
                ) : (
                  <Monto
                    valor={v}
                    moneda={m}
                    tamano="grande"
                    className={cx(
                      "text-[23px] font-semibold tracking-[-0.028em]",
                      v > 0 ? "text-pos" : "text-neg",
                    )}
                  />
                )}
              </div>
              <span className="text-[11.5px] text-ink-4">
                {v === 0 ? "Sin saldo" : v > 0 ? "Nos deben" : "Le debemos"}
              </span>
            </div>
          );
        })}
        {conSaldo.length === 0 && filas.length > 0 && (
          <div className="bg-pos-wash border border-pos/25 rounded-xl px-4 py-3.5 flex flex-col justify-center">
            <span className="label-mono !text-pos">Estado</span>
            <span className="text-[15px] font-semibold text-pos mt-1">Cuenta cerrada</span>
            <span className="text-[11.5px] text-pos/80">Las cuatro monedas en cero</span>
          </div>
        )}
      </div>

      <Card>
        <CardBar>
          {monedasUsadas.length > 1 && (
            <Segmented
              label="Moneda"
              value={moneda}
              onChange={setMoneda}
              options={monedasUsadas.map((m) => ({ value: m, label: m }))}
            />
          )}
          <div className="ml-auto flex items-center gap-4">
            {hayCierre ? (
              <Toggle checked={soloDesdeCierre} onChange={setSoloDesdeCierre}>
                Desde el último cierre
              </Toggle>
            ) : (
              <span className="font-mono text-[11px] text-ink-4">Sin cierres registrados</span>
            )}
            <span className="font-mono text-[11px] text-ink-3 tabular-nums whitespace-nowrap">
              {visibles.length} mov.
            </span>
          </div>
        </CardBar>

        {visibles.length === 0 ? (
          <Vacio
            titulo="Sin movimientos posteriores al cierre"
            texto={`${contraparte} cerró su cuenta y todavía no volvió a operar.`}
            accion={
              <Button size="sm" onClick={() => setSoloDesdeCierre(false)}>
                Ver todo el historial
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] min-w-[760px]">
              <thead>
                <tr className="border-b border-line bg-raised">
                  <th className="text-left label-mono font-medium px-4 py-2.5">Fecha</th>
                  <th className="text-left label-mono font-medium px-4 py-2.5">Detalle</th>
                  <th className="text-left label-mono font-medium px-4 py-2.5">Tipo</th>
                  <th className="text-right label-mono font-medium px-4 py-2.5 whitespace-nowrap">
                    Impacto {moneda}
                  </th>
                  <th className="text-right label-mono font-medium px-4 py-2.5 whitespace-nowrap">
                    Saldo {moneda}
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((f) => (
                  <Fragment key={f.id}>
                    <FilaMovimiento fila={f} moneda={moneda} onAbrir={() => setAbierto(f)} />
                    {/* El cierre es un evento, no un movimiento financiero: va
                        como un corte en el hilo del libro, después de la
                        operación que dejó las cuatro monedas en cero. */}
                    {f.esCierre && (
                      <tr aria-label={`Cuenta cerrada el ${fmtFecha(f.fecha)}`}>
                        <td colSpan={5} className="px-4 py-0">
                          <div className="flex items-center gap-3 py-2.5">
                            <span className="h-px flex-1 bg-pos/30" />
                            <span className="flex items-center gap-2 font-mono text-[10.5px]
                                             tracking-[0.12em] uppercase text-pos whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-pos" />
                              Cuenta cerrada · {fmtFecha(f.fecha)}
                            </span>
                            <span className="h-px flex-1 bg-pos/30" />
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="mt-4 text-[12.5px] text-ink-3 max-w-[82ch]">
        El saldo se recalcula al consultarlo, así que está siempre al día — no
        hay ningún botón que tarde minutos.{" "}
        <span className="text-ink-2 font-medium">
          Tocá una fila para ver de qué partidas está compuesta.
        </span>
      </p>

      <DetalleMovimiento
        fila={abierto}
        contraparte={contraparte}
        onCerrar={() => setAbierto(null)}
      />
    </>
  );
}

function FilaMovimiento({
  fila,
  moneda,
  onAbrir,
}: {
  fila: FilaLibro;
  moneda: Moneda;
  onAbrir: () => void;
}) {
  const d = fila.delta[moneda] ?? 0;
  const s = fila.saldo[moneda];
  const tono = TONO_CATEGORIA[fila.categoria] ?? "neutral";

  return (
    <tr
      onClick={onAbrir}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onAbrir(); }
      }}
      className={cx(
        "border-b border-line-soft last:border-0 cursor-pointer",
        fila.esCierre ? "bg-pos-wash/40" : "hover:bg-raised",
      )}
    >
      <td className="px-4 py-2.5 font-mono text-[12px] whitespace-nowrap text-ink-3">
        {fmtFecha(fila.fecha)}
      </td>
      <td className="px-4 py-2.5 min-w-0">
        <span className="text-ink font-medium">{fila.concepto}</span>
        <span className="ml-2 font-mono text-[10.5px] text-ink-4">{fila.oficina}</span>
        {fila.partidas.length > 1 && (
          <span className="ml-2 font-mono text-[10px] text-brand bg-brand-wash px-1 rounded">
            {fila.partidas.length} partidas
          </span>
        )}
      </td>
      <td className="px-4 py-2.5 whitespace-nowrap">
        <Badge tone={tono}>{ETIQUETA_CATEGORIA[fila.categoria]}</Badge>
      </td>
      <td className="px-4 py-2.5 text-right">
        {d === 0 ? (
          <SinValor />
        ) : (
          <Monto valor={d} moneda={moneda} conSigno className={d < 0 ? "text-neg" : "text-pos"} />
        )}
      </td>
      <td className="px-4 py-2.5 text-right">
        <Monto
          valor={s}
          moneda={moneda}
          className={cx("font-semibold", s < 0 ? "text-neg" : d === 0 ? "text-ink-2" : "text-ink")}
        />
      </td>
    </tr>
  );
}

/* ── Detalle del movimiento ─────────────────────────────────── */

function DetalleMovimiento({
  fila,
  contraparte,
  onCerrar,
}: {
  fila: FilaLibro | null;
  contraparte: string;
  onCerrar: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [concepto, setConcepto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, guardar] = useTransition();

  if (!fila) return null;

  function abrirEdicion() {
    setConcepto(fila!.concepto);
    setMotivo("");
    setError(null);
    setEditando(true);
  }

  function confirmar() {
    setError(null);
    guardar(async () => {
      const r = await editarMovimiento(fila!.id, { concepto }, motivo || undefined);
      if (!r.ok) { setError(r.mensaje); return; }
      setEditando(false);
      onCerrar();
    });
  }

  return (
    <Panel
      abierto
      onCerrar={onCerrar}
      titulo={fila.concepto}
      subtitulo={`${contraparte} · ${fmtFecha(fila.fecha)} · ${fila.oficina}`}
      pie={
        editando ? (
          <>
            <Button variant="primary" size="sm" disabled={guardando || !concepto.trim()} onClick={confirmar}>
              {guardando ? "Guardando…" : "Guardar cambios"}
            </Button>
            <Button size="sm" onClick={() => setEditando(false)}>Cancelar</Button>
            {error && <span role="alert" className="text-[12.5px] text-neg self-center">{error}</span>}
          </>
        ) : (
          <>
            <Button size="sm" onClick={abrirEdicion}>Editar detalle</Button>
            <Button size="sm" onClick={onCerrar}>Cerrar</Button>
          </>
        )
      }
    >
      <div className="px-5 py-4">
        {editando ? (
          <div className="flex flex-col gap-4">
            <Field label="Detalle">
              <Input value={concepto} onChange={(e) => setConcepto(e.target.value)} className="h-10" autoFocus />
            </Field>
            <Field label="Motivo del cambio">
              <Input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Queda registrado en la auditoría"
                className="h-10"
              />
            </Field>
            <p className="text-[12.5px] text-ink-3 leading-relaxed">
              El cambio se registra con tu usuario, el valor anterior y el
              nuevo. Los importes no se editan desde acá: corregir una partida
              es una operación distinta y de más riesgo.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-5">
              <Dato etiqueta="Fecha">{fmtFecha(fila.fecha)}</Dato>
              <Dato etiqueta="Oficina">{fila.oficina}</Dato>
              <Dato etiqueta="Contraparte">{contraparte}</Dato>
              <Dato etiqueta="Categoría">
                <Badge tone={TONO_CATEGORIA[fila.categoria] ?? "neutral"}>
                  {ETIQUETA_CATEGORIA[fila.categoria]}
                </Badge>
              </Dato>
            </div>

            <span className="label-mono">
              {fila.partidas.length === 1 ? "Partida" : `${fila.partidas.length} partidas`}
            </span>
            <div className="mt-2 flex flex-col gap-2">
              {fila.partidas.map((p, i) => {
                const convirtio = p.moneda_impacto !== p.moneda_nominal;
                return (
                  <div key={i} className="border border-line rounded-lg bg-raised px-3.5 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge tone="neutral">{ETIQUETA_MEDIO[p.medio_pago]}</Badge>
                      <span className="font-mono text-[10.5px] text-ink-3">{p.moneda_nominal}</span>
                      {convirtio && <Badge tone="brand">convertido</Badge>}
                    </div>

                    <div className="mt-2.5 grid gap-y-1.5 text-[12.5px]"
                         style={{ gridTemplateColumns: "auto 1fr" }}>
                      <span className="text-ink-3 pr-4">Monto nominal</span>
                      <span className="text-right">
                        <Monto valor={p.monto_nominal} moneda={p.moneda_nominal} />
                      </span>

                      {p.tipo_cambio !== null && (
                        <>
                          <span className="text-ink-3 pr-4">Tipo de cambio</span>
                          <span className="text-right font-mono tnum text-ink">
                            {fmtMonto(p.tipo_cambio)}
                          </span>
                        </>
                      )}
                      {p.comision_pct !== null && p.comision_pct !== 0 && (
                        <>
                          <span className="text-ink-3 pr-4">Comisión</span>
                          <span className="text-right font-mono tnum text-ink">
                            {fmtPct(p.comision_pct)}
                          </span>
                        </>
                      )}

                      <span className="text-brand font-medium pr-4 pt-1.5 border-t border-line mt-1">
                        Impacta la cuenta
                      </span>
                      <span className="text-right pt-1.5 border-t border-line mt-1">
                        <Monto
                          valor={p.monto_impacto}
                          moneda={p.moneda_impacto}
                          className={cx("font-semibold", p.monto_impacto < 0 ? "text-neg" : "text-brand")}
                        />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {fila.partidas.length > 1 && (
              <p className="mt-3 text-[12.5px] text-ink-3 leading-relaxed">
                Cada partida resuelve su moneda por separado, así que ninguna
                puede perderse porque otra de la misma operación tenga tipo de
                cambio.
              </p>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}
