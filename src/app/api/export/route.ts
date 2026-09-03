import { NextResponse } from "next/server";
import {
  getContraparte, getContrapartes, getMovimientosDeContraparte,
  getMovimientosDelDia, getOficinas, getTodosLosMovimientos,
} from "@/lib/data";
import { construirCtaCte, saldoFinal } from "@/lib/domain/saldos";
import { calcularImpacto } from "@/lib/domain/fx";
import { MONEDAS } from "@/lib/domain/types";
import { fmtFecha, fmtMonto } from "@/lib/format";

/**
 * Export a CSV. Se genera del lado del servidor —no en el navegador— para
 * que el archivo sea idéntico siempre y quede registrado quién exportó qué.
 *
 * Delimitador punto y coma y BOM UTF-8: es lo que hace que Excel en
 * configuración regional argentina abra el archivo con las columnas
 * separadas y la coma decimal en su lugar.
 */
function csv(filas: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + filas.map((f) => f.map(esc).join(";")).join("\r\n");
}

function respuesta(nombre: string, contenido: string) {
  return new NextResponse(contenido, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombre}"`,
      "Cache-Control": "no-store",
    },
  });
}

const hoy = () => new Date().toISOString().slice(0, 10).split("-").reverse().join("-");

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tipo = searchParams.get("tipo");

  if (tipo === "balance") {
    const [contrapartes, movimientos] = await Promise.all([getContrapartes(), getTodosLosMovimientos()]);
    const filas: (string | number)[][] = [["Contraparte", ...MONEDAS, "Último cierre"]];
    const tot: Record<string, number> = { ARS: 0, USD: 0, EUR: 0, BRL: 0 };

    for (const c of contrapartes) {
      const cta = construirCtaCte(movimientos.filter((m) => m.contraparte_id === c.id));
      const s = saldoFinal(cta);
      const cierre = [...cta].reverse().find((f) => f.esCierre);
      for (const m of MONEDAS) tot[m] += s[m];
      filas.push([c.nombre, ...MONEDAS.map((m) => (s[m] ? fmtMonto(s[m], m) : "")), cierre ? fmtFecha(cierre.movimiento.fecha) : ""]);
    }
    filas.push(["TOTALES", ...MONEDAS.map((m) => fmtMonto(tot[m], m)), ""]);
    return respuesta(`Balance general - ${hoy()}.csv`, csv(filas));
  }

  if (tipo === "cta") {
    const id = Number(searchParams.get("id"));
    const [contraparte, movimientos, oficinas] = await Promise.all([
      getContraparte(id), getMovimientosDeContraparte(id), getOficinas(),
    ]);
    if (!contraparte) return new NextResponse("Contraparte inexistente", { status: 404 });

    const cta = construirCtaCte(movimientos);
    const filas: (string | number)[][] = [
      ["Fecha", "Oficina", "Concepto", "Categoría",
       ...MONEDAS.flatMap((m) => [`Monto ${m}`, `Saldo ${m}`])],
    ];
    for (const f of cta) {
      filas.push([
        fmtFecha(f.movimiento.fecha),
        oficinas.find((o) => o.id === f.movimiento.oficina_id)?.nombre ?? "",
        f.esCierre ? "CUENTA CERRADA" : f.movimiento.concepto,
        f.esCierre ? "Cierre" : f.movimiento.categoria,
        ...MONEDAS.flatMap((m) => [
          f.delta[m] ? fmtMonto(f.delta[m]!, m) : "",
          fmtMonto(f.saldo[m], m),
        ]),
      ]);
    }
    return respuesta(`${contraparte.nombre} - ${hoy()}.csv`, csv(filas));
  }

  if (tipo === "carga") {
    const fecha = searchParams.get("fecha") ?? "";
    const oficinaId = Number(searchParams.get("oficina") ?? 1);
    const [movimientos, contrapartes, oficinas] = await Promise.all([
      getMovimientosDelDia(fecha, oficinaId), getContrapartes(), getOficinas(),
    ]);
    const oficina = oficinas.find((o) => o.id === oficinaId)?.nombre ?? "";

    const filas: (string | number)[][] = [
      ["Fecha", "Contraparte", "Concepto", "Categoría", "Medio de pago",
       "Moneda", "Monto", "T. cambio", "Comisión %", "Impacta moneda", "Impacta monto"],
    ];
    for (const m of movimientos) {
      for (const p of m.partidas) {
        const imp = calcularImpacto(p);
        filas.push([
          fmtFecha(m.fecha),
          contrapartes.find((c) => c.id === m.contraparte_id)?.nombre ?? "",
          m.concepto, m.categoria, p.medio_pago, p.moneda_nominal,
          fmtMonto(p.monto_nominal, p.moneda_nominal),
          p.tipo_cambio ? fmtMonto(p.tipo_cambio) : "",
          p.comision_pct ? fmtMonto(p.comision_pct * 100) : "",
          imp.moneda, fmtMonto(imp.monto, imp.moneda),
        ]);
      }
    }
    return respuesta(`Caja diaria ${oficina} - ${fecha}.csv`, csv(filas));
  }

  return new NextResponse("Parámetro 'tipo' inválido", { status: 400 });
}
