import type { Metadata } from "next";
import Link from "next/link";
import {
  Badge, Button, Card, CardBar, Monto, PageHead, SinValor, Vacio, cx,
} from "@/components/ui";
import { IcoArrow, IcoGrid, IcoPeople, IcoBars } from "@/components/ui/icons";
import {
  getContrapartes, getOficinas, getResumenDelDia, getTodosLosMovimientos,
} from "@/lib/data";
import { HOY_DEMO } from "@/lib/data/dataset";
import { impactoPorMoneda } from "@/lib/domain/fx";
import { CATEGORIAS_QUE_IMPACTAN, MONEDAS, type Moneda } from "@/lib/domain/types";
import { ETIQUETA_CATEGORIA } from "@/lib/domain/parseo";
import { fmtFecha, fmtFechaLarga } from "@/lib/format";

export const metadata: Metadata = { title: "Inicio" };

/**
 * Home operativo.
 *
 * Responde una sola pregunta: qué está pasando hoy. Cuatro bloques y nada
 * más — un tablero lleno de indicadores no ayuda a operar.
 */
export default async function InicioPage() {
  const hoy = HOY_DEMO;
  const [resumen, movimientos, contrapartes, oficinas] = await Promise.all([
    getResumenDelDia(hoy),
    getTodosLosMovimientos(),
    getContrapartes(),
    getOficinas(),
  ]);

  const nombre = (id: number | null) => contrapartes.find((c) => c.id === id)?.nombre ?? "—";
  const oficina = (id: number) => oficinas.find((o) => o.id === id)?.nombre ?? "—";

  const recientes = [...movimientos]
    .sort((a, b) => (a.fecha === b.fecha ? b.orden - a.orden : a.fecha < b.fecha ? 1 : -1))
    .slice(0, 10);

  // Monedas que efectivamente se movieron hoy: no se muestran columnas vacías.
  const monedasDelDia = MONEDAS.filter(
    (m) => resumen.ingresos[m] || resumen.egresos[m] || resumen.neto[m],
  );

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

      {/* ── Movimiento del día ── */}
      <Card className="mb-5">
        <CardBar>
          <span className="label-mono">Movimiento del día</span>
          <span className="ml-auto font-mono text-[11px] text-ink-3 tabular-nums">
            {resumen.movimientos} {resumen.movimientos === 1 ? "movimiento" : "movimientos"}
          </span>
        </CardBar>

        {monedasDelDia.length === 0 ? (
          <Vacio
            titulo="Todavía no se cargó nada hoy"
            texto="Cuando cargues el primer movimiento vas a ver acá el neto del día por moneda."
            accion={<Link href="/carga"><Button size="sm" variant="primary">Cargar movimientos</Button></Link>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] min-w-[560px]">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left label-mono font-medium px-4 py-2.5" />
                  {monedasDelDia.map((m) => (
                    <th key={m} className="text-right label-mono font-medium px-4 py-2.5">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <FilaResumen etiqueta="Ingresos" valores={resumen.ingresos} monedas={monedasDelDia} tono="pos" />
                <FilaResumen etiqueta="Pagos" valores={resumen.egresos} monedas={monedasDelDia} tono="neg" />
                <tr className="border-t-2 border-line bg-raised">
                  <td className="px-4 py-3 text-[13px] font-semibold text-ink">Neto</td>
                  {monedasDelDia.map((m) => {
                    const v = resumen.neto[m] ?? 0;
                    return (
                      <td key={m} className="px-4 py-3 text-right">
                        {v === 0 ? (
                          <SinValor />
                        ) : (
                          <Monto valor={v} moneda={m}
                                 className={cx("font-semibold text-[14px]",
                                               v > 0 ? "text-pos" : "text-neg")} />
                        )}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
        {/* ── Actividad reciente ── */}
        <Card>
          <CardBar>
            <span className="label-mono">Actividad reciente</span>
            <Link href="/carga" className="ml-auto text-[12.5px] text-brand hover:underline">
              Ir a la carga
            </Link>
          </CardBar>

          {recientes.length === 0 ? (
            <Vacio titulo="Sin actividad" texto="Todavía no hay movimientos cargados." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] min-w-[620px]">
                <thead>
                  <tr className="border-b border-line bg-raised">
                    <th className="text-left label-mono font-medium px-4 py-2.5">Fecha</th>
                    <th className="text-left label-mono font-medium px-4 py-2.5">Contraparte</th>
                    <th className="text-left label-mono font-medium px-4 py-2.5">Detalle</th>
                    <th className="text-right label-mono font-medium px-4 py-2.5">Impacto</th>
                  </tr>
                </thead>
                <tbody>
                  {recientes.map((m) => {
                    const impacta = CATEGORIAS_QUE_IMPACTAN.has(m.categoria);
                    const imp = impactoPorMoneda(m.partidas);
                    return (
                      <tr key={m.id} className="border-b border-line-soft last:border-0 hover:bg-raised group">
                        <td className="px-4 py-2.5 font-mono text-[12px] text-ink-3 whitespace-nowrap">
                          {fmtFecha(m.fecha)}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {m.contraparte_id ? (
                            <Link href={`/cuentas/${m.contraparte_id}`}
                                  className="text-ink font-medium group-hover:text-brand group-hover:underline">
                              {nombre(m.contraparte_id)}
                            </Link>
                          ) : (
                            <span className="text-ink-4">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-ink-2">
                          {m.concepto}
                          <span className="ml-2 font-mono text-[10.5px] text-ink-4">
                            {oficina(m.oficina_id)}
                          </span>
                          {!impacta && (
                            <span className="ml-2"><Badge>{ETIQUETA_CATEGORIA[m.categoria]}</Badge></span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          {!impacta ? (
                            <span className="font-mono text-[11px] text-ink-4">no impacta</span>
                          ) : (
                            <span className="inline-flex flex-col items-end gap-0.5">
                              {(Object.entries(imp) as [Moneda, number][]).map(([mon, v]) => (
                                <Monto key={mon} valor={v} moneda={mon} conSigno
                                       className={cx("text-[12.5px]", v < 0 ? "text-neg" : "text-pos")} />
                              ))}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          {/* ── Requiere atención ── */}
          <Card>
            <CardBar>
              <span className="label-mono">Requiere atención</span>
            </CardBar>
            <ul className="divide-y divide-line-soft text-[13px]">
              <Item
                etiqueta="Cheques cargados hoy"
                valor={resumen.chequesDelDia}
                nota="Impactan la cuenta en su fecha de cobro"
              />
              <Item
                etiqueta="Movimientos sin impacto"
                valor={resumen.sinImpacto}
                nota="Compras, ventas e impuestos, por definición"
              />
              <Item etiqueta="Celdas con error de tipo" valor={0} bien />
              <Item etiqueta="Contrapartes duplicadas" valor={0} bien />
            </ul>
          </Card>

          {/* ── Acciones rápidas ── */}
          <Card>
            <CardBar>
              <span className="label-mono">Ir a</span>
            </CardBar>
            <ul className="divide-y divide-line-soft">
              <Acceso href="/carga" Icon={IcoGrid} titulo="Cargar movimientos"
                      texto="La grilla del día, con pegado desde Excel" />
              <Acceso href="/cuentas" Icon={IcoPeople} titulo="Ver cuentas"
                      texto="Saldo por contraparte y por moneda" />
              <Acceso href="/balance" Icon={IcoBars} titulo="Ver balance"
                      texto="Totales por moneda y exportación" />
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

function FilaResumen({
  etiqueta,
  valores,
  monedas,
  tono,
}: {
  etiqueta: string;
  valores: Partial<Record<Moneda, number>>;
  monedas: Moneda[];
  tono: "pos" | "neg";
}) {
  return (
    <tr className="border-b border-line-soft">
      <td className="px-4 py-2.5 text-ink-2">{etiqueta}</td>
      {monedas.map((m) => {
        const v = valores[m] ?? 0;
        return (
          <td key={m} className="px-4 py-2.5 text-right">
            {v === 0 ? (
              <SinValor />
            ) : (
              <Monto valor={v} moneda={m} className={tono === "pos" ? "text-pos" : "text-neg"} />
            )}
          </td>
        );
      })}
    </tr>
  );
}

function Item({
  etiqueta,
  valor,
  nota,
  bien,
}: {
  etiqueta: string;
  valor: number;
  nota?: string;
  bien?: boolean;
}) {
  return (
    <li className="px-4 py-3 flex items-start gap-3">
      <span className="flex-1">
        <span className="block text-ink-2">{etiqueta}</span>
        {nota && <span className="block text-[11.5px] text-ink-4 mt-0.5">{nota}</span>}
      </span>
      <span className={cx("font-mono tnum text-[15px] font-semibold",
                          bien && valor === 0 ? "text-pos" : valor === 0 ? "text-ink-4" : "text-ink")}>
        {valor}
      </span>
    </li>
  );
}

function Acceso({
  href,
  Icon,
  titulo,
  texto,
}: {
  href: string;
  Icon: (p: { className?: string }) => React.ReactNode;
  titulo: string;
  texto: string;
}) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 px-4 py-3 hover:bg-raised group">
        <span className="w-8 h-8 rounded-lg bg-brand-wash text-brand grid place-items-center flex-none">
          <Icon className="w-[15px] h-[15px]" />
        </span>
        <span className="min-w-0">
          <span className="block text-[13.5px] font-medium text-ink group-hover:text-brand">{titulo}</span>
          <span className="block text-[11.5px] text-ink-4">{texto}</span>
        </span>
        <IcoArrow className="ml-auto w-4 h-4 text-ink-4 group-hover:text-brand flex-none" />
      </Link>
    </li>
  );
}

export const dynamic = "force-dynamic";
