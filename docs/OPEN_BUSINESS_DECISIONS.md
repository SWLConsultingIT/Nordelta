# Decisiones de negocio pendientes

Reglas que no se pueden determinar desde el código y que **no se inventaron**.
Cada una está aislada arquitectónicamente: el desarrollo siguió sin ellas, y
ninguna bloquea el resto del sistema.

Prioridades: **BLOCKER** impide cerrar el esquema · **HIGH** afecta un saldo
o una regla financiera · **MEDIUM** afecta alcance o diseño · **LOW** es
prolijidad.

| # | Pregunta | Prioridad | Responde |
|---|---|---|---|
| D1 | ¿Sigue vigente el asiento espejo del proveedor de transferencia? | BLOCKER | Lucho |
| D2 | ¿Qué es un «full pago» y qué lo distingue? | BLOCKER | Lucho |
| D3 | ¿«Egresos» y «Gastos» son lo mismo que «Pagos a proveedores»? | HIGH | Lucho |
| D4 | ¿Los préstamos son una entidad con capital, interés y plazo? | HIGH | Lucho |
| D5 | ¿De dónde sale el tipo de cambio? ¿Hay que preservar cotizaciones? | HIGH | Lucho |
| D6 | ¿El descuento del cheque es informativo o impacta algún saldo? | HIGH | Lucho |
| D7 | ¿Cuándo impacta contablemente un cheque? ¿Existe el rechazo? | HIGH | Lucho |
| D8 | ¿Qué debe pasar al editar un movimiento histórico? | HIGH | Lucho + cliente |
| D9 | ¿Quiénes usan el sistema y qué ve cada uno? | MEDIUM | Cliente |
| D10 | ¿Pueden existir dos movimientos idénticos el mismo día? | MEDIUM | Lucho |
| D11 | ¿Los impuestos deberían llegar a la cuenta corriente? | MEDIUM | Lucho |
| D12 | ¿Una fila por partida o la fila ancha del legacy? | MEDIUM | Quien carga |
| D13 | ¿«Peña» y «Pena» son el mismo cliente? | LOW | Lucho |
| D14 | ¿Por qué hay seis Sheets de cierre? | LOW | Santi o Lucho |

---

## D1 · Asiento espejo del proveedor de transferencia — BLOCKER

**Por qué importa** · Define si un movimiento puede referenciar dos
contrapartes, que es una decisión de esquema.

**Comportamiento legacy** · La query de 2025 tiene una segunda rama
`UNION ALL` que emite un movimiento espejo a nombre de
`Proveedor_Transferencia`, con su propio `TC_Transferencia_Proveedor`, su
propia `Comision_Proveedor` y su propio `Detalle_Proveedor`. Es la financiera
parada en el medio de una transferencia, con asiento para las dos
contrapartes.

**Evidencia** · Esa rama **no existe** en la query de 2026. Las cinco
columnas asociadas desaparecieron del esquema.

**Impacto técnico** · El modelo `movimiento + partidas` lo soporta sin
reescrituras: alcanza con agregar `contraparte_secundaria_id` a
`movimientos` y una partida marcada. **No está implementado a propósito**:
activar contablemente una funcionalidad sin confirmar sería inventar una
regla.

**Decisión necesaria** · Una de tres. (a) Se dejó de usar
intencionalmente → se descarta. (b) Sigue vigente → se implementa. (c) Se
perdió sin querer al rearmar el dataset 2026 → **es un incidente: faltan
asientos de proveedor desde enero** y hay que cuantificarlo antes de migrar.

---

## D2 · Qué es un «full pago» — BLOCKER

**Por qué importa** · Es una de las tres categorías que sí impactan la cuenta
corriente. Si tiene semántica propia, hoy vive en la cabeza de alguien.

**Comportamiento legacy** · Está en `ALLOWED_SECTIONS` y el código la trata
**idéntico** a ingresos y pagos a proveedores. No hay ninguna regla que la
distinga.

