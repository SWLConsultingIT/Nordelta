# Reunión con Lucho · una hora

Preguntas en lenguaje de negocio, ordenadas para que las dos primeras se
resuelvan en los primeros diez minutos. Cada una tiene un ejemplo concreto
para que se pueda contestar sin pensar en el sistema.

**Formato sugerido:** ir de arriba hacia abajo. Si una pregunta se traba más
de cinco minutos, anotarla y seguir — se retoma al final.

---

## 1 · Cuando ustedes hacen una transferencia para un cliente, ¿el proveedor de la transferencia también queda con cuenta?

**Ejemplo concreto**

> Un cliente les pide transferir dos millones de pesos. Ustedes usan un
> proveedor de transferencias, que les cobra su comisión y les da su propio
> tipo de cambio.
>
> Al final del día, ¿ese proveedor también aparece en el listado de cuentas
> con un saldo? ¿O el único que aparece es el cliente?

**Por qué lo necesitamos**

Hasta 2025 el sistema generaba **dos movimientos** por esa operación: uno para
el cliente y otro para el proveedor de la transferencia, cada uno con su
propio tipo de cambio y su propia comisión. En 2026 esa parte desapareció del
sistema.

**Opciones**

| | Qué significa | Qué hacemos |
|---|---|---|
| **A** | Se dejó de usar a propósito, el proveedor ya no lleva cuenta | Lo damos de baja y no se implementa |
| **B** | Sigue siendo así, el proveedor lleva cuenta | Lo implementamos |
| **C** | Debería seguir siendo así pero dejó de funcionar | **Faltan asientos de proveedor desde enero de 2026** y hay que reconstruirlos |

**Si la respuesta es C**, la siguiente pregunta es: ¿alguien notó que faltaban
esos saldos? Eso nos dice si el problema es de enero o más reciente.

---

## 2 · ¿Qué es un «full pago»?

**Ejemplo concreto**

> Un cliente les debe mil dólares. Les paga mil dólares.
>
> ¿Eso se carga como «full pago»? ¿O «full pago» es otra cosa?

**Por qué lo necesitamos**

En el sistema, «full pago» es una de las tres categorías que afectan la cuenta
corriente, pero el código la trata **exactamente igual** que a un ingreso o a
un pago a proveedor. Si para ustedes significa algo distinto —cancelar el
total, cerrar una operación, algo— eso hoy no está en el sistema y vive en la
cabeza de quien carga.

**Lo que necesitamos saber**

Si es solo una etiqueta para después buscar, listo, no hay nada que hacer. Si
implica algo que el sistema debería hacer solo, describilo en una frase.

---

## 3 · Los cheques entran a la cuenta el día que vencen, sin que nadie confirme que se cobraron. ¿Está bien así?

**Ejemplo concreto**

> Reciben un cheque a 30 días por un millón de pesos. Llega el día del
> vencimiento. El sistema, solo, suma ese millón a la cuenta del cliente.
>
> ¿Y si el cheque rebota?

**Por qué lo necesitamos**

Hoy no existe forma de registrar un rechazo. Si un cheque rebota, el saldo
sigue contando esa plata como cobrada.

**Lo que necesitamos saber**

1. ¿Rebotan cheques? ¿Con qué frecuencia?
2. ¿El saldo debería sumar el cheque cuando vence, o cuando alguien confirma
   que se cobró?
3. Si rebotan y hoy no se registra, **¿cuántos saldos actuales están
   inflados?**

---

## 4 · Cuando un cliente descuenta un cheque, la diferencia que ustedes se quedan, ¿es ganancia de ustedes?

**Ejemplo concreto**

> Cheque de un millón. Tasa de descuento del 5 %. Le pagan al cliente
> 950.000.
>
> Esos 50.000, ¿aparecen en algún lado del sistema como ingreso de Nordelta?

**Por qué lo necesitamos**

El sistema guarda la tasa y el monto del descuento, pero **no los suma a
ningún saldo ni a ningún reporte**. Si es ganancia, hoy no se ve en ninguna
parte.

---

## 5 · ¿De dónde sale el tipo de cambio que se carga en cada operación?

**Ejemplo concreto**

> Cargan una operación de cuatro millones de pesos a 1.485.
>
> Ese 1.485, ¿lo define alguien a la mañana para todo el día? ¿Lo negocian
> por operación? ¿Cambia entre oficinas?

**Y la parte importante**

