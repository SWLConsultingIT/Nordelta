"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "../ui";
import { IcoInicio, IcoGrid, IcoPeople, IcoBars, IcoScale, IcoShield } from "../ui/icons";

/**
 * Riel de navegación.
 *
 * Cinco destinos agrupados por para qué se entra. El estado activo se marca
 * con tres señales a la vez —fondo, color e indicador lateral— porque solo
 * con color se pierde de un barrido.
 *
 * La estructura es una grilla de tres filas para que el bloque de usuario
 * quede fijo abajo sin depender de la altura del contenido.
 */
const GRUPOS: {
  titulo: string | null;
  items: { href: string; label: string; Icon: (p: { className?: string }) => React.ReactNode }[];
}[] = [
  { titulo: null, items: [{ href: "/inicio", label: "Inicio", Icon: IcoInicio }] },
  { titulo: "Operación", items: [{ href: "/carga", label: "Carga", Icon: IcoGrid }] },
  {
    titulo: "Consultas",
    items: [
      { href: "/cuentas", label: "Cuentas", Icon: IcoPeople },
      { href: "/balance", label: "Balance", Icon: IcoBars },
    ],
  },
  {
    titulo: "Control",
    items: [
      { href: "/ajustes", label: "Ajustes", Icon: IcoScale },
      { href: "/auditoria", label: "Auditoría", Icon: IcoShield },
    ],
  },
];

export function Rail({
  email,
  oficina,
  demo,
}: {
  email: string;
  oficina: string;
  demo: boolean;
}) {
  const path = usePathname();

  return (
    <nav
      aria-label="Navegación principal"
      className="bg-navy border-r border-navy-3 md:grid md:grid-rows-[auto_1fr_auto] md:h-screen md:sticky md:top-0
                 flex items-center gap-1 px-3 py-3 md:py-4 overflow-x-auto md:overflow-visible"
    >
      {/* Marca */}
      <Link
        href="/inicio"
        className="flex items-center gap-2.5 px-1.5 md:mb-2 pr-4 md:pr-1.5 shrink-0 rounded-lg"
      >
        <span
          className="w-[28px] h-[28px] rounded-[9px] grid place-items-center font-mono text-[12.5px]
                     font-bold text-white flex-none bg-gradient-to-b from-brand-hi to-brand"
        >
          N
        </span>
        <span className="hidden md:flex flex-col leading-none gap-[3px]">
          <span className="text-on-navy text-[13.5px] font-semibold tracking-[-0.012em]">Nordelta</span>
          <span className="font-mono text-[8.5px] tracking-[0.14em] uppercase text-on-navy-3">
            {demo ? "Demostración" : "Operaciones"}
          </span>
        </span>
      </Link>

      {/* Navegación */}
      <div className="contents md:flex md:flex-col md:gap-0.5 md:min-h-0 md:overflow-y-auto">
        {GRUPOS.map((g, i) => (
          <div key={g.titulo ?? `g${i}`} className="contents md:block">
            {g.titulo && (
              <div className="hidden md:block font-mono text-[8.5px] tracking-[0.15em] uppercase
                              text-on-navy-3 px-2.5 pt-4 pb-1.5">
                {g.titulo}
              </div>
            )}
            {g.items.map(({ href, label, Icon }) => {
              const activo = path === href || path.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={activo ? "page" : undefined}
                  className={cx(
                    "relative flex items-center gap-2.5 px-2.5 h-[34px] rounded-lg text-[13px]",
                    "whitespace-nowrap shrink-0 transition-colors duration-100",
                    activo
                      ? "bg-navy-3 text-on-navy font-semibold"
                      : "text-on-navy-2 hover:bg-navy-2 hover:text-on-navy",
                  )}
                >
                  {activo && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-[16px] rounded-r
                                 bg-brand-hi"
                    />
                  )}
                  <Icon className={cx("w-[15px] h-[15px] flex-none", activo ? "text-brand-hi" : "opacity-75")} />
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* Usuario y contexto */}
      <div className="hidden md:block pt-3 mt-2 border-t border-navy-2">
        <div className="flex items-center gap-2.5 px-1.5">
          <span className="w-[26px] h-[26px] rounded-full bg-navy-3 text-on-navy grid place-items-center
                           text-[10px] font-semibold flex-none">
            {email.slice(0, 2).toUpperCase()}
          </span>
          <span className="min-w-0 leading-tight flex-1">
            <span className="block text-on-navy text-[11.5px] font-medium truncate">{email}</span>
            <span className="block font-mono text-[9px] tracking-[0.08em] uppercase text-on-navy-3 truncate">
              {oficina}
            </span>
          </span>
          <Link
            href="/"
            aria-label="Salir"
            className="w-7 h-7 grid place-items-center rounded-lg text-on-navy-3 hover:bg-navy-2
                       hover:text-on-navy flex-none"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}
                 strokeLinecap="round" className="w-[14px] h-[14px]" aria-hidden>
              <path d="M14 5.5H6.5v13H14M11 12h9M16.5 8.5 20 12l-3.5 3.5" />
            </svg>
          </Link>
        </div>
      </div>
    </nav>
  );
}
