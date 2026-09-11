import { cx } from "@/components/ui";

/**
 * La aplicación, mostrada sin decir nada.
 *
 * **No lee datos y no puede leerlos.** No importa nada de `lib/data`, ni
 * de los repositorios, ni del dataset: todo lo que se ve está escrito acá
 * y es deliberadamente neutro. La portada es pública y el producto no lo
 * es; que hoy los datos de staging sean sintéticos no alcanza, porque
 * mañana no van a serlo y nadie va a volver a mirar la portada.
 *
 * Hay un test —`tests/landing-sin-datos`— que verifica las dos cosas: que
 * no exista camino de importación hacia los datos, y que lo renderizado
 * no contenga un solo dígito.
 *
 * Lo que sí comunica: que del otro lado hay software de verdad. Los
 * rótulos, las columnas y los estados son los reales. Los valores no
 * existen.
 */

/** Ocupa el lugar de un valor sin serlo. */
function Valor({ ancho, tono = "normal" }: { ancho: string; tono?: "normal" | "tenue" | "fuerte" }) {
  return (
    <span
      aria-hidden
      className={cx(
        "block h-[6px] rounded-full",
        tono === "fuerte" ? "bg-ink-4/40" : tono === "tenue" ? "bg-line-soft" : "bg-line-hard/55",
      )}
      style={{ width: ancho }}
    />
  );
}

/** Estado, con el punto del sistema de diseño y sin ninguna cantidad. */
function Chip({ texto, tono }: { texto: string; tono: "ok" | "espera" | "revisar" }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-3 whitespace-nowrap">
      <span
        aria-hidden
        className={cx(
          "w-[5px] h-[5px] rounded-full flex-none",
          tono === "ok" ? "bg-pos/70" : tono === "revisar" ? "bg-warn/70" : "bg-ink-4/50",
        )}
      />
      {texto}
    </span>
  );
}

const SECCIONES = [
  "Inicio", "Conciliación", "Planillas", "Clientes", "Cuentas", "Balance", "Auditoría",
];

const FILAS: { estado: string; tono: "ok" | "espera" | "revisar"; anchos: [string, string, string] }[] = [
  { estado: "Conciliada", tono: "ok", anchos: ["72%", "54%", "46%"] },
  { estado: "Conciliada", tono: "ok", anchos: ["58%", "66%", "38%"] },
  { estado: "Pendiente", tono: "espera", anchos: ["64%", "42%", "52%"] },
  { estado: "Conciliada", tono: "ok", anchos: ["48%", "58%", "44%"] },
  { estado: "Revisión", tono: "revisar", anchos: ["76%", "36%", "60%"] },
  { estado: "Conciliada", tono: "ok", anchos: ["54%", "62%", "40%"] },
];

/**
 * Ventana de aplicación completa.
 *
 * Barra superior, riel, barra de filtros, tabla y panel de detalle
 * abierto. Que se vea entera —y recortada por el borde de la pantalla—
 * es lo que la hace leer como software y no como una ilustración.
 */