> Si dentro de tres meses hay que corregir esa operación de hoy, ¿el 1.485
> tiene que quedar como está, o se recalcula con la cotización del día de la
> corrección?

**Por qué lo necesitamos**

La segunda parte decide si el sistema necesita guardar un histórico de
cotizaciones o si el tipo de cambio es simplemente un dato de la operación.

---

## 6 · «Egresos» y «Gastos», ¿son lo mismo que «Pagos a proveedores»?

**Ejemplo concreto**

> En algunas hojas la sección se llama «Pagos a proveedores» y en otras
> «Egresos» o «Gastos».
>
> ¿Es la misma cosa escrita distinto, o son categorías que ustedes quieren
> poder distinguir?

**Por qué lo necesitamos**

El sistema actual las **fusiona todas** en «Pagos a proveedores». Si son
distintas, hoy se está perdiendo esa distinción.

---

## 7 · ¿Puede haber dos movimientos exactamente iguales el mismo día?

**Ejemplo concreto**

> El mismo cliente, el mismo día, dos pagos de doscientos cincuenta mil pesos
> cada uno, con el mismo detalle.
>
> ¿Puede pasar?

**Por qué lo necesitamos**

El sistema actual, cuando encuentra dos filas idénticas, **borra una**. Sin
avisar.

**Si la respuesta es que sí puede pasar**, entonces hoy se están perdiendo
movimientos y hay que revisar el histórico.

---

## 8 · Cuando hay que corregir una operación de un mes cerrado, ¿cómo lo hacen hoy?

**Ejemplo concreto**

> Estamos en septiembre y aparece un error en una operación de marzo.
>
> ¿Se edita la operación de marzo? ¿O se carga un ajuste con fecha de
> septiembre?

**Por qué lo necesitamos**

Si se edita, el sistema recalcula todos los cierres de cuenta posteriores de
ese cliente, en silencio. Necesitamos saber si eso es lo esperado, y si hay
meses que ya no se tocan.

**También:** ¿debería quedar registrado el motivo de la corrección?

---

## 9 · ¿Los impuestos tienen que aparecer en la cuenta corriente del cliente?

**Ejemplo concreto**

> Cargan un impuesto en la hoja del día.
>
> ¿Eso afecta lo que un cliente les debe?

**Por qué lo necesitamos**

Hoy **no** afecta, pero por casualidad: la sección de impuestos no está
contemplada en el sistema y sus filas quedan afuera por la posición en que
están. Si alguien reordena la planilla, empiezan a contar.

---

## 10 · ¿«Peña» y «Pena» son el mismo cliente?

**Por qué lo necesitamos**

El sistema nuevo unifica mayúsculas y espacios —«SANCHEZ», «sanchez» y
«Sanchez» son uno— pero **no** unifica acentos, para no fusionar dos clientes
distintos por error. Si quieren que también los unifique, es un cambio de una
línea.

---

## 11 · ¿Por qué hay seis planillas de cierre de cuentas corrientes?

**Por qué lo necesitamos**

Seis no coincide con las cuatro oficinas ni con los dos años. Si la división
significa algo, la conservamos como campo. Si es histórico acumulado, se
unifica.

---

## Para el cliente, no para Lucho

Estas son operativas y las contesta quien maneja el equipo:

- ¿Quiénes van a usar el sistema, y alguien tiene que ver **solo** su oficina?
- ¿Quién puede borrar un movimiento? ¿Quién puede cargar un ajuste de cuenta?
- ¿Cómo es el internet en cada oficina? Si es inestable, la pantalla de carga
  tiene que funcionar sin conexión y eso cambia el trabajo.
- ¿Hay que migrar todo 2025, o alcanza con poder consultarlo aparte?
- ¿Hay algo anterior a 2025, en otro formato?

---

## Los seis defectos, para avisar

No son preguntas: son cosas que están pasando hoy y que conviene contar en la
misma reunión. El detalle está en `LEGACY_BUGS.md`.

1. El Sheet muestra el saldo antes de que termine de calcularse.
2. Dos movimientos idénticos se colapsan en uno.
3. La protección contra procesos simultáneos no funciona.
4. El cierre de cuenta puede cambiar entre una corrida y otra.
5. Una operación que mezcla efectivo y transferencia **pierde plata**.
6. Una operación con dólares y pesos convertidos **pierde plata**.

Los dos últimos se pueden cuantificar en pesos exactos apenas tengamos un
export del histórico. Conviene llevar ese número a la reunión siguiente, no a
esta.
