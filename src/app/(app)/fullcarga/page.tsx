import type { Metadata } from "next";
import { Card, CardBar, PageHeader, TablaShell, Th, Vacio, Badge } from "@/components/ui";
import { PanelFullcarga } from "./Panel";
import { accionHayCredenciales } from "./acciones";
import { getInformes, getResumenOperativo } from "@/lib/data/operaciones";
import { hoyISO, fmtFecha, desdeHace } from "@/lib/format";
import { sumarDias } from "@/lib/operaciones/fechas";

// Estado operativo: cambia con cada corrida, cada resolución y cada
// planilla importada. Prerenderizarla la dejaría mostrando los números
// del momento del build.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Fullcarga" };

export default async function FullcargaPage() {
  const [credenciales, informes, resumen] = await Promise.all([
    accionHayCredenciales(),
    getInformes(),
    getResumenOperativo(),
  ]);
  const hoy = hoyISO();
  const ultimo = informes[0] ?? null;
  const movimientos = informes.reduce((a, i) => a + i.acreditaciones, 0);

  return (
    <>
      <PageHeader
        titulo="Fullcarga"
        contexto={[
          "Origen de las acreditaciones",
          `${informes.length} ${informes.length === 1 ? "informe procesado" : "informes procesados"}`,
          resumen.ultimaCorrida
            ? `conciliación actualizada ${desdeHace(resumen.ultimaCorrida.momento)}`
            : "sin conciliar",
        ]}
      />

      <div className="mb-5">
        <PanelFullcarga
          hayCredenciales={credenciales}
          desdePorDefecto={sumarDias(hoy, -7)}
          hastaPorDefecto={hoy}
          ultima={ultimo ? `${fmtFecha(ultimo.importadoEn.slice(0, 10))} · ${ultimo.importadoEn.slice(11, 16)}` : null}
          periodo={ultimo ? `${fmtFecha(ultimo.desde)} → ${fmtFecha(ultimo.hasta)}` : null}
          movimientos={movimientos}
        />
      </div>

      <Card>
        <CardBar><span className="t-bloque">Informes procesados</span></CardBar>
        {informes.length === 0 ? (
          <Vacio titulo="Todavía no se cargó ningún informe" compacto />
        ) : (
          <TablaShell minWidth={700}>
            <thead className="bg-raised border-b border-line">
              <tr>
                <Th>Archivo</Th>
                <Th>Rango</Th>
                <Th>Origen</Th>
                <Th derecha>Acreditaciones nuevas</Th>
                <Th>Cargado</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {informes.map((i) => (
                <tr key={i.id}>
                  <td className="px-4 py-2.5 text-ink text-[12.5px] truncate max-w-[300px]">{i.archivo}</td>
                  <td className="px-4 py-2.5 t-num text-ink-2 whitespace-nowrap">
                    {fmtFecha(i.desde)} — {fmtFecha(i.hasta)}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tono={i.origen === "AUTOMATICO" ? "brand" : "neutral"}>
                      {i.origen === "AUTOMATICO" ? "automático" : "manual"}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right t-num text-ink">{i.acreditaciones}</td>
                  <td className="px-4 py-2.5 t-num text-[12px] text-ink-3 whitespace-nowrap">
                    {i.importadoEn.slice(0, 16).replace("T", " ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </TablaShell>
        )}
      </Card>
    </>
  );
}
