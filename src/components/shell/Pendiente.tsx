export function Pendiente({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="bg-surface border border-dashed border-brand-line rounded-xl px-8 py-12 text-center">
      <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{titulo}</h2>
      <p className="mt-2 mx-auto max-w-[56ch] text-[13.5px] leading-relaxed text-ink-2">{texto}</p>
    </div>
  );
}
