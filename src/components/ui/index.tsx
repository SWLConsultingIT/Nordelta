import type {
  ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes,
} from "react";
import type { Moneda } from "@/lib/domain/types";
import { SIMBOLO, partirMonto } from "@/lib/format";

export function cx(...v: (string | false | null | undefined)[]) {
  return v.filter(Boolean).join(" ");
}

/* ══ Botón ═══════════════════════════════════════════════════
   Tres niveles y nada más: primario para la acción de la pantalla,
   normal para todo lo demás, fantasma para lo terciario. */

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "default" | "ghost" | "danger";
  size?: "sm" | "md";
};

export function Button({ variant = "default", size = "md", className, ...p }: BtnProps) {
  return (
    <button
      {...p}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap",
        "transition-[background-color,border-color,color,box-shadow] duration-100",
        "disabled:opacity-45 disabled:pointer-events-none active:translate-y-[0.5px]",
        size === "sm" ? "h-8 px-2.5 text-[12.5px]" : "h-9 px-3.5 text-[13.5px]",
        variant === "primary" &&
          "bg-brand text-white border border-brand-lo/40 shadow-e1 hover:bg-brand-hi",
        variant === "default" &&
          "bg-surface text-ink-2 border border-line shadow-e1 hover:bg-raised hover:text-ink hover:border-line-hard",
        variant === "ghost" && "text-ink-3 hover:text-ink hover:bg-raised",
        variant === "danger" &&
          "bg-neg text-white border border-neg/40 shadow-e1 hover:brightness-110",
        className,
      )}
    />
  );
}

/* ══ Superficies ═════════════════════════════════════════════ */

