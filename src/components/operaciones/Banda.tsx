import type { ReactNode } from "react";
import Link from "next/link";
import { Button, Card, cx } from "@/components/ui";
import { IcoArrow } from "@/components/ui/icons";

/**
 * El estado de la conciliación, en una sola lectura.
 *
 * La composición responde a una jerarquía explícita y no a un tablero de
 * métricas: a la izquierda **lo que el sistema resolvió solo**, que es el
 * argumento del producto; a la derecha **lo que queda para una persona**,
 * que es el trabajo. Todo lo demás —importes, flujo— va después y más chico.
 *
 * El porcentaje es el protagonista a propósito. «455 de 497» obliga a hacer
 * la cuenta; «91,5 % resueltas automáticamente» se entiende de un vistazo, y
 * es exactamente lo que hay que entender.
 *
 * Regla confirmada por NORD que ordena el resto: todo lo que el sistema no
 * cerró es un problema visible desde el día cero. Por eso «requieren
 * atención» tiene el mismo peso visual que el porcentaje y **no existe
 * ninguna sección donde esconder pendientes**.
 */

export interface Segmento {
  clave: string;
  etiqueta: string;
  valor: number;
  clase: string;
}

export function BarraProporcion({
  segmentos,
  className,
  alto = "h-[5px]",
}: {
  segmentos: readonly Segmento[];
  className?: string;
  alto?: string;
}) {
  const total = segmentos.reduce((a, s) => a + s.valor, 0) || 1;
  return (
    <div
      className={cx("flex rounded-full overflow-hidden bg-line-soft gap-px", alto, className)}
      role="img"
      aria-label={segmentos.map((s) => `${s.valor} ${s.etiqueta}`).join(", ")}
    >
      {segmentos
        .filter((s) => s.valor > 0)
        .map((s) => (
          <span
            key={s.clave}
            className={s.clase}
            style={{ width: `${(s.valor / total) * 100}%` }}
            title={`${s.etiqueta}: ${s.valor}`}
          />
        ))}
    </div>
  );
}

/** Los cinco segmentos de la partición, siempre en el mismo orden y color. */
export const segmentosDe = (r: {
  conciliadas: number; resueltas: number; pendientes: number; revision: number; errores: number;
}): Segmento[] => [
  { clave: "c", etiqueta: "conciliadas", valor: r.conciliadas, clase: "bg-pos" },
  { clave: "r", etiqueta: "resueltas", valor: r.resueltas, clase: "bg-brand" },
  { clave: "p", etiqueta: "pendientes", valor: r.pendientes, clase: "bg-warn/50" },
  { clave: "v", etiqueta: "en revisión", valor: r.revision, clase: "bg-warn" },
  { clave: "e", etiqueta: "con error", valor: r.errores, clase: "bg-neg" },
];

/** Un número con su rótulo. El número manda; el rótulo explica. */
export function Cifra({
  valor,
  etiqueta,
  nota,
  tono = "ink",
  tamano = "md",
}: {
  valor: ReactNode;
  etiqueta: string;
  nota?: ReactNode;
  tono?: "ink" | "pos" | "warn" | "neg" | "brand";
  tamano?: "sm" | "md" | "lg";
}) {
  const color =
    tono === "pos" ? "text-pos"
    : tono === "warn" ? "text-warn"
    : tono === "neg" ? "text-neg"
    : tono === "brand" ? "text-brand"
    : "text-ink";
  const tam =
    tamano === "lg" ? "text-[32px] leading-[1.04]"
    : tamano === "sm" ? "text-[18px] leading-[1.1]"
    : "text-[24px] leading-[1.08]";
  return (
    <div className="min-w-0">
      <div className={cx("t-num font-semibold tracking-[-0.022em]", tam, color)}>{valor}</div>
      <div className="t-metrica mt-1.5">{etiqueta}</div>
      {nota && <div className="mt-1 text-[11.5px] text-ink-4">{nota}</div>}
    </div>
  );
}

/**
 * Hero de conciliación.
 *
 * Dos mitades con pesos deliberadamente distintos, no cinco números
 * flotando: automatización contra trabajo pendiente.
 */
