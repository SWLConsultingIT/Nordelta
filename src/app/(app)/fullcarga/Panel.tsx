"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardBar, CardFoot, Estado, Field, Input } from "@/components/ui";
import { IcoBolt } from "@/components/ui/icons";
import { usarAvisos } from "@/components/ui/Toast";
import {
  accionDescargar, accionSubirInforme, type ResultadoImporte,
} from "./acciones";

/**
 * Las dos formas de traer el informe.
 *
 * La automática es la que se probó contra Fullcarga de verdad: login, token
 * de Struts, formulario y descarga del XLS, con el resultado idéntico al del
 * archivo que baja Mati a mano. La manual existe porque un sistema del que
 * dependés y que no controlás **se cae**, y ese día hay que poder seguir
 * trabajando.
 *
 * Las credenciales viven solo en el entorno del servidor. No hay campo donde
 * escribirlas y no viajan al navegador.
 */
export function PanelFullcarga({
  hayCredenciales,
  desdePorDefecto,
  hastaPorDefecto,
  ultima,
  periodo,
  movimientos,
}: {
  hayCredenciales: boolean;
  desdePorDefecto: string;
  hastaPorDefecto: string;
  /** Cuándo se trajo información por última vez. */
  ultima: string | null;
  /** Qué rango cubre el último informe. */
  periodo: string | null;
  /** Cuántas acreditaciones hay en el pozo. */
  movimientos: number;
}) {
  const [desde, setDesde] = useState(desdePorDefecto);
  const [hasta, setHasta] = useState(hastaPorDefecto);
  const [resultado, setResultado] = useState<ResultadoImporte | null>(null);
  const [pendiente, iniciar] = useTransition();
  const entrada = useRef<HTMLInputElement>(null);
  const { avisar } = usarAvisos();
  const router = useRouter();

  const listo = (r: ResultadoImporte) => {
    setResultado(r);
    avisar(
      r.nuevasAcreditadas > 0
        ? `${r.nuevasAcreditadas} ${r.nuevasAcreditadas === 1 ? "operación acreditó" : "operaciones acreditaron"}`
        : "Informe cargado, sin acreditaciones nuevas",
      {
        tono: r.nuevasAcreditadas > 0 ? "ok" : "info",
        detalle: `${r.nuevas} registros nuevos · ${r.pendientes} siguen pendientes`,
      },
    );
    router.refresh();
  };

  const descargar = () =>
    iniciar(async () => {
      const r = await accionDescargar(desde, hasta);
      if (!r.ok) return avisar(r.mensaje, { tono: "error" });
      listo(r.datos);
    });

  const subir = (f: File | null) => {
    if (!f) return;
    iniciar(async () => {
      const fd = new FormData();
      fd.set("archivo", f);
      fd.set("desde", desde);
      fd.set("hasta", hasta);
      const r = await accionSubirInforme(fd);
      if (!r.ok) return avisar(r.mensaje, { tono: "error" });
      listo(r.datos);
    });
  };

  return (
    <>
      {/* Estado de la integración, en términos de operación.
          Nada de HTTP, tokens ni sesiones: eso es asunto del sistema, no
          de quien concilia. Lo que importa es si está conectado, hasta
          cuándo llegó la información y cuántos movimientos entraron. */}
      <Card className="mb-5">
        <div className="grid md:grid-cols-[minmax(0,1fr)_auto] gap-4 items-center px-5 py-4">
          <div className="grid sm:grid-cols-3 gap-5">
            <div>
              <div className="flex items-center gap-2">
                {hayCredenciales
                  ? <Estado tono="pos">Conectado</Estado>
                  : <Estado tono="warn">Sin conexión configurada</Estado>}
              </div>
              <p className="mt-1.5 mb-0 text-[11.5px] text-ink-4">
                {hayCredenciales
                  ? "El sistema puede pedir el informe por su cuenta."
                  : "Se puede seguir trabajando subiendo el informe a mano."}
              </p>
            </div>

            <div>
              <span className="t-metrica">Última actualización</span>
              <p className="mt-1 mb-0 text-[13.5px] text-ink">
                {ultima ?? <span className="text-ink-4">todavía no</span>}
              </p>
            </div>

            <div>
              <span className="t-metrica">Último período</span>
              <p className="mt-1 mb-0 text-[13.5px] text-ink t-num">
                {periodo ?? <span className="text-ink-4 font-sans">—</span>}
              </p>
              <p className="mt-0.5 mb-0 text-[11.5px] text-ink-4">
                <span className="t-num">{movimientos.toLocaleString("es-AR")}</span>{" "}
                movimientos procesados
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              disabled={!hayCredenciales || pendiente}
              onClick={descargar}
            >
              <IcoBolt className="w-4 h-4" />
              {pendiente ? "Actualizando…" : "Actualizar ahora"}
            </Button>
            <Button disabled={pendiente} onClick={() => entrada.current?.click()}>
              Subir informe
            </Button>
            <input
              ref={entrada}
              type="file"
              accept=".xls,.xlsx"
              className="sr-only"
              onChange={(e) => subir(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 px-5 py-3 border-t border-line bg-raised">
          <Field label="Desde">
            <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="h-9" />
          </Field>
          <Field label="Hasta">
            <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="h-9" />
          </Field>
          <p className="m-0 ml-auto max-w-[46ch] text-[11.5px] text-ink-3">
            El rango vale para las dos formas de traer el informe. Si Fullcarga no responde,
            el archivo subido a mano recorre exactamente el mismo camino.
          </p>
        </div>
      </Card>

      {resultado && (
        <Card className="mb-5">
          <CardBar>
            <Estado tono="pos">Informe procesado</Estado>
            <span className="ml-auto text-[11.5px] text-ink-4 truncate">
              {resultado.informe.archivo}
            </span>
          </CardBar>
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-line">
            <Dato n={resultado.acreditacionesLeidas} t="Acreditaciones leídas" />
            <Dato n={resultado.nuevas} t="Registros nuevos" />
            <Dato n={resultado.nuevasAcreditadas} t="Operaciones acreditadas" tono="text-pos" />
            <Dato n={resultado.pendientes} t="Siguen pendientes" tono="text-warn" />
          </div>
          <CardFoot>
            <span>
              Los registros repetidos no se cargan dos veces: los informes se superponen por
              diseño y duplicarlos rompería la relación uno a uno.
            </span>
            <Button size="sm" className="ml-auto" onClick={() => router.push("/conciliacion")}>
              Ver la conciliación
            </Button>
          </CardFoot>
        </Card>
      )}
    </>
  );
}

function Dato({ n, t, tono }: { n: number; t: string; tono?: string }) {
  return (
    <div className="px-4 py-3.5">
      <div className={`t-num text-[22px] font-semibold ${tono ?? "text-ink"}`}>{n}</div>
      <div className="t-metrica mt-1">{t}</div>
    </div>
  );
}