**Impacto técnico** · Hoy es un valor de enum con `afecta_cta_cte = true`. Si
implica un comportamiento —cancelar un saldo completo, cerrar una operación,
disparar algo— falta implementarlo.

**Decisión necesaria** · Si es solo una clasificación para reportes, no hay
nada que hacer y se cierra. Si no, describir la regla.

---

## D3 · «Egresos» y «Gastos» — HIGH

**Comportamiento legacy** · El script de consolidado los **fusiona**:
cualquier sección que empiece con `Egresos` o `Gastos` se guarda como
*Pagos a proveedores*, perdiendo la distinción.

**Impacto técnico** · `interpretarCategoria()` mantiene el mapeo por
compatibilidad. Si son categorías distintas del negocio, hoy se está
perdiendo información y hay que agregar los valores al enum.

**Decisión necesaria** · Sinónimos históricos, o categorías distintas.

---

## D4 · Préstamos — HIGH

**Evidencia** · Revisadas las cuatro queries y los seis Apps Script: no hay
tabla de préstamos, ni interés, ni plazo, ni cuotas, ni amortización.
«Préstamo» parece ser texto libre en el campo Detalle, y el «pasaje
automático a dólares» es la regla de tipo de cambio que ya existe.

**Impacto técnico** · Ninguno si se confirma. El modelo no impide agregar la
entidad después: sería una tabla `prestamos` con los movimientos
referenciándola.

**Decisión necesaria** · Una frase de confirmación. Si Nordelta presta con
interés y plazo y eso hoy se lleva por fuera del sistema, es un módulo nuevo
y cambia el alcance del proyecto.

---

## D5 · Origen del tipo de cambio — HIGH

**Comportamiento legacy** · Se escribe a mano por fila, y hay **dos por
fila**: `TC` para la pata efectivo y `TC_Transferencia` para la de
transferencia.

**Preguntas** · ¿Quién decide el valor? ¿Es por operación, por día, por
oficina? Y sobre todo: si mañana alguien corrige un movimiento de enero,
¿tiene que quedar la cotización de enero o se recalcula con la de hoy?

**Impacto técnico** · Si hay que preservar cotizaciones, aparece una tabla
`tipos_cambio` con vigencia y los movimientos la referencian. Si el TC es
siempre un dato de la operación, la implementación actual —una columna por
partida— es la correcta y no hay nada que cambiar.

---

## D6 · Descuento del cheque — HIGH

**Comportamiento legacy** · El importe que llega a la cuenta corriente es
`A_pagar`, ya neto. La `Tasa_de_Descuento` y el `Descuento` viajan hasta la
tabla final pero **no suman a ningún saldo**.

**Impacto técnico** · Están modelados en `partida_cheque` como datos. Si el
descuento es ingreso de la financiera, debería impactar algún saldo o algún
reporte, y hoy no lo hace en ninguno de los dos sistemas.

---

## D7 · Cuándo impacta un cheque — HIGH

**Comportamiento legacy** · Filtro `Fecha_Cobro <= CURRENT_DATE()`. El cheque
entra a la cuenta corriente **automáticamente al llegar su fecha**, sin que
nadie confirme el cobro. **No existe ningún estado de rechazado.**

**Impacto técnico** · `partida_cheque.estado` ya existe con los cuatro
valores (`pendiente`, `cobrado`, `rechazado`, `anulado`). Lo que **no** está
decidido es si el impacto contable debe seguir la fecha (como hoy) o el
estado. Hasta que se defina, la vista replica el comportamiento legacy.

**Decisión necesaria** · Si los rechazos existen, hoy el saldo cuenta plata
que nunca entró. Habría que definir el momento del impacto y revisar el
histórico.

---

## D8 · Editar movimientos históricos — HIGH

