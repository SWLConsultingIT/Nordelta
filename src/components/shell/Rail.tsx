"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "../ui";
import { IcoInicio, IcoGrid, IcoPeople, IcoBars, IcoScale, IcoShield } from "../ui/icons";

/**
 * Navegación lateral.
 *
 * Corta y sin ambigüedad: cinco destinos agrupados por para qué se entra.
 * Un riel con veinte íconos obliga a leerlo cada vez.
 */
const GRUPOS = [
  {
    titulo: null,
    items: [{ href: "/inicio", label: "Inicio", Icon: IcoInicio }],
  },
  {
    titulo: "Operación",
    items: [{ href: "/carga", label: "Carga de movimientos", Icon: IcoGrid }],
  },
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
      { href: "/ajustes", label: "Ajustes de cuenta", Icon: IcoScale },
      { href: "/auditoria", label: "Auditoría", Icon: IcoShield },
    ],
  },
];

export function Rail({ email, demo }: { email: string; demo: boolean }) {
  const path = usePathname();

  return (
    <nav className="bg-navy border-r border-navy-3 flex md:flex-col gap-0.5 px-3 py-4 md:py-5
                    overflow-x-auto md:overflow-visible">
      <Link href="/inicio" className="flex items-center gap-2.5 px-2 md:pb-5 pr-4 md:pr-2 shrink-0">
        <span className="w-[30px] h-[30px] rounded-lg grid place-items-center font-mono text-[13px]
                         font-bold text-white flex-none bg-gradient-to-br from-brand-hi to-brand">
          N
        </span>
        <span className="hidden md:flex flex-col leading-tight">
          <span className="text-on-navy text-[13.5px] font-semibold tracking-[-0.01em]">Nordelta</span>
          <span className="font-mono text-[9px] tracking-[0.13em] uppercase text-on-navy-3">
            {demo ? "Demostración" : "Operaciones"}
          </span>
        </span>
      </Link>

      {GRUPOS.map((g, i) => (
        <div key={g.titulo ?? `g${i}`} className="contents md:block">
          {g.titulo && (
            <div className="hidden md:block font-mono text-[9px] tracking-[0.14em] uppercase
                            text-on-navy-3 px-2 pt-4 pb-1.5">
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
                  "flex items-center gap-2.5 px-2.5 py-2 rounded-[7px] text-[13px]",
                  "whitespace-nowrap shrink-0 transition-colors",
                  activo
                    ? "bg-navy-3 text-on-navy font-semibold shadow-[inset_2px_0_0_var(--color-brand-hi)]"
                    : "text-on-navy-2 hover:bg-navy-2 hover:text-on-navy",
                )}
              >
                <Icon className={cx("w-[15px] h-[15px] flex-none", activo ? "text-brand-hi" : "opacity-80")} />
                {label}
              </Link>
            );
          })}
        </div>
      ))}

      <div className="hidden md:flex mt-auto pt-3 border-t border-navy-2 items-center gap-2.5 px-1">
        <span className="w-[26px] h-[26px] rounded-full bg-navy-3 text-on-navy grid place-items-center
                         text-[10.5px] font-semibold flex-none">
          {email.slice(0, 2).toUpperCase()}
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block text-on-navy text-[12px] font-medium truncate">{email}</span>
          <Link href="/" className="font-mono text-[10px] text-on-navy-3 hover:text-on-navy-2">
            Salir
          </Link>
        </span>
      </div>
    </nav>
  );
}
