# Guion de demostración · 8 a 10 minutos

Recorrido que cuenta una historia coherente: se carga una operación, se ve
cómo impacta una cuenta, se cierra otra con un ajuste y se muestra el rastro
que quedó. Los datos son ficticios y están armados para que cada paso tenga
algo concreto que mostrar.

## Antes de empezar

```bash
npm install
npm run dev
```

Abrir **http://localhost:3000**. No hacen falta variables de entorno, ni
Supabase, ni conexión a nada.

Si es la segunda vez que se corre la demo, restablecer primero los datos en
**Ajustes de cuenta → Restablecer datos de demostración**.

**Recomendado:** ventana en 1440 px, sin zoom. Tener a mano una planilla de
Excel con el bloque del paso 2.

---

## 1 · Entrar · 30 s

Landing → **Ingresar** → **Ingresar a la demostración**.

> «No hay pantalla de configuración ni nada técnico: el operador entra y ya
> está en su día de trabajo.»

Cae en **Inicio**.

---

## 2 · Inicio · qué está pasando hoy · 1 min

Señalar los tres bloques:

- **Movimiento del día** — ingresos, pagos y neto, **con las monedas
  separadas**. Vale decirlo en voz alta: un total que mezcle pesos con
  dólares no significa nada, y el sistema no lo hace en ninguna pantalla.
- **Actividad reciente** — los últimos movimientos, con su impacto.
- **Requiere atención** — cheques del día, movimientos que por definición no
  tocan la cuenta corriente, y los contadores de error en cero.

> «El sistema viejo, para responder esto, necesitaba abrir dos archivos y
> apretar un botón que tardaba minutos.»

---

## 3 · Carga · pegar desde Excel · 2 min

Ir a **Carga de movimientos**. Está en Nordelta y en la fecha del día.

Copiar este bloque desde una planilla de Excel (son cinco columnas: la
contraparte, el detalle, la categoría, el medio y la moneda; después el monto):

```
Patagonia Comercial SA	Cobro de factura	Ingresos	Efectivo	Pesos	1.850.000
Grupo Horizonte SA	Transferencia recibida	Ingresos	Transferencia	Dólares	4.200
Mercado Central SA	Pago a proveedor	Pagos a proveedores	Efectivo	Pesos	-620.000
```

Hacer clic en la **primera celda de la primera fila vacía** y pegar.

Qué señalar:

1. **Los montos entran con el formato de Excel argentino.** `1.850.000` se
   interpreta bien. Un parser que solo aceptara `1850000` rompería el pegado.
2. **Las categorías y monedas escritas en texto se interpretan.** «Ingresos»
   pasa a la categoría correcta, «Dólares» a USD. Lo que no se puede
   interpretar queda marcado en la celda y **no se inventa**.
3. La columna **Impacta cta. cte.** se calcula sola.

Después: escribir una letra en un monto. La celda se pone roja y el guardado
se bloquea.

> «Esto en la planilla es un cartel después del hecho. Acá el dato no puede
> entrar: la base tiene tipos y no lo aceptaría.»

Borrar la letra y apretar **Guardar**.

> «Tres movimientos guardados.»

---

## 4 · La cuenta que acabamos de tocar · 1,5 min

**Cuentas** → buscar **Patagonia Comercial SA** → abrir.

Qué señalar:

- Los **saldos por moneda** arriba, cada uno con su símbolo.
- El movimiento que se acaba de cargar **ya está en el libro**, y el saldo en
  pesos subió 1.850.000.
- La columna **Saldo** muestra cómo quedó la cuenta después de cada operación.

> «No hay que consolidar nada. El saldo es el resultado de la consulta.»

Tocar una fila para abrir el detalle.

- Se ven las **partidas** que componen el movimiento: monto nominal, tipo de
  cambio, comisión y qué impacta.

**Para el caso interesante:** ir a **Logística del Sur SA** y abrir la
operación *Liquidación de operación*. Tiene **dos partidas**: efectivo en
pesos sin convertir, y transferencia en pesos convertida a dólares con
comisión.

