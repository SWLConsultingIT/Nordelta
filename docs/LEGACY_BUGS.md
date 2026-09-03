# Registro de defectos del sistema legacy

Defectos encontrados leyendo el código en producción: las cuatro queries de
BigQuery del workflow `Nordel - Big Query - Querys` y los seis Apps Script de
los Sheets.

**Los seis afectan la exactitud de los saldos hoy**, con independencia de la
migración. Cuatro pueden estar produciendo números incorrectos sin que nadie
lo note.

| # | Defecto | Impacto | Estado |
|---|---|---|---|
| 1 | Carrera de 30 s entre el Sheet y la cadena de queries | Saldo leído de una tabla a medio reconstruir | Imposible por diseño |
| 2 | La deduplicación borra movimientos legítimos | Pérdida de movimientos | Imposible por diseño |
| 3 | El semáforo de concurrencia falla en abierto | Lectura de datos en blanco | Invertido a fail-safe |
| 4 | El cierre de cuenta no es determinístico | El cierre se mueve entre corridas | Corregido con `orden` |
| 5 | La columna de pesos se anula y pierde la pata sin convertir | Pérdida de dinero | Imposible por diseño |
| 6 | Un o-exclusivo descarta la pata convertida | Pérdida de dinero | Imposible por diseño |

---

## Bug 1 · Carrera de 30 segundos

**Dónde** · Apps Script de Cuentas Corrientes, `refrescarBigQueryYNotificar()`.

**Qué hace** · `enviarWebhook()` → `Utilities.sleep(30000)` →
`refreshAllDataSources()`.

**Causa** · La cadena de n8n corre cuatro jobs de BigQuery secuenciales, cada
uno con su loop de polling, más dos nodos `Wait`. Santi dice en el video que
tarda minutos. El Apple Script espera **30 segundos fijos** y refresca sin
verificar que la cadena haya terminado. Las cuatro queries son
`CREATE OR REPLACE TABLE`, así que durante la reconstrucción la tabla está
siendo reemplazada.

**Impacto** · El Sheet puede mostrar el saldo de una tabla a medio
reconstruir, sin ninguna señal de que eso pasó. Explica el momento del video
donde Santi toca actualizar, no pasa nada y vuelve a tocar.

**Comportamiento nuevo** · No existe equivalente. Los saldos son vistas que
se calculan al consultarlas; no hay proceso que disparar ni espera que
estimar. Las escrituras son atómicas por RPC.

**Regresión** · No aplica: se elimina la clase entera de problema. La
atomicidad está cubierta en `tests/db-paridad.test.ts`.

---

## Bug 2 · La deduplicación borra movimientos legítimos

**Dónde** · Apps Script de consolidado, `removeDuplicateRows_()`.

**Qué hace** · Deduplica por firma de fila completa:
`row.map(String).join('|')`.

**Impacto** · Dos pagos al mismo cliente, el mismo día, por el mismo monto y
con el mismo detalle se colapsan en uno solo, en silencio. Es un caso
perfectamente normal en una financiera.

**Comportamiento nuevo** · Cada movimiento tiene identidad propia
(`movimientos.id`). **Nunca** se deduplica por contenido financiero. La
idempotencia de la migración usa identidad de origen —
`origen->>'legacy_id'` con índice único — que es una cosa distinta.

**Regresión** · `tests/cierres.test.ts` → «dos movimientos idénticos
sobreviven como dos» y «tres pagos iguales suman tres veces».

---

## Bug 3 · El semáforo de concurrencia falla en abierto

**Dónde** · `actualizarEstadoScript_()` en caja diaria escribe en
`script!C2`; `verificarYEsperarOtrosScripts()` en Cuentas Corrientes lee
`script!D2` y `D4` de su propia hoja, que deben ser espejos por
`IMPORTRANGE`.

**Causa** · Los dos scripts hacen `return` con solo un `Logger.log` de
advertencia si la hoja `script` no existe o cambió de nombre. Ante cualquier
problema, **el sistema asume que está libre y sigue**.

**Impacto** · El consolidado se vacía y se reescribe mientras BigQuery puede
estar leyéndolo. Explica por qué parecía roto en caja diaria 1.

**Comportamiento nuevo** · Invertido a fail-safe en toda la superficie:

- `fn_puede_ver_oficina()` devuelve falso cuando no hay perfil.
- Un perfil nuevo arranca con `rol = 'lectura'` y sin ninguna oficina
  asignada: no ve nada hasta que un administrador lo habilite.
- Las tablas con RLS activo y sin política de escritura **deniegan**:
  `auditoria` es append-only por construcción, no por convención.
- La capa de datos nunca devuelve una lista vacía ante un fallo; lanza
  `ErrorDatos`.

**Regresión** · Cubierto estructuralmente en `0003_rls.sql`. Las políticas se
aplican en `tests/db-paridad.test.ts` a través de las vistas con
`security_invoker`.

---

## Bug 4 · El cierre de cuenta no es determinístico

**Dónde** · Tercera query, `Consolidado.Cheques-Transacciones`.

**Qué hace** ·
`ROW_NUMBER() OVER (PARTITION BY CLIENTE ORDER BY FECHA, <cierres al final>, CONCEPTO)`.

