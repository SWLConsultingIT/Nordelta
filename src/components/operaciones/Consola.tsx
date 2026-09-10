"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Badge, Button, Card, CardBar, CardFoot, Dato, Estado, FilterTabs, Buscador,
  Monto, Panel, Select, TablaShell, Th, Toggle, Vacio, cx,
} from "@/components/ui";
import { IcoArrow, IcoCheck, IcoReloj } from "@/components/ui/icons";
import { usarAvisos } from "@/components/ui/Toast";
import { BUCKETS, ESTADOS, tonoDe } from "@/lib/operaciones/buckets";
import type { Bucket, Cliente, Decision, Evento } from "@/lib/operaciones/tipos";
import type { OperacionVista } from "@/lib/data/operaciones";
import { fechaCorta } from "@/lib/operaciones/fechas";
import { accionActualizar, accionResolver } from "@/app/(app)/conciliacion/acciones";

/**
 * Consola de conciliación.
 *
 * Es la pantalla donde Mati trabaja, y por eso está construida como una
 * herramienta y no como un tablero: densa, filtrable y con la decisión a un
 * clic de distancia. El filtro por defecto es **lo que requiere atención**,
 * porque las 455 que se resolvieron solas no necesitan que nadie las mire.
 *
 * La cola puede llegar a miles de filas —la mitad del volumen acredita
 * después de D+1—, así que buscar, filtrar y ordenar no son un extra: son la
 * diferencia entre una lista usable y uno de esos listados infinitos que
 * nadie abre.
 */

type Vista = "ATENCION" | Bucket | "TODAS";

const ORDENES = [
  { v: "ANTIGUEDAD", t: "Más antiguas primero" },
  { v: "IMPORTE", t: "Mayor importe" },
  { v: "FECHA", t: "Depósito más reciente" },
  { v: "CLIENTE", t: "Por cliente" },
] as const;

const ATENCION: Bucket[] = ["PENDIENTE", "REVISION", "ERROR"];

/**
 * Qué hacer, en dos palabras.
 *
 * La explicación larga vive en el panel de detalle. En la tabla, una frase
 * de sesenta caracteres se corta a la mitad y deja de informar: lo que sirve
 * de un barrido es el verbo.
 */
const ACCION: Record<Bucket, string> = {
  CONCILIADA: "—",
  RESUELTA: "—",
  PENDIENTE: "Monitorear",
  REVISION: "Revisar",
  ERROR: "Avisar al cliente",
};

