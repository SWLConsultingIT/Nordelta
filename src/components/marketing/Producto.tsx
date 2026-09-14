/**
 * La vista del producto que se muestra en la portada.
 *
 * **No recibe datos y no puede recibirlos.** No tiene props, no importa nada
 * de la aplicación y no renderiza un solo dígito. Lo que en el producto es
 * un nombre, un importe o una fecha, acá es una forma: un campo con el ancho
 * que tendría el dato, del color del texto atenuado.
 *
 * La decisión de fondo: una portada que muestra la pantalla real de una
 * herramienta privada está publicando cómo trabaja la empresa; una que
 * muestra un dibujo inventado miente. Esto es la tercera opción —la
 * estructura verdadera, vacía— y es la única que envejece bien.
 *
 * Lo que sostiene la credibilidad, entonces, no son los datos sino el
 * oficio: el riel con sus secciones, la barra de filtros, los tres
 * indicadores, la tabla con estados de color y el panel de trazabilidad
 * encima. Es la diferencia entre un producto vacío y un boceto gris.
 */

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

/* ── Iconografía ────────────────────────────────────────────────
   Trazos propios y mínimos. La portada no importa el juego de
   iconos de la aplicación: ese módulo arrastra el dominio y
   metería medio producto en el árbol de una página pública.      */

type Icono = (p: { className?: string }) => React.ReactElement;

const Trazo = (d: string): Icono =>
  function Ico({ className }) {
    return (
      <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
        <path
          d={d}
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

const IcoInicio = Trazo("M2.5 7 8 2.5 13.5 7v6a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V7Z");
const IcoConciliacion = Trazo("M2.5 5.5h7m0 0L7 3m2.5 2.5L7 8M13.5 10.5h-7m0 0L9 8m-2.5 2.5L9 13");
const IcoPlanillas = Trazo("M3 2.5h10v11H3v-11Zm0 4h10m-6-4v11");
const IcoClientes = Trazo("M6 7.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm-3.5 5c0-1.9 1.6-3 3.5-3s3.5 1.1 3.5 3M11 5.5a1.6 1.6 0 1 1 0 3");
const IcoCuentas = Trazo("M2 4.5h12v8H2v-8Zm0 2.5h12M4.5 10.5h3");
const IcoAuditoria = Trazo("M8 2 3 4v4c0 2.8 2.1 5.2 5 6 2.9-.8 5-3.2 5-6V4L8 2Z");
const IcoLupa = Trazo("M7.2 11.4a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4Zm3.1-1.1 2.7 2.7");
const IcoFiltro = Trazo("M2.5 4h11M4.5 8h7M6.5 12h3");

const SECCIONES: { nombre: string; icono: Icono }[] = [
  { nombre: "Inicio", icono: IcoInicio },
  { nombre: "Conciliación", icono: IcoConciliacion },
  { nombre: "Planillas", icono: IcoPlanillas },
  { nombre: "Clientes", icono: IcoClientes },
  { nombre: "Cuentas", icono: IcoCuentas },
  { nombre: "Auditoría", icono: IcoAuditoria },
];

/* ── Piezas ─────────────────────────────────────────────────── */

/** Donde el producto pone un valor. Nunca un dato: una forma. */
function Campo({ ancho, fuerte }: { ancho: string; fuerte?: boolean }) {
  return (
    <span
      aria-hidden
      className={cx(
        "block h-[7px] rounded-full",
        fuerte ? "bg-ink-4/70" : "bg-line-hard/80",
        ancho,
      )}
    />
  );
}

type Tono = "ok" | "espera" | "revisar" | "error";

const TONOS: Record<Tono, string> = {
  ok: "text-pos bg-pos-wash border-pos-line",
  espera: "text-ink-2 bg-sunken border-line-hard",
  revisar: "text-brand-lo bg-brand-wash border-brand-line",
  error: "text-neg bg-neg-wash border-neg-line",
};

const PUNTOS: Record<Tono, string> = {
  ok: "bg-pos",
  espera: "bg-ink-4",
  revisar: "bg-brand",
  error: "bg-neg",
};

function Chip({ tono, children }: { tono: Tono; children: React.ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-[6px] h-[21px] pl-[7px] pr-2 rounded-[5px] border",
        "text-[11px] font-medium leading-none whitespace-nowrap",
        TONOS[tono],
      )}
    >
      <span aria-hidden className={cx("w-[5px] h-[5px] rounded-full flex-none", PUNTOS[tono])} />
      {children}
    </span>
  );
}

