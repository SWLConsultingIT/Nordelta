import Link from "next/link";
import { Button, Cifra } from "@/components/ui";
import { IcoArrow, IcoBolt, IcoLedger, IcoShield, IcoLock } from "@/components/ui/icons";

const CAPACIDADES = [
  {
    Icon: IcoLedger,
    titulo: "Un solo libro mayor",
    texto:
      "Transacciones, cheques, transferencias y ajustes conviven en una única tabla, con saldo por cliente y por moneda calculado en vivo.",
  },
  {
    Icon: IcoBolt,
    titulo: "Carga con la velocidad de la planilla",
    texto:
      "Grilla editable con navegación por teclado y pegado desde Excel. Las conversiones se calculan al salir de la celda.",
  },
  {
    Icon: IcoShield,
    titulo: "Trazabilidad completa",
    texto:
      "Cada cambio queda registrado con usuario, fecha, valor anterior y valor nuevo. Nada se sobrescribe en silencio.",
  },
];

/** Vista previa del balance, estática. Muestra el producto real
 *  en lugar de una ilustración abstracta. */
const PREVIEW = [
  { c: "Alvarez, J.", ars: "2.400.000", dec: ",00", usd: "—", cierre: true },
  { c: "Beltrán, R.", ars: "—", dec: "", usd: "3.570,00", cierre: false },
  { c: "Cabrera, M.", ars: "—", dec: "", usd: "1.500,00", cierre: true },
  { c: "Ibarra, C.", ars: "100.000", dec: ",00", usd: "34,34", cierre: false },
];

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Barra ── */}
      <header className="border-b border-line bg-surface/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-3">
          <span className="w-[30px] h-[30px] rounded-lg grid place-items-center font-mono text-[13px] font-bold text-white
                           bg-gradient-to-br from-brand-hi to-brand shadow-[0_2px_8px_-2px_rgba(30,95,209,.6)]">
            N
          </span>
          <span className="font-semibold tracking-[-0.015em]">Nordelta</span>
          <span className="font-mono text-[9px] tracking-[0.13em] uppercase text-ink-3 border border-line rounded px-1.5 py-0.5">
            Operaciones
          </span>
          <Link href="/login" className="ml-auto">
            <Button variant="primary">Ingresar</Button>
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-8 grid lg:grid-cols-[1fr_minmax(0,460px)] gap-14 items-center">
        <div>
          <span className="label-mono">Plataforma interna</span>
          <h1 className="mt-3 text-[clamp(2.1rem,5vw,3.2rem)] font-bold tracking-[-0.03em] leading-[1.06] text-balance">
            Las cuentas corrientes de Nordelta, en un solo lugar.
          </h1>
          <p className="mt-5 text-[17px] leading-relaxed text-ink-2 max-w-[54ch]">
            Reemplaza las planillas mensuales, los consolidados y la cadena de
            queries por una base de datos única. El saldo de cada cliente está
            siempre al día, en pesos, dólares, euros y reales.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login">
              <Button variant="primary" className="h-10 px-4">
                Ingresar <IcoArrow className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/inicio">
              <Button className="h-10 px-4">Ver la aplicación</Button>
            </Link>
          </div>
          <p className="mt-4 flex items-center gap-2 text-[12.5px] text-ink-3">
            <IcoLock className="w-3.5 h-3.5" />
            Acceso restringido al personal de Nordelta.
          </p>
        </div>

        {/* Vista previa */}
        <div className="bg-surface border border-line rounded-xl shadow-e3 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-line bg-raised">
            <span className="label-mono">Balance general</span>
            <span className="ml-auto font-mono text-[10px] text-pos bg-pos-wash px-1.5 py-0.5 rounded">
              en vivo
            </span>
          </div>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line">
                <th className="text-left label-mono px-4 py-2 font-medium">Cliente</th>
                <th className="text-right label-mono px-4 py-2 font-medium">ARS</th>
                <th className="text-right label-mono px-4 py-2 font-medium">USD</th>
              </tr>
            </thead>
            <tbody>
              {PREVIEW.map((r) => (
                <tr key={r.c} className="border-b border-line-soft last:border-0">
                  <td className="px-4 py-2.5 text-ink font-medium">
                    {r.c}
                    {r.cierre && (
                      <span className="ml-2 font-mono text-[9px] tracking-wider uppercase text-pos bg-pos-wash px-1.5 py-0.5 rounded">
                        cerrada
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right text-ink">
                    {r.ars === "—" ? <span className="text-ink-4">—</span> : <Cifra entero={r.ars} decimal={r.dec} />}
                  </td>
                  <td className="px-4 py-2.5 text-right text-ink">
                    {r.usd === "—" ? (
                      <span className="text-ink-4">—</span>
                    ) : (
                      <Cifra entero={r.usd.split(",")[0]} decimal={"," + r.usd.split(",")[1]} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Capacidades ── */}
      <section className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-3 gap-5">
        {CAPACIDADES.map(({ Icon, titulo, texto }) => (
          <div key={titulo} className="bg-surface border border-line rounded-xl p-5 shadow-e1">
            <span className="w-9 h-9 rounded-lg bg-brand-wash text-brand grid place-items-center mb-3.5">
              <Icon className="w-[18px] h-[18px]" />
            </span>
            <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{titulo}</h2>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">{texto}</p>
          </div>
        ))}
      </section>

      <footer className="mt-auto border-t border-line">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] text-ink-3">
          <span>Nordelta Operations Platform</span>
          <span className="ml-auto">Desarrollado por SWL Consulting</span>
        </div>
      </footer>
    </div>
  );
}
