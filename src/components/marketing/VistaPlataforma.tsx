import { cx } from "@/components/ui";

/**
 * Representación del producto para la portada.
 *
 * **No lee datos. No puede leerlos.** No importa nada de `lib/data`, ni
 * de los repositorios, ni del dataset de demostración: todo lo que se ve
 * está escrito acá y es deliberadamente neutro.
 *
 * La razón es que la portada es pública y el producto no lo es. Que hoy
 * los datos de staging sean sintéticos no alcanza: mañana no lo van a
 * ser, y nadie se va a acordar de revisar la portada. Por eso la garantía
 * es estructural y hay un test que la verifica —`tests/landing-sin-datos`—
 * antes que una promesa.
 *
 * Lo que sí comunica: que hay una aplicación seria detrás. Los rótulos
 * son reales; los valores, no existen.
 */

/** Barra de valor sin valor. Ocupa el lugar de un número sin serlo. */
function Barra({ ancho, fuerte }: { ancho: string; fuerte?: boolean }) {
  return (
    <span
      aria-hidden
      className={cx("block h-[7px] rounded-full", fuerte ? "bg-ink-4/45" : "bg-line-hard/60")}
      style={{ width: ancho }}
    />
  );
}

const NAVEGACION = [
  { etiqueta: "Inicio", activo: false },
  { etiqueta: "Conciliación", activo: true },
  { etiqueta: "Planillas", activo: false },
  { etiqueta: "Clientes", activo: false },
  { etiqueta: "Cuentas", activo: false },
  { etiqueta: "Balance", activo: false },
];

const METRICAS = [
  { etiqueta: "Operaciones procesadas", ancho: "76%" },
  { etiqueta: "Conciliadas", ancho: "58%" },
  { etiqueta: "Requieren atención", ancho: "24%" },
];

const FILAS = [
  { estado: "Normal", anchos: ["68%", "44%", "52%"] },
  { estado: "Pendiente", anchos: ["52%", "60%", "38%"] },
  { estado: "Revisión", anchos: ["74%", "36%", "58%"] },
  { estado: "Normal", anchos: ["46%", "56%", "44%"] },
  { estado: "Normal", anchos: ["62%", "40%", "50%"] },
];

export function VistaPlataforma({ className }: { className?: string }) {
  return (
    <div
      className={cx(
        "rounded-xl border border-line bg-surface shadow-e3 overflow-hidden select-none",
        className,
      )}
      role="img"
      aria-label="Representación de la interfaz de NORD, sin datos"
    >
      {/* Cabecera de ventana: ubica la imagen como software sin imitar un
          navegador entero. */}
      <div className="flex items-center gap-2 px-3.5 h-[34px] border-b border-line bg-raised">
        <span className="flex gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-[6px] h-[6px] rounded-full bg-line-hard" />
          ))}
        </span>
        <span className="ml-1.5 text-[10.5px] text-ink-4 tracking-[0.01em]">Nordelta</span>
      </div>

      <div className="grid grid-cols-[124px_minmax(0,1fr)]">
        {/* Riel parcial: da contexto de aplicación sin ser legible del todo. */}
        <div className="bg-navy px-2.5 py-3 flex flex-col gap-0.5">
          {NAVEGACION.map((n) => (
            <span
              key={n.etiqueta}
              className={cx(
                "flex items-center gap-2 h-[24px] px-2 rounded-md text-[10.5px] whitespace-nowrap",
                n.activo ? "bg-navy-3 text-on-navy font-medium" : "text-on-navy-3",
              )}
            >
              <span
                aria-hidden
                className={cx(
                  "w-[9px] h-[9px] rounded-[3px] flex-none",
                  n.activo ? "bg-brand-hi" : "bg-navy-4",
                )}
              />
              {n.etiqueta}
            </span>
          ))}
        </div>

        <div className="min-w-0">
          {/* Encabezado */}
          <div className="px-5 pt-4 pb-3 border-b border-line">
            <p className="m-0 text-[13px] font-semibold tracking-[-0.012em] text-ink">
              Conciliación
            </p>
            <span className="mt-2 block"><Barra ancho="38%" /></span>
          </div>

          {/* Resumen: rótulos reales, valores inexistentes */}
          <div className="px-5 py-4 border-b border-line grid gap-3">
            {METRICAS.map((m) => (
              <div key={m.etiqueta} className="flex items-center gap-4">
                <span className="text-[11px] text-ink-3 w-[132px] flex-none">{m.etiqueta}</span>
                <span className="flex-1 min-w-0"><Barra ancho={m.ancho} fuerte /></span>
                <span className="t-num text-[12px] text-ink-4 w-[18px] text-right">—</span>
              </div>
            ))}
          </div>

          {/* Tabla */}
          <div>
            {FILAS.map((f, i) => (
              <div
                key={i}
                className={cx(
                  "grid grid-cols-[92px_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,0.8fr)]",
                  "items-center gap-4 px-5 py-[11px]",
                  i > 0 && "border-t border-line-soft",
                )}
              >
                <span className="inline-flex items-center gap-1.5 text-[10.5px] text-ink-3 whitespace-nowrap">
                  <span aria-hidden className="w-[5px] h-[5px] rounded-full bg-ink-4/60" />
                  {f.estado}
                </span>
                {f.anchos.map((a, j) => (
                  <Barra key={j} ancho={a} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Los módulos de la plataforma, como navegación abstracta.
 *
 * Nombres de secciones, nada más. Ni un dato.
 */
export function ModulosPlataforma({ className }: { className?: string }) {
  const modulos = [
    "Inicio", "Conciliación", "Planillas", "Clientes", "Cuentas", "Balance", "Auditoría",
  ];
  return (
    <div className={cx("flex flex-wrap gap-2", className)}>
      {modulos.map((m, i) => (
        <span
          key={m}
          className={cx(
            "inline-flex items-center h-[32px] px-3.5 rounded-lg text-[12.5px] border whitespace-nowrap",
            i === 1
              ? "border-brand-hi/40 bg-brand-hi/10 text-on-navy"
              : "border-navy-4 text-on-navy-2",
          )}
        >
          {m}
        </span>
      ))}
    </div>
  );
}
