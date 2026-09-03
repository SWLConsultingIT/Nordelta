"use client";

import { useMemo, useState } from "react";
import { Badge, Card, CardBar, Dato, Input, Panel, Segmented, Vacio, cx } from "@/components/ui";
import type { EntradaAuditoria } from "@/lib/domain/types";

type Filtro = "todas" | "INSERT" | "UPDATE" | "DELETE";

/** Frase en lenguaje de negocio para cada tipo de cambio. */
function describir(e: EntradaAuditoria): string {
  const que =
    e.entidad === "movimiento" ? "un movimiento"
    : e.entidad === "partida" ? "las partidas de un movimiento"
    : "una contraparte";

  if (e.operacion === "INSERT") return `Se creó ${que}`;
  if (e.operacion === "DELETE") return `Se eliminó ${que}`;
  if (e.campo === "partidas") return "Se modificaron las partidas de un movimiento";
  if (e.campo) return `Se modificó ${que}`;
  return `Se modificó ${que}`;
}

const ETIQUETA_CAMPO: Record<string, string> = {
  concepto: "Detalle",
  categoria: "Categoría",
  partidas: "Partidas",
  contraparte_id: "Contraparte",
  fecha: "Fecha",
  oficina_id: "Oficina",
  nombre: "Nombre",
};

const TONO = { INSERT: "pos", UPDATE: "warn", DELETE: "neg" } as const;
const ACCION = { INSERT: "Alta", UPDATE: "Cambio", DELETE: "Baja" } as const;

function momento(iso: string): { fecha: string; hora: string } {
  const [f, h] = iso.split("T");
  const [a, m, d] = f.split("-");
  return { fecha: `${d}/${m}/${a}`, hora: (h ?? "").slice(0, 5) };
}

export function TablaAuditoria({ entradas }: { entradas: EntradaAuditoria[] }) {
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [q, setQ] = useState("");
  const [abierta, setAbierta] = useState<EntradaAuditoria | null>(null);

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return entradas.filter((e) => {
      if (filtro !== "todas" && e.operacion !== filtro) return false;
      if (!t) return true;
      return [e.actor, e.entidad, e.referencia, e.campo, e.motivo, e.descripcion]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(t));
    });
  }, [entradas, filtro, q]);

  return (
    <>
      <Card>
        <CardBar>
          <Segmented
            label="Acción"
            value={filtro}
            onChange={setFiltro}
            options={[
              { value: "todas", label: "Todas" },
              { value: "INSERT", label: "Altas" },
              { value: "UPDATE", label: "Cambios" },
              { value: "DELETE", label: "Bajas" },
            ]}
          />
          <div className="ml-auto flex items-center gap-3">
            <Input
              type="search"
              placeholder="Buscar usuario, detalle o motivo"
              aria-label="Buscar en la auditoría"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="min-w-[250px]"
            />
            <span className="font-mono text-[11px] text-ink-3 tabular-nums whitespace-nowrap">
              {visibles.length}
            </span>
          </div>
        </CardBar>

        {visibles.length === 0 ? (
          <Vacio
            titulo="Sin registros"
            texto={
              q
                ? `Ningún cambio coincide con «${q}».`
                : "Todavía no se registró ningún cambio con este filtro. Cargá o editá un movimiento y volvé."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] min-w-[820px]">
              <thead>
                <tr className="border-b border-line bg-raised">
                  <th className="text-left label-mono font-medium px-4 py-2.5 whitespace-nowrap">Fecha y hora</th>
                  <th className="text-left label-mono font-medium px-4 py-2.5">Acción</th>
                  <th className="text-left label-mono font-medium px-4 py-2.5">Qué pasó</th>
                  <th className="text-left label-mono font-medium px-4 py-2.5">Campo</th>
                  <th className="text-left label-mono font-medium px-4 py-2.5">Usuario</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((e) => {
                  const { fecha, hora } = momento(e.ocurrido_en);
                  const tieneDetalle = Boolean(e.campo || e.valor_anterior || e.motivo);
                  return (
                    <tr
                      key={e.id}
                      onClick={() => tieneDetalle && setAbierta(e)}
                      tabIndex={tieneDetalle ? 0 : undefined}
                      onKeyDown={(ev) => {
                        if (tieneDetalle && (ev.key === "Enter" || ev.key === " ")) {
                          ev.preventDefault(); setAbierta(e);
                        }
                      }}
                      className={cx(
                        "border-b border-line-soft last:border-0",
                        tieneDetalle ? "cursor-pointer hover:bg-raised" : "hover:bg-raised/60",
                      )}
                    >
                      <td className="px-4 py-2.5 whitespace-nowrap font-mono text-[12px]">
                        <span className="text-ink-2">{fecha}</span>
                        <span className="text-ink-4 ml-1.5">{hora}</span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <Badge tone={TONO[e.operacion]}>{ACCION[e.operacion]}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-ink">
                        {describir(e)}
                        {e.descripcion && (
                          <span className="text-ink-3"> · {e.descripcion}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-ink-3">
                        {e.campo ? (ETIQUETA_CAMPO[e.campo] ?? e.campo) : "—"}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-[12.5px] text-ink-3">
                        {e.actor}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Panel
        abierto={abierta !== null}
        onCerrar={() => setAbierta(null)}
        titulo={abierta ? describir(abierta) : ""}
        subtitulo={
          abierta
            ? `${momento(abierta.ocurrido_en).fecha} ${momento(abierta.ocurrido_en).hora} · ${abierta.actor}`
            : undefined
        }
      >
        {abierta && (
          <div className="px-5 py-4">
            <div className="mb-5">
              <Dato etiqueta="Acción">
                <Badge tone={TONO[abierta.operacion]}>{ACCION[abierta.operacion]}</Badge>
              </Dato>
              <Dato etiqueta="Entidad">{abierta.entidad}</Dato>
              {abierta.descripcion && <Dato etiqueta="Detalle">{abierta.descripcion}</Dato>}
              {abierta.campo && (
                <Dato etiqueta="Campo">{ETIQUETA_CAMPO[abierta.campo] ?? abierta.campo}</Dato>
              )}
              {abierta.motivo && <Dato etiqueta="Motivo">«{abierta.motivo}»</Dato>}
            </div>

            {(abierta.valor_anterior || abierta.valor_nuevo) && (
              <>
                <span className="label-mono">Qué cambió</span>
                <div className="mt-2 grid gap-2">
                  {abierta.valor_anterior !== null && (
                    <div className="border border-neg/25 bg-neg-wash rounded-lg px-3.5 py-2.5">
                      <span className="label-mono !text-neg">Antes</span>
                      <p className="mt-1 text-[13px] text-ink break-words">{abierta.valor_anterior}</p>
                    </div>
                  )}
                  {abierta.valor_nuevo !== null && (
                    <div className="border border-pos/25 bg-pos-wash rounded-lg px-3.5 py-2.5">
                      <span className="label-mono !text-pos">Después</span>
                      <p className="mt-1 text-[13px] text-ink break-words">{abierta.valor_nuevo}</p>
                    </div>
                  )}
                </div>
              </>
            )}

            <p className="mt-5 text-[12.5px] text-ink-3 leading-relaxed">
              Referencia interna del registro: <code className="font-mono text-[11.5px]
              bg-brand-wash text-brand px-1 rounded">{abierta.referencia}</code>. Sirve
              para rastrear el movimiento si hace falta investigar.
            </p>
          </div>
        )}
      </Panel>
    </>
  );
}
