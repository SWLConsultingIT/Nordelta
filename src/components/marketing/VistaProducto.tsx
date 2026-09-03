import { Monto, cx } from "@/components/ui";
import { IcoBars, IcoGrid, IcoInicio, IcoPeople, IcoScale, IcoShield } from "@/components/ui/icons";
import type { Moneda } from "@/lib/domain/types";

/* ═══════════════════════════════════════════════════════════════
   Vista del producto para la portada.

   No son maquetas dibujadas: usan los mismos tokens, la misma escala
   tipográfica y los mismos componentes de monto que la aplicación, así
   que lo que se ve en la portada es lo que se ve al entrar.

   Los datos son los del modo demostración —sintéticos— y están
   rotulados como tales. En una página sin autenticación no aparece
   ningún dato real.
   ═══════════════════════════════════════════════════════════════ */

const RAIL = [
  { Icon: IcoInicio, activo: false },
  { Icon: IcoGrid, activo: true },
  { Icon: IcoPeople, activo: false },
  { Icon: IcoBars, activo: false },
  { Icon: IcoScale, activo: false },
  { Icon: IcoShield, activo: false },
];

/** Marco de ventana: rail estrecho a la izquierda y barra de título. */
function Ventana({
  titulo,
  contexto,
  children,
  className,
}: {
  titulo: string;
  contexto: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-2xl border border-line bg-surface shadow-e4 overflow-hidden select-none",
        className,
      )}
      aria-hidden
    >
      <div className="flex">
        {/* Rail */}
        <div className="w-11 shrink-0 bg-navy flex flex-col items-center gap-1 py-3">
          <span className="w-6 h-6 rounded-lg grid place-items-center font-mono text-[11px]
                           font-bold text-white bg-gradient-to-br from-brand-hi to-brand mb-2">
            N
          </span>
          {RAIL.map(({ Icon, activo }, i) => (
            <span
              key={i}
              className={cx(
                "relative w-7 h-7 rounded-lg grid place-items-center",
                activo ? "bg-navy-3 text-on-navy" : "text-on-navy-3",
              )}
            >
              {activo && (
                <span className="absolute left-[-6px] top-1.5 bottom-1.5 w-[2.5px] rounded-full bg-brand-hi" />
              )}
              <Icon className="w-[14px] h-[14px]" />
            </span>
          ))}
        </div>

        {/* Contenido */}
        <div className="flex-1 min-w-0 bg-ground">
          <div className="flex items-baseline gap-2 px-4 pt-3.5 pb-3">
            <span className="text-[15px] font-semibold tracking-[-0.018em] text-ink">{titulo}</span>
            <span className="t-secondary truncate">{contexto}</span>
          </div>
          <div className="px-4 pb-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

/* ── Cuenta corriente ───────────────────────────────────────── */

const SALDOS: { moneda: Moneda; valor: number }[] = [
  { moneda: "ARS", valor: 4_182_500 },
  { moneda: "USD", valor: -2_400 },
  { moneda: "EUR", valor: 0 },
  { moneda: "BRL", valor: 0 },
];

const LIBRO: {
  fecha: string;
  concepto: string;
  tipo: string;
  tono: "pos" | "neg" | "brand";
  delta: number;
  saldo: number;
  cierre?: boolean;
}[] = [
  { fecha: "28/08", concepto: "Anticipo de cliente", tipo: "Ingreso", tono: "pos", delta: 3_200_000, saldo: 3_200_000 },
  { fecha: "29/08", concepto: "Pago proveedor · transferencia", tipo: "Pago", tono: "neg", delta: -1_450_000, saldo: 1_750_000 },
  { fecha: "01/09", concepto: "Cobro USD al cambio del día", tipo: "Ingreso", tono: "brand", delta: 2_610_000, saldo: 4_360_000 },
  { fecha: "02/09", concepto: "Comisión de transferencia", tipo: "Pago", tono: "neg", delta: -177_500, saldo: 4_182_500 },
];

