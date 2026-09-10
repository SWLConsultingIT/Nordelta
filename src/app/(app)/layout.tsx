import { Rail } from "@/components/shell/Rail";
import { ProveedorDeAvisos } from "@/components/ui/Toast";
import { esDemo, getOficinas } from "@/lib/data";
import { getResumenOperativo, OPERACIONES_MIGRADAS } from "@/lib/data/operaciones";
import { perfilActual } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [perfil, oficinas, resumen] = await Promise.all([
    perfilActual(),
    getOficinas(),
    getResumenOperativo(),
  ]);

  return (
    <ProveedorDeAvisos>
      <div className="md:grid md:grid-cols-[216px_minmax(0,1fr)] min-h-screen">
        <Rail
          nombre={perfil?.nombre ?? "Invitado"}
          email={perfil?.email ?? ""}
          organizacion={perfil?.organizacion?.nombre ?? oficinas[0]?.nombre ?? "Nordelta"}
          demo={esDemo}
          atencion={resumen.requierenAtencion}
        />
        {/* El ancho máximo evita que las tablas se estiren a lo absurdo en
            monitores grandes, sin apretarlas en una notebook: a 1440 el
            contenido respira y a 1728 no queda una fila de 1500 px que hay
            que recorrer con la cabeza. */}
        <main className="min-w-0">
          {/* Si el modo demostración está apagado pero el dominio operativo
              todavía no corre contra la base, hay que decirlo. Servir un
              archivo local creyendo que es Postgres es el error que nadie
              descubre hasta que importa. */}
          {!esDemo && !OPERACIONES_MIGRADAS && (
            <div className="bg-warn-wash border-b border-warn-line px-5 xl:px-8 py-2 text-[12.5px] text-warn">
              Acreditaciones y conciliación todavía se sirven desde el almacén local.
              Las tablas existen en las migraciones 0006 y 0007, sin aplicar.
            </div>
          )}
          <div className="mx-auto max-w-[1320px] px-5 xl:px-8 py-7 pb-20">{children}</div>
        </main>
      </div>
    </ProveedorDeAvisos>
  );
}
