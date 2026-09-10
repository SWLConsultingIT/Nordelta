import { NextResponse } from "next/server";
import { escribirXlsx } from "@/lib/planillas/escritor-xlsx";
import { digitoVerificador } from "@/lib/fullcarga/cuit";
import { sumarDias } from "@/lib/operaciones/fechas";
import { hoyISO } from "@/lib/format";
import { exigirSesion } from "@/lib/auth";

/**
 * Planilla de ejemplo para probar la importación.
 *
 * Todo inventado. Reproduce a propósito las cosas que una planilla real
 * trae y que el importador tiene que resolver sin ayuda:
 *
 *   · una columna de más, que se ignora;
 *   · CUIT con guiones y sin guiones;
 *   · filas que traen DNI en vez de CUIT —cerca de la mitad, como en el
 *     archivo real—;
 *   · **un CUIT con el verificador mal**, que tiene que salir marcado como
 *     error y no acreditarse jamás;
 *   · un importe escrito con formato argentino.
 */
export async function GET() {
  await exigirSesion();
  const hoy = hoyISO();
  const cuit = (prefijo: string, doc: string) => {
    const diez = prefijo + doc.padStart(8, "0");
    return diez + String(digitoVerificador(diez));
  };

  const c1 = cuit("20", "31445678");
  const c2 = cuit("27", "28903112");
  const c3 = cuit("23", "35112904");
  // Verificador cambiado a propósito: es la fila que tiene que dar error.
  const roto = c3.slice(0, 10) + String((Number(c3[10]) + 1) % 10);

  const filas: (string | number | null)[][] = [
    ["Planilla de transferencias", null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ["BANCO", "FECHA DEPOSITO", "IMPORTE", "NOMBRE", "DNI/CUIT DEPOSITANTE",
     "NRO DEPOSITO", "TIPO", "COMENTARIO", "OBSERVACIONES INTERNAS"],
    ["BANCO GALICIA", sumarDias(hoy, -2), 153500, "Aldana Ferreyra",
     `${c1.slice(0, 2)}-${c1.slice(2, 10)}-${c1.slice(10)}`, "4881201", "TRANSFERENCIA", "", "ok"],
    ["BANCO MACRO", sumarDias(hoy, -2), 185000, "Ramiro Quiroga", "28903112",
     "4881202", "TRANSFERENCIA", "", ""],
    ["BBVA ARGENTINA", sumarDias(hoy, -1), "245.000,00", "Malena Ocampo", c2,
     "4881203", "TRANSFERENCIA", "", ""],
    ["BANCO NACION", sumarDias(hoy, -1), 799000, "Ezequiel Iturbe", roto,
     "4881204", "TRANSFERENCIA", "cuota anual", ""],
    ["MERCADO PAGO", sumarDias(hoy, -1), 320000, "Paula Mansilla", "31445678",
     "4881205", "TRANSFERENCIA", "", ""],
    ["BANCO CIUDAD", hoy, 499000, "Tobías Urquiza", cuit("24", "30887711"),
     "4881206", "TRANSFERENCIA", "", ""],
  ];

  const bytes = escribirXlsx(filas, "Transferencias");
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="planilla-ejemplo-${hoy}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
