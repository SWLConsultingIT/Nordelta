import { describe, expect, it } from "vitest";
import { construirCtaCte, indiceUltimoCierre, saldoFinal, desdeUltimoCierre, compararMovimientos } from "@/lib/domain/saldos";
import { ef, tr, mov, mezclar } from "./_helpers";

/* Regla confirmada en producción: el cierre se marca cuando las CUATRO
   monedas dan cero simultáneamente (redondeadas a 2 decimales) y la posición
   anterior tenía al menos una distinta de cero. No hay cierre por moneda. */

describe("cierre de cuenta · la regla de las cuatro monedas", () => {
  it("cierra cuando la única moneda usada vuelve a cero", () => {
    const filas = construirCtaCte([
      mov("2026-01-10", [ef("USD", 1000)], { id: "1" }),
      mov("2026-01-20", [ef("USD", -1000)], { id: "2" }),
    ]);
    expect(filas.map((f) => f.esCierre)).toEqual([false, true]);
  });

  it("NO cierra si una moneda queda con saldo, aunque las otras estén en cero", () => {
    const filas = construirCtaCte([
      mov("2026-01-10", [ef("USD", 1000), ef("ARS", 500)], { id: "1" }),
      mov("2026-01-20", [ef("USD", -1000)], { id: "2" }),
    ]);
    expect(filas.map((f) => f.esCierre)).toEqual([false, false]);
    expect(saldoFinal(filas)).toEqual({ ARS: 500, USD: 0, EUR: 0, BRL: 0 });
  });

  it("cierra recién cuando las cuatro llegan a cero", () => {
    const filas = construirCtaCte([
      mov("2026-01-01", [ef("ARS", 100), ef("USD", 10), ef("EUR", 5), ef("BRL", 2)], { id: "1" }),
      mov("2026-01-02", [ef("ARS", -100), ef("USD", -10)], { id: "2" }),
      mov("2026-01-03", [ef("EUR", -5)], { id: "3" }),
      mov("2026-01-04", [ef("BRL", -2)], { id: "4" }),
    ]);
    expect(filas.map((f) => f.esCierre)).toEqual([false, false, false, true]);
  });

  it("no marca cierre en el arranque, cuando no había nada que cerrar", () => {
    const filas = construirCtaCte([mov("2026-01-10", [ef("USD", 0.001)], { id: "1" })]);
    // 0,001 redondea a 0, pero la posición previa también era cero.
    expect(filas[0].esCierre).toBe(false);
  });

  it("reconoce dos cierres separados en el mismo historial", () => {
    const filas = construirCtaCte([
      mov("2026-01-01", [ef("USD", 500)], { id: "1" }),
      mov("2026-01-05", [ef("USD", -500)], { id: "2" }),
      mov("2026-02-01", [ef("USD", 800)], { id: "3" }),
      mov("2026-02-10", [ef("USD", -800)], { id: "4" }),
    ]);
    expect(filas.filter((f) => f.esCierre)).toHaveLength(2);
    expect(indiceUltimoCierre(filas)).toBe(3);
  });

  it("usa la tolerancia de dos decimales, igual que el round de la base", () => {
    const filas = construirCtaCte([
      mov("2026-01-01", [ef("USD", 100)], { id: "1" }),
      mov("2026-01-02", [ef("USD", -99.999)], { id: "2" }),
    ]);
    // El saldo crudo es 0,001 → redondea a 0 → cierra.
    expect(filas[1].esCierre).toBe(true);
    expect(filas[1].saldo.USD).toBe(0);
  });

  it("el ajuste de cierre se ordena al final del día", () => {
    const filas = construirCtaCte([
      mov("2026-03-01", [ef("USD", -300)], { id: "9", categoria: "ajuste_cierre", orden: 1 }),
      mov("2026-03-01", [ef("USD", 300)], { id: "1", categoria: "ingreso", orden: 2 }),
    ]);
    // Aunque el ajuste tenga orden menor, va después: primero entra el ingreso.
    expect(filas[0].movimiento.categoria).toBe("ingreso");
    expect(filas[1].esCierre).toBe(true);
  });
});

