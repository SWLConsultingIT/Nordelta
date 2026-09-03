import Link from "next/link";
import { Button } from "@/components/ui";
import { IcoArrow, IcoLock } from "@/components/ui/icons";

/**
 * Entrada al producto.
 *
 * Deliberadamente sobria y sin ningún dato: es una página sin autenticación.
 * Lo único que tiene que hacer es identificar el producto y dejar entrar.
 */
export default function Landing() {
  return (
    <div className="min-h-screen grid place-items-center bg-ground px-6">
      <div className="w-full max-w-[420px]">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl grid place-items-center font-mono text-[17px]
                           font-bold text-white bg-gradient-to-br from-brand-hi to-brand
                           shadow-[0_3px_12px_-3px_rgba(30,95,209,.55)]">
            N
          </span>
          <div>
            <h1 className="text-[22px] font-bold tracking-[-0.02em] leading-none">Nordelta</h1>
            <p className="text-[13px] text-ink-3 mt-1">Gestión financiera</p>
          </div>
        </div>

        <p className="mt-7 text-[14.5px] leading-relaxed text-ink-2">
          Cuentas corrientes multi-moneda, carga diaria y balance en un solo
          lugar. Plataforma interna de uso exclusivo del personal autorizado.
        </p>

        <Link href="/login" className="mt-7 block">
          <Button variant="primary" className="w-full h-11 text-[14.5px]">
            Ingresar <IcoArrow className="w-4 h-4" />
          </Button>
        </Link>

        <p className="mt-5 flex items-center gap-2 text-[12px] text-ink-4">
          <IcoLock className="w-3.5 h-3.5" />
          Acceso restringido
        </p>
      </div>

      <footer className="absolute bottom-6 font-mono text-[10.5px] text-ink-4">
        Desarrollado por SWL Consulting
      </footer>
    </div>
  );
}