export function VistaCuenta({ className }: { className?: string }) {
  return (
    <Ventana titulo="Patagonia Comercial SA" contexto="Cuenta corriente · 118 movimientos" className={className}>
      {/* Tira de saldos: una superficie, una columna por moneda */}
      <div className="rounded-xl border border-line bg-surface shadow-e2 overflow-hidden">
        <div className="px-3 py-1.5 border-b border-line bg-raised">
          <span className="t-label">Saldo actual</span>
        </div>
        <div className="grid grid-cols-4 divide-x divide-line">
          {SALDOS.map(({ moneda, valor }) => (
            <div key={moneda} className="px-3 py-2.5 min-w-0">
              <span className="t-label">{moneda}</span>
              <div className="mt-0.5">
                {valor === 0 ? (
                  <span className="t-num text-[15px] text-ink-4">—</span>
                ) : (
                  <Monto
                    valor={valor}
                    moneda={moneda}
                    tamano="sm"
                    className={cx("text-[15px] font-semibold", valor > 0 ? "text-pos" : "text-neg")}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Libro */}
      <div className="mt-3 rounded-xl border border-line bg-surface shadow-e2 overflow-hidden">
        <div className="grid px-3 py-1.5 border-b border-line bg-raised gap-2"
             style={{ gridTemplateColumns: "38px minmax(0,1fr) 56px 98px 98px" }}>
          <span className="t-th">Fecha</span>
          <span className="t-th">Detalle</span>
          <span className="t-th">Tipo</span>
          <span className="t-th text-right">Impacto</span>
          <span className="t-th text-right">Saldo</span>
        </div>

        {LIBRO.map((f) => (
          <div
            key={f.fecha}
            className="grid px-3 py-[7px] border-b border-line-soft last:border-0 gap-2 items-baseline"
            style={{ gridTemplateColumns: "38px minmax(0,1fr) 56px 98px 98px" }}
          >
            <span className="t-num text-[11px] text-ink-3">{f.fecha}</span>
            <span className="text-[12px] text-ink font-medium truncate">{f.concepto}</span>
            <span className={cx(
              "font-mono text-[8.5px] tracking-[0.09em] uppercase px-1 py-0.5 rounded w-fit font-medium",
              f.tono === "pos" && "bg-pos-wash text-pos",
              f.tono === "neg" && "bg-neg-wash text-neg",
              f.tono === "brand" && "bg-brand-wash text-brand",
            )}>
              {f.tipo}
            </span>
            <Monto valor={f.delta} moneda="ARS" conSigno tamano="sm"
                   className={cx("text-[11.5px] text-right", f.delta < 0 ? "text-neg" : "text-pos")} />
            <Monto valor={f.saldo} moneda="ARS" tamano="sm"
                   className="text-[11.5px] text-right font-semibold text-ink" />
          </div>
        ))}

        <div className="flex items-center gap-2 px-3 py-1.5 bg-pos-wash/60 border-t border-pos-line">
          <span className="h-px flex-1 bg-pos-line" />
          <span className="t-label !text-pos !text-[8px] whitespace-nowrap">
            Cierre · las cuatro monedas en cero
          </span>
          <span className="h-px flex-1 bg-pos-line" />
        </div>
      </div>
    </Ventana>
  );
}

/* ── Grilla de carga ────────────────────────────────────────── */

const COLUMNAS = [
  { t: "Contraparte", w: "minmax(0,1.5fr)", der: false },
  { t: "Detalle", w: "minmax(0,1.4fr)", der: false },
  { t: "Categoría", w: "minmax(0,0.85fr)", der: false },
  { t: "Medio", w: "minmax(0,0.8fr)", der: false },
  { t: "Mon.", w: "30px", der: false },
  { t: "Monto", w: "minmax(0,1.1fr)", der: true },
  { t: "T. cambio", w: "minmax(0,0.85fr)", der: true },
  { t: "Comisión", w: "58px", der: true },
  { t: "Impacto", w: "minmax(0,1.15fr)", der: true },
];

const PLANTILLA = COLUMNAS.map((c) => c.w).join(" ");

const FILAS: {
  contraparte: string; detalle: string; categoria: string; medio: string;
  moneda: Moneda; monto: number; tc: string; com: string;
  impacto: number; impactoMoneda: Moneda; convertido?: boolean;
}[] = [
  {
    contraparte: "Grupo Horizonte SA", detalle: "Cobro parcial", categoria: "Ingreso",
    medio: "Efectivo", moneda: "ARS", monto: 1_850_000, tc: "—", com: "—",
    impacto: 1_850_000, impactoMoneda: "ARS",
  },
  {
    contraparte: "Logística del Sur SA", detalle: "Pago de factura", categoria: "Pago",
    medio: "Transf.", moneda: "ARS", monto: -2_400_000, tc: "—", com: "1,20 %",
    impacto: -2_371_200, impactoMoneda: "ARS",
  },
  {
    contraparte: "Distribuidora Andina SRL", detalle: "Préstamo en pesos", categoria: "Ingreso",
    medio: "Transf.", moneda: "ARS", monto: 3_480_000, tc: "1.160,00", com: "—",
    impacto: 3_000, impactoMoneda: "USD", convertido: true,
  },
  {
    contraparte: "Servicios Costanera SRL", detalle: "Cheque a 30 días", categoria: "Ingreso",
    medio: "Cheque", moneda: "ARS", monto: 940_000, tc: "—", com: "—",
    impacto: 940_000, impactoMoneda: "ARS",
  },
];

export function VistaCarga({ className }: { className?: string }) {
  return (
    <Ventana titulo="Carga del día" contexto="03 de septiembre · Oficina Puertos" className={className}>
      <div className="rounded-xl border border-line bg-surface shadow-e2 overflow-hidden">
        {/* Barra de herramientas */}
        <div className="flex items-center gap-2 px-3 h-[38px] border-b border-line bg-raised">
          <span className="inline-flex gap-0.5 p-0.5 rounded-lg bg-sunken border border-line">
            <span className="px-2 h-[20px] grid place-items-center rounded-md bg-surface
                             text-[10.5px] text-brand font-semibold shadow-e1">Puertos</span>
            <span className="px-2 h-[20px] grid place-items-center rounded-md text-[10.5px] text-ink-3">
              Remeros
            </span>
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <span className="px-2 h-[22px] grid place-items-center rounded-lg border border-line
                             bg-surface text-[10.5px] text-ink-2">Nueva fila</span>
            <span className="px-2 h-[22px] grid place-items-center rounded-lg bg-brand
                             text-[10.5px] text-white font-semibold">Guardar</span>
          </span>
        </div>

        {/* Encabezado */}
        <div className="grid px-3 py-1.5 border-b border-line bg-raised gap-2"
             style={{ gridTemplateColumns: PLANTILLA }}>
          {COLUMNAS.map((c) => (
            <span key={c.t} className={cx("t-th !text-[8px] truncate", c.der && "text-right")}>{c.t}</span>
          ))}
        </div>

        {/* Filas */}
        {FILAS.map((f, i) => (
          <div
            key={f.contraparte}
            className={cx(
              "grid px-3 py-[7px] gap-2 items-baseline border-b border-line-soft",
              i === 2 && "bg-brand-wash/40",
            )}
            style={{ gridTemplateColumns: PLANTILLA }}
          >
            <span className="text-[11.5px] text-ink font-medium truncate">{f.contraparte}</span>
            <span className="text-[11.5px] text-ink-2 truncate">{f.detalle}</span>
            <span className="text-[11.5px] text-ink-2 truncate">{f.categoria}</span>
            <span className="text-[11.5px] text-ink-2 truncate">{f.medio}</span>
            <span className="t-num text-[11px] text-ink-3">{f.moneda}</span>
            <Monto valor={f.monto} moneda={f.moneda} tamano="sm"
                   className={cx("text-[11.5px] text-right", f.monto < 0 ? "text-neg" : "text-ink")} />
            <span className="t-num text-[11px] text-right text-ink-3">{f.tc}</span>
            <span className="t-num text-[11px] text-right text-ink-3 whitespace-nowrap">{f.com}</span>
            <span className="text-right bg-sunken -my-[7px] py-[7px] -mr-3 pr-3">
              <Monto
                valor={f.impacto}
                moneda={f.impactoMoneda}
                tamano="sm"
                className={cx(
                  "text-[11.5px]",
                  f.impacto < 0 ? "text-neg" : f.convertido ? "text-brand font-semibold" : "text-ink-2",
                )}
              />
            </span>
          </div>
        ))}

        {/* Fila vacía en espera, como en la planilla */}
        <div className="grid px-3 py-[7px] gap-2 border-b border-line-soft"
             style={{ gridTemplateColumns: PLANTILLA }}>
          <span className="h-3 rounded bg-line-soft" />
          <span className="h-3 rounded bg-line-soft" />
          <span /><span /><span /><span /><span /><span />
          <span className="bg-sunken -my-[7px] -mr-3" />
        </div>

        {/* Barra de estado */}
        <div className="flex items-center gap-3 px-3 py-1.5 bg-surface border-t border-line">
          <span className="t-num text-[10.5px] text-ink-2">4 filas</span>
          <span className="flex items-center gap-1 text-[10.5px] text-pos">
            <span className="w-1 h-1 rounded-full bg-pos" />
            listas para guardar
          </span>
          <span className="ml-auto flex items-center gap-2.5">
            <span className="flex items-baseline gap-1">
              <span className="t-label !text-[8px]">ARS</span>
              <Monto valor={1_418_800} moneda="ARS" tamano="sm"
                     className="text-[10.5px] font-semibold text-ink" />
            </span>
            <span className="flex items-baseline gap-1">
              <span className="t-label !text-[8px]">USD</span>
              <Monto valor={3_000} moneda="USD" tamano="sm"
                     className="text-[10.5px] font-semibold text-ink" />
            </span>
          </span>
        </div>
      </div>
    </Ventana>
  );
}