export function HeroConciliacion({
  titulo = "Conciliación de hoy",
  total,
  conciliadas,
  resueltas,
  pendientes,
  revision,
  errores,
  tasaAutomatica,
  masAntigua,
  href = "/conciliacion",
  cta = "Revisar excepciones",
  mostrarCta = true,
}: {
  titulo?: string;
  total: number;
  conciliadas: number;
  resueltas: number;
  pendientes: number;
  revision: number;
  errores: number;
  tasaAutomatica: number;
  masAntigua?: number;
  href?: string;
  cta?: string;
  mostrarCta?: boolean;
}) {
  const atencion = pendientes + revision + errores;

  return (
    <Card>
      <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] divide-y md:divide-y-0 md:divide-x divide-line">
        {/* Lo que el sistema resolvió solo */}
        <div className="px-6 py-5">
          <p className="t-bloque m-0">{titulo}</p>

          <div className="mt-4 flex items-baseline gap-2.5">
            <span className="t-num text-[44px] leading-none font-semibold tracking-[-0.03em] text-pos">
              {tasaAutomatica.toLocaleString("es-AR")}
              <span className="text-[26px] font-medium ml-0.5">%</span>
            </span>
          </div>
          <p className="mt-2 mb-0 text-[13px] text-ink-2">
            resueltas automáticamente
          </p>
          <p className="mt-0.5 mb-0 text-[12px] text-ink-4">
            <span className="t-num">{conciliadas}</span> de{" "}
            <span className="t-num">{total}</span> operaciones procesadas
            {resueltas > 0 && (
              <> · <span className="t-num">{resueltas}</span> resueltas por vos</>
            )}
          </p>

          <BarraProporcion
            className="mt-4"
            segmentos={segmentosDe({ conciliadas, resueltas, pendientes, revision, errores })}
          />
        </div>

        {/* Lo que queda para una persona */}
        <div className="px-6 py-5 flex flex-col">
          <div className="flex items-baseline gap-2.5">
            <span
              className={cx(
                "t-num text-[32px] leading-none font-semibold tracking-[-0.025em]",
                atencion > 0 ? "text-ink" : "text-ink-4",
              )}
            >
              {atencion}
            </span>
            <span className="text-[13px] text-ink-2">
              {atencion === 1 ? "requiere tu atención" : "requieren tu atención"}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-4">
            <Desglose n={pendientes} titulo="Pendientes" nota="monitorear" tono="warn" />
            <Desglose n={revision} titulo="Para revisar" nota="decidís vos" tono="warn" />
            <Desglose n={errores} titulo="Datos incorrectos" nota="avisar al cliente" tono="neg" />
          </div>

          <div className="mt-auto pt-4 flex flex-wrap items-center gap-3">
            {mostrarCta && atencion > 0 && (
              <Link href={href}>
                <Button variant="primary" size="sm">
                  {cta} <IcoArrow className="w-3.5 h-3.5" />
                </Button>
              </Link>
            )}
            {masAntigua !== undefined && masAntigua > 0 && (
              <span className="text-[11.5px] text-ink-4">
                La más antigua espera hace <span className="t-num">{masAntigua}</span> días
              </span>
            )}
            {atencion === 0 && (
              <span className="text-[12.5px] text-pos">
                Todo lo enviado está conciliado o resuelto.
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function Desglose({
  n, titulo, nota, tono,
}: { n: number; titulo: string; nota: string; tono: "warn" | "neg" }) {
  const vacio = n === 0;
  return (
    <div className="min-w-0">
      <span
        className={cx(
          "block t-num text-[19px] leading-none font-semibold tracking-[-0.02em]",
          vacio ? "text-ink-4" : tono === "neg" ? "text-neg" : "text-warn",
        )}
      >
        {n}
      </span>
      <span className="block mt-1.5 text-[12px] text-ink-2 truncate">{titulo}</span>
      <span className="block mt-px text-[11px] text-ink-4 truncate">{nota}</span>
    </div>
  );
}