export function Card({
  className,
  children,
  plano,
}: {
  className?: string;
  children: ReactNode;
  /** Sin sombra: para tarjetas que viven dentro de otra superficie. */
  plano?: boolean;
}) {
  return (
    <div
      className={cx(
        "bg-surface border border-line rounded-xl overflow-hidden",
        plano ? "shadow-none" : "shadow-e2",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardBar({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cx(
        "flex flex-wrap items-center gap-x-3 gap-y-2 px-4 h-[46px] shrink-0",
        "border-b border-line bg-raised",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardFoot({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cx(
        "flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2 border-t border-line bg-raised",
        "text-[11.5px] text-ink-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ══ Encabezado de página ════════════════════════════════════
   Un solo patrón para las siete pantallas: título, contexto y
   acciones a la derecha. */

export function PageHeader({
  titulo,
  contexto,
  acciones,
  className,
}: {
  titulo: ReactNode;
  /** Metadata secundaria. Un arreglo se separa con puntos medios. */
  contexto?: ReactNode | ReactNode[];
  acciones?: ReactNode;
  className?: string;
}) {
  const partes = Array.isArray(contexto) ? contexto.filter(Boolean) : contexto ? [contexto] : [];
  return (
    <header className={cx("flex flex-wrap items-end gap-x-6 gap-y-3 mb-5", className)}>
      <div className="min-w-0">
        <h1 className="t-page m-0 truncate">{titulo}</h1>
        {partes.length > 0 && (
          <p className="flex flex-wrap items-center gap-x-2 mt-1 t-secondary m-0">
            {partes.map((p, i) => (
              <span key={i} className="flex items-center gap-2">
                {i > 0 && <span className="text-ink-4 select-none">·</span>}
                {p}
              </span>
            ))}
          </p>
        )}
      </div>
      {acciones && <div className="ml-auto flex flex-wrap items-center gap-2">{acciones}</div>}
    </header>
  );
}

/* ══ Estado ══════════════════════════════════════════════════
   Punto de color más texto, en lugar de una píldora rellena. Una
   tabla llena de píldoras compite con los números, que son el
   contenido real. */

export type Tono = "neutral" | "brand" | "pos" | "neg" | "warn";

const TINTA: Record<Tono, string> = {
  neutral: "text-ink-3",
  brand: "text-brand",
  pos: "text-pos",
  neg: "text-neg",
  warn: "text-warn",
};
const PUNTO: Record<Tono, string> = {
  neutral: "bg-ink-4",
  brand: "bg-brand",
  pos: "bg-pos",
  neg: "bg-neg",
  warn: "bg-warn",
};

export function Estado({ tono = "neutral", children }: { tono?: Tono; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 text-[12px] whitespace-nowrap", TINTA[tono])}>
      <span className={cx("w-[5px] h-[5px] rounded-full flex-none", PUNTO[tono])} />
      {children}
    </span>
  );
}

/** Píldora rellena. Se reserva para lo que tiene que destacar de verdad. */
export function Badge({ tono = "neutral", children }: { tono?: Tono; children: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-block font-mono text-[9px] tracking-[0.09em] uppercase px-1.5 py-0.5 rounded font-medium",
        tono === "neutral" && "bg-line-soft text-ink-3",
        tono === "brand" && "bg-brand-wash text-brand",
        tono === "pos" && "bg-pos-wash text-pos",
        tono === "neg" && "bg-neg-wash text-neg",
        tono === "warn" && "bg-warn-wash text-warn",
      )}
    >
      {children}
    </span>
  );
}

/* ══ Campos ══════════════════════════════════════════════════ */

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("flex flex-col gap-1.5 min-w-0", className)}>
      <span className="t-label">{label}</span>
      {children}
    </label>
  );
}

const CAMPO_BASE =
  "h-9 rounded-lg bg-surface border border-line px-2.5 text-[13.5px] text-ink shadow-e1 " +
  "placeholder:text-ink-4 transition-colors hover:border-line-hard focus:border-brand";

export function Input({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cx(CAMPO_BASE, className)} />;
}

/** Select con flecha propia: el nativo se ve distinto en cada sistema. */
export function Select({
  className,
  children,
  ...p
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative inline-flex min-w-0">
      <select {...p} className={cx(CAMPO_BASE, "pr-8 cursor-pointer w-full", className)}>
        {children}
      </select>
      <span
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-[70%] w-[5px] h-[5px]
                   border-r-[1.5px] border-b-[1.5px] border-ink-4 rotate-45"
      />
    </span>
  );
}

/**
 * Campo de búsqueda con lupa.
 *
 * El ancho va en el envoltorio: el input lleva `w-full` y le ganaría a
 * cualquier clase de ancho que llegue por `className`.
 */
export function Buscador({
  className,
  ancho = "w-[248px]",
  ...p
}: InputHTMLAttributes<HTMLInputElement> & { ancho?: string }) {
  return (
    <span className={cx("relative inline-flex min-w-0 max-w-full", ancho)}>
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-[14px] h-[14px] text-ink-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      >
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m15.5 15.5 4 4" />
      </svg>
      <input type="search" {...p} className={cx(CAMPO_BASE, "pl-8 w-full", className)} />
    </span>
  );
}

/* ══ Pestañas de filtro ══════════════════════════════════════ */

export function FilterTabs<T extends string | number>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: { value: T; label: string; cuenta?: number }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cx("inline-flex gap-0.5 p-0.5 rounded-[10px] bg-sunken border border-line", className)}
    >
      {options.map((o) => {
        const activo = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={activo}
            onClick={() => onChange(o.value)}
            className={cx(
              "inline-flex items-center gap-1.5 px-2.5 h-7 rounded-lg text-[12.5px] whitespace-nowrap",
              "transition-colors duration-100",
              activo
                ? "bg-surface text-brand font-semibold shadow-e1"
                : "text-ink-3 hover:text-ink",
            )}
          >
            {o.label}
            {o.cuenta !== undefined && (
              <span className={cx("t-num text-[11px]", activo ? "text-brand/70" : "text-ink-4")}>
                {o.cuenta}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ══ Interruptor ═════════════════════════════════════════════ */

export function Toggle({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="inline-flex items-center gap-2.5 cursor-pointer select-none text-[12.5px] text-ink-2 whitespace-nowrap">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only peer"
      />
      <span
        className={cx(
          "relative w-[32px] h-[18px] rounded-full flex-none transition-colors duration-150",
          "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brand peer-focus-visible:outline-offset-2",
          checked ? "bg-brand" : "bg-line-hard",
        )}
      >
        <span
          className={cx(
            "absolute top-0.5 left-0.5 w-[14px] h-[14px] rounded-full bg-white shadow-e1",
            "transition-transform duration-150",
            checked && "translate-x-[14px]",
          )}
        />
      </span>
      {children}
    </label>
  );
}

/* ══ Importes ════════════════════════════════════════════════
   Un solo componente para que un importe se vea igual en toda la
   aplicación: símbolo atenuado, miles con punto, decimales con coma
   y en segundo plano. */

export function Monto({
  valor,
  moneda,
  className,
  conSigno,
  tamano = "md",
}: {
  valor: number;
  moneda: Moneda;
  className?: string;
  /** Muestra el signo + en los positivos. Para columnas de impacto. */
  conSigno?: boolean;
  tamano?: "sm" | "md" | "xl" | "hero";
}) {
  const { entero, decimal } = partirMonto(Math.abs(valor), moneda);
  const signo = valor < 0 ? "−" : conSigno && valor > 0 ? "+" : "";
  const simbolo =
    tamano === "hero" ? "text-[0.5em] mr-1.5"
    : tamano === "xl" ? "text-[0.58em] mr-1.5"
    : tamano === "sm" ? "text-[0.8em] mr-[3px]"
    : "text-[0.76em] mr-1";

  return (
    <span className={cx("t-num whitespace-nowrap", className)}>
      <span className={cx("text-ink-3 font-normal", simbolo)}>
        {signo}
        {SIMBOLO[moneda]}
      </span>
      {entero}
      <span className="opacity-40 font-normal">{decimal}</span>
    </span>
  );
}

/** Guion tenue para un valor que no existe: un 0,00 falso confunde. */
export function SinValor({ className }: { className?: string }) {
  return <span className={cx("t-num text-ink-4 select-none", className)}>—</span>;
}

/* ══ Tira de saldos ══════════════════════════════════════════
   Una sola superficie con una columna por moneda. Reemplaza a cuatro
   tarjetas: más compacta y más fácil de comparar de un barrido. */

export function TiraDeSaldos({
  titulo,
  items,
  className,
}: {
  titulo?: string;
  items: { moneda: Moneda; valor: number; nota?: string }[];
  className?: string;
}) {
  return (
    <Card className={className}>
      {titulo && (
        <CardBar>
          <span className="t-label">{titulo}</span>
        </CardBar>
      )}
      <div
        className="grid divide-x divide-line"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0,1fr))` }}
      >
        {items.map(({ moneda, valor, nota }) => (
          <div key={moneda} className="px-4 py-3.5 min-w-0">
            <span className="t-label">{moneda}</span>
            <div className="mt-1">
              {valor === 0 ? (
                <span className="t-num text-[21px] text-ink-4">—</span>
              ) : (
                <Monto
                  valor={valor}
                  moneda={moneda}
                  tamano="xl"
                  className={cx(
                    "text-[21px] font-semibold",
                    valor > 0 ? "text-pos" : "text-neg",
                  )}
                />
              )}
            </div>
            {nota && <span className="block mt-0.5 text-[11px] text-ink-4">{nota}</span>}
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ══ Estado vacío ════════════════════════════════════════════ */

export function Vacio({
  titulo,
  texto,
  accion,
  compacto,
}: {
  titulo: string;
  texto?: string;
  accion?: ReactNode;
  compacto?: boolean;
}) {
  return (
    <div className={cx("text-center px-6", compacto ? "py-8" : "py-16")}>
      <p className="t-section m-0">{titulo}</p>
      {texto && <p className="mt-1.5 mx-auto max-w-[44ch] t-secondary m-0">{texto}</p>}
      {accion && <div className="mt-4 flex justify-center">{accion}</div>}
    </div>
  );
}

/* ══ Panel lateral ═══════════════════════════════════════════ */

export function Panel({
  abierto,
  onCerrar,
  titulo,
  encabezado,
  subtitulo,
  pie,
  children,
}: {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  /** Reemplaza el título por una composición propia. */
  encabezado?: ReactNode;
  subtitulo?: ReactNode;
  pie?: ReactNode;
  children: ReactNode;
}) {
  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label={titulo}>
      <button
        aria-label="Cerrar"
        onClick={onCerrar}
        className="absolute inset-0 bg-navy/30 cursor-default anim-velo"
      />
      <div className="relative h-full w-full max-w-[540px] bg-surface border-l border-line shadow-e4 flex flex-col anim-panel">
        <div className="flex items-start gap-3 px-5 py-4 border-b border-line shrink-0">
          <div className="min-w-0 flex-1">
            {encabezado ?? <h2 className="t-section m-0 truncate">{titulo}</h2>}
            {subtitulo && <div className="t-secondary mt-1">{subtitulo}</div>}
          </div>
          <button
            onClick={onCerrar}
            aria-label="Cerrar"
            className="-mr-1 -mt-1 w-8 h-8 grid place-items-center rounded-lg text-ink-3
                       hover:bg-raised hover:text-ink text-[17px] leading-none flex-none"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {pie && (
          <div className="px-5 py-3.5 border-t border-line bg-raised flex flex-wrap items-center gap-2 shrink-0">
            {pie}
          </div>
        )}
      </div>
    </div>
  );
}

/** Par etiqueta/valor para los paneles de detalle. */
export function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 py-2 border-b border-line-soft last:border-0">
      <span className="t-label w-[112px] flex-none">{etiqueta}</span>
      <span className="text-[13.5px] text-ink min-w-0">{children}</span>
    </div>
  );
}

/* ══ Envoltorio de tabla ═════════════════════════════════════
   Toda tabla ancha scrollea dentro de su contenedor: el cuerpo de la
   página nunca scrollea de costado. */

export function TablaShell({
  children,
  minWidth,
}: {
  children: ReactNode;
  minWidth?: number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]" style={minWidth ? { minWidth } : undefined}>
        {children}
      </table>
    </div>
  );
}

export function Th({
  children,
  derecha,
  className,
}: {
  children?: ReactNode;
  derecha?: boolean;
  className?: string;
}) {
  return (
    <th className={cx("t-th px-4 py-2.5 font-medium", derecha ? "text-right" : "text-left", className)}>
      {children}
    </th>
  );
}
