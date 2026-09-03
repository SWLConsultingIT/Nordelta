"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import {
  Badge, Button, Card, CardBar, CardFoot, Dato, Field, FilterTabs, Input, Monto, Panel,
  SinValor, TablaShell, Th, TiraDeSaldos, Toggle, Vacio, cx,
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
  const cerrada = filas.length > 0 && conSaldo.length === 0;

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

  const movimientosEnMoneda = visibles.filter((f) => (f.delta[moneda] ?? 0) !== 0).length;

  return (
    <>
      {/* Una sola superficie con las cuatro monedas: se comparan de un
          barrido, en lugar de cuatro tarjetas sueltas. */}
      <TiraDeSaldos
        titulo={cerrada ? "Saldo · cuenta cerrada" : "Saldo actual"}
        className="mb-5"
        items={MONEDAS.map((m) => ({
          moneda: m,
          valor: saldoFinal[m],
          nota:
            saldoFinal[m] === 0
              ? "Sin saldo"
              : saldoFinal[m] > 0
                ? "Nos deben"
                : "Le debemos",
        }))}
      />

      <Card>
        <CardBar>
          {monedasUsadas.length > 1 ? (
            <FilterTabs
              label="Moneda del libro"
              value={moneda}
              onChange={setMoneda}
              options={monedasUsadas.map((m) => ({ value: m, label: m }))}
            />
          ) : (
            <span className="t-label">Libro en {moneda}</span>
          )}
          <div className="ml-auto flex items-center gap-4">
            {hayCierre ? (
              <Toggle checked={soloDesdeCierre} onChange={setSoloDesdeCierre}>
                Desde el último cierre
              </Toggle>
            ) : (
              <span className="t-num text-[11.5px] text-ink-4">Sin cierres registrados</span>
            )}
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
          <TablaShell minWidth={760}>
            <thead>
              <tr className="border-b border-line bg-raised">
                <Th>Fecha</Th>
                <Th>Detalle</Th>
                <Th>Tipo</Th>
                <Th derecha>Impacto {moneda}</Th>
                <Th derecha>Saldo {moneda}</Th>
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
                      <td colSpan={5} className="p-0">
                        <div className="flex items-center gap-3 px-4 py-2 bg-pos-wash/60 border-y border-pos-line">
                          <span className="h-px flex-1 bg-pos-line" />
                          <span className="flex items-center gap-2 t-label !text-pos whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-pos" />
                            Cuenta cerrada · {fmtFecha(f.fecha)} · las cuatro monedas en cero
                          </span>
                          <span className="h-px flex-1 bg-pos-line" />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </TablaShell>
        )}

        <CardFoot>
          <span className="t-num text-[12px] text-ink-2">
            {visibles.length} {visibles.length === 1 ? "movimiento" : "movimientos"}
          </span>
          <span className="t-num text-[12px] text-ink-4">
            {movimientosEnMoneda} {movimientosEnMoneda === 1 ? "impacta" : "impactan"} en {moneda}
          </span>
          <span className="ml-auto flex items-baseline gap-1.5">
            <span className="t-label">Saldo {moneda}</span>
            <Monto
              valor={saldoFinal[moneda]}
              moneda={moneda}
              className={cx(
                "text-[13px] font-semibold",
                saldoFinal[moneda] < 0 ? "text-neg" : saldoFinal[moneda] > 0 ? "text-pos" : "text-ink-4",
              )}
            />
          </span>
        </CardFoot>
      </Card>

      <p className="mt-4 t-secondary max-w-[82ch]">
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
      className="border-b border-line-soft last:border-0 cursor-pointer hover:bg-raised group"
    >
      <td className="px-4 py-2.5 t-num text-[12px] whitespace-nowrap text-ink-3">
        {fmtFecha(fila.fecha)}
      </td>
      <td className="px-4 py-2.5 min-w-0">
        <span className="text-[13.5px] text-ink font-medium group-hover:text-brand">
          {fila.concepto}
        </span>
        <span className="ml-2 t-num text-[10.5px] text-ink-4">{fila.oficina}</span>
        {fila.partidas.length > 1 && (
          <span className="ml-2"><Badge tono="brand">{fila.partidas.length} partidas</Badge></span>
        )}
      </td>
      <td className="px-4 py-2.5 whitespace-nowrap">
        <Badge tono={tono}>{ETIQUETA_CATEGORIA[fila.categoria]}</Badge>
      </td>
      <td className="px-4 py-2.5 text-right">
        {d === 0 ? (
          <SinValor />
        ) : (
          <Monto
            valor={d}
            moneda={moneda}
            conSigno
            className={cx("text-[13px]", d < 0 ? "text-neg" : "text-pos")}
          />
        )}
      </td>
      <td className="px-4 py-2.5 text-right">
        <Monto
          valor={s}
          moneda={moneda}
          className={cx(
            "text-[13px] font-semibold",
            s < 0 ? "text-neg" : d === 0 ? "text-ink-3" : "text-ink",
          )}
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
            <p className="t-secondary leading-relaxed">
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
                <Badge tono={TONO_CATEGORIA[fila.categoria] ?? "neutral"}>
                  {ETIQUETA_CATEGORIA[fila.categoria]}
                </Badge>
              </Dato>
            </div>

            <span className="t-label">
              {fila.partidas.length === 1 ? "Partida" : `${fila.partidas.length} partidas`}
            </span>
            <div className="mt-2 flex flex-col gap-2">
              {fila.partidas.map((p, i) => {
                const convirtio = p.moneda_impacto !== p.moneda_nominal;
                return (
                  <div key={i} className="border border-line rounded-xl bg-raised px-3.5 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge>{ETIQUETA_MEDIO[p.medio_pago]}</Badge>
                      <span className="t-num text-[10.5px] text-ink-3">{p.moneda_nominal}</span>
                      {convirtio && <Badge tono="brand">convertido</Badge>}
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
                          <span className="text-right t-num text-ink">{fmtMonto(p.tipo_cambio)}</span>
                        </>
                      )}
                      {p.comision_pct !== null && p.comision_pct !== 0 && (
                        <>
                          <span className="text-ink-3 pr-4">Comisión</span>
                          <span className="text-right t-num text-ink">{fmtPct(p.comision_pct)}</span>
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
              <p className="mt-3 t-secondary leading-relaxed">
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
