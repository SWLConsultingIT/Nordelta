import { Rail } from "@/components/shell/Rail";
import { ProveedorDeAvisos } from "@/components/ui/Toast";
import { esDemo, getOficinas } from "@/lib/data";
import { getResumenOperativo, OPERACIONES_MIGRADAS } from "@/lib/data/operaciones";
import { perfilActual } from "@/lib/auth";
import { ErrorConfiguracion } from "@/lib/data/contexto";

/**
 * Un despliegue al que le falta una variable no puede decir «error del
 * servidor».
 *
 * Pasó de verdad y costó horas: la aplicación fallaba cerrada —que es lo
 * correcto— pero la pantalla decía «A server error occurred», el mensaje
 * quedaba en los registros del proveedor, y quien despliega no tiene por
 * qué ir a buscarlo ahí. Un error de configuración es la clase de falla que
 * **se arregla mirándola**, así que se muestra.
 *
 * Lo que se muestra son **nombres de variables, nunca valores**: es
 * exactamente lo que construye `faltantes()`, y por eso se puede poner en
 * pantalla sin pensarlo dos veces.
 */
function Configuracion({ detalle }: { detalle: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-navy px-6 text-on-navy antialiased">
      <div className="w-full max-w-[520px]">
        <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-on-navy-2">
          Configuración
        </span>
        <span aria-hidden className="mt-5 block h-px w-full bg-white/22" />
        <h1 className="mt-8 text-[30px] font-semibold leading-[1.1] tracking-[-0.03em] text-white">
          Falta configurar el entorno.
        </h1>
        <p className="mt-5 rounded-[3px] border border-warn-hi/35 bg-warn-hi/10 px-4 py-3 text-[14px] leading-[1.55] text-warn-hi">
          {detalle}
        </p>
        <p className="mt-6 text-[14px] leading-[1.6] text-on-navy-2">
          La aplicación no adivina el modo de datos: prefiere no arrancar antes que
          servir la información equivocada. Cargá la variable en el entorno del
          despliegue y volvé a publicar.
        </p>
      </div>
    </div>
  );
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let perfil, oficinas, resumen;
  try {
    [perfil, oficinas, resumen] = await Promise.all([
      perfilActual(),
      getOficinas(),
      getResumenOperativo(),
    ]);
  } catch (e) {
    if (e instanceof ErrorConfiguracion) return <Configuracion detalle={e.message} />;
    throw e;
  }

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
