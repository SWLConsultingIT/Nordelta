import type { Metadata } from "next";
import Link from "next/link";
import {
  Badge, Button, Card, CardBar, CardFoot, Estado, Monto, PageHeader,
  SinValor, TablaShell, Th, Vacio, cx,
} from "@/components/ui";
import {
  IcoArrow, IcoBars, IcoCheque, IcoGrid, IcoPeople, IcoShield,
} from "@/components/ui/icons";
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
 * Centro de operaciones.
 *
 * Responde una sola pregunta: qué está pasando hoy. Primero el neto del día,
 * que es el número por el que se pregunta; después la actividad y lo que
 * requiere atención. Un tablero lleno de indicadores no ayuda a operar.
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

  const delDia = movimientos.filter((m) => m.fecha === hoy);
  const recientes = [...movimientos]
    .sort((a, b) => (a.fecha === b.fecha ? b.orden - a.orden : a.fecha < b.fecha ? 1 : -1))
    .slice(0, 10);

  // Monedas que efectivamente se movieron hoy: no se muestran columnas vacías.
  const monedasDelDia = MONEDAS.filter(
    (m) => resumen.ingresos[m] || resumen.egresos[m] || resumen.neto[m],
  );
  const contrapartesDelDia = new Set(delDia.map((m) => m.contraparte_id).filter(Boolean)).size;

  return (
    <>
      <PageHeader
        titulo="Hoy"
        contexto={[
          fmtFechaLarga(hoy),
          `${resumen.movimientos} ${resumen.movimientos === 1 ? "movimiento cargado" : "movimientos cargados"}`,
          <Estado key="e" tono="pos">Saldos al día</Estado>,
        ]}
        acciones={
          <Link href="/carga">
            <Button variant="primary">
              Cargar movimientos <IcoArrow className="w-4 h-4" />
            </Button>
          </Link>
        }
      />

      {/* ── Neto del día por moneda ───────────────────────────── */}
      <Card className="mb-5">
        <CardBar>
          <span className="t-label">Movimiento del día</span>
          <span className="ml-auto t-num text-[11.5px] text-ink-4">
            {contrapartesDelDia} {contrapartesDelDia === 1 ? "contraparte" : "contrapartes"}
          </span>
        </CardBar>

        {monedasDelDia.length === 0 ? (
          <Vacio
            titulo="Todavía no se cargó nada hoy"
            texto="Cuando cargues el primer movimiento vas a ver acá el neto del día por moneda."
            accion={
              <Link href="/carga">
                <Button size="sm" variant="primary">Cargar movimientos</Button>
              </Link>
            }
          />
        ) : (
          <div
            className="grid divide-y divide-line md:divide-y-0 md:divide-x"
            style={{ gridTemplateColumns: `repeat(${monedasDelDia.length}, minmax(0,1fr))` }}
          >
            {monedasDelDia.map((m) => {
              const neto = resumen.neto[m] ?? 0;
              const ing = resumen.ingresos[m] ?? 0;
              const egr = resumen.egresos[m] ?? 0;
              return (
                <div key={m} className="px-4 py-4 min-w-0">
                  <span className="t-label">Neto {m}</span>
                  <div className="mt-1">
                    {neto === 0 ? (
                      <span className="t-num text-[26px] text-ink-4">—</span>
                    ) : (
                      <Monto
                        valor={neto}
                        moneda={m}
                        conSigno
                        tamano="xl"
                        className={cx(
                          "text-[26px] font-semibold",
                          neto > 0 ? "text-pos" : "text-neg",
                        )}
                      />
                    )}
                  </div>

                  <div className="mt-2.5 pt-2.5 border-t border-line-soft flex flex-col gap-1">
                    <Renglon etiqueta="Ingresos" valor={ing} moneda={m} tono="pos" />
                    <Renglon etiqueta="Pagos" valor={egr} moneda={m} tono="neg" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_318px] gap-5 items-start">
        {/* ── Actividad reciente ── */}
        <Card>
          <CardBar>
            <span className="t-label">Actividad reciente</span>
            <Link href="/carga" className="ml-auto text-[12.5px] text-brand hover:underline">
              Ir a la carga
            </Link>
          </CardBar>

          {recientes.length === 0 ? (
            <Vacio titulo="Sin actividad" texto="Todavía no hay movimientos cargados." />
          ) : (
            <TablaShell minWidth={620}>
              <thead>
                <tr className="border-b border-line bg-raised">
                  <Th>Fecha</Th>
                  <Th>Contraparte</Th>
                  <Th>Detalle</Th>
                  <Th derecha>Impacto</Th>
                </tr>
              </thead>
              <tbody>
                {recientes.map((m) => {
                  const impacta = CATEGORIAS_QUE_IMPACTAN.has(m.categoria);
                  const imp = impactoPorMoneda(m.partidas);
                  return (
                    <tr key={m.id} className="border-b border-line-soft last:border-0 hover:bg-raised group">
                      <td className="px-4 py-2.5 t-num text-[12px] text-ink-3 whitespace-nowrap">
                        {fmtFecha(m.fecha)}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {m.contraparte_id ? (
                          <Link href={`/cuentas/${m.contraparte_id}`}
                                className="text-[13.5px] text-ink font-medium group-hover:text-brand">
                            {nombre(m.contraparte_id)}
                          </Link>
                        ) : (
                          <SinValor />
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-[13.5px] text-ink-2">
                        {m.concepto}
                        <span className="ml-2 t-num text-[10.5px] text-ink-4">
                          {oficina(m.oficina_id)}
                        </span>
                        {!impacta && (
                          <span className="ml-2"><Badge>{ETIQUETA_CATEGORIA[m.categoria]}</Badge></span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        {!impacta ? (
                          <span className="t-num text-[11px] text-ink-4">no impacta</span>
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
            </TablaShell>
          )}

          <CardFoot>
            <span className="t-num text-[12px] text-ink-2">
              Últimos {recientes.length} de {movimientos.length}
            </span>
            <span className="ml-auto t-secondary">
              El saldo de cada cuenta se recalcula al consultarlo
            </span>
          </CardFoot>
        </Card>

        <div className="flex flex-col gap-5">
          {/* ── Requiere atención ── */}
          <Card>
            <CardBar>
              <span className="t-label">Requiere atención</span>
            </CardBar>
            <ul className="divide-y divide-line-soft">
              <Item
                Icon={IcoCheque}
                etiqueta="Cheques cargados hoy"
                valor={resumen.chequesDelDia}
                nota="Impactan la cuenta en su fecha de cobro"
              />
              <Item
                Icon={IcoBars}
                etiqueta="Movimientos sin impacto"
                valor={resumen.sinImpacto}
                nota="Compras, ventas e impuestos, por definición"
              />
              <Item Icon={IcoShield} etiqueta="Celdas con error de tipo" valor={0} bien
                    nota="La base rechaza un texto en una columna de importe" />
              <Item Icon={IcoPeople} etiqueta="Contrapartes duplicadas" valor={0} bien
                    nota="Unicidad garantizada por la base, no por convención" />
            </ul>
          </Card>

          {/* ── Accesos ── */}
          <Card>
            <CardBar>
              <span className="t-label">Ir a</span>
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

/** Renglón de apoyo debajo del neto: ingresos y pagos del día. */
function Renglon({
  etiqueta,
  valor,
  moneda,
  tono,
}: {
  etiqueta: string;
  valor: number;
  moneda: Moneda;
  tono: "pos" | "neg";
}) {
  return (
    <span className="flex items-baseline justify-between gap-2">
      <span className="text-[11.5px] text-ink-3">{etiqueta}</span>
      {valor === 0 ? (
        <SinValor className="text-[12px]" />
      ) : (
        <Monto
          valor={valor}
          moneda={moneda}
          tamano="sm"
          className={cx("text-[12.5px]", tono === "pos" ? "text-pos" : "text-neg")}
        />
      )}
    </span>
  );
}

function Item({
  Icon,
  etiqueta,
  valor,
  nota,
  bien,
}: {
  Icon: (p: { className?: string }) => React.ReactNode;
  etiqueta: string;
  valor: number;
  nota?: string;
  bien?: boolean;
}) {
  const enCero = valor === 0;
  return (
    <li className="px-4 py-3 flex items-start gap-3">
      <span
        className={cx(
          "w-7 h-7 rounded-lg grid place-items-center flex-none mt-px",
          bien && enCero ? "bg-pos-wash text-pos" : enCero ? "bg-line-soft text-ink-4" : "bg-brand-wash text-brand",
        )}
      >
        <Icon className="w-[14px] h-[14px]" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] text-ink-2">{etiqueta}</span>
        {nota && <span className="block text-[11px] text-ink-4 mt-0.5">{nota}</span>}
      </span>
      <span className={cx(
        "t-num text-[16px] font-semibold",
        bien && enCero ? "text-pos" : enCero ? "text-ink-4" : "text-ink",
      )}>
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
