import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, CardBar, Cifra, PageHead, Button, cx } from "@/components/ui";
import { IcoArrow } from "@/components/ui/icons";
import { getContrapartes, getOficinas, getTodosLosMovimientos } from "@/lib/data";
import { impactoPorMoneda } from "@/lib/domain/fx";
import { MONEDAS, CATEGORIAS_QUE_IMPACTAN, type Moneda } from "@/lib/domain/types";
import { fmtFecha, fmtFechaLarga, hoyISO, partirMonto } from "@/lib/format";

export const metadata: Metadata = { title: "Inicio" };

export default async function InicioPage() {
  const [movimientos, contrapartes, oficinas] = await Promise.all([
    getTodosLosMovimientos(),
    getContrapartes(),
    getOficinas(),
  ]);

  const hoy = hoyISO();
  const deHoy = movimientos.filter((m) => m.fecha === hoy);

  // Total del día por moneda, sumando solo lo que impacta la cuenta corriente.
  const totalHoy: Partial<Record<Moneda, number>> = {};
  for (const m of deHoy) {
    if (!CATEGORIAS_QUE_IMPACTAN.has(m.categoria)) continue;
    for (const [mon, v] of Object.entries(impactoPorMoneda(m.partidas))) {
      totalHoy[mon as Moneda] = (totalHoy[mon as Moneda] ?? 0) + v!;
    }
  }

  const nombre = (id: number | null) => contrapartes.find((c) => c.id === id)?.nombre ?? "—";
  const oficina = (id: number) => oficinas.find((o) => o.id === id)?.nombre ?? "—";

  const recientes = [...movimientos]
    .sort((a, b) => (a.fecha === b.fecha ? b.orden - a.orden : a.fecha < b.fecha ? 1 : -1))
    .slice(0, 8);

  const excluidos = deHoy.filter((m) => !CATEGORIAS_QUE_IMPACTAN.has(m.categoria)).length;

  return (
    <>
      <PageHead
        title="Inicio"
        sub={fmtFechaLarga(hoy)}
        actions={
          <Link href="/carga">
            <Button variant="primary">
              Cargar movimientos <IcoArrow className="w-4 h-4" />
            </Button>
          </Link>
        }
      />

      {/* Movimiento del día, por moneda */}
      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(172px,1fr))" }}>
        {MONEDAS.map((m) => {
          const v = totalHoy[m] ?? 0;
          const { entero, decimal } = partirMonto(v, m);
          return (
            <div key={m} className="bg-surface border border-line rounded-xl px-4 py-3.5 shadow-e2">
              <span className="label-mono">Hoy en {m}</span>
              <div className="mt-1">
                <Cifra
                  entero={entero}
                  decimal={decimal}
                  className={cx(
                    "text-[22px] font-semibold tracking-[-0.028em]",
                    v > 0 ? "text-pos" : v < 0 ? "text-neg" : "text-ink-4",
                  )}
                />
              </div>
              <span className="text-[11.5px] text-ink-4">
                {v === 0 ? "Sin movimientos" : v > 0 ? "Neto a favor" : "Neto en contra"}
              </span>
            </div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
        {/* Actividad reciente */}
        <Card>
          <CardBar>
            <span className="label-mono">Actividad reciente</span>
            <Link href="/carga" className="ml-auto text-[12.5px] text-brand hover:underline">
              Ver carga diaria
            </Link>
          </CardBar>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] min-w-[620px]">
              <thead>
                <tr className="border-b border-line bg-raised">
                  {["Fecha", "Contraparte", "Concepto", "Oficina", "Impacto"].map((h, i) => (
                    <th
                      key={h}
                      className={cx("label-mono font-medium px-3.5 py-2.5 whitespace-nowrap", i === 4 ? "text-right" : "text-left")}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recientes.map((m) => {
                  const imp = impactoPorMoneda(m.partidas);
                  const impacta = CATEGORIAS_QUE_IMPACTAN.has(m.categoria);
                  return (
                    <tr key={m.id} className="border-b border-line-soft last:border-0 hover:bg-raised">
                      <td className="px-3.5 py-2.5 font-mono text-[12px] text-ink-3 whitespace-nowrap">{fmtFecha(m.fecha)}</td>
                      <td className="px-3.5 py-2.5 text-ink font-medium whitespace-nowrap">{nombre(m.contraparte_id)}</td>
                      <td className="px-3.5 py-2.5 text-ink-2">
                        {m.concepto}
                        {!impacta && (
                          <span className="ml-2">
                            <Badge tone="neutral">no impacta</Badge>
                          </span>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 text-ink-3 whitespace-nowrap">{oficina(m.oficina_id)}</td>
                      <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                        {impacta ? (
                          Object.entries(imp).map(([mon, v]) => {
                            const { entero, decimal } = partirMonto(v!, mon as Moneda);
                            return (
                              <span key={mon} className="ml-2 inline-flex items-baseline gap-1">
                                <span className="font-mono text-[9.5px] text-ink-3">{mon}</span>
                                <Cifra entero={entero} decimal={decimal} className={cx("text-[12.5px]", v! < 0 && "text-neg")} />
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-ink-4">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Requiere atención */}
        <div className="flex flex-col gap-3">
          <Card>
            <CardBar>
              <span className="label-mono">Requiere atención</span>
            </CardBar>
            <ul className="divide-y divide-line-soft text-[13px]">
              <Item ok label="Celdas con errores de tipo" valor="0" />
              <Item ok label="Contrapartes duplicadas" valor="0" />
              <Item label="Movimientos que no impactan la cuenta" valor={String(excluidos)} nota="Compras, ventas e impuestos, por definición" />
            </ul>
          </Card>

          <Card>
            <CardBar>
              <span className="label-mono">Turno</span>
            </CardBar>
            <div className="p-4 text-[13px] text-ink-2 leading-relaxed">
              Estás cargando en <span className="text-ink font-semibold">Nordelta</span>.
              Los movimientos del día se guardan a medida que escribís — no hay
              ningún botón de consolidar.
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function Item({ label, valor, ok, nota }: { label: string; valor: string; ok?: boolean; nota?: string }) {
  return (
    <li className="px-4 py-3 flex items-start gap-3">
      <span className="flex-1">
        <span className="block text-ink-2">{label}</span>
        {nota && <span className="block text-[11.5px] text-ink-4 mt-0.5">{nota}</span>}
      </span>
      <span className={cx("font-mono tnum text-[15px] font-semibold", ok && valor === "0" ? "text-pos" : "text-ink")}>
        {valor}
      </span>
    </li>
  );
}
