import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes } from "react";
import type { Moneda } from "@/lib/domain/types";
import { SIMBOLO, partirMonto } from "@/lib/format";

export function cx(...v: (string | false | null | undefined)[]) {
  return v.filter(Boolean).join(" ");
}

/* ── Botón ─────────────────────────────────────────────────── */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "default" | "ghost" | "danger";
  size?: "sm" | "md";
};
export function Button({ variant = "default", size = "md", className, ...p }: BtnProps) {
  return (
    <button
      {...p}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap",
        "transition-colors disabled:opacity-50 disabled:pointer-events-none",
        size === "sm" ? "h-8 px-3 text-[13px]" : "h-9 px-3.5 text-[13.5px]",
        variant === "primary" &&
          "bg-brand text-white border border-brand hover:bg-brand-hi hover:border-brand-hi shadow-e1",
        variant === "default" &&
          "bg-surface text-ink-2 border border-line hover:bg-raised hover:text-ink hover:border-brand-line shadow-e1",
        variant === "ghost" && "text-ink-3 hover:text-ink hover:bg-raised",
        variant === "danger" && "bg-neg-wash text-neg border border-transparent hover:brightness-95",
        className,
      )}
    />
  );
}

/* ── Tarjeta ───────────────────────────────────────────────── */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cx("bg-surface border border-line rounded-xl shadow-e2 overflow-hidden", className)}>
      {children}
    </div>
  );
}
export function CardBar({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cx("flex flex-wrap items-center gap-3 px-4 py-3 border-b border-line bg-raised", className)}>
      {children}
    </div>
  );
}
export function CardFoot({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cx("flex flex-wrap items-center gap-3 px-4 py-2.5 border-t border-line bg-raised text-xs text-ink-3", className)}>
      {children}
    </div>
  );
}

/* ── Insignia ──────────────────────────────────────────────── */
export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "brand" | "pos" | "neg" | "warn";
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-block font-mono text-[9px] tracking-[0.09em] uppercase px-1.5 py-0.5 rounded",
        tone === "neutral" && "bg-line-soft text-ink-3",
        tone === "brand" && "bg-brand-wash text-brand",
        tone === "pos" && "bg-pos-wash text-pos",
        tone === "neg" && "bg-neg-wash text-neg",
        tone === "warn" && "bg-warn-wash text-warn",
      )}
    >
      {children}
    </span>
  );
}

/* ── Campo ─────────────────────────────────────────────────── */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label-mono">{label}</span>
      {children}
    </label>
  );
}
export function Input({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...p}
      className={cx(
        "h-9 rounded-lg bg-surface border border-line px-2.5 text-[13.5px] text-ink",
        "placeholder:text-ink-4 shadow-e1 focus:border-brand",
        className,
      )}
    />
  );
}

/* ── Control segmentado ────────────────────────────────────── */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex gap-0.5 p-0.5 rounded-[10px] bg-raised border border-line shadow-e1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            "px-2.5 h-7 rounded-lg text-[12.5px] whitespace-nowrap transition-colors",
            o.value === value
              ? "bg-surface text-brand font-semibold shadow-e1"
              : "text-ink-3 hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ── Interruptor ───────────────────────────────────────────── */
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
    <label className="inline-flex items-center gap-2.5 cursor-pointer select-none text-[13px] text-ink-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
      <span
        className={cx(
          "relative w-[34px] h-[19px] rounded-full flex-none transition-colors",
          "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brand peer-focus-visible:outline-offset-2",
          checked ? "bg-brand" : "bg-line",
        )}
      >
        <span
          className={cx(
            "absolute top-0.5 left-0.5 w-[15px] h-[15px] rounded-full bg-surface shadow transition-transform",
            checked && "translate-x-[15px]",
          )}
        />
      </span>
      {children}
    </label>
  );
}

/* ── Cifra con decimales atenuados ─────────────────────────── */
export function Cifra({
  entero,
  decimal,
  className,
}: {
  entero: string;
  decimal: string;
  className?: string;
}) {
  return (
    <span className={cx("font-mono tnum", className)}>
      {entero}
      <span className="opacity-45 font-medium">{decimal}</span>
    </span>
  );
}

