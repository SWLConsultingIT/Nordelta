"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input, Segmented } from "@/components/ui";
import type { Oficina } from "@/lib/domain/types";

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
      <Segmented
        label="Oficina"
        value={oficinaId}
        onChange={(v) => ir({ oficina: String(v) })}
        options={oficinas.map((o) => ({ value: o.id, label: o.nombre.replace("Oficina ", "") }))}
      />
      <div className="ml-auto">
        <Input
          type="date"
          aria-label="Día"
          value={fecha}
          onChange={(e) => ir({ fecha: e.target.value })}
        />
      </div>
    </>
  );
}
