"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FilterTabs, Input } from "@/components/ui";
import type { Oficina } from "@/lib/domain/types";

/** Barra de contexto de la carga: qué día y qué oficina se está cargando. */
export function FiltrosCarga({
  oficinas,
  fecha,
  oficinaId,
}: {
  oficinas: Oficina[];
  fecha: string;
  oficinaId: number;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const ir = (patch: Record<string, string>) => {
    const q = new URLSearchParams(sp.toString());
    Object.entries(patch).forEach(([k, v]) => q.set(k, v));
    router.push(`/carga?${q.toString()}`);
  };

  return (
    <>
      <Input
        type="date"
        aria-label="Día que se está cargando"
        value={fecha}
        onChange={(e) => e.target.value && ir({ fecha: e.target.value })}
        className="h-8 text-[12.5px] w-[142px]"
      />
      <FilterTabs
        label="Oficina"
        value={oficinaId}
        onChange={(v: number) => ir({ oficina: String(v) })}
        options={oficinas.map((o) => ({ value: o.id, label: o.nombre }))}
      />
    </>
  );
}
