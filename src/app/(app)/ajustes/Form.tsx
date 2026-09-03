"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Badge, Button, Card, CardBar, Estado, Field, Input, Monto, Select, SinValor, Vacio, cx,
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
 * exactamente qué saldo va a quedar en cada moneda. Va en vertical —
 * actual, ajuste, resultante — porque así se lee como un asiento y no
 * como una tabla apretada.
 */
export function FormAjuste({
  cuentas,
  oficinas,
  fecha,
  inicial = null,
}: {
  cuentas: CuentaAjustable[];
  oficinas: Oficina[];
  fecha: string;
  /** Contraparte preelegida, cuando se llega desde el libro de una cuenta. */
  inicial?: number | null;
}) {
  const router = useRouter();
  const [id, setId] = useState<number | null>(inicial);
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

  // Solo se muestran las monedas en juego: cuatro filas con tres en «—»
  // hacen ruido y esconden la que importa.
  const enJuego = MONEDAS.filter(
    (m) => (elegida?.saldo[m] ?? 0) !== 0 || montos[m] !== "",
  );

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
    <div className="grid lg:grid-cols-[minmax(0,1fr)_384px] gap-5 items-start">
      <Card>
        <CardBar>
          <span className="t-label">Nuevo ajuste</span>
          {elegida && (
            <span className="ml-auto t-num text-[11.5px] text-ink-3">{fmtFecha(fecha)}</span>
          )}
        </CardBar>

        <div className="p-4 flex flex-col gap-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Contraparte">
              <Select
                value={id ?? ""}
                onChange={(e) => elegir(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Elegí una contraparte…</option>
                {conSaldo.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </Select>
            </Field>

            <Field label="Oficina">
              <Select value={oficinaId} onChange={(e) => setOficinaId(Number(e.target.value))}>
                {oficinas.map((o) => (
                  <option key={o.id} value={o.id}>{o.nombre}</option>
                ))}
              </Select>
            </Field>
          </div>

          {!elegida ? (
            <div className="py-10 text-center">
              <p className="t-body text-ink-3 m-0">
                Elegí una contraparte para ver su saldo y armar el ajuste.
              </p>
            </div>
          ) : (
            <>
              <div>
                <span className="t-label">Saldo actual</span>
                <div className="mt-1.5 grid gap-2"
                     style={{ gridTemplateColumns: "repeat(auto-fit,minmax(132px,1fr))" }}>
                  {MONEDAS.map((m) => {
                    const v = elegida.saldo[m];
                    return (
                      <div key={m} className="bg-raised border border-line rounded-xl px-3 py-2">
                        <span className="t-label">{m}</span>
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
                <span className="t-secondary">
                  Completa el asiento con el negativo de cada saldo.
                </span>
              </div>

              <div>
                <span className="t-label">Monto del ajuste</span>
                <div className="mt-1.5 grid gap-2"
                     style={{ gridTemplateColumns: "repeat(auto-fit,minmax(148px,1fr))" }}>
                  {MONEDAS.map((m) => {
                    const malo = parseMonto(montos[m]) === null;
                    const aplica = elegida.saldo[m] !== 0 || montos[m] !== "";
                    return (
                      <label key={m} className="flex flex-col gap-1">
                        <span className={cx("t-label", !aplica && "!text-ink-4")}>{m}</span>
                        <input
                          inputMode="decimal"
                          placeholder={aplica ? "0,00" : "—"}
                          value={montos[m]}
                          onChange={(e) => { setMontos({ ...montos, [m]: e.target.value }); setHecho(null); }}
                          className={cx(
                            "h-9 rounded-lg border px-2.5 text-[13.5px] t-num text-right shadow-e1",
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
                  <span role="status" aria-live="polite" className="flex items-center gap-2">
                    <Estado tono="pos">
                      Ajuste registrado con{" "}
                      {hecho.patas === 1 ? "1 partida" : `${hecho.patas} partidas`}
                    </Estado>
                    <Link href={`/cuentas/${hecho.contraparte}`}
                          className="text-[12.5px] text-brand hover:underline inline-flex items-center gap-1">
                      Ver la cuenta <IcoArrow className="w-3.5 h-3.5" />
                    </Link>
                  </span>
                )}
                {error && (
                  <span role="alert">
                    <Estado tono="neg">{error}</Estado>
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </Card>

      {/* ── Previsualización vertical: actual → ajuste → resultante ── */}
      <Card>
        <CardBar>
          <span className="t-label">Cómo queda</span>
          {elegida && (
            <span className="ml-auto text-[12.5px] text-ink-2 font-medium truncate">
              {elegida.nombre}
            </span>
          )}
        </CardBar>

        {!elegida ? (
          <Vacio
            compacto
            titulo="Sin contraparte elegida"
            texto="La previsualización del asiento aparece acá."
          />
        ) : (
          <>
            <Etapa
              rotulo="Saldo actual"
              nota="Como está hoy la cuenta"
              monedas={enJuego}
              valor={(m) => elegida.saldo[m]}
              tinta={(v) => (v === 0 ? "text-ink-4" : v > 0 ? "text-pos" : "text-neg")}
            />

            <Flecha signo="+" />

            <Etapa
              rotulo="Ajuste a registrar"
              nota="El asiento que se va a crear"
              monedas={enJuego}
              valor={(m) => parseMonto(montos[m]) ?? 0}
              tinta={(v) => (v === 0 ? "text-ink-4" : "text-brand")}
              conSigno
            />

            <Flecha signo="=" />

            <Etapa
              rotulo="Saldo resultante"
              nota={quedaEnCero ? "Las cuatro monedas en cero" : "Después de registrar el ajuste"}
              monedas={enJuego}
              valor={(m) => resultante[m]}
              tinta={(v) => (v === 0 ? "text-pos" : v < 0 ? "text-neg" : "text-ink")}
              destacada
            />

            <div className={cx(
              "px-4 py-3 border-t text-[12.5px] leading-relaxed",
              quedaEnCero ? "bg-pos-wash border-pos-line text-pos" : "bg-raised border-line text-ink-3",
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
                <Badge tono="pos">Esta cuenta ya estaba cerrada</Badge>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

/** Una de las tres etapas del asiento. */
function Etapa({
  rotulo,
  nota,
  monedas,
  valor,
  tinta,
  conSigno,
  destacada,
}: {
  rotulo: string;
  nota: string;
  monedas: Moneda[];
  valor: (m: Moneda) => number;
  tinta: (v: number) => string;
  conSigno?: boolean;
  destacada?: boolean;
}) {
  return (
    <div className={cx("px-4 py-3", destacada && "bg-raised")}>
      <div className="flex items-baseline gap-2">
        <span className={cx("t-label", destacada && "!text-ink-2")}>{rotulo}</span>
        <span className="text-[11px] text-ink-4 truncate">{nota}</span>
      </div>

      {monedas.length === 0 ? (
        <p className="mt-1 t-num text-[13px] text-ink-4 m-0">sin monedas en juego</p>
      ) : (
        <ul className="mt-1.5 flex flex-col gap-1">
          {monedas.map((m) => {
            const v = valor(m);
            return (
              <li key={m} className="flex items-baseline justify-between gap-3">
                <span className="t-label !tracking-[0.1em]">{m}</span>
                {v === 0 ? (
                  <SinValor className="text-[14px]" />
                ) : (
                  <Monto
                    valor={v}
                    moneda={m}
                    conSigno={conSigno}
                    className={cx(
                      destacada ? "text-[16px] font-semibold" : "text-[14px] font-medium",
                      tinta(v),
                    )}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Conector entre etapas: el operador de la cuenta, en el hilo vertical. */
function Flecha({ signo }: { signo: "+" | "=" }) {
  return (
    <div className="relative h-0 border-t border-line" aria-hidden>
      <span className="absolute left-4 -top-[9px] w-[18px] h-[18px] rounded-full bg-surface
                       border border-line grid place-items-center t-num text-[11px]
                       leading-none text-ink-3">
        {signo}
      </span>
    </div>
  );
}