/* ── Encabezado de página ──────────────────────────────────── */
export function PageHead({
  title,
  sub,
  actions,
}: {
  title: string;
  sub?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end gap-4 mb-5">
      <div>
        <h1 className="text-[21px] font-bold tracking-[-0.021em] leading-tight m-0">{title}</h1>
        {sub && <p className="text-[13px] text-ink-3 mt-1 m-0">{sub}</p>}
      </div>
      {actions && <div className="ml-auto flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/* ── Monto con símbolo de moneda ───────────────────────────── */
// Se usa en toda la aplicación para que un importe se vea siempre igual:
// símbolo, miles con punto, decimales con coma y atenuados.

export function Monto({
  valor,
  moneda,
  className,
  conSigno,
  tamano = "normal",
}: {
  valor: number;
  moneda: Moneda;
  className?: string;
  /** Muestra el signo + en los positivos. Útil en una columna de impacto. */
  conSigno?: boolean;
  tamano?: "normal" | "grande";
}) {
  const { entero, decimal } = partirMonto(Math.abs(valor), moneda);
  const signo = valor < 0 ? "−" : conSigno && valor > 0 ? "+" : "";
  return (
    <span className={cx("font-mono tnum whitespace-nowrap", className)}>
      <span className={cx("text-ink-3", tamano === "grande" ? "mr-1.5 text-[0.62em]" : "mr-1 text-[0.78em]")}>
        {signo}{SIMBOLO[moneda]}
      </span>
      {entero}
      <span className="opacity-45 font-medium">{decimal}</span>
    </span>
  );
}

/** Guion tenue para un valor que no existe, en lugar de un 0,00 que confunde. */
export function SinValor() {
  return <span className="text-ink-4 font-mono">—</span>;
}

/* ── Estados vacíos ────────────────────────────────────────── */

export function Vacio({
  titulo,
  texto,
  accion,
}: {
  titulo: string;
  texto?: string;
  accion?: ReactNode;
}) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="text-[14.5px] font-semibold text-ink">{titulo}</p>
      {texto && <p className="mt-1.5 mx-auto max-w-[46ch] text-[13px] text-ink-3">{texto}</p>}
      {accion && <div className="mt-4 flex justify-center">{accion}</div>}
    </div>
  );
}

/* ── Panel lateral ─────────────────────────────────────────── */

export function Panel({
  abierto,
  onCerrar,
  titulo,
  subtitulo,
  pie,
  children,
}: {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  subtitulo?: string;
  pie?: ReactNode;
  children: ReactNode;
}) {
  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label={titulo}>
      <button
        aria-label="Cerrar"
        onClick={onCerrar}
        className="absolute inset-0 bg-navy/25 backdrop-blur-[1px] cursor-default"
      />
      <div className="relative h-full w-full max-w-[520px] bg-surface border-l border-line shadow-e3 flex flex-col">
        <div className="flex items-start gap-3 px-5 py-4 border-b border-line">
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold tracking-[-0.014em] truncate">{titulo}</h2>
            {subtitulo && <p className="text-[12.5px] text-ink-3 mt-0.5">{subtitulo}</p>}
          </div>
          <button
            onClick={onCerrar}
            aria-label="Cerrar"
            className="ml-auto -mr-1 -mt-1 w-8 h-8 grid place-items-center rounded-lg text-ink-3
                       hover:bg-raised hover:text-ink text-[18px] leading-none"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {pie && <div className="px-5 py-3.5 border-t border-line bg-raised flex flex-wrap gap-2">{pie}</div>}
      </div>
    </div>
  );
}

/** Par etiqueta/valor, para los detalles. */
export function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 py-2 border-b border-line-soft last:border-0">
      <span className="label-mono w-[124px] flex-none">{etiqueta}</span>
      <span className="text-[13.5px] text-ink min-w-0">{children}</span>
    </div>
  );
}
