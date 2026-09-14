"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "../ui";
import {
  IcoInicio, IcoGrid, IcoPeople, IcoBars, IcoScale, IcoShield,
  IcoCheck, IcoPlanilla, IcoCliente, IcoBolt,
} from "../ui/icons";

/**
 * Riel de navegación.
 *
 * Tres grupos que responden a para qué se entra: **operación** —el trabajo
 * diario de Mati—, **finanzas** —el libro— y **control**. El orden no es
 * decorativo: acreditaciones va primero porque es el trabajo principal.
 *
 * El estado activo se marca con fondo e indicador lateral, no con color
 * saturado: en una barra oscura, un azul fuerte compite con el contador de
 * excepciones, que es lo único que tiene que llamar la atención.
 */
const GRUPOS: {
  titulo: string | null;
  items: {
    href: string;
    label: string;
    Icon: (p: { className?: string }) => React.ReactNode;
    /** Nombre del contador que se muestra al lado, si hay alguno. */
    contador?: "atencion";
  }[];
}[] = [
  { titulo: null, items: [{ href: "/inicio", label: "Inicio", Icon: IcoInicio }] },
  {
    titulo: "Operación",
    items: [
      { href: "/conciliacion", label: "Conciliación", Icon: IcoCheck, contador: "atencion" },
      { href: "/planillas", label: "Planillas", Icon: IcoPlanilla },
      { href: "/clientes", label: "Clientes", Icon: IcoCliente },
    ],
  },
  {
    titulo: "Finanzas",
    items: [
      { href: "/cuentas", label: "Cuentas", Icon: IcoPeople },
      { href: "/balance", label: "Balance", Icon: IcoBars },
    ],
  },
  {
    titulo: "Control",
    items: [
      { href: "/auditoria", label: "Auditoría", Icon: IcoShield },
    ],
  },
];

/**
 * Lo que no compite con el trabajo diario.
 *
 * Fullcarga es una integración, no algo que Mati administre: se actualiza
 * desde la conciliación y su pantalla es para cuando algo falla. La carga
 * de movimientos y los ajustes existen, pero no son el flujo principal.
 * Ponerlos al mismo nivel obligaba a decidir entre nueve destinos cada vez
 * que se entra.
 */
const SECUNDARIOS: { href: string; label: string; Icon: (p: { className?: string }) => React.ReactNode }[] = [
  { href: "/fullcarga", label: "Fullcarga", Icon: IcoBolt },
  { href: "/carga", label: "Carga manual", Icon: IcoGrid },
  { href: "/ajustes", label: "Ajustes", Icon: IcoScale },
];


