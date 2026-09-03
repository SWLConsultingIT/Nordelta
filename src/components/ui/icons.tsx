/**
 * Iconografía.
 *
 * Un solo estilo: trazo de 1.7, extremos redondeados, caja de 24 y tamaño
 * óptico parejo. Mezclar pesos o estilos de ícono es lo que más rápido hace
 * que una interfaz se vea armada con piezas de distintos lados.
 */
type P = { className?: string };

const CAJA = "w-[15px] h-[15px] flex-none";

function svg(hijos: React.ReactNode, className?: string) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? CAJA}
      aria-hidden="true"
    >
      {hijos}
    </svg>
  );
}

/* ── Navegación ── */
export const IcoInicio = ({ className }: P) =>
  svg(<><path d="M3.5 11 12 4l8.5 7" /><path d="M6 9.6V20h12V9.6" /><path d="M10 20v-5h4v5" /></>, className);

export const IcoGrid = ({ className }: P) =>
  svg(<><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><path d="M3.5 9.5h17M9.5 9.5v10M15 9.5v10" /></>, className);

export const IcoPeople = ({ className }: P) =>
  svg(<><circle cx="9" cy="8.5" r="3" /><path d="M3.6 19.5c0-3 2.4-5 5.4-5s5.4 2 5.4 5" /><path d="M16 6a3 3 0 0 1 0 5.6M17.6 19.5c0-2-.7-3.6-2-4.6" /></>, className);

export const IcoBars = ({ className }: P) =>
  svg(<><path d="M3 20h18" /><path d="M6.5 20v-6M11.5 20V6M16.5 20v-9" /></>, className);

export const IcoScale = ({ className }: P) =>
  svg(<><path d="M12 4.5v15M7.5 19.5h9" /><path d="M12 7 5 9l3 4.6L11 9zM12 7l7 2-3 4.6L13 9z" /></>, className);

export const IcoShield = ({ className }: P) =>
  svg(<><path d="M12 3.5 5.5 6v5.6c0 3.8 2.7 7.1 6.5 8.4 3.8-1.3 6.5-4.6 6.5-8.4V6L12 3.5Z" /><path d="m9.3 11.8 2 2 3.4-3.6" /></>, className);

/* ── Acciones y adornos ── */
export const IcoArrow = ({ className }: P) =>
  svg(<path d="M4.5 12h15M13.5 6l6 6-6 6" />, className);

export const IcoMas = ({ className }: P) =>
  svg(<path d="M12 5.5v13M5.5 12h13" />, className);

export const IcoLock = ({ className }: P) =>
  svg(<><rect x="4.8" y="10.5" width="14.4" height="9.7" rx="2" /><path d="M8.4 10.5V7.4a3.6 3.6 0 0 1 7.2 0v3.1" /></>, className);

export const IcoBolt = ({ className }: P) =>
  svg(<path d="M13 3.5 5.5 14H11l-1 6.5L18.5 10H13l1-6.5Z" />, className);

export const IcoCheck = ({ className }: P) =>
  svg(<path d="m5 12.5 4.5 4.5L19 7" />, className);

export const IcoBuscar = ({ className }: P) =>
  svg(<><circle cx="10.5" cy="10.5" r="6.2" /><path d="m15.3 15.3 4.2 4.2" /></>, className);

export const IcoDescargar = ({ className }: P) =>
  svg(<><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" /><path d="M4.5 19.5h15" /></>, className);

export const IcoCheque = ({ className }: P) =>
  svg(<><rect x="2.5" y="6" width="19" height="12" rx="2" /><path d="M6.5 12h5M15 12h3" /></>, className);

export const IcoReloj = ({ className }: P) =>
  svg(<><circle cx="12" cy="12" r="8.2" /><path d="M12 7.6V12l3 2" /></>, className);
