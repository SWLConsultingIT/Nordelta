/**
 * Verificación de las reglas de negocio contra el comportamiento del
 * sistema en producción.
 *
 * Cada caso de acá está derivado del SQL de BigQuery o de los Apps Script.
 * Si uno falla, cambiamos una regla financiera sin querer.
 *
 *   npm run verificar
 */
import { calcularImpacto, impactoPorMoneda } from "../src/lib/domain/fx";
import { construirCtaCte } from "../src/lib/domain/saldos";
import { MOVIMIENTOS } from "../src/lib/data/fixtures";

let fallas = 0;
function chk(nombre: string, real: unknown, esperado: unknown) {
  const ok = JSON.stringify(real) === JSON.stringify(esperado);
  if (!ok) fallas++;
  console.log(`${ok ? "✓" : "✗"} ${nombre}`);
  if (!ok) console.log(`    esperado ${JSON.stringify(esperado)} · obtuve ${JSON.stringify(real)}`);
}

console.log("\n── Regla de conversión ───────────────────────────────");

chk("efectivo 4.455.000 ARS @1485 → USD 3.000",
  calcularImpacto({ medio_pago: "efectivo", moneda_nominal: "ARS", monto_nominal: 4455000, tipo_cambio: 1485, comision_pct: null }),
  { moneda: "USD", monto: 3000 });

chk("transferencia 50.000 ARS @1485 +2% → USD 34,3434 (comisión antes de dividir)",
  calcularImpacto({ medio_pago: "transferencia", moneda_nominal: "ARS", monto_nominal: 50000, tipo_cambio: 1485, comision_pct: 0.02 }),
  { moneda: "USD", monto: 34.3434 });

chk("el efectivo ignora la comisión aunque venga cargada",
  calcularImpacto({ medio_pago: "efectivo", moneda_nominal: "ARS", monto_nominal: 100000, tipo_cambio: null, comision_pct: 0.02 }),
  { moneda: "ARS", monto: 100000 });

chk("transferencia 3.500 USD +2% no divide → USD 3.570",
  calcularImpacto({ medio_pago: "transferencia", moneda_nominal: "USD", monto_nominal: 3500, tipo_cambio: null, comision_pct: 0.02 }),
  { moneda: "USD", monto: 3570 });

chk("un TC sobre una pata en USD no convierte nada",
  calcularImpacto({ medio_pago: "efectivo", moneda_nominal: "USD", monto_nominal: 1000, tipo_cambio: 1485, comision_pct: null }),
  { moneda: "USD", monto: 1000 });

console.log("\n── Bug 5 de producción: la fila mixta ────────────────");
console.log("   El consolidado 2026 anula PESOS cuando cualquiera de los dos");
console.log("   tipos de cambio existe, pero solo recupera la pata efectivo");
console.log("   si TC>0 — y así pierde los 100.000 en efectivo.");

const mixto = MOVIMIENTOS.find((m) => m.id === "m17")!;
chk("100.000 ARS efectivo + 50.000 ARS transf @1485 +2% → conserva las dos patas",
  impactoPorMoneda(mixto.partidas),
  { ARS: 100000, USD: 34.34 });

console.log("\n── Cierre de cuenta ──────────────────────────────────");

const cta = construirCtaCte(MOVIMIENTOS.filter((m) => m.contraparte_id === 3));
chk("6 movimientos en la cuenta", cta.length, 6);
chk("el cierre cae en el tercer movimiento", cta.findIndex((f) => f.esCierre), 2);
chk("un solo cierre en todo el historial", cta.filter((f) => f.esCierre).length, 1);
chk("saldo final USD 1.500", cta.at(-1)!.saldo.USD, 1500);
chk("en el cierre las cuatro monedas dan cero",
  cta[2].saldo, { ARS: 0, USD: 0, EUR: 0, BRL: 0 });

console.log("\n── Exclusión de categorías ───────────────────────────");
const conCompra = construirCtaCte(MOVIMIENTOS.filter((m) => m.contraparte_id === 7));
chk("las compras no llegan a la cuenta corriente (ALLOWED_SECTIONS)",
  conCompra.every((f) => f.movimiento.categoria !== "compra"), true);

console.log(fallas === 0 ? "\n✅ Todas las verificaciones pasan\n" : `\n❌ ${fallas} verificaciones fallaron\n`);
process.exit(fallas ? 1 : 0);
