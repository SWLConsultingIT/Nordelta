"use client";

import { useMemo, useState } from "react";
import {
  Badge, Buscador, Card, CardBar, CardFoot, Dato, FilterTabs, Panel, TablaShell, Th, Vacio, cx,
} from "@/components/ui";
import type { EntradaAuditoria } from "@/lib/domain/types";
import { diferencias } from "@/lib/auditoria/diff";

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
  medio_pago: "Medio de pago",
  moneda_nominal: "Moneda",
  monto_nominal: "Monto",
  tipo_cambio: "Tipo de cambio",
  comision_pct: "Comisión",
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

  const cuenta = (op: Filtro) =>
    op === "todas" ? entradas.length : entradas.filter((e) => e.operacion === op).length;

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

  const cambios = abierta ? diferencias(abierta) : [];

  return (
    <>
      <Card>
        <CardBar>
          <Buscador
            placeholder="Buscar usuario o motivo…"
            aria-label="Buscar en la auditoría"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            ancho="w-[292px]"
            className="h-8 text-[12.5px]"
          />
          <FilterTabs
            label="Acción"
            value={filtro}
            onChange={setFiltro}
            options={[
              { value: "todas", label: "Todas", cuenta: cuenta("todas") },
              { value: "INSERT", label: "Altas", cuenta: cuenta("INSERT") },
              { value: "UPDATE", label: "Cambios", cuenta: cuenta("UPDATE") },
              { value: "DELETE", label: "Bajas", cuenta: cuenta("DELETE") },
            ]}
          />
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
          <TablaShell minWidth={820}>
            <thead>
              <tr className="border-b border-line bg-raised">
                <Th>Fecha y hora</Th>
                <Th>Acción</Th>
                <Th>Qué pasó</Th>
                <Th>Campo</Th>
                <Th>Usuario</Th>
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
                    <td className="px-4 py-2.5 whitespace-nowrap t-num text-[12px]">
                      <span className="text-ink-2">{fecha}</span>
                      <span className="text-ink-4 ml-1.5">{hora}</span>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <Badge tono={TONO[e.operacion]}>{ACCION[e.operacion]}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-[13.5px] text-ink">
                      {describir(e)}
                      {e.descripcion && <span className="text-ink-3"> · {e.descripcion}</span>}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-[12.5px] text-ink-3">
                      {e.campo ? (ETIQUETA_CAMPO[e.campo] ?? e.campo) : "—"}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-[12.5px] text-ink-3">
                      {e.actor}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TablaShell>
        )}

        <CardFoot>
          <span className="t-num text-[12px] text-ink-2">
            {visibles.length} de {entradas.length}
          </span>
          <span className="ml-auto t-secondary">
            Tocá un registro para ver exactamente qué campo cambió
          </span>
        </CardFoot>
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
                <Badge tono={TONO[abierta.operacion]}>{ACCION[abierta.operacion]}</Badge>
              </Dato>
              <Dato etiqueta="Entidad">{abierta.entidad}</Dato>
              {abierta.descripcion && <Dato etiqueta="Detalle">{abierta.descripcion}</Dato>}
              {abierta.motivo && <Dato etiqueta="Motivo">«{abierta.motivo}»</Dato>}
            </div>

            {cambios.length > 0 && (
              <>
                <span className="t-label">
                  {cambios.length === 1 ? "Campo modificado" : `${cambios.length} campos modificados`}
                </span>
                <div className="mt-2 flex flex-col gap-1.5">
                  {cambios.map((c) => (
                    <div key={c.campo} className="border border-line rounded-xl overflow-hidden">
                      <div className="px-3.5 py-2 bg-raised border-b border-line">
                        <span className="t-label">{ETIQUETA_CAMPO[c.campo] ?? c.campo}</span>
                      </div>
                      <div className="grid divide-y divide-line-soft sm:divide-y-0 sm:divide-x sm:grid-cols-2">
                        <div className="px-3.5 py-2.5 bg-neg-wash/50">
                          <span className="t-label !text-neg">Antes</span>
                          <p className="mt-1 text-[13px] text-ink break-words m-0">
                            {c.antes ?? <span className="text-ink-4">sin valor</span>}
                          </p>
                        </div>
                        <div className="px-3.5 py-2.5 bg-pos-wash/50">
                          <span className="t-label !text-pos">Después</span>
                          <p className="mt-1 text-[13px] text-ink break-words m-0">
                            {c.despues ?? <span className="text-ink-4">sin valor</span>}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 t-secondary leading-relaxed">
                  Se listan solo los campos que efectivamente cambiaron. Lo que
                  no aparece acá quedó igual.
                </p>
              </>
            )}

            <p className="mt-5 t-secondary leading-relaxed">
              Referencia interna del registro:{" "}
              <code className="t-num text-[11.5px] bg-brand-wash text-brand px-1 rounded">
                {abierta.referencia}
              </code>
              . Sirve para rastrear el movimiento si hace falta investigar.
            </p>
          </div>
        )}
      </Panel>
    </>
  );
}
