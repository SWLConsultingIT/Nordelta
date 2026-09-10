import { cx } from "@/components/ui";

/**
 * Réplica estática de la pantalla de conciliación, para la portada.
 *
 * No es una ilustración ni un gráfico decorativo: usa los mismos tokens,
 * la misma tipografía y la misma composición que la pantalla real. Quien
 * la ve en la portada y después entra al producto tiene que reconocerla.
 *
 * Es **estática a propósito**. Una portada no es lugar para montar la
 * aplicación entera, y una animación que simula trabajo es exactamente el
 * tipo de promesa que este producto no debería hacer.
 */

interface Fila {
  cliente: string;
  problema: string;
  tono: "warn" | "neg";
  dias: number;
  importe: string;
  accion: string;
}

const FILAS: Fila[] = [
  { cliente: "Padel Pro Norte", problema: "Pendiente de acreditación", tono: "warn", dias: 3, importe: "153.500", accion: "Monitorear" },
  { cliente: "Gimnasio Lomas", problema: "CUIT incorrecto", tono: "neg", dias: 1, importe: "799.000", accion: "Avisar al cliente" },
  { cliente: "Academia Sur", problema: "Match para revisar", tono: "warn", dias: 2, importe: "185.000", accion: "Elegir" },
];

export function VistaConciliacion({ className }: { className?: string }) {
  return (
    <div
      className={cx(
        "rounded-xl border border-line bg-surface shadow-e3 overflow-hidden select-none",
        className,
      )}
      aria-label="Vista de la pantalla de conciliación de NORD"
      role="img"
    >
      {/* Barra de ventana: ubica la imagen como producto sin imitar un
          navegador entero. */}
      <div className="flex items-center gap-2 px-4 h-[38px] border-b border-line bg-raised">
        <span className="flex gap-1.5" aria-hidden>
          {["bg-line-hard", "bg-line-hard", "bg-line-hard"].map((c, i) => (
            <span key={i} className={cx("w-[7px] h-[7px] rounded-full", c)} />
          ))}
        </span>
        <span className="ml-2 text-[11px] text-ink-4">Conciliación</span>
        <span className="ml-auto text-[10.5px] text-ink-4">actualizada hace 12 min</span>
      </div>

      {/* Cabecera con el número que importa */}
      <div className="grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] divide-y sm:divide-y-0 sm:divide-x divide-line">
        <div className="px-5 py-4">
          <p className="m-0 text-[12px] font-semibold text-ink">Conciliación de hoy</p>
          <div className="mt-3 flex items-baseline">
            <span className="t-num text-[38px] leading-none font-semibold tracking-[-0.03em] text-pos">
              91,5<span className="text-[22px] font-medium ml-0.5">%</span>
            </span>
          </div>
          <p className="mt-2 mb-0 text-[12px] text-ink-2">conciliado automáticamente</p>
          <p className="mt-0.5 mb-0 text-[11px] text-ink-4">
            <span className="t-num">455</span> de <span className="t-num">497</span> operaciones procesadas
          </p>

          <div className="mt-3.5 flex h-[5px] rounded-full overflow-hidden bg-line-soft gap-px" aria-hidden>
            <span className="bg-pos" style={{ width: "91.5%" }} />
            <span className="bg-warn/50" style={{ width: "4.8%" }} />
            <span className="bg-warn" style={{ width: "2.2%" }} />
            <span className="bg-neg" style={{ width: "1.5%" }} />
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="flex items-baseline gap-2">
            <span className="t-num text-[26px] leading-none font-semibold tracking-[-0.025em] text-ink">42</span>
            <span className="text-[12px] text-ink-2">requieren atención</span>
          </div>
          <div className="mt-3.5 grid grid-cols-3 gap-3">
            <Mini n="24" t="Pendientes" tono="text-warn" />
            <Mini n="11" t="Para revisar" tono="text-warn" />
            <Mini n="7" t="Con error" tono="text-neg" />
          </div>
        </div>
      </div>

      {/* La bandeja de trabajo */}
      <div className="border-t border-line">
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-line">
          <Pestana activa>Requieren atención 42</Pestana>
          <Pestana>Pendientes 24</Pestana>
          <Pestana>Conciliadas 455</Pestana>
        </div>
        <table className="w-full text-[12px]">
          <tbody>
            {FILAS.map((f) => (
              <tr key={f.cliente} className="border-b border-line-soft last:border-0">
                <td className="px-4 py-2.5 text-ink whitespace-nowrap">{f.cliente}</td>
                <td className="px-2 py-2.5">
                  <span
                    className={cx(
                      "inline-flex items-center gap-1.5 whitespace-nowrap",
                      f.tono === "neg" ? "text-neg" : "text-warn",
                    )}
                  >
                    <span
                      className={cx("w-[5px] h-[5px] rounded-full", f.tono === "neg" ? "bg-neg" : "bg-warn")}
                      aria-hidden
                    />
                    {f.problema}
                  </span>
                </td>
                <td className="px-2 py-2.5 text-right t-num text-ink-3">{f.dias} d</td>
                <td className="px-2 py-2.5 text-right t-num text-ink whitespace-nowrap">
                  <span className="text-ink-4">$ </span>{f.importe}
                </td>
                <td className="px-4 py-2.5 text-ink-3 whitespace-nowrap">{f.accion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Mini({ n, t, tono }: { n: string; t: string; tono: string }) {
  return (
    <span className="min-w-0">
      <span className={cx("block t-num text-[16px] leading-none font-semibold", tono)}>{n}</span>
      <span className="block mt-1 text-[10.5px] text-ink-3 truncate">{t}</span>
    </span>
  );
}

function Pestana({ children, activa }: { children: React.ReactNode; activa?: boolean }) {
  return (
    <span
      className={cx(
        "px-2 h-[22px] inline-flex items-center rounded-md text-[11px] whitespace-nowrap",
        activa ? "bg-brand-wash text-brand font-medium" : "text-ink-4",
      )}
    >
      {children}
    </span>
  );
}

/**
 * Segunda vista: la bandeja de un cliente.
 *
 * Existe para mostrar que NORD no es una pantalla sino un sistema: la
 * misma operación vista desde el cliente, con su planilla y su estado.
 */
export function VistaCliente({ className }: { className?: string }) {
  const planillas = [
    { archivo: "Transferencias 09-09.xlsx", ok: 42, total: 47, estado: "Con errores", tono: "text-neg" },
    { archivo: "Transferencias 02-09.xlsx", ok: 45, total: 47, estado: "Pendiente", tono: "text-warn" },
    { archivo: "Transferencias 28-08.xlsx", ok: 38, total: 38, estado: "Acreditada", tono: "text-pos" },
  ];
  return (
    <div
      className={cx(
        "rounded-xl border border-line bg-surface shadow-e3 overflow-hidden select-none",
        className,
      )}
      aria-label="Vista del detalle de un cliente en NORD"
      role="img"
    >
      <div className="px-5 py-4 border-b border-line">
        <p className="m-0 text-[13px] font-semibold text-ink">Padel Pro Norte</p>
        <p className="mt-0.5 mb-0 text-[11px] text-ink-4">3 planillas · 132 operaciones</p>
        <div className="mt-3.5 grid grid-cols-3 gap-4">
          <Mini n="$ 71.336.500" t="Enviado" tono="text-ink" />
          <Mini n="$ 63.874.500" t="Acreditado" tono="text-pos" />
          <Mini n="$ 5.967.000" t="Pendiente" tono="text-warn" />
        </div>
      </div>
      <table className="w-full text-[12px]">
        <tbody>
          {planillas.map((p) => (
            <tr key={p.archivo} className="border-b border-line-soft last:border-0">
              <td className="px-4 py-2.5 text-ink-2 truncate max-w-[190px]">{p.archivo}</td>
              <td className="px-2 py-2.5 whitespace-nowrap">
                <span className="t-num text-ink">{p.ok}</span>
                <span className="t-num text-ink-4"> de {p.total}</span>
              </td>
              <td className="px-2 py-2.5 w-[70px]">
                <span className="block h-[4px] rounded-full bg-line-soft overflow-hidden" aria-hidden>
                  <span className="block h-full bg-pos" style={{ width: `${(p.ok / p.total) * 100}%` }} />
                </span>
              </td>
              <td className={cx("px-4 py-2.5 whitespace-nowrap", p.tono)}>{p.estado}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
