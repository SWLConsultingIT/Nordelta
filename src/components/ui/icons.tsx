type P = { className?: string };
const base = "w-[15px] h-[15px] flex-none";
const svg = (d: React.ReactNode, className?: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
       strokeLinecap="round" strokeLinejoin="round" className={className ?? base} aria-hidden="true">
    {d}
  </svg>
);

export const IcoInicio = ({ className }: P) => svg(<><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v10h13V10" /></>, className);
export const IcoGrid = ({ className }: P) => svg(<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M9 9v11M15 9v11" /></>, className);
export const IcoLedger = ({ className }: P) => svg(<path d="M4 5h16M4 10h16M4 15h10M4 20h7" />, className);
export const IcoBars = ({ className }: P) => svg(<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />, className);
export const IcoPeople = ({ className }: P) => svg(<><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" /><path d="M16 5.5a3.2 3.2 0 0 1 0 6M18 20c0-2.3-.9-4-2.3-5" /></>, className);
export const IcoScale = ({ className }: P) => svg(<><path d="M12 4v16M7 20h10M12 7 5 9l3 5 3-5M12 7l7 2-3 5-3-5" /></>, className);
export const IcoShield = ({ className }: P) => svg(<><path d="M12 3 5 6v6c0 4 3 7.5 7 9 4-1.5 7-5 7-9V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></>, className);
export const IcoArrow = ({ className }: P) => svg(<path d="M5 12h14M13 6l6 6-6 6" />, className);
export const IcoBolt = ({ className }: P) => svg(<path d="M13 3 5 14h6l-1 7 8-11h-6l1-7Z" />, className);
export const IcoLock = ({ className }: P) => svg(<><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8.5 10.5V7a3.5 3.5 0 0 1 7 0v3.5" /></>, className);