export function Consola({
  operaciones,
  clientes,
  vistaInicial = "ATENCION",
  clienteFijo,
  compacta,
}: {
  operaciones: OperacionVista[];
  clientes: Cliente[];
  vistaInicial?: Vista;
  /** Cuando la consola vive dentro de un cliente, no se ofrece el filtro. */
  clienteFijo?: string;
  /** Sin barra de acciones ni tabs: para incrustarla en un detalle. */
  compacta?: boolean;
}) {
  const [vista, setVista] = useState<Vista>(vistaInicial);
  const [texto, setTexto] = useState("");
  const [cliente, setCliente] = useState(clienteFijo ?? "");
  const [orden, setOrden] = useState<(typeof ORDENES)[number]["v"]>("ANTIGUEDAD");
  const [minDias, setMinDias] = useState(0);
  const [tope, setTope] = useState(60);
  const [abierta, setAbierta] = useState<OperacionVista | null>(null);
  const [pendiente, iniciar] = useTransition();
  const { avisar } = usarAvisos();

  const cuentas = useMemo(() => {
    const c: Record<string, number> = { TODAS: operaciones.length, ATENCION: 0 };
    for (const o of operaciones) {
      c[o.bucket] = (c[o.bucket] ?? 0) + 1;
      if (ATENCION.includes(o.bucket)) c.ATENCION += 1;
    }
    return c;
  }, [operaciones]);

  const filtradas = useMemo(() => {
    const t = texto.trim().toLowerCase();
    const filas = operaciones.filter((o) => {
      if (vista === "ATENCION" && !ATENCION.includes(o.bucket)) return false;
      if (vista !== "ATENCION" && vista !== "TODAS" && o.bucket !== vista) return false;
      if (cliente && o.clienteId !== cliente) return false;
      if (minDias && o.diasPendiente < minDias) return false;
      if (t === "") return true;
      return (
        (o.nombreDepositante ?? "").toLowerCase().includes(t) ||
        o.identificacionOriginal.toLowerCase().includes(t) ||
        o.identificacionNormalizada.includes(t) ||
        (o.numeroDeposito ?? "").includes(t) ||
        o.cliente.nombre.toLowerCase().includes(t)
      );
    });
    return [...filas].sort((a, b) => {
      if (orden === "IMPORTE") return b.importe - a.importe;
      if (orden === "FECHA") return a.fechaDeposito < b.fechaDeposito ? 1 : -1;
      if (orden === "CLIENTE") {
        const c = a.cliente.nombre.localeCompare(b.cliente.nombre, "es");
        return c !== 0 ? c : b.diasPendiente - a.diasPendiente;
      }
      return b.diasPendiente - a.diasPendiente || b.importe - a.importe;
    });
  }, [operaciones, vista, texto, cliente, minDias, orden]);

  const visibles = filtradas.slice(0, tope);
  const totalFiltrado = filtradas.reduce((a, o) => a + o.importe, 0);

  const actualizar = () =>
    iniciar(async () => {
      const r = await accionActualizar();
      if (!r.ok) return avisar(r.mensaje, { tono: "error" });
      const { nuevasAcreditadas, pendientesAlCierre, porMapeo } = r.datos;
      avisar(
        nuevasAcreditadas > 0
          ? `${nuevasAcreditadas} ${nuevasAcreditadas === 1 ? "operación encontró" : "operaciones encontraron"} acreditación`
          : "Sin novedades: nada nuevo acreditó",
        {
          tono: nuevasAcreditadas > 0 ? "ok" : "info",
          detalle: `${pendientesAlCierre} siguen pendientes${porMapeo > 0 ? ` · ${porMapeo} por identidad confirmada` : ""}`,
        },
      );
    });

  const resolver = (decision: Decision, acreditacionId: string | null, aprender: boolean) => {
    if (!abierta) return;
    if (decision === "CONFIRMAR_MATCH" && !abierta.candidatos.some((c) => c.id === acreditacionId)) {
      return avisar("Elegí uno de los candidatos de esta operación", { tono: "error" });
    }
    iniciar(async () => {
      const r = await accionResolver({
        operacionId: abierta.id,
        decision,
        acreditacionId,
        aprenderIdentidad: aprender,
      });
      if (!r.ok) return avisar(r.mensaje, { tono: "error" });
      setAbierta(null);
      avisar(
        decision === "CONFIRMAR_MATCH" ? "Acreditación confirmada"
        : decision === "MARCAR_DUPLICADO" ? "Marcada como duplicada"
        : "Decisión registrada",
        { detalle: aprender ? "La identidad queda aprendida para las próximas" : undefined },
      );
    });
  };

  return (
    <>
      <Card>
        {!compacta && (
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-line">
            <FilterTabs<Vista>
              label="Qué mostrar"
              value={vista}
              onChange={(v) => { setVista(v); setTope(60); }}
              options={[
                { value: "ATENCION", label: "Requieren atención", cuenta: cuentas.ATENCION },
                { value: "PENDIENTE", label: "Pendientes", cuenta: cuentas.PENDIENTE ?? 0 },
                { value: "REVISION", label: "Para revisar", cuenta: cuentas.REVISION ?? 0 },
                { value: "ERROR", label: "Datos incorrectos", cuenta: cuentas.ERROR ?? 0 },
                { value: "CONCILIADA", label: "Conciliadas", cuenta: cuentas.CONCILIADA ?? 0 },
                { value: "TODAS", label: "Todas", cuenta: cuentas.TODAS },
              ]}
            />
            <Button className="ml-auto" size="sm" onClick={actualizar} disabled={pendiente}>
              <IcoReloj className="w-3.5 h-3.5" />
              {pendiente ? "Actualizando…" : "Actualizar conciliación"}
            </Button>
          </div>
        )}

        <CardBar className="h-auto py-2.5">
          <Buscador
            placeholder="Depositante, CUIT, comprobante…"
            value={texto}
            onChange={(e) => { setTexto(e.target.value); setTope(60); }}
            ancho="w-[260px]"
          />
          {!clienteFijo && (
            <Select
              aria-label="Cliente"
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              className="w-[176px]"
            >
              <option value="">Todos los clientes</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </Select>
          )}
          <Select
            aria-label="Orden"
            value={orden}
            onChange={(e) => setOrden(e.target.value as typeof orden)}
            className="w-[196px]"
          >
            {ORDENES.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </Select>
          <Select
            aria-label="Antigüedad mínima"
            value={String(minDias)}
            onChange={(e) => setMinDias(Number(e.target.value))}
            className="w-[150px]"
          >
            <option value="0">Cualquier antigüedad</option>
            <option value="3">3 días o más</option>
            <option value="7">7 días o más</option>
            <option value="15">15 días o más</option>
            <option value="30">30 días o más</option>
          </Select>
          <span className="ml-auto t-num text-[11.5px] text-ink-4">
            {filtradas.length} de {operaciones.length}
          </span>
        </CardBar>

        {filtradas.length === 0 ? (
          <Vacio
            titulo={vista === "ATENCION" ? "Nada requiere tu atención" : "No hay operaciones con ese filtro"}
            texto={
              vista === "ATENCION"
                ? "Todo lo enviado está conciliado o resuelto. Va a volver a llenarse cuando entre la próxima planilla."
                : "Probá con otro filtro o limpiá la búsqueda."
            }
          />
        ) : (
          <TablaShell minWidth={940}>
            <thead className="bg-raised border-b border-line">
              <tr>
                <Th>Estado</Th>
                <Th>Cliente</Th>
                <Th>Depósito</Th>
                <Th derecha>Días</Th>
                <Th>Depositante</Th>
                <Th>Identificación</Th>
                <Th derecha>Importe</Th>
                <Th>Acción</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {visibles.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => setAbierta(o)}
                  className="cursor-pointer hover:bg-raised transition-colors"
                >
                  <td className="px-4 py-2">
                    <Estado tono={tonoDe(o.estado)}>{ESTADOS[o.estado].etiqueta}</Estado>
                  </td>
                  <td className="px-4 py-2 text-ink-2 whitespace-nowrap">{o.cliente.nombre}</td>
                  <td className="px-4 py-2 t-num text-ink-2 whitespace-nowrap">{fechaCorta(o.fechaDeposito)}</td>
                  <td className="px-4 py-2 text-right">
                    <span className={cx(
                      "t-num",
                      o.bucket === "CONCILIADA" || o.bucket === "RESUELTA" ? "text-ink-4"
                      : o.diasPendiente >= 15 ? "text-warn font-semibold"
                      : "text-ink-2",
                    )}>
                      {o.diasPendiente}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-ink truncate max-w-[190px]">{o.nombreDepositante}</td>
                  <td className="px-4 py-2 t-num text-[12px] text-ink-3 whitespace-nowrap">
                    {o.identificacionOriginal}
                    <span className="ml-1.5 text-ink-4 text-[10px] uppercase tracking-wide">
                      {o.tipoIdentificacion === "DNI_PROBABLE" ? "dni"
                        : o.tipoIdentificacion === "CUIT_VALIDO" ? "cuit" : "inválida"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Monto valor={o.importe} moneda="ARS" tamano="sm" className="text-ink" />
                  </td>
                  <td className="px-4 py-2 text-[12px] text-ink-3 whitespace-nowrap">
                    {ACCION[o.bucket]}
                  </td>
                </tr>
              ))}
            </tbody>
          </TablaShell>
        )}

        {filtradas.length > 0 && (
          <CardFoot>
            <span>
              {visibles.length} de {filtradas.length} · total filtrado{" "}
              <Monto valor={totalFiltrado} moneda="ARS" tamano="sm" className="text-ink-2" />
            </span>
            {tope < filtradas.length && (
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setTope((t) => t + 120)}>
                Ver más
              </Button>
            )}
          </CardFoot>
        )}
      </Card>

      {/* La `key` remonta el panel al cambiar de operación. Sin eso el
          candidato elegido sobrevive al cierre, y confirmar en la operación
          siguiente acreditaría contra el registro de la anterior. */}
      <DetalleOperacion
        key={abierta?.id ?? "ninguna"}
        operacion={abierta}
        onCerrar={() => setAbierta(null)}
        onResolver={resolver}
        ocupado={pendiente}
      />
    </>
  );
}

