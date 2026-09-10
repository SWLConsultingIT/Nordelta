import { NextResponse } from "next/server";
import { exigirSesion } from "@/lib/auth";
import { filaAcreditacion, informeSintetico } from "@/lib/fullcarga/escritor-xls";
import { getOperaciones } from "@/lib/data/operaciones";
import { hoyISO } from "@/lib/format";

/**
 * Informe de Fullcarga de ejemplo, en `.xls` de verdad.
 *
 * Sirve para demostrar el ciclo completo sin depender de Fullcarga: se baja,
 * se sube por «subir informe descargado» y varias operaciones que estaban
 * pendientes encuentran su acreditación. Recorre **el parser real de BIFF8**,
 * no un atajo: es el mismo código que lee el archivo que baja Mati.
 *
 * Se arma a partir de las operaciones que hoy están pendientes, así el
 * ejemplo tiene efecto visible. Los datos que lo rodean —razón social,
 * banco, códigos— son inventados.
 */
export async function GET() {
  await exigirSesion();

  // Solo las que llegaron con CUIT. Para una operación que el cliente
  // informó con DNI haría falta el CUIT real de esa persona, y acá no
  // existe: **no se fabrica uno**. Que esas queden pendientes en la
  // demostración no es una limitación del ejemplo, es la regla.
  const pendientes = (await getOperaciones({ bucket: "PENDIENTE" }))
    .filter((o) => o.tipoIdentificacion === "CUIT_VALIDO")
    .slice(0, 6);

  const observacion = (cuit: string, nombre: string, fecha: string) => {
    const [a, m, d] = fecha.split("-");
    return `${d}/${m}/${a} - Transferencia Recibida  - De ${nombre} / - Var / ${cuit}`;
  };

  const filas = pendientes.map((o) =>
    filaAcreditacion({
      observacion: observacion(
        o.identificacionNormalizada,
        o.nombreDepositante ?? "Depositante",
        o.fechaDeposito,
      ),
      importe: o.importe,
      // El matcher cruza contra FECHA INGRESO, nunca contra FECHA.
      fechaIngreso: `${o.fechaDeposito} 09:00:00.0`,
      fecha: `${o.fechaDeposito} 10:00:00.000`,
      banco: o.banco ?? "Banco de Prueba",
      tipoIncremento: "Transferencia bancaria",
    }),
  );

  const bytes = informeSintetico(filas);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/vnd.ms-excel",
      "Content-Disposition": `attachment; filename="informe-ejemplo-${hoyISO()}.xls"`,
      "Cache-Control": "no-store",
    },
  });
}
