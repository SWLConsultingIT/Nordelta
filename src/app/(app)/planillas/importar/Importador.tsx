"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Button, Card, CardBar, CardFoot, Estado, Field, Monto, Select,
  TablaShell, Th, Vacio, cx,
} from "@/components/ui";
import { IcoArrow, IcoDescargar } from "@/components/ui/icons";
import { usarAvisos } from "@/components/ui/Toast";
import { Cifra } from "@/components/operaciones/Banda";
import type { Cliente } from "@/lib/operaciones/tipos";
import {
  accionImportar, accionPrevisualizar, type Previsualizacion,
} from "./acciones";

/**
 * Importación en cuatro pasos, sin que nadie tenga que tocar el Excel.
 *
 * Seleccionar → parsear y normalizar → ver qué salió → confirmar. El paso
 * que importa es el tercero: antes de escribir nada se muestra qué se leyó,
 * cuántas filas están listas y cuáles tienen problema, con el motivo. Una
 * importación que falla después de guardar es mucho peor que una que avisa
 * antes.
 */
export function Importador({ clientes }: { clientes: Cliente[] }) {
  const [clienteId, setClienteId] = useState(clientes[0]?.id ?? "");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<Previsualizacion | null>(null);
  const [pendiente, iniciar] = useTransition();
  const entrada = useRef<HTMLInputElement>(null);
  const { avisar } = usarAvisos();
  const router = useRouter();

  const cuerpo = () => {
    const fd = new FormData();
    if (archivo) fd.set("archivo", archivo);
    fd.set("clienteId", clienteId);
    return fd;
  };

  const elegir = (f: File | null) => {
    setArchivo(f);
    setPrevia(null);
    if (!f) return;
    iniciar(async () => {
      const fd = new FormData();
      fd.set("archivo", f);
      fd.set("clienteId", clienteId);
      const r = await accionPrevisualizar(fd);
      if (!r.ok) return avisar(r.mensaje, { tono: "error" });
      setPrevia(r.datos);
    });
  };

  const confirmar = () =>
    iniciar(async () => {
      const r = await accionImportar(cuerpo());
      if (!r.ok) return avisar(r.mensaje, { tono: "error" });
      avisar(`${r.datos.operaciones} operaciones importadas`, {
        detalle:
          r.datos.acreditadas > 0
            ? `${r.datos.acreditadas} acreditaron en la misma corrida`
            : "Ninguna acreditó todavía: se reintenta con cada informe",
      });
      router.push(`/planillas/${r.datos.planillaId}`);
    });

  return (
    <div className="grid lg:grid-cols-[320px_minmax(0,1fr)] gap-4 items-start">
      {/* Paso 1 y 2 */}
      <Card>
        <CardBar><span className="t-label">Archivo</span></CardBar>
        <div className="px-4 py-4 flex flex-col gap-3.5">
          <Field label="Cliente">
            <Select value={clienteId} onChange={(e) => { setClienteId(e.target.value); setPrevia(null); }}>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </Select>
          </Field>

          <div>
            <span className="t-label">Planilla</span>
            <input
              ref={entrada}
              type="file"
              accept=".xlsx"
              className="sr-only"
              onChange={(e) => elegir(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => entrada.current?.click()}
              className={cx(
                "mt-1.5 w-full rounded-xl border border-dashed px-3.5 py-5 text-center transition-colors",
                archivo ? "border-brand-line bg-brand-wash" : "border-line-hard hover:border-brand hover:bg-raised",
              )}
            >
              <span className="block text-[13px] text-ink font-medium truncate">
                {archivo ? archivo.name : "Elegir archivo .xlsx"}
              </span>
              <span className="block mt-0.5 text-[11.5px] text-ink-4">
                {archivo
                  ? `${(archivo.size / 1024).toFixed(0)} KB · cambiar`
                  : "El que mandó el cliente, sin tocar"}
              </span>
            </button>
          </div>

          <p className="m-0 text-[11.5px] text-ink-3">
            No hace falta limpiarlo. Se ubica el encabezado aunque no esté arriba, se aceptan
            columnas de más, y los CUIT con guiones y los importes con formato argentino se
            normalizan solos.
          </p>

          <a
            href="/api/planilla-ejemplo"
            className="inline-flex items-center gap-1.5 text-[12px] text-brand hover:underline"
          >
            <IcoDescargar className="w-3.5 h-3.5" />
            Descargar una planilla de ejemplo
          </a>
        </div>
      </Card>

      {/* Paso 3 y 4 */}
      {!previa ? (
        <Card>
          <Vacio
            titulo={pendiente ? "Leyendo la planilla…" : "Elegí un archivo para ver qué trae"}
            texto={
              pendiente
                ? undefined
                : "Antes de guardar nada vas a ver cuántas operaciones se leyeron, cuáles están listas y cuáles tienen algún problema."
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          <Card>
            <CardBar>
              <span className="t-label">Qué se leyó</span>
              <span className="ml-auto text-[11.5px] text-ink-4 truncate">
                hoja «{previa.hoja}» · encabezado en la fila {previa.filaEncabezado}
              </span>
            </CardBar>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-5 py-4">
              <Cifra valor={previa.total} etiqueta="Operaciones" />
              <Cifra valor={previa.total - previa.conProblema} etiqueta="Listas" tono="pos" />
              <Cifra
                valor={previa.conProblema}
                etiqueta="Con algo que mirar"
                tono={previa.conProblema > 0 ? "warn" : "ink"}
              />
              <Cifra
                valor={<Monto valor={previa.totalImporte} moneda="ARS" tamano="xl" className="text-[22px] font-semibold" />}
                etiqueta="Total"
              />
            </div>

            {(previa.columnasFaltantes.length > 0 ||
              previa.columnasDesconocidas.length > 0 ||
              previa.filasOcultas > 0 ||
              previa.celdasConFormula > 0 ||
              previa.celdasCombinadas > 0) && (
              <CardFoot className="flex-col items-start gap-1">
                {previa.columnasFaltantes.length > 0 && (
                  <span className="text-neg">
                    Faltan columnas: {previa.columnasFaltantes.join(", ")}
                  </span>
                )}
                {previa.columnasDesconocidas.length > 0 && (
                  <span>Columnas de más, se ignoran: {previa.columnasDesconocidas.join(", ")}</span>
                )}
                {previa.filasOcultas > 0 && (
                  <span className="text-warn">
                    {previa.filasOcultas} filas ocultas en el archivo. Se leyeron igual.
                  </span>
                )}
                {previa.celdasCombinadas > 0 && (
                  <span>{previa.celdasCombinadas} celdas combinadas.</span>
                )}
                {previa.celdasConFormula > 0 && (
                  <span>{previa.celdasConFormula} celdas con fórmula: se usó el valor calculado.</span>
                )}
              </CardFoot>
            )}
          </Card>

          <Card>
            <CardBar>
              <span className="t-label">Vista previa</span>
              <span className="ml-auto t-num text-[11.5px] text-ink-4">
                {Math.min(previa.filas.length, 120)} de {previa.total}
              </span>
            </CardBar>
            <TablaShell minWidth={760}>
              <thead className="bg-raised border-b border-line">
                <tr>
                  <Th derecha>Fila</Th>
                  <Th>Fecha</Th>
                  <Th>Depositante</Th>
                  <Th>Identificación</Th>
                  <Th derecha>Importe</Th>
                  <Th>Estado</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {previa.filas.slice(0, 120).map((f) => (
                  <tr key={f.fila} className={cx(f.estado === "INVALIDA" && "bg-neg-wash/40")}>
                    <td className="px-4 py-2 text-right t-num text-ink-4">{f.fila}</td>
                    <td className="px-4 py-2 t-num text-ink-2">{f.fecha ?? "—"}</td>
                    <td className="px-4 py-2 text-ink truncate max-w-[180px]">{f.nombre ?? "—"}</td>
                    <td className="px-4 py-2 t-num text-[12px] text-ink-3">
                      {f.identificacion || "—"}
                      <span className="ml-1.5 text-[10px] uppercase tracking-wide text-ink-4">
                        {f.tipo === "DNI_PROBABLE" ? "dni" : f.tipo === "CUIT_VALIDO" ? "cuit" : "inválida"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {f.importe === null
                        ? <span className="text-ink-4">—</span>
                        : <Monto valor={f.importe} moneda="ARS" tamano="sm" className="text-ink" />}
                    </td>
                    <td className="px-4 py-2">
                      {f.estado === "VALIDA" ? (
                        <Estado tono="pos">Lista</Estado>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Estado tono={f.estado === "INVALIDA" ? "neg" : "warn"}>
                            {f.estado === "INVALIDA" ? "No se puede conciliar" : "Revisar"}
                          </Estado>
                          {f.errores[0] && (
                            <span className="text-[11px] text-ink-4 truncate max-w-[220px]">
                              {f.errores[0]}
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </TablaShell>
            <CardFoot>
              <span>
                Se importa todo, también lo que está mal: una fila con error queda registrada y
                visible, no desaparece.
              </span>
              <Button
                variant="primary"
                className="ml-auto"
                disabled={pendiente || previa.total === 0}
                onClick={confirmar}
              >
                {pendiente ? "Importando…" : <>Importar y conciliar <IcoArrow className="w-4 h-4" /></>}
              </Button>
            </CardFoot>
          </Card>
        </div>
      )}
    </div>
  );
}