> «Esta fila es la que el sistema actual pierde. Anula la columna de pesos
> porque hay un tipo de cambio en la otra pata, y esos pesos desaparecen del
> saldo. Acá cada partida resuelve su moneda por separado, así que no puede
> pasar.»

---

## 5 · Editar y ver el rastro · 1 min

En el detalle de cualquier movimiento: **Editar detalle**.

Cambiar el texto, escribir un motivo —«corrección pedida por el cliente»— y
guardar.

> «El cambio se refleja en el momento, y queda registrado quién lo hizo.»

---

## 6 · Cerrar una cuenta con un ajuste · 1,5 min

**Ajustes de cuenta** → elegir **Servicios Costanera SRL**.

Qué señalar:

- El **saldo actual**: $ 47.350 y US$ 128,40. Saldos chicos que quedaron de
  operaciones anteriores.
- Apretar **Proponer ajuste a cero**. El sistema completa el asiento con el
  negativo de cada saldo.
- En el panel de la derecha: **Actual → Ajuste → Queda**, moneda por moneda.
  Se lee de un vistazo qué va a pasar antes de confirmar.
- El aviso en verde: *La cuenta queda cerrada.*

> «El ajuste no toca ningún saldo: genera un asiento contable explícito. Y
> como las cuatro monedas quedan en cero, el cierre se marca solo.»

**Registrar ajuste** → **Ver la cuenta**.

En el libro aparece el corte:

```
──────── Cuenta cerrada · 03/09/2026 ────────
```

> «El cierre es un evento, no un movimiento de plata. Marca el final de un
> ciclo, y desde acá el operador puede filtrar solo lo que vino después.»

**Para mostrar el filtro:** ir a **Estudio Delta SRL**, que ya tenía un
cierre y volvió a operar. Activar **Desde el último cierre**: quedan solo los
movimientos del ciclo nuevo.

---

## 7 · Auditoría · 1 min

**Auditoría**.

- Están el alta de los tres movimientos del paso 3, la edición del paso 5 y
  el ajuste del paso 6.
- Filtrar por **Cambios** y abrir el de la edición.
- En el panel: **Antes** en rojo, **Después** en verde, y el motivo escrito.

> «Esto es capacidad nueva. En el sistema actual, si un saldo cambia, no hay
> forma de saber quién lo cambió ni cuándo.»

---

## 8 · Balance y exportación · 1 min

**Balance**.

- Los **totales por moneda** arriba, en cuatro tarjetas separadas.
- **Solo con saldo** activado por defecto: no se muestran decenas de cuentas
  en cero.
- Buscar una contraparte para mostrar el filtro.

**Exportar CSV** → abrir el archivo en Excel.

> «Se abre con las columnas separadas y la coma decimal en su lugar. Está en
> punto y coma y con BOM, que es lo que Excel en configuración argentina
> necesita. Es el archivo que hoy le mandan al cliente.»

---

## Cierre · 30 s

> «Todo lo que vieron sale de una sola fuente de datos: cargué en la grilla y
> el cambio apareció en la cuenta, en el balance y en la auditoría, sin
> apretar nada. Eso es lo que hoy requiere consolidar 62 hojas y esperar una
> cadena de consultas.»

---

## Qué NO mostrar todavía

Si sale el tema, es mejor decirlo de frente que improvisar:

| Tema | Qué decir |
|---|---|
| Base de datos real | Corre con datos de demostración. El esquema de Supabase está escrito y probado, falta aplicarlo |
| Migración del histórico | El importador está listo y probado; falta un export del sistema actual |
| Usuarios y permisos | Diseñado y probado en el esquema, sin conectar |
| Transferencias a móvil | No está en la demo a propósito: es una regla que todavía no confirmamos |
| Préstamos | Igual: no inventamos comportamiento contable |

---

## Si algo se rompe en vivo

1. **Ajustes de cuenta → Restablecer datos de demostración** vuelve todo al
   estado inicial. Pide confirmación.
2. Si la grilla queda en un estado raro: recargar la página. Lo guardado
   persiste; lo que estaba sin guardar se pierde.
3. Si el pegado no entra: verificar que el foco esté en una celda de la
   grilla —tiene que verse el recuadro azul— antes de pegar.