**Comportamiento legacy** · Los cierres se recalculan cada vez, así que
editar una fila de enero **mueve en silencio todos los cierres posteriores**
de ese cliente. Y nada registra quién cambió qué.

**Impacto técnico** · La infraestructura está lista: `actualizar_movimiento`
reemplaza cabecera y partidas atómicamente, la auditoría registra cada campo
con valor anterior y nuevo, y acepta un motivo. La política RLS deja editar
solo a supervisor y admin.

**Decisión necesaria** · Si el motivo es obligatorio, si hay períodos
cerrados que no se tocan, y si una corrección se hace editando o con un
asiento de ajuste. Nada de eso se inventó.

---

## D9 · Usuarios y permisos — MEDIUM

**Evidencia** · Cero. El legacy no tiene noción de usuario.

**Impacto técnico** · `0003_rls.sql` implementa cuatro roles y alcance por
oficina, con el default más restrictivo posible: un perfil nuevo no ve nada.
Es el mínimo razonable, no el modelo definitivo.

**Decisión necesaria** · ¿Un operador de Puertos ve los movimientos de
Remeros? ¿Quién puede borrar? ¿Quién puede cargar un ajuste de cuenta?

---

## D10 · Movimientos idénticos el mismo día — MEDIUM

**Comportamiento legacy** · Se colapsan en uno solo, en silencio (bug 2).

**Impacto técnico** · El sistema nuevo los conserva como dos, que es lo
correcto por defecto. Si el negocio afirma que no pueden existir, se agrega
una restricción explícita —que rechaza con un mensaje— en lugar de borrar
callado.

**Además** · Si pueden existir, **hoy se están perdiendo movimientos** y hay
que revisar el histórico.

---

## D11 · Impuestos en la cuenta corriente — MEDIUM

**Comportamiento legacy** · No llegan, pero **por accidente**: el script no
tiene ninguna rama para una sección llamada `Impuestos`, así que esas filas
heredan la sección anterior. Como cae entre Compras y Ventas, ambas
excluidas, el resultado termina siendo correcto — y se rompe si alguien
reordena la planilla.

**Impacto técnico** · En el sistema nuevo está explícito:
`fn_categoria_puede_impactar()` excluye `impuesto`, y un CHECK impide la
combinación contradictoria. Si la respuesta es que sí deben impactar, se
cambia la función.

---

## D12 · Una fila por partida, o la fila ancha — MEDIUM

**Contexto** · La grilla usa una fila por partida (nueve columnas). El legacy
usa una fila ancha de dieciséis columnas donde el medio de pago está
codificado en cuál columna llenás.

**Impacto técnico** · **Ninguno sobre el modelo**: `movimiento + partidas`
soporta las dos representaciones. Es una decisión de interfaz.

**Decisión necesaria** · Sentarse con quien carga todos los días, cronómetro
en mano, y comparar veinte movimientos en la grilla nueva contra veinte en el
Sheet. Si la nueva es más lenta, se rediseña dentro del modelo de partidas
—por ejemplo agrupando visualmente el movimiento con sus patas debajo— sin
volver al modelo legacy.

---

## D13 · Plegado de acentos en nombres — LOW

**Contexto** · `normalizarNombre()` unifica mayúsculas, espacios y formas
Unicode, pero **no plega acentos**: «Peña» y «Pena» son clientes distintos.

**Por qué así** · Plegarlos podría fusionar dos clientes genuinamente
distintos, y eso es una decisión del negocio.

**Impacto técnico** · Cambiarlo es una línea en la función y en la columna
generada, más una migración de datos si ya hay duplicados.

---

## D14 · Por qué seis Sheets de cierre — LOW

**Contexto** · Seis no coincide con cuatro oficinas ni con los dos años en
uso.

**Impacto técnico** · Si la división significa algo del negocio, hay que
conservarla como campo. Si es histórico acumulado, se unifica en la categoría
`ajuste_cierre` como está hoy.