/* ══ Panel de detalle y resolución ═══════════════════════════ */

function DetalleOperacion({
  operacion,
  onCerrar,
  onResolver,
  ocupado,
}: {
  operacion: OperacionVista | null;
  onCerrar: () => void;
  onResolver: (d: Decision, acreditacionId: string | null, aprender: boolean) => void;
  ocupado: boolean;
}) {
  const [elegida, setElegida] = useState<string | null>(null);
  const [aprender, setAprender] = useState(true);

  if (!operacion) return null;
  const o = operacion;
  const info = ESTADOS[o.estado];
  const decide = o.bucket === "REVISION";
  const candidata = o.candidatos.find((c) => c.id === elegida) ?? null;
  const identidadDistinta = candidata !== null && candidata.cuit !== o.identificacionNormalizada;

  return (
    <Panel
      abierto
      onCerrar={onCerrar}
      titulo={o.nombreDepositante ?? "Operación"}
      encabezado={
        <div className="min-w-0">
          <h2 className="t-section m-0 truncate">{o.nombreDepositante ?? "Sin nombre"}</h2>
          <div className="mt-1.5 flex items-center gap-2">
            <Estado tono={tonoDe(o.estado)}>{info.etiqueta}</Estado>
            <Badge>{o.cliente.alias}</Badge>
          </div>
        </div>
      }
      pie={
        decide ? (
          <>
            <Button
              variant="primary"
              disabled={!elegida || ocupado}
              onClick={() => onResolver("CONFIRMAR_MATCH", elegida, aprender && identidadDistinta)}
            >
              <IcoCheck className="w-4 h-4" />
              Confirmar acreditación
            </Button>
            <Button disabled={ocupado} onClick={() => onResolver("RECHAZAR_CANDIDATOS", null, false)}>
              Ninguna corresponde
            </Button>
            <Button variant="ghost" disabled={ocupado} onClick={() => onResolver("MANTENER_PENDIENTE", null, false)}>
              Dejar pendiente
            </Button>
            {o.duplicadoDe.length > 0 && (
              <Button
                variant="ghost"
                className="ml-auto"
                disabled={ocupado}
                onClick={() => onResolver("MARCAR_DUPLICADO", null, false)}
              >
                Es duplicada
              </Button>
            )}
          </>
        ) : (
          <span className="text-[12px] text-ink-3">{info.queHacer}</span>
        )
      }
    >
      <div className="px-5 py-4">
        {/* Qué pasó y qué hacer. El código técnico va al final, no acá. */}
        <div
          className={cx(
            "rounded-xl border px-3.5 py-3",
            o.bucket === "ERROR" ? "bg-neg-wash border-neg-line"
            : o.bucket === "CONCILIADA" || o.bucket === "RESUELTA" ? "bg-pos-wash border-pos-line"
            : "bg-warn-wash border-warn-line",
          )}
        >
          <p className="m-0 text-[13px] text-ink">{info.quePaso}</p>
          <p className="m-0 mt-1.5 text-[12.5px] text-ink-2">
            <span className="t-label mr-1.5">Qué hacer</span>
            {info.queHacer}
          </p>
        </div>

        <div className="mt-4">
          <Dato etiqueta="Cliente">{o.cliente.nombre}</Dato>
          <Dato etiqueta="Planilla">
            <Link href={`/planillas/${o.planillaId}`} className="text-brand hover:underline">
              {o.planilla.archivo}
            </Link>
            <span className="text-ink-4"> · fila {o.fila}</span>
          </Dato>
          <Dato etiqueta="Fecha depósito">
            <span className="t-num">{o.fechaDeposito}</span>
            <span className="text-ink-4"> · hace {o.diasPendiente} {o.diasPendiente === 1 ? "día" : "días"}</span>
          </Dato>
          <Dato etiqueta="Importe">
            <Monto valor={o.importe} moneda="ARS" className="font-semibold" />
          </Dato>
          <Dato etiqueta="Identificación">
            <span className="t-num">{o.identificacionOriginal}</span>
            <span className="ml-2 text-ink-4 text-[11.5px]">
              {o.tipoIdentificacion === "DNI_PROBABLE" ? "declarado como DNI"
                : o.tipoIdentificacion === "CUIT_VALIDO" ? "CUIT válido"
                : "no es CUIT ni DNI"}
            </span>
          </Dato>
          <Dato etiqueta="Comprobante">
            {o.numeroDeposito ?? <span className="text-ink-4">sin número</span>}
          </Dato>
          <Dato etiqueta="Banco">{o.banco ?? <span className="text-ink-4">—</span>}</Dato>
          {o.intentos > 0 && (
            <Dato etiqueta="Intentos">
              <span className="t-num">{o.intentos}</span>
              <span className="text-ink-4"> · última vez {o.evaluadaEn.slice(0, 16).replace("T", " ")}</span>
            </Dato>
          )}
        </div>

        {/* Comparación contra Fullcarga.

            Las dos puntas se muestran una sobre otra y alineadas campo a
            campo. Es la pregunta que Mati tiene que contestar —¿son la
            misma operación?— y contestarla exige comparar tres datos, no
            leer un formulario. */}
        {(o.candidatos.length > 0 || o.acreditacion) && (
          <div className="mt-5">
            <p className="t-bloque m-0 mb-2.5">
              {o.acreditacion
                ? "Acreditación encontrada"
                : o.candidatos.length === 1
                  ? "Candidato en Fullcarga"
                  : `${o.candidatos.length} candidatos en Fullcarga`}
            </p>

            <div className="rounded-xl border border-line overflow-hidden">
              {/* Lo que declaró el cliente */}
              <div className="px-3.5 py-3 bg-raised">
                <p className="t-metrica m-0 mb-2">Transferencia del cliente</p>
                <div className="grid grid-cols-3 gap-3">
                  <Campo etiqueta="DNI / CUIT" valor={o.identificacionOriginal} />
                  <Campo etiqueta="Fecha" valor={o.fechaDeposito} />
                  <Campo
                    etiqueta="Importe"
                    valor={o.importe.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                  />
                </div>
              </div>

              {(o.acreditacion ? [o.acreditacion] : o.candidatos).map((a) => {
                const seleccionada = elegida === a.id;
                const cotejo = [
                  a.cuit === o.identificacionNormalizada,
                  a.fecha === o.fechaDeposito,
                  Math.abs(a.importe - o.importe) < 0.005,
                ];
                const coinciden = cotejo.filter(Boolean).length;
                return (
                  <div key={a.id} className="border-t border-line">
                    {/* Conector con el veredicto */}
                    <div className="flex items-center gap-2.5 px-3.5 py-1.5 bg-surface">
                      <span aria-hidden className="text-ink-4 text-[13px] leading-none">↕</span>
                      <span
                        className={cx(
                          "text-[11.5px]",
                          coinciden === 3 ? "text-pos" : coinciden === 0 ? "text-neg" : "text-warn",
                        )}
                      >
                        Coinciden {coinciden} de 3 datos
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={!decide}
                      onClick={() => setElegida(seleccionada ? null : a.id)}
                      aria-pressed={decide ? seleccionada : undefined}
                      className={cx(
                        "w-full text-left px-3.5 py-3 border-t transition-colors duration-150",
                        decide ? "cursor-pointer hover:bg-raised" : "cursor-default",
                        seleccionada
                          ? "border-brand-line bg-brand-wash"
                          : "border-line bg-surface",
                      )}
                    >
                      <p className="t-metrica m-0 mb-2 flex items-center gap-2">
                        Acreditación en Fullcarga
                        {decide && (
                          <span className={cx("normal-case tracking-normal text-[11px]",
                            seleccionada ? "text-brand font-medium" : "text-ink-4")}>
                            {seleccionada ? "seleccionada" : "elegir"}
                          </span>
                        )}
                      </p>
                      <div className="grid grid-cols-3 gap-3">
                        <Campo etiqueta="CUIT" valor={a.cuit} coincide={cotejo[0]} />
                        <Campo etiqueta="Fecha ingreso" valor={a.fecha} coincide={cotejo[1]} />
                        <Campo
                          etiqueta="Importe"
                          valor={a.importe.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                          coincide={cotejo[2]}
                        />
                      </div>
                      {a.descripcion && (
                        <p className="m-0 mt-2 text-[11px] text-ink-4 truncate">{a.descripcion}</p>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {decide && identidadDistinta && (
              <div className="mt-3 rounded-xl border border-brand-line bg-brand-wash px-3.5 py-3">
                <Toggle checked={aprender} onChange={setAprender}>
                  Recordar que <span className="t-num">{o.identificacionNormalizada}</span> es{" "}
                  <span className="t-num">{candidata?.cuit}</span>
                </Toggle>
                <p className="m-0 mt-1.5 text-[11.5px] text-ink-3">
                  Se aplica solo a {o.cliente.nombre} en las próximas conciliaciones. No se
                  deduce nada: queda registrado que lo confirmaste vos.
                </p>
              </div>
            )}
          </div>
        )}

        {o.duplicadoDe.length > 0 && (
          <p className="mt-4 text-[12px] text-ink-3">
            Coincide con {o.duplicadoDe.length === 1 ? "la fila" : "las filas"}{" "}
            <span className="t-num">{o.duplicadoDe.join(", ")}</span> de la misma planilla.
          </p>
        )}

        <p className="mt-5 pt-3 border-t border-line-soft text-[11px] text-ink-4">
          <span className="t-label mr-1.5">Estado técnico</span>
          <span className="t-num">{o.estado}</span> · {o.motivo}
        </p>
      </div>
    </Panel>
  );
}

/**
 * Un dato de la comparación.
 *
 * Sin `coincide` es el lado del cliente, que es la referencia y no se
 * juzga. Con `coincide` es el lado de Fullcarga, donde lo que importa es
 * si cuadra o no.
 */
function Campo({
  etiqueta,
  valor,
  coincide,
}: {
  etiqueta: string;
  valor: string;
  coincide?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] text-ink-4">{etiqueta}</div>
      <div
        className={cx(
          "mt-0.5 truncate t-num text-[12.5px]",
          coincide === undefined ? "text-ink" : coincide ? "text-pos" : "text-neg",
        )}
      >
        {coincide === false && <span aria-hidden className="mr-1">≠</span>}
        {valor}
      </div>
    </div>
  );
}

/** Línea de historial. Se usa en el detalle de la planilla. */
export function LineaHistorial({ evento }: { evento: Evento }) {
  return (
    <div className="flex items-baseline gap-2.5 py-1.5 border-b border-line-soft last:border-0">
      <span className="t-num text-[11px] text-ink-4 w-[112px] flex-none">
        {evento.momento.slice(0, 16).replace("T", " ")}
      </span>
      <span className="flex items-center gap-1.5 text-[12px] min-w-0">
        {evento.de && (
          <>
            <span className="text-ink-4">{ESTADOS[evento.de].etiqueta}</span>
            <IcoArrow className="w-3 h-3 text-ink-4 flex-none" />
          </>
        )}
        <Estado tono={tonoDe(evento.a)}>{ESTADOS[evento.a].etiqueta}</Estado>
        <span className="text-ink-4 truncate">· {evento.actor}</span>
      </span>
    </div>
  );
}

/** Etiqueta reutilizable de bucket, para las cabeceras de sección. */
export function EtiquetaBucket({ bucket }: { bucket: Bucket }) {
  const b = BUCKETS[bucket];
  return <Estado tono={b.tono}>{b.etiqueta}</Estado>;
}
