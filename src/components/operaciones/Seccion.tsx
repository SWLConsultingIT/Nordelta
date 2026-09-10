import type { ReactNode } from "react";
import Link from "next/link";
import { Card, cx } from "@/components/ui";

/**
 * Encabezado de bloque dentro de una página.
 *
 * Un título en texto normal con una acción a la derecha, y la superficie
 * debajo. Reemplaza a la versalita monoespaciada dentro de una barra: en
 * una pantalla con cinco bloques, cinco rótulos en mayúsculas gritan todos
 * a la vez y ninguno se lee.
 */
export function Seccion({
  titulo,
  nota,
  enlace,
  textoEnlace = "Ver todo",
  children,
  className,
  sinTarjeta,
}: {
  titulo: string;
  nota?: ReactNode;
  enlace?: string;
  textoEnlace?: string;
  children: ReactNode;
  className?: string;
  /** Para contenido que no necesita superficie propia. */
  sinTarjeta?: boolean;
}) {
  return (
    <section className={cx("min-w-0", className)}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-2.5">
        <h2 className="t-bloque m-0">{titulo}</h2>
        {nota && <span className="text-[12px] text-ink-4">{nota}</span>}
        {enlace && (
          <Link
            href={enlace}
            className="ml-auto text-[12.5px] text-brand hover:underline whitespace-nowrap"
          >
            {textoEnlace}
          </Link>
        )}
      </div>
      {sinTarjeta ? children : <Card>{children}</Card>}
    </section>
  );
}
