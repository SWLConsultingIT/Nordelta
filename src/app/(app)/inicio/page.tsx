import type { Metadata } from "next";
import Link from "next/link";
import {
  Badge, Button, Estado, Monto, PageHeader, SinValor, TablaShell, Th, Vacio, cx,
} from "@/components/ui";
import { IcoMas } from "@/components/ui/icons";
import { HeroConciliacion } from "@/components/operaciones/Banda";
import { Bandeja } from "@/components/operaciones/Bandeja";
import { Seccion } from "@/components/operaciones/Seccion";
import { ESTADO_PLANILLA } from "../planillas/page";
import { getOficinas, getResumenDelDia, getTodosLosMovimientos, getContrapartes } from "@/lib/data";
import {
  getOperaciones, getPlanillas, getResumenOperativo,
} from "@/lib/data/operaciones";
import { HOY_DEMO } from "@/lib/data/dataset";
import { impactoPorMoneda } from "@/lib/domain/fx";
import { CATEGORIAS_QUE_IMPACTAN, MONEDAS, type Moneda } from "@/lib/domain/types";
import { desdeHace, fmtFecha, fmtFechaLarga, hoyISO } from "@/lib/format";

// El estado operativo cambia con cada corrida y cada importación.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Inicio" };

/**
 * Centro de operaciones.
 *
 * El orden de la página **es** la respuesta a «qué tengo que hacer»:
 * primero cuánto resolvió el sistema solo, después lo que quedó para una
 * persona, después de dónde vino y recién al final el estado financiero.
 *
 * Ese orden cambió a propósito. Antes lo primero era el neto del día por
 * moneda: cuatro números grandes que no le dicen a Mati qué hacer con su
 * mañana. La conciliación es el trabajo; el libro es la consecuencia.
 */