**Causa** · No hay desempate más allá del concepto. Dos movimientos del mismo
cliente, misma fecha y mismo concepto quedan en orden arbitrario.

**Impacto** · El saldo corrido y, por lo tanto, **cuál fila dispara el cierre
de cuenta** pueden cambiar entre corridas sobre los mismos datos.

**Comportamiento nuevo** · `movimientos.orden` da un desempate estable, y el
orden canónico es idéntico en las tres implementaciones:
`compararMovimientos()` en el dominio, la ventana de `v_cta_cte`, y el
`ORDER BY` de las consultas.

**Regresión** · `tests/cierres.test.ts` → veinticinco mezclas
determinísticas del historial producen la misma huella; más el desempate por
id numérico y no lexicográfico.

---

## Bug 5 · La columna de pesos se anula y pierde la pata sin convertir

**Dónde** · Segunda query, `Consolidado.Transacciones26`.

**Qué hace**

```sql
PESOS = CASE WHEN COALESCE(TC,0) > 0 OR COALESCE(TC_Transferencia,0) > 0
             THEN NULL
             ELSE ROUND(PESOS + Pago_Facil + Transferencia_Pesos*(1+Comision), 2)
        END
```

**Causa** · La condición que anula `PESOS` mira **los dos** tipos de cambio,
pero `DOLARES` solo recupera la pata efectivo cuando `TC > 0`. En cualquier
fila que mezcle una pata convertida con una pata en pesos sin convertir, la
pata sin convertir desaparece del saldo.

**Impacto medido** · Efectivo de 100.000 ARS sin TC, más una transferencia de
50.000 ARS a 1.485 con 2 %:

| | PESOS | DOLARES |
|---|---|---|
| Legacy 2026 | `NULL` — se pierden los 100.000 | 34,34 |
| Correcto | 100.000 | 34,34 |

La fórmula de 2025 sobre la misma fila devuelve 100.000, así que **el
rediseño de 2026 introdujo el defecto**.

**Comportamiento nuevo** · Imposible por diseño. Cada partida resuelve su
moneda de impacto de forma independiente en una columna generada, así que
ninguna pata puede desaparecer porque otra de la misma operación tenga tipo
de cambio.

**Regresión** · `tests/bug5-regresion.test.ts` transcribe la fórmula legacy
para demostrar la divergencia, y recorre las **1023 combinaciones** no vacías
de un conjunto de nueve patas verificando que cada aporte sobrevive.

**Cuánto dinero afecta en producción** · Depende de si esas filas mixtas
existen de verdad. La consulta de diagnóstico está en la sección G del
documento de arquitectura.

---

## Bug 6 · Un o-exclusivo descarta la pata convertida

**Dónde** · Segunda query, `Consolidado.Transacciones26`, columna `DOLARES`.

**Qué hace**

```sql
CASE WHEN COALESCE(DOLARES,0) <> 0 THEN DOLARES
     WHEN COALESCE(TC,0) > 0      THEN (PESOS + Pago_Facil) / TC
     ELSE 0 END
```

**Causa** · Es un **o-exclusivo donde correspondía una suma**. Si la fila
tiene un monto nominal en dólares, la pata de pesos convertida no se suma:
se descarta. Lo mismo en la rama de transferencia con
`Transferencias_en_Dolares` y `TC_Transferencia`.

**Impacto medido** · Pesos 100.000 a TC 1.485 más 100.000 dólares nominales:

| | PESOS | DOLARES |
|---|---|---|
| Legacy 2026 | `NULL` — se pierden los 100.000 ARS | 100.000,00 |
| Correcto | 100.000 | 100.067,34 |

Pérdida doble en la misma fila: los 100.000 pesos por el bug 5 y los 67,34
dólares por este.

**Encontrado** · Durante la auditoría, por el barrido de conciliación de
`tests/migracion.test.ts`: aparecía como diferencia «sin explicar» y al
investigarlo resultó ser un mecanismo distinto del bug 5.

**Comportamiento nuevo** · Imposible por diseño, por la misma razón que el
bug 5: las patas se suman, nunca se eligen.

**Regresión** · `tests/migracion.test.ts` → «identifica el bug 6: el
o-exclusivo que descarta la pata convertida», y el barrido amplio que exige
cero diferencias sin explicar.

---

## Defectos menores

| Defecto | Dónde | Estado |
|---|---|---|
| El export deja spreadsheets `Temp_…` huérfanos para siempre | `descargarExcelLimpio()` | El export nuevo no crea archivos intermedios |
| La rama de alerta de errores con IA está cableada sin prompt | Nodo `Message a model`, gpt-5-mini | No se replica; los errores se manejan con la taxonomía de `domain/errors.ts` |
| El comentario y el código discrepan en las columnas validadas | Validador de Cierre De Cuentas | No aplica: la validación es por campo, no por índice de columna |
| `TRIM(CLIENTE)` resuelve espacios pero no mayúsculas | Cuarta query, `balance_final` | `contrapartes.nombre_norm` con índice único |
| No existe estado de rechazo de cheque | Sheet de cheques | `partida_cheque.estado` existe; **cuándo** impacta es decisión abierta (D7) |