describe("determinismo · el bug 4 del legacy no puede volver", () => {
  // El legacy ordenaba por fecha, cierres al final y concepto. Dos
  // movimientos iguales del mismo día quedaban en orden arbitrario y podía
  // cambiar cuál disparaba el cierre entre corridas.
  const historial = [
    mov("2026-01-01", [ef("USD", 100)], { id: "1", orden: 1, concepto: "igual" }),
    mov("2026-01-01", [ef("USD", 200)], { id: "2", orden: 2, concepto: "igual" }),
    mov("2026-01-01", [ef("USD", -300)], { id: "3", orden: 3, concepto: "igual" }),
    mov("2026-01-02", [ef("ARS", 5000)], { id: "4", orden: 1, concepto: "igual" }),
    mov("2026-01-02", [ef("ARS", -5000)], { id: "5", orden: 2, concepto: "igual" }),
  ];

  it("el resultado no depende del orden en que llegan los movimientos", () => {
    const canonico = construirCtaCte(historial);
    const huella = (fs: ReturnType<typeof construirCtaCte>) =>
      JSON.stringify(fs.map((f) => [f.movimiento.id, f.saldo, f.esCierre]));

    for (let semilla = 1; semilla <= 25; semilla++) {
      expect(huella(construirCtaCte(mezclar(historial, semilla)))).toBe(huella(canonico));
    }
  });

  it("desempata por id numérico, no lexicográfico", () => {
    // Con orden lexicográfico "10" iría antes que "2".
    const a = mov("2026-01-01", [ef("USD", 1)], { id: "2", orden: 1 });
    const b = mov("2026-01-01", [ef("USD", 1)], { id: "10", orden: 1 });
    expect(compararMovimientos(a, b)).toBeLessThan(0);
  });

  it("con concepto idéntico y mismo orden, el id decide de forma estable", () => {
    const gemelos = [
      mov("2026-01-01", [ef("USD", 100)], { id: "7", orden: 1, concepto: "x" }),
      mov("2026-01-01", [ef("USD", -100)], { id: "8", orden: 1, concepto: "x" }),
    ];
    const r1 = construirCtaCte(gemelos);
    const r2 = construirCtaCte([gemelos[1], gemelos[0]]);
    expect(r1.map((f) => f.movimiento.id)).toEqual(["7", "8"]);
    expect(r2.map((f) => f.movimiento.id)).toEqual(["7", "8"]);
    expect(r1[1].esCierre).toBe(true);
  });
});

describe("exclusión de categorías · ALLOWED_SECTIONS", () => {
  it("compras, ventas e impuestos no entran a la cuenta corriente", () => {
    const filas = construirCtaCte([
      mov("2026-01-01", [ef("ARS", 1000)], { id: "1", categoria: "ingreso" }),
      mov("2026-01-02", [ef("ARS", 9999)], { id: "2", categoria: "compra" }),
      mov("2026-01-03", [ef("ARS", 8888)], { id: "3", categoria: "venta" }),
      mov("2026-01-04", [ef("ARS", 7777)], { id: "4", categoria: "impuesto" }),
    ]);
    expect(filas).toHaveLength(1);
    expect(saldoFinal(filas).ARS).toBe(1000);
  });

  it("respeta afecta_cta_cte cuando viene explícito en falso", () => {
    const filas = construirCtaCte([
      mov("2026-01-01", [ef("ARS", 1000)], { id: "1", categoria: "ingreso", afecta_cta_cte: false }),
    ]);
    expect(filas).toHaveLength(0);
  });

  it("incluye ingresos, pagos a proveedores, full pagos y ajustes", () => {
    const filas = construirCtaCte([
      mov("2026-01-01", [ef("ARS", 100)], { id: "1", categoria: "ingreso" }),
      mov("2026-01-02", [ef("ARS", 100)], { id: "2", categoria: "pago_proveedor" }),
      mov("2026-01-03", [ef("ARS", 100)], { id: "3", categoria: "full_pago" }),
      mov("2026-01-04", [ef("ARS", 100)], { id: "4", categoria: "ajuste_cierre" }),
    ]);
    expect(filas).toHaveLength(4);
  });
});

describe("duplicados · el bug 2 del legacy no puede volver", () => {
  // removeDuplicateRows_ deduplicaba por firma de fila completa, así que dos
  // pagos idénticos del mismo día al mismo cliente se colapsaban en uno.
  it("dos movimientos idénticos sobreviven como dos", () => {
    const filas = construirCtaCte([
      mov("2026-01-15", [ef("ARS", 250000)], { id: "1", orden: 1, concepto: "Pago parcial", contraparte_id: 3 }),
      mov("2026-01-15", [ef("ARS", 250000)], { id: "2", orden: 2, concepto: "Pago parcial", contraparte_id: 3 }),
    ]);
    expect(filas).toHaveLength(2);
    expect(saldoFinal(filas).ARS).toBe(500000);
  });

  it("tres pagos iguales suman tres veces", () => {
    const filas = construirCtaCte(
      [1, 2, 3].map((i) =>
        mov("2026-01-15", [tr("USD", 100, null, 0.02)], { id: String(i), orden: i, concepto: "igual" }),
      ),
    );
    expect(filas).toHaveLength(3);
    expect(saldoFinal(filas).USD).toBe(306);
  });
});

describe("desdeUltimoCierre", () => {
  const filas = construirCtaCte([
    mov("2026-01-01", [ef("USD", 500)], { id: "1" }),
    mov("2026-01-05", [ef("USD", -500)], { id: "2" }),
    mov("2026-02-01", [ef("USD", 800)], { id: "3" }),
  ]);

  it("devuelve solo lo posterior al cierre", () => {
    expect(desdeUltimoCierre(filas).map((f) => f.movimiento.id)).toEqual(["3"]);
  });

  it("devuelve todo si nunca cerró", () => {
    const sinCierre = construirCtaCte([mov("2026-01-01", [ef("USD", 500)], { id: "1" })]);
    expect(desdeUltimoCierre(sinCierre)).toHaveLength(1);
  });
});
