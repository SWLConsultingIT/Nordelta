import Link from "next/link";
import { Button } from "@/components/ui";
import { IcoArrow, IcoBolt, IcoLedger, IcoShield, IcoLock, IcoScale } from "@/components/ui/icons";

const CAPACIDADES = [
  {
    Icon: IcoLedger,
    titulo: "Un solo libro mayor",
    texto:
      "Transacciones, cheques, transferencias y ajustes conviven en una única tabla. El saldo de cada cuenta se calcula al consultarlo, no en un proceso nocturno.",
  },
  {
    Icon: IcoBolt,
    titulo: "La velocidad de la planilla",
    texto:
      "Grilla editable con navegación por teclado y pegado directo desde Excel. Las conversiones se resuelven al salir de la celda.",
  },
  {
    Icon: IcoScale,
    titulo: "Multi-moneda de verdad",
    texto:
      "Pesos, dólares, euros y reales, cada uno con su saldo propio. Las conversiones guardan el monto original y la cotización aplicada.",
  },
  {
    Icon: IcoShield,
    titulo: "Trazabilidad completa",
    texto:
      "Cada cambio queda registrado con usuario, momento, valor anterior y valor nuevo. Nada se sobrescribe en silencio.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col bg-ground">
      {/* ── Barra ── */}
      <header className="sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center gap-3">
          <Marca />
          <Link href="/login" className="ml-auto">
            <Button variant="primary">Ingresar</Button>
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden border-b border-line">
        {/* Retícula y resplandor: dan profundidad sin recurrir a un degradado gigante */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              "linear-gradient(var(--color-line) 1px, transparent 1px), linear-gradient(90deg, var(--color-line) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(120% 100% at 15% 0%, black 15%, transparent 70%)",
            WebkitMaskImage: "radial-gradient(120% 100% at 15% 0%, black 15%, transparent 70%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 right-[-10%] w-[680px] h-[680px] rounded-full opacity-[0.10]"
          style={{ background: "radial-gradient(circle, var(--color-brand) 0%, transparent 62%)" }}
        />

        <div className="relative mx-auto max-w-6xl px-6 pt-24 pb-20">
          <span className="label-mono">Plataforma interna de operaciones</span>
          <h1 className="mt-5 max-w-[20ch] text-[clamp(2.6rem,6.4vw,4.25rem)] font-bold leading-[1.02] tracking-[-0.038em] text-balance">
            El libro mayor de Nordelta, al día a cada segundo.
          </h1>
          <p className="mt-7 max-w-[58ch] text-[clamp(1.02rem,2.1vw,1.2rem)] leading-relaxed text-ink-2">
            Reemplaza las planillas mensuales, los consolidados y la cadena de
            consultas por una sola base de datos. Cargá como en Excel, consultá
            como en un sistema.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link href="/login">
              <Button variant="primary" className="h-11 px-5 text-[14.5px]">
                Ingresar <IcoArrow className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/inicio">
              <Button className="h-11 px-5 text-[14.5px]">Recorrer la aplicación</Button>
            </Link>
            <span className="ml-1 flex items-center gap-2 text-[12.5px] text-ink-3">
              <IcoLock className="w-3.5 h-3.5" />
              Acceso restringido al personal autorizado
            </span>
          </div>
        </div>
      </section>

      {/* ── Tesis: de muchas planillas a una tabla ── */}
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="max-w-[62ch]">
            <span className="label-mono">El cambio de fondo</span>
            <h2 className="mt-3 text-[clamp(1.6rem,3.6vw,2.2rem)] font-bold tracking-[-0.026em] leading-[1.14] text-balance">
              Una planilla por día y por oficina se convierte en una fila con fecha.
            </h2>
            <p className="mt-4 text-[15.5px] leading-relaxed text-ink-2">
              Todo el andamiaje del sistema anterior existía para resolver un
              problema que una base de datos no tiene: juntar información que
              vivía repartida en archivos separados. Al desaparecer ese problema,
              desaparece el andamiaje.
            </p>
          </div>

          <Transformacion />
        </div>
      </section>

      {/* ── Capacidades ── */}
      <section className="border-b border-line">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <span className="label-mono">Qué resuelve</span>
          <div className="mt-6 grid gap-px bg-line border border-line rounded-2xl overflow-hidden md:grid-cols-2">
            {CAPACIDADES.map(({ Icon, titulo, texto }) => (
              <div key={titulo} className="bg-surface p-7">
                <span className="grid place-items-center w-10 h-10 rounded-xl bg-brand-wash text-brand">
                  <Icon className="w-[19px] h-[19px]" />
                </span>
                <h3 className="mt-4 text-[16px] font-semibold tracking-[-0.014em]">{titulo}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-ink-2 max-w-[46ch]">{texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Cierre ── */}
      <section className="bg-navy relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage:
              "linear-gradient(var(--color-brand-hi) 1px, transparent 1px), linear-gradient(90deg, var(--color-brand-hi) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(ellipse at 78% 20%, black, transparent 70%)",
            WebkitMaskImage: "radial-gradient(ellipse at 78% 20%, black, transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-6 py-20 flex flex-wrap items-end gap-10">
          <div className="max-w-[46ch]">
            <h2 className="text-[clamp(1.5rem,3.4vw,2.1rem)] font-bold tracking-[-0.026em] leading-[1.16] text-on-navy text-balance">
              Un saldo solo sirve si se puede explicar.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-on-navy-2">
              Cada número de la plataforma se remonta a los movimientos que lo
              componen, con la cotización que se usó y quién los cargó.
            </p>
          </div>
          <Link href="/login" className="ml-auto">
            <Button variant="primary" className="h-11 px-5 text-[14.5px]">
              Ingresar <IcoArrow className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="bg-navy border-t border-navy-3">
        <div className="mx-auto max-w-6xl px-6 py-7 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[11px] text-on-navy-3">
          <span className="text-on-navy-2">Nordelta Operations Platform</span>
          <span className="ml-auto">Desarrollado por SWL Consulting</span>
        </div>
      </footer>
    </div>
  );
}

function Marca() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="grid place-items-center w-[30px] h-[30px] rounded-lg font-mono text-[13px] font-bold text-white
                       bg-gradient-to-br from-brand-hi to-brand shadow-[0_2px_10px_-2px_rgba(30,95,209,.55)]">
        N
      </span>
      <span className="font-semibold tracking-[-0.017em]">Nordelta</span>
      <span className="font-mono text-[9px] tracking-[0.14em] uppercase text-ink-3 border border-line rounded px-1.5 py-0.5">
        Operaciones
      </span>
    </Link>
  );
}

/** Esquema del cambio de arquitectura. No muestra ningún dato: solo la
 *  forma del problema — muchos archivos separados contra una sola tabla. */
function Transformacion() {
  const hojas = Array.from({ length: 12 }, (_, i) => ({
    x: 12 + (i % 4) * 62,
    y: 16 + Math.floor(i / 4) * 46,
    r: (i * 7) % 5 - 2,
  }));

  return (
    <figure className="mt-12">
      <svg
        viewBox="0 0 880 200"
        role="img"
        aria-label="A la izquierda, una docena de planillas separadas. A la derecha, una sola tabla continua. En el medio, una flecha."
        className="w-full h-auto max-w-full text-ink-4"
      >
        <defs>
          <marker id="pta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0 L10 5 L0 10 z" fill="var(--color-brand)" />
          </marker>
        </defs>

        {/* Antes: archivos dispersos */}
        {hojas.map((h, i) => (
          <g key={i} transform={`translate(${h.x} ${h.y}) rotate(${h.r} 25 18)`}>
            <rect width="52" height="36" rx="3" fill="var(--color-raised)" stroke="var(--color-line)" strokeWidth="1.1" />
            <line x1="7" y1="11" x2="45" y2="11" stroke="var(--color-line)" strokeWidth="2" />
            <line x1="7" y1="19" x2="38" y2="19" stroke="var(--color-line)" strokeWidth="2" />
            <line x1="7" y1="27" x2="42" y2="27" stroke="var(--color-line)" strokeWidth="2" />
          </g>
        ))}
        <text x="140" y="188" textAnchor="middle" className="fill-current" style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: ".1em" }}>
          UNA PLANILLA POR DÍA Y OFICINA
        </text>

        {/* Flecha */}
        <line x1="300" y1="94" x2="392" y2="94" stroke="var(--color-brand)" strokeWidth="1.6" markerEnd="url(#pta)" />

        {/* Después: una sola tabla */}
        <g transform="translate(420 16)">
          <rect width="440" height="128" rx="8" fill="var(--color-surface)" stroke="var(--color-brand-line)" strokeWidth="1.4" />
          <rect width="440" height="26" rx="8" fill="var(--color-brand-wash)" />
          <rect y="18" width="440" height="8" fill="var(--color-brand-wash)" />
          <line x1="0" y1="26" x2="440" y2="26" stroke="var(--color-brand-line)" strokeWidth="1.2" />
          {[0, 1, 2, 3].map((r) => (
            <line key={r} x1="0" y1={26 + (r + 1) * 20.4} x2="440" y2={26 + (r + 1) * 20.4} stroke="var(--color-line-soft)" strokeWidth="1" />
          ))}
          {[92, 176, 260, 344].map((x) => (
            <line key={x} x1={x} y1="0" x2={x} y2="128" stroke="var(--color-line-soft)" strokeWidth="1" />
          ))}
          {[0, 1, 2, 3, 4].map((r) =>
            [14, 106, 190, 274, 358].map((x, c) => (
              <rect
                key={`${r}-${c}`}
                x={x}
                y={34 + r * 20.4}
                width={c === 0 ? 58 : c === 1 ? 52 : 44}
                height="5"
                rx="2.5"
                fill={r === 0 ? "var(--color-brand)" : "var(--color-line)"}
                opacity={r === 0 ? 0.5 : 1}
              />
            )),
          )}
        </g>
        <text x="640" y="188" textAnchor="middle" className="fill-current" style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: ".1em" }}>
          UNA TABLA CON UNA COLUMNA FECHA
        </text>
      </svg>
    </figure>
  );
}