export default async function InicioPage() {
  const hoy = hoyISO();
  const [operativo, atencion, planillas, resumen, movimientos, contrapartes, oficinas] =
    await Promise.all([
      getResumenOperativo(),
      getOperaciones({ orden: "ANTIGUEDAD" }),
      getPlanillas(),
      getResumenDelDia(HOY_DEMO),
      getTodosLosMovimientos(),
      getContrapartes(),
      getOficinas(),
    ]);

  const requierenAtencion = atencion.filter(
    (o) => o.bucket === "PENDIENTE" || o.bucket === "REVISION" || o.bucket === "ERROR",
  );
  const nombre = (id: number | null) => contrapartes.find((c) => c.id === id)?.nombre ?? "—";
  const oficina = (id: number) => oficinas.find((o) => o.id === id)?.nombre ?? "—";
  const recientes = [...movimientos]
    .sort((a, b) => (a.fecha === b.fecha ? b.orden - a.orden : a.fecha < b.fecha ? 1 : -1))
    .slice(0, 6);
  const monedasDelDia = MONEDAS.filter(
    (m) => resumen.ingresos[m] || resumen.egresos[m] || resumen.neto[m],
  );

  return (
    <>
      <PageHeader
        titulo="Hoy"
        contexto={[
          fmtFechaLarga(hoy),
          operativo.ultimaCorrida
            ? `conciliación actualizada ${desdeHace(operativo.ultimaCorrida.momento)}`
            : "sin conciliar todavía",
        ]}
        acciones={
          <>
            <Link href="/fullcarga">
              <Button>Actualizar Fullcarga</Button>
            </Link>
            <Link href="/planillas/importar">
              <Button variant="primary">
                <IcoMas className="w-4 h-4" />
                Importar planilla
              </Button>
            </Link>
          </>
        }
      />

      {/* ── 1 · Conciliación ── */}
      <div className="mb-7">
        <HeroConciliacion
          total={operativo.total}
          conciliadas={operativo.conciliadas}
          resueltas={operativo.resueltas}
          pendientes={operativo.pendientes}
          revision={operativo.revision}
          errores={operativo.errores}
          tasaAutomatica={operativo.tasaAutomatica}
          masAntigua={operativo.masAntigua}
        />
      </div>

      {/* ── 2 · Lo que requiere una persona ── */}
      <Seccion
        titulo="Requiere tu atención"
        nota={
          requierenAtencion.length > 0
            ? `${requierenAtencion.length} operaciones · ${
                requierenAtencion.length > 6 ? "las 6 más antiguas" : "todas"
              }`
            : undefined
        }
        enlace={requierenAtencion.length > 0 ? "/conciliacion" : undefined}
        className="mb-7"
      >
        <Bandeja operaciones={requierenAtencion} />
      </Seccion>

      {/* ── 3 · De dónde viene el trabajo ── */}
      <Seccion titulo="Planillas recientes" enlace="/planillas" className="mb-7">
        {planillas.length === 0 ? (
          <Vacio titulo="Todavía no se importó ninguna planilla" compacto />
        ) : (
          <TablaShell minWidth={780}>
            <thead className="bg-raised border-b border-line">
              <tr>
                <Th>Cliente</Th>
                <Th>Recibida</Th>
                <Th derecha>Operaciones</Th>
                <Th derecha>Enviado</Th>
                <Th derecha>Acreditado</Th>
                <Th>Estado</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {planillas.slice(0, 5).map((p) => {
                const e = ESTADO_PLANILLA[p.estado];
                return (
                  <tr key={p.id} className="hover:bg-raised transition-colors duration-150">
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <Link href={`/planillas/${p.id}`} className="text-ink font-medium hover:text-brand">
                        {p.cliente.nombre}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 t-num text-ink-3 whitespace-nowrap">
                      {fmtFecha(p.fecha)}
                    </td>
                    <td className="px-4 py-2.5 text-right t-num text-ink-2">
                      <span className="text-pos">{p.acreditadas}</span>
                      <span className="text-ink-4"> / {p.operaciones}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Monto valor={p.enviado} moneda="ARS" tamano="sm" className="text-ink" />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Monto valor={p.acreditado} moneda="ARS" tamano="sm" className="text-pos" />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Estado tono={e.tono}>{e.texto}</Estado>
                        {p.listaParaCtaCte && <Badge tono="brand">cta cte</Badge>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TablaShell>
        )}
      </Seccion>

      {/* ── 4 y 5 · El libro, después del trabajo ── */}
      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-7 items-start">
        <Seccion
          titulo="Actividad reciente"
          nota={fmtFecha(HOY_DEMO)}
          enlace="/carga"
          textoEnlace="Ir a la carga"
        >
          {recientes.length === 0 ? (
            <Vacio titulo="Sin movimientos cargados" compacto />
          ) : (
            <TablaShell minWidth={560}>
              <thead className="bg-raised border-b border-line">
                <tr>
                  <Th>Fecha</Th>
                  <Th>Contraparte</Th>
                  <Th>Detalle</Th>
                  <Th derecha>Impacto</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {recientes.map((m) => {
                  const impacta = CATEGORIAS_QUE_IMPACTAN.has(m.categoria);
                  const imp = impactoPorMoneda(m.partidas);
                  return (
                    <tr key={m.id} className="hover:bg-raised transition-colors duration-150 group">
                      <td className="px-4 py-2.5 t-num text-[12px] text-ink-3 whitespace-nowrap">
                        {fmtFecha(m.fecha)}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {m.contraparte_id ? (
                          <Link href={`/cuentas/${m.contraparte_id}`}
                                className="text-[13px] text-ink group-hover:text-brand">
                            {nombre(m.contraparte_id)}
                          </Link>
                        ) : <SinValor />}
                      </td>
                      <td className="px-4 py-2.5 text-[13px] text-ink-2 truncate max-w-[220px]">
                        {m.concepto}
                        <span className="ml-2 t-num text-[10.5px] text-ink-4">
                          {oficina(m.oficina_id)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        {!impacta ? (
                          <span className="text-[11px] text-ink-4">no impacta</span>
                        ) : (
                          <span className="inline-flex flex-col items-end gap-0.5">
                            {(Object.entries(imp) as [Moneda, number][]).map(([mon, v]) => (
                              <Monto key={mon} valor={v} moneda={mon} conSigno tamano="sm"
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
        </Seccion>

        <Seccion titulo="Estado financiero" nota={fmtFecha(HOY_DEMO)} enlace="/balance" textoEnlace="Ver balance">
          {monedasDelDia.length === 0 ? (
            <Vacio titulo="Sin movimiento hoy" compacto />
          ) : (
            <div className="divide-y divide-line-soft">
              {monedasDelDia.map((m) => {
                const neto = resumen.neto[m] ?? 0;
                return (
                  <div key={m} className="px-4 py-3 flex items-baseline justify-between gap-3">
                    <span className="t-metrica">{m}</span>
                    <span className="text-right">
                      <Monto
                        valor={neto}
                        moneda={m}
                        conSigno
                        className={cx("text-[15px] font-semibold", neto > 0 ? "text-pos" : neto < 0 ? "text-neg" : "text-ink-4")}
                      />
                      <span className="block mt-0.5 text-[11px] text-ink-4">
                        {(resumen.ingresos[m] ?? 0) > 0 && `+${Math.round((resumen.ingresos[m] ?? 0) / 1000)}k`}
                        {(resumen.egresos[m] ?? 0) < 0 && ` ${Math.round((resumen.egresos[m] ?? 0) / 1000)}k`}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Seccion>
      </div>
    </>
  );
}