/** Iniciales para el avatar. Dos letras, del nombre y no del correo. */
function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export function Rail({
  nombre,
  email,
  organizacion,
  demo,
  atencion = 0,
}: {
  /** Nombre para mostrar. Nunca un identificador técnico. */
  nombre: string;
  email: string;
  organizacion: string;
  demo: boolean;
  /** Operaciones que requieren que alguien haga algo. Visible desde
   *  cualquier pantalla: es lo primero que Mati necesita saber. */
  atencion?: number;
}) {
  const path = usePathname();

  return (
    <nav
      aria-label="Navegación principal"
      className="bg-navy border-r border-navy-2 md:grid md:grid-rows-[auto_1fr_auto] md:h-screen
                 md:sticky md:top-0 md:overflow-hidden
                 flex items-center gap-1 px-3 py-3 md:px-3 md:py-4 overflow-x-auto md:overflow-x-hidden"
    >
      {/* Marca */}
      <Link
        href="/inicio"
        className="flex items-center gap-2.5 px-1.5 md:mb-1 pr-4 md:pr-1.5 shrink-0 rounded-lg"
      >
        <span
          className="w-[26px] h-[26px] rounded-lg grid place-items-center font-mono text-[12px]
                     font-semibold text-on-navy flex-none bg-navy-4 border border-navy-4"
        >
          N
        </span>
        <span className="hidden md:flex items-baseline gap-1.5 min-w-0">
          <span className="text-on-navy text-[13.5px] font-semibold tracking-[-0.012em] truncate">
            Pagos Nordelta
          </span>
          {demo && (
            <span className="text-[9px] font-medium tracking-[0.04em] uppercase text-on-navy-3
                             border border-navy-4 rounded px-1 py-px leading-[1.4]">
              demo
            </span>
          )}
        </span>
      </Link>

      {/* Navegación */}
      <div className="contents md:flex md:flex-col md:gap-px md:min-h-0 md:overflow-y-auto md:pt-2">
        {GRUPOS.map((g, i) => (
          <div key={g.titulo ?? `g${i}`} className="contents md:block">
            {g.titulo && (
              <div className="hidden md:block text-[10.5px] font-medium tracking-[0.02em]
                              text-on-navy-3 px-2.5 pt-5 pb-1.5">
                {g.titulo}
              </div>
            )}
            {g.items.map(({ href, label, Icon, contador }) => {
              const activo = path === href || path.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={activo ? "page" : undefined}
                  className={cx(
                    "relative flex items-center gap-2.5 px-2.5 h-[32px] rounded-lg text-[13px]",
                    "whitespace-nowrap shrink-0 transition-colors duration-150",
                    activo
                      ? "bg-navy-3 text-on-navy font-medium"
                      : "text-on-navy-2 hover:bg-navy-2 hover:text-on-navy",
                  )}
                >
                  {activo && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-[14px] rounded-r bg-brand-hi"
                    />
                  )}
                  <Icon className={cx("w-[15px] h-[15px] flex-none", activo ? "text-on-navy" : "opacity-70")} />
                  <span className="min-w-0 truncate">{label}</span>
                  {contador === "atencion" && atencion > 0 && (
                    <span
                      className="ml-auto hidden md:block t-num text-[10.5px] font-medium text-warn-hi tabular-nums"
                      title={`${atencion} requieren atención`}
                    >
                      {atencion}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* Secundario: presente pero sin competir con el flujo. */}
      <div className="hidden md:flex md:flex-col md:gap-px md:mt-auto md:pt-4">
        {SECUNDARIOS.map(({ href, label, Icon }) => {
          const activo = path === href || path.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              aria-current={activo ? "page" : undefined}
              className={cx(
                "relative flex items-center gap-2.5 px-2.5 h-[30px] rounded-lg text-[12.5px]",
                "whitespace-nowrap transition-colors duration-150",
                activo
                  ? "bg-navy-3 text-on-navy font-medium"
                  : "text-on-navy-3 hover:bg-navy-2 hover:text-on-navy-2",
              )}
            >
              <Icon className="w-[14px] h-[14px] flex-none opacity-70" />
              <span className="min-w-0 truncate">{label}</span>
            </Link>
          );
        })}
      </div>

      {/* Usuario */}
      <div className="hidden md:flex items-center gap-2.5 mt-3 pt-3 px-1.5 border-t border-navy-2">
        <span
          className="w-[24px] h-[24px] rounded-full bg-navy-3 text-on-navy-2 grid place-items-center
                     text-[9.5px] font-semibold flex-none"
          title={email}
        >
          {iniciales(nombre)}
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-on-navy-2 text-[11.5px] truncate">{nombre}</span>
          <span className="block text-[10px] text-on-navy-3 truncate">{organizacion}</span>
        </span>
        <Link
          href="/"
          aria-label="Salir"
          className="w-7 h-7 grid place-items-center rounded-lg text-on-navy-3 hover:bg-navy-2
                     hover:text-on-navy flex-none transition-colors duration-150"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}
               strokeLinecap="round" className="w-[14px] h-[14px]" aria-hidden>
            <path d="M14 5.5H6.5v13H14M11 12h9M16.5 8.5 20 12l-3.5 3.5" />
          </svg>
        </Link>
      </div>
    </nav>
  );
}