/** Indicador del encabezado: rótulo, barra y estado. Sin cifra. */
function Indicador({
  rotulo,
  ancho,
  tono,
}: {
  rotulo: string;
  ancho: string;
  tono: Tono;
}) {
  return (
    <div className="flex-1 min-w-0 rounded-[9px] border border-line bg-surface px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[10.5px] font-medium tracking-[0.01em] text-ink-3">
          {rotulo}
        </span>
        <span aria-hidden className={cx("w-[6px] h-[6px] rounded-full flex-none", PUNTOS[tono])} />
      </div>
      <span aria-hidden className="mt-2.5 block h-[5px] rounded-full bg-sunken overflow-hidden">
        <span
          className={cx(
            "block h-full rounded-full",
            tono === "ok" ? "bg-pos" : tono === "revisar" ? "bg-brand" : "bg-ink-4",
            ancho,
          )}
        />
      </span>
    </div>
  );
}

const COLUMNAS = ["Estado", "Cliente", "Operación", "Depósito", "Importe"];

const FILAS: { tono: Tono; etiqueta: string; cliente: string; op: string; fecha: string; importe: string }[] = [
  { tono: "ok", etiqueta: "Conciliada", cliente: "w-[72%]", op: "w-[58%]", fecha: "w-[64%]", importe: "w-[54%]" },
  { tono: "ok", etiqueta: "Conciliada", cliente: "w-[55%]", op: "w-[70%]", fecha: "w-[48%]", importe: "w-[72%]" },
  { tono: "espera", etiqueta: "Pendiente", cliente: "w-[80%]", op: "w-[46%]", fecha: "w-[60%]", importe: "w-[45%]" },
  { tono: "ok", etiqueta: "Conciliada", cliente: "w-[63%]", op: "w-[66%]", fecha: "w-[52%]", importe: "w-[66%]" },
  { tono: "revisar", etiqueta: "Revisión", cliente: "w-[74%]", op: "w-[54%]", fecha: "w-[68%]", importe: "w-[58%]" },
  { tono: "ok", etiqueta: "Conciliada", cliente: "w-[58%]", op: "w-[76%]", fecha: "w-[44%]", importe: "w-[62%]" },
  { tono: "error", etiqueta: "Dato incorrecto", cliente: "w-[68%]", op: "w-[50%]", fecha: "w-[56%]", importe: "w-[50%]" },
];

/**
 * El ancho de las columnas, en un solo lugar.
 *
 * La de estado va fija y medida contra la etiqueta más larga: con `auto`
 * la cabecera y las filas son dos grillas distintas y se desalinean, y
 * con menos de esto el chip más largo queda cortado por la columna
 * siguiente.
 */
const REJILLA = "grid grid-cols-[128px_1.1fr_1fr_0.8fr_0.7fr] items-center gap-x-4 xl:gap-x-5";

/* ── La ventana ─────────────────────────────────────────────── */

export function AplicacionPreview() {
  return (
    <div
      aria-hidden
      className={cx(
        "select-none overflow-hidden rounded-[13px] border border-line-hard bg-surface",
        "shadow-[0_1px_2px_rgba(11,25,48,.05),0_12px_28px_-14px_rgba(11,25,48,.18),0_40px_80px_-40px_rgba(11,25,48,.28)]",
      )}
    >
      <div className="flex">
        <Riel />
        <div className="min-w-0 flex-1">
          <BarraSuperior />
          <Encabezado />
          <Tabla />
        </div>
      </div>
    </div>
  );
}

function Riel() {
  return (
    <div className="hidden w-[176px] flex-none flex-col bg-navy py-3.5 sm:flex">
      <span className="flex items-center gap-2 px-3.5 pb-4">
        <span className="grid h-[21px] w-[21px] flex-none place-items-center rounded-[6px] bg-brand text-[10px] font-bold text-white">
          P
        </span>
        <span className="truncate text-[12px] font-semibold tracking-[-0.012em] text-on-navy">
          Pagos Nordelta
        </span>
      </span>

      {SECCIONES.map(({ nombre, icono: Ico }, i) => (
        <span
          key={nombre}
          className={cx(
            "mx-2 flex h-[30px] items-center gap-2.5 rounded-[7px] px-2.5 text-[12px]",
            i === 1 ? "bg-navy-3 font-medium text-on-navy" : "text-on-navy-2",
          )}
        >
          <Ico className="h-[13px] w-[13px] flex-none opacity-80" />
          <span className="truncate">{nombre}</span>
        </span>
      ))}

      <span className="mt-auto mx-3.5 flex items-center gap-2 border-t border-navy-3 pt-3">
        <span className="grid h-[20px] w-[20px] flex-none place-items-center rounded-full bg-navy-4 text-[9px] font-semibold text-on-navy">
          MA
        </span>
        <Campo ancho="w-[58%]" />
      </span>
    </div>
  );
}

