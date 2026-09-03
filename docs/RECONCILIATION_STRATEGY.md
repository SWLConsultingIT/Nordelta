# Estrategia de conciliación

## El criterio

El criterio de aceptación **no** es:

> mismo input → mismo output que el legacy

sino:

> mismo input → **mismo resultado financiero esperado**, salvo los defectos
> legacy documentados en `LEGACY_BUGS.md`.

La distinción no es teórica. Cuatro de los seis defectos del sistema viejo
producen números incorrectos. Si el sistema nuevo los reprodujera, la
conciliación cerraría perfecto y el resultado seguiría estando mal.

**Consecuencia operativa:** hay que acordar esta excepción con el cliente
*antes* de la marcha en paralelo, no durante. Si se descubre a mitad de la
conciliación, cada diferencia se discute como si fuera un error nuestro.

---

## Reglas que tienen que dar idéntico

Verificadas contra el código de producción y cubiertas por tests.

| Regla | Verificación |
|---|---|
| Qué categorías impactan la cuenta corriente | `cierres.test.ts` · exclusión de compras, ventas e impuestos |
| Conversión: comisión antes de dividir | `fx.test.ts` · `db-paridad.test.ts` |
| Comisión solo en patas de transferencia | `fx.test.ts` · CHECK en la base |
| Dos tipos de cambio independientes por fila | `migracion.test.ts` |
| Cierre: cuatro monedas en cero simultáneas | `cierres.test.ts` · `db-paridad.test.ts` |
| Redondeo a dos decimales, mitad alejándose del cero | `dinero.test.ts` · `db-paridad.test.ts` |
| Sin lógica automática de signo | `fx.test.ts` |
| Fecha del cheque = fecha de cobro; monto = A pagar | `migracion.test.ts` |
| Balance agrupado por moneda, nunca mezclado | `db-paridad.test.ts` |

---

## Diferencias esperadas

Toda diferencia con el legacy tiene que caer en una de estas categorías. El
importador las clasifica automáticamente.

| Motivo | Qué significa | Acción |
|---|---|---|
| `bug5_columna_anulada` | El legacy anuló la columna de pesos y perdió la pata sin convertir | **El nuevo es correcto.** Cuantificar el dinero afectado |
| `bug6_pata_descartada` | El legacy usó un o-exclusivo y descartó una pata entera | **El nuevo es correcto.** Cuantificar |
| `sin_explicar` | Ninguna de las anteriores | **Frenar.** Es señal de que interpretamos algo mal |

El barrido de `migracion.test.ts` recorre combinaciones de patas con y sin
tipo de cambio, con y sin comisión, y **exige cero diferencias
`sin_explicar`**. Si aparece una, el test falla: es la red que impide migrar
con una regla mal entendida.

---

## Método de comparación

### Paso 1 · Conciliación en frío, sobre el histórico

Antes de cargar nada en producción. El importador procesa el histórico legacy
y produce, sin escribir:

1. **Reporte de errores** — filas que no se pudieron interpretar, con fila,
   campo, valor y motivo. Ninguna fila se descarta en silencio.
2. **Reporte de diferencias** — por fila y por moneda, lo que el legacy
   habría calculado contra lo que calcula el modelo nuevo, con el motivo
   clasificado.
3. **Cuantificación del daño** — total de dinero que el legacy perdió por los
   bugs 5 y 6, por moneda y por período.

El punto 3 es lo que se le lleva al cliente: no «encontramos un bug» sino
«el bug costó tanto, en estas filas».

### Paso 2 · Conciliación de saldos

Para cada contraparte y cada moneda, comparar:

- el saldo de `Balance.balance_final` del sistema viejo;
- el saldo de `v_balance` del sistema nuevo.

La diferencia por contraparte tiene que ser **exactamente** la suma de las
diferencias explicadas del paso 1. Si no cierra, falta algo.

### Paso 3 · Marcha en paralelo

Un mes calendario cargando en los dos sistemas y conciliando **todos los
días**. Es caro y molesto, y es lo único que compra confianza en un sistema
contable. Acá aparecen las reglas que nadie recordaba.

---

## Tolerancias

**Ninguna sobre el resultado final.** Un libro contable no tiene tolerancia:
si los saldos no coinciden al centavo después de descontar las diferencias
explicadas, hay algo sin entender.

Lo que sí está definido con precisión:

| Concepto | Precisión | Dónde |
|---|---|---|
| `monto_impacto` de una partida | 4 decimales | `numeric(18,4)` · `DECIMALES_IMPACTO` |
| Saldo mostrado y comparado | 2 decimales | `round(…, 2)` · `DECIMALES_SALDO` |
| Comparación de cierre a cero | 2 decimales | `esCero()` · la vista |
| Monto individual máximo | 10^11 | `MONTO_MAXIMO` · CHECK en la base |

Dos precisiones sobre el redondeo, que son la causa más probable de una
diferencia de centavos si algo se implementa distinto:

- **La mitad se redondea alejándose del cero**, como `round(numeric)` de
  Postgres. `Math.round` de JavaScript redondea hacia +∞ y difiere en todos
  los negativos que caen al medio.
- **Se redondea una sola vez**, al final. Postgres hace `round(sum(x), 2)`;
  redondear en cada paso de la acumulación arrastra el error.

Las dos están verificadas contra PostgreSQL 18 real en `db-paridad.test.ts`.

---

## Reporte de diferencias

Formato del reporte que produce el importador:

```
fila  moneda  legacy      nuevo        motivo                   patas descartadas
────────────────────────────────────────────────────────────────────────────────
12    ARS     (anulado)   100.000,00   bug5_columna_anulada     PESOS
12    USD     34,34       34,34        —
48    USD     100.000,00  100.067,34   bug6_pata_descartada     PESOS convertido
```

Resumen por moneda y período, con el total perdido por cada defecto.

---

## Qué falta para poder correrlo

El importador y la conciliación están implementados y testeados
(`src/lib/migracion/legacy.ts`), pero **no se corrieron sobre datos reales**:
hace falta un export del histórico legacy. Sin eso, lo único que puede
afirmarse es que la transformación es correcta sobre los casos construidos,
no cuánto dinero afectó el defecto en producción.