export function VentanaNord({ className }: { className?: string }) {
  return (
    <div
      className={cx(
        "rounded-[14px] border border-line bg-surface overflow-hidden select-none",
        "shadow-[0_2px_4px_rgba(19,26,36,.04),0_24px_64px_-24px_rgba(19,26,36,.18)]",
        className,
      )}
      role="img"
      aria-label="Interfaz de NORD, sin datos"
    >
      {/* Barra de ventana */}
      <div className="flex items-center gap-3 px-4 h-[38px] border-b border-line bg-raised">
        <span className="flex gap-[6px]" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-[7px] h-[7px] rounded-full bg-line-hard" />
          ))}
        </span>
        <span className="flex items-center gap-1.5 text-[10.5px] text-ink-4">
          <span>Nordelta</span>
          <span aria-hidden className="text-line-hard">/</span>
          <span className="text-ink-3">Conciliación</span>
        </span>
        <span className="ml-auto flex items-center gap-2" aria-hidden>
          <span className="w-[86px] h-[18px] rounded-md bg-surface border border-line" />
          <span className="w-[18px] h-[18px] rounded-full bg-line-soft" />
        </span>
      </div>

      <div className="grid grid-cols-[146px_minmax(0,1fr)]">
        {/* Riel */}
        <div className="bg-navy px-3 py-3.5 flex flex-col gap-[2px]">
          <span className="flex items-center gap-2 px-2 pb-3" aria-hidden>
            <span className="w-[17px] h-[17px] rounded-[5px] bg-navy-4 grid place-items-center
                             font-mono text-[8px] font-semibold text-on-navy">N</span>
            <span className="h-[5px] w-[46px] rounded-full bg-navy-3" />
          </span>
          {SECCIONES.map((s, i) => (
            <span
              key={s}
              className={cx(
                "flex items-center gap-2 h-[25px] px-2 rounded-md text-[10.5px] whitespace-nowrap",
                i === 1 ? "bg-navy-3 text-on-navy font-medium" : "text-on-navy-3",
              )}
            >
              <span
                aria-hidden
                className={cx(
                  "w-[9px] h-[9px] rounded-[3px] flex-none",
                  i === 1 ? "bg-brand-hi" : "bg-navy-4",
                )}
              />
              {s}
            </span>
          ))}
        </div>

        <div className="min-w-0 grid grid-cols-[minmax(0,1fr)_186px]">
          {/* Cuerpo */}
          <div className="min-w-0 border-r border-line">
            {/* Filtros */}
            <div className="flex items-center gap-2 px-4 h-[42px] border-b border-line" aria-hidden>
              <span className="h-[24px] w-[132px] rounded-lg border border-line bg-surface" />
              <span className="h-[24px] w-[84px] rounded-lg border border-line bg-surface" />
              <span className="h-[24px] w-[72px] rounded-lg border border-line bg-surface" />
              <span className="ml-auto h-[6px] w-[38px] rounded-full bg-line-soft" />
            </div>

            {/* Encabezado de tabla */}
            <div className="grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_106px_minmax(0,0.9fr)]
                            items-center gap-4 px-4 h-[32px] border-b border-line bg-raised">
              {["Operación", "Cliente", "Estado", "Última actualización"].map((c) => (
                <span key={c} className="text-[10px] font-medium text-ink-4 whitespace-nowrap">
                  {c}
                </span>
              ))}
            </div>

            {/* Filas */}
            {FILAS.map((f, i) => (
              <div
                key={i}
                className={cx(
                  "grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_106px_minmax(0,0.9fr)]",
                  "items-center gap-4 px-4 h-[38px]",
                  i > 0 && "border-t border-line-soft",
                  i === 4 && "bg-brand-wash/50",
                )}
              >
                <Valor ancho={f.anchos[0]} tono="fuerte" />
                <Valor ancho={f.anchos[1]} />
                <Chip texto={f.estado} tono={f.tono} />
                <Valor ancho={f.anchos[2]} tono="tenue" />
              </div>
            ))}
          </div>

          {/* Panel de detalle abierto: es lo que hace que parezca una
              aplicación en uso y no una captura de una tabla. */}
          <div className="bg-raised/60 px-4 py-3.5 flex flex-col gap-3.5">
            <div>
              <span className="block text-[10px] text-ink-4">Detalle</span>
              <span className="mt-1.5 block"><Valor ancho="72%" tono="fuerte" /></span>
            </div>
            <div className="h-px bg-line" aria-hidden />
            {["Cliente", "Estado", "Origen", "Historial"].map((r) => (
              <div key={r} className="flex flex-col gap-1.5">
                <span className="text-[10px] text-ink-4">{r}</span>
                <Valor ancho={r === "Historial" ? "84%" : "58%"} />
              </div>
            ))}
            <div className="mt-auto flex gap-2" aria-hidden>
              <span className="h-[24px] flex-1 rounded-lg bg-navy/90" />
              <span className="h-[24px] w-[54px] rounded-lg border border-line bg-surface" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Detalle oscuro, para la sección institucional.
 *
 * Un recorte de la misma aplicación sobre fondo navy. Muestra que el
 * producto conserva contexto —origen, estado, historial— sin decir de
 * qué operación se trata.
 */
export function DetalleOscuro({ className }: { className?: string }) {
  const lineas = [
    { etiqueta: "Origen", ancho: "62%" },
    { etiqueta: "Estado", ancho: "38%" },
    { etiqueta: "Responsable", ancho: "54%" },
  ];
  return (
    <div
      className={cx(
        "rounded-[14px] border border-navy-3 bg-navy-2 overflow-hidden select-none",
        "shadow-[0_24px_64px_-28px_rgba(0,0,0,.6)]",
        className,
      )}
      role="img"
      aria-label="Detalle de una operación en NORD, sin datos"
    >
      <div className="flex items-center gap-2.5 px-4 h-[36px] border-b border-navy-3">
        <span className="text-[10.5px] text-on-navy-3">Detalle de operación</span>
        <span className="ml-auto flex items-center gap-1.5 text-[10.5px] text-on-navy-2">
          <span aria-hidden className="w-[5px] h-[5px] rounded-full bg-pos/70" />
          Conciliada
        </span>
      </div>

      <div className="px-4 py-4 grid gap-3.5">
        {lineas.map((l) => (
          <div key={l.etiqueta} className="flex items-center gap-4">
            <span className="text-[10.5px] text-on-navy-3 w-[82px] flex-none">{l.etiqueta}</span>
            <span
              aria-hidden
              className="block h-[6px] rounded-full bg-navy-4"
              style={{ width: l.ancho }}
            />
          </div>
        ))}

        <div className="h-px bg-navy-3 my-1" aria-hidden />

        <span className="text-[10.5px] text-on-navy-3">Historial</span>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <span
              aria-hidden
              className={cx(
                "w-[7px] h-[7px] rounded-full flex-none",
                i === 0 ? "bg-brand-hi" : "bg-navy-4",
              )}
            />
            <span
              aria-hidden
              className="block h-[5px] rounded-full bg-navy-3"
              style={{ width: ["68%", "52%", "44%"][i] }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
