import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes } from "react";

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