/** Barra de ventana: migas y acciones. Le da marco de aplicación. */
function BarraSuperior() {
  return (
    <div className="flex h-[38px] items-center gap-3 border-b border-line bg-raised px-4">
      <span className="flex items-center gap-1.5 text-[11px] text-ink-3">
        Operación
        <svg viewBox="0 0 6 10" className="h-[8px] w-[5px]" fill="none" aria-hidden>
          <path d="M1 1l3.5 4L1 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        <span className="font-medium text-ink-2">Conciliación</span>
      </span>
      <span className="ml-auto flex items-center gap-1.5">
        <span aria-hidden className="h-[6px] w-[6px] rounded-full bg-line-hard" />
        <span aria-hidden className="h-[6px] w-[6px] rounded-full bg-line-hard" />
      </span>
    </div>
  );
}

function Encabezado() {
  return (
    <div className="border-b border-line px-4 py-3.5 xl:px-5">
      <div className="flex items-center gap-3">
        <span className="text-[14.5px] font-semibold tracking-[-0.018em] text-ink">
          Conciliación
        </span>
        <span className="ml-auto hidden items-center gap-2 md:flex">
          <span className="flex h-[27px] w-[128px] items-center gap-1.5 rounded-[7px] border border-line-hard px-2 text-[11px] text-ink-4 xl:w-[158px]">
            <IcoLupa className="h-[11px] w-[11px] flex-none" />
            Buscar
          </span>
          <span className="flex h-[27px] items-center gap-1.5 rounded-[7px] border border-line-hard px-2.5 text-[11px] text-ink-2">
            <IcoFiltro className="h-[11px] w-[11px] flex-none" />
            Filtros
          </span>
        </span>
      </div>

      <div className="mt-3 flex gap-2.5">
        <Indicador rotulo="Conciliadas" ancho="w-[88%]" tono="ok" />
        <Indicador rotulo="Pendientes" ancho="w-[34%]" tono="espera" />
        <Indicador rotulo="Requieren revisión" ancho="w-[19%]" tono="revisar" />
      </div>
    </div>
  );
}

function Tabla() {
  return (
    <div>
      <div className={cx(REJILLA, "border-b border-line bg-raised px-4 py-2 xl:px-5")}>
        {COLUMNAS.map((c, i) => (
          <span
            key={c}
            className={cx(
              "truncate text-[10.5px] font-medium tracking-[0.008em] text-ink-3",
              i === COLUMNAS.length - 1 && "text-right",
            )}
          >
            {c}
          </span>
        ))}
      </div>

      {FILAS.map((f, i) => (
        <div
          key={i}
          className={cx(
            REJILLA,
            "px-4 py-[10px] xl:px-5",
            i < FILAS.length - 1 && "border-b border-line-soft",
          )}
        >
          <Chip tono={f.tono}>{f.etiqueta}</Chip>
          <Campo ancho={f.cliente} fuerte />
          <Campo ancho={f.op} />
          <Campo ancho={f.fecha} />
          <span className="flex justify-end">
            <Campo ancho={f.importe} fuerte />
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Panel de trazabilidad ──────────────────────────────────── */

const HISTORIA: { titulo: string; tono: Tono }[] = [
  { titulo: "Planilla recibida", tono: "espera" },
  { titulo: "Datos validados", tono: "ok" },
  { titulo: "Pago identificado", tono: "ok" },
  { titulo: "Conciliada automáticamente", tono: "ok" },
];

/**
 * El panel que cuenta la historia de una operación.
 *
 * Es lo que hace creíble la palabra «trazabilidad» sin escribir un dato:
 * se ve que cada paso quedó registrado, quién lo hizo y en qué orden.
 */
export function PanelTrazabilidad() {
  return (
    <div
      aria-hidden
      className={cx(
        "w-full max-w-[370px] select-none rounded-[12px] border border-line-hard bg-surface p-5",
        "shadow-[0_2px_4px_rgba(11,25,48,.06),0_16px_32px_-12px_rgba(11,25,48,.20)]",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-semibold tracking-[-0.012em] text-ink">
          Historial de la operación
        </span>
        <Chip tono="ok">Conciliada</Chip>
      </div>

      <ol className="mt-3.5 space-y-0">
        {HISTORIA.map((h, i) => (
          <li key={h.titulo} className="relative flex gap-2.5 pb-3.5 last:pb-0">
            {i < HISTORIA.length - 1 && (
              <span
                aria-hidden
                className="absolute left-[4px] top-[11px] bottom-0 w-px bg-line-hard"
              />
            )}
            <span
              aria-hidden
              className={cx(
                "relative mt-[4px] h-[9px] w-[9px] flex-none rounded-full ring-[2.5px] ring-surface",
                PUNTOS[h.tono],
              )}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-[11.5px] leading-tight text-ink-2">{h.titulo}</span>
              <span className="mt-1.5 flex items-center gap-1.5">
                <Campo ancho="w-[42px]" />
                <Campo ancho="w-[28px]" />
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
