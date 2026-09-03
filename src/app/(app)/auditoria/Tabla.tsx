"use client";

import { useMemo, useState } from "react";
import { Badge, CardBar, Input, Segmented, cx } from "@/components/ui";
import type { EntradaAuditoria } from "@/lib/domain/types";

type Filtro = "todas" | "INSERT" | "UPDATE" | "DELETE";

const ETIQUETA: Record<EntradaAuditoria["operacion"], string> = {
  INSERT: "Alta",
  UPDATE: "Cambio",
  DELETE: "Baja",
};
const TONO: Record<EntradaAuditoria["operacion"], "pos" | "warn" | "neg"> = {
  INSERT: "pos",
  UPDATE: "warn",
  DELETE: "neg",
};

function fmtMomento(iso: string) {
  const [f, h] = iso.split("T");
  const [a, m, d] = f.split("-");
  return { fecha: `${d}/${m}/${a}`, hora: h.slice(0, 5) };
}

export function TablaAuditoria({ entradas }: { entradas: EntradaAuditoria[] }) {
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [q, setQ] = useState("");

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return entradas.filter((e) => {
      if (filtro !== "todas" && e.operacion !== filtro) return false;
      if (!t) return true;
      return [e.actor, e.entidad, e.referencia, e.campo, e.motivo]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(t));
    });
  }, [entradas, filtro, q]);

  return (
    <>
      <CardBar>
        <Segmented
          label="Operación"
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
            placeholder="Buscar usuario, campo o motivo"
            aria-label="Buscar en la auditoría"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="min-w-[240px]"
          />
          <span className="font-mono text-[11px] text-ink-3 whitespace-nowrap">
            {visibles.length} de {entradas.length}
          </span>
        </div>
      </CardBar>

      <ul className="divide-y divide-line-soft">
        {visibles.map((e) => {
          const { fecha, hora } = fmtMomento(e.ocurrido_en);
          return (
            <li key={e.id} className="px-4 py-3.5 hover:bg-raised flex flex-wrap gap-x-4 gap-y-2">
              <span className="w-[92px] flex-none font-mono text-[11.5px] leading-tight">
                <span className="block text-ink-2">{fecha}</span>
                <span className="block text-ink-4">{hora}</span>
              </span>

              <span className="w-[68px] flex-none pt-0.5">
                <Badge tone={TONO[e.operacion]}>{ETIQUETA[e.operacion]}</Badge>
              </span>

              <span className="flex-1 min-w-[260px]">
                <span className="block text-[13px] text-ink">
                  <span className="text-ink-3">{e.entidad}</span>{" "}
                  <span className="font-mono text-[12px] text-brand bg-brand-wash px-1 rounded">{e.referencia}</span>
                  {e.campo && (
                    <>
                      {" · "}
                      <span className="font-medium">{e.campo}</span>
                    </>
                  )}
                </span>

                {e.campo && (
                  <span className="block mt-1 font-mono text-[12px]">
                    <span className="text-neg line-through">{e.valor_anterior ?? "∅"}</span>
                    <span className="text-ink-4 mx-1.5">→</span>
                    <span className="text-pos">{e.valor_nuevo ?? "∅"}</span>
                  </span>
                )}

                {e.operacion === "DELETE" && e.valor_anterior && (
                  <span className="block mt-1 font-mono text-[12px] text-neg line-through">{e.valor_anterior}</span>
                )}

                {e.motivo && (
                  <span className="block mt-1 text-[12.5px] text-ink-3 italic">«{e.motivo}»</span>
                )}
              </span>

              <span className={cx("flex-none text-[12px] self-start pt-0.5", "text-ink-3")}>{e.actor}</span>
            </li>
          );
        })}
        {visibles.length === 0 && (
          <li className="px-4 py-10 text-center text-ink-3">Ninguna entrada coincide con los filtros.</li>
        )}
      </ul>
    </>
  );
}
