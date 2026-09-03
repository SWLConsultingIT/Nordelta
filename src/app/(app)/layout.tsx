import { Rail } from "@/components/shell/Rail";
import { ProveedorDeAvisos } from "@/components/ui/Toast";
import { esDemo, getOficinas } from "@/lib/data";
import { sesionActual } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [sesion, oficinas] = await Promise.all([sesionActual(), getOficinas()]);

  return (
    <ProveedorDeAvisos>
      <div className="md:grid md:grid-cols-[212px_minmax(0,1fr)] min-h-screen">
        <Rail
          email={sesion?.email ?? "demo@nordelta.com"}
          oficina={oficinas[0]?.nombre ?? "Nordelta"}
          demo={esDemo}
        />
        {/* El ancho máximo evita que las tablas se estiren a lo absurdo en
            monitores grandes, sin apretarlas en una notebook. */}
        <main className="min-w-0">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-5 xl:px-8 py-6 pb-16">{children}</div>
        </main>
      </div>
    </ProveedorDeAvisos>
  );
}
