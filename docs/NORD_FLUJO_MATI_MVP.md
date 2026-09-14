# El flujo de Mati · del motor a la pantalla

> **Nota de nombre.** Este documento es de una etapa anterior y usa «NORD»
> como nombre del producto y como abreviatura del cliente. El nombre visible
> pasó a ser **Pagos Nordelta**; el contenido se conserva tal cual porque
> documenta decisiones tomadas en ese momento.

> El flujo que describe NORD, contrastado contra lo que el motor ya produce
> hoy. Es un documento de diseño: **sin UI, sin Supabase, sin esquema, sin
> deploy, sin push.**
>
> Objetivo: que quede escrito qué de este flujo **ya existe**, qué es
> **mapeo de presentación** y qué es **motor que todavía no está** — antes de
> abrir un archivo `.tsx`.
>
> **Revisión 2 · 10-sep-2026** — incorpora la regla confirmada de pendientes.
> Ver §0.

---

## 0. Cambio de regla · pendientes

NORD confirmó la definición, y **reemplaza** lo que decía la revisión 1 de
este documento.

> **Una transferencia enviada y no acreditada es un problema desde el
> momento del envío.** No hay período de gracia: ni D+1, ni X días, ni
> umbral de antigüedad, ni vencimiento.

Y son problema **desde el momento de la detección**, sin esperar nada:
CUIT faltante o incorrecto, identificación inválida, comprobante inválido,
datos incorrectos, posible duplicado, match ambiguo.

**Queda reemplazado:** la revisión 1 de este documento sostenía en su §4 que
«pendiente no es tarea de Mati» y proponía ubicar los pendientes en una
sección secundaria llamada *en curso, sin acción*. **Esa conclusión ya no
aplica y no debe reutilizarse.** El razonamiento se apoyaba en el rezago
medido (§4), que sigue siendo un hecho — pero el rezago describe **cuánto
tarda** una acreditación, no **si el pendiente es un problema**. Son dos
preguntas distintas y la segunda la contesta el negocio, no la medición.

Lo que sí se conserva de esa sección: la distinción entre **qué es un
problema** (todo lo no conciliado) y **qué acción cabe** (monitorear, pedir
corrección al cliente, elegir un candidato, revisar). Esa distinción sigue
siendo válida y es la que ordena la pantalla — pero opera **dentro** de
«requieren atención», no para sacar filas de ahí.

---

## 1. El flujo pedido

```
MATI ENTRA A NORD
   ↓
INICIO            Acreditaciones de hoy · Enviadas · Acreditadas
                  Pendientes · Con error
   ↓
CONCILIACIÓN      497 operaciones procesadas
                  455 conciliadas automáticamente
                   24 pendientes
                   11 requieren revisión
                    7 con error
   ↓
MATI VE SOLO      DNI/CUIT dudoso · transferencia no encontrada
                  duplicado · match ambiguo · datos incorrectos
   ↓
RESUELVE EXCEPCIONES
   ↓
ESTADO POR CLIENTE   Enviado · Acreditado · Pendiente · Error
```

Dos lecturas que el sketch fija y conviene dejar explícitas:

**a) Los cuatro buckets particionan el total.** `455 + 24 + 11 + 7 = 497`.
No hay solapamiento: cada operación cae en exactamente uno. Eso es una
decisión de diseño y es la correcta — obliga a que ninguna fila se pierda,
que es la misma invariante que el motor ya verifica (`✅ ninguna fila
perdida`).

Con la regla de §0, la partición pasa a tener **dos niveles**:

```
497 operaciones
 ├─ 455  conciliadas automáticamente
 └─  42  REQUIEREN ATENCIÓN
      ├─ 24  pendientes de acreditación
      ├─ 11  requieren revisión
      └─  7  con error
```

**b) «Enviado» no es un quinto estado: es el denominador.** En *Inicio*,
«Enviadas» aparece junto a «Acreditadas / Pendientes / Con error», y en
*Estado por cliente* vuelve a aparecer «Enviado». La única lectura
consistente con (a) es que *Enviado* es **todo lo que el cliente declaró**, y
los otros tres son en qué terminó. Es decir: `Enviado = Acreditado +
Pendiente + Error`. Si la intención fuera otra —un estado «se envió pero
todavía no se procesó»— hay que decirlo, porque cambia el modelo de datos:
implicaría registrar el momento de ingesta como un evento distinto del de
conciliación.

---

## 2. Qué de esto ya existe

**Casi todo el contenido.** El motor hoy produce, sobre datos reales, los
cinco números de la pantalla *Conciliación* y el detalle por fila con el
motivo redactado para que lo lea una persona.

Corrida real de hoy (`CLIENT_SAMPLE_01`, 12 operaciones, informe de Fullcarga
del 01 al 10 de septiembre, 1197 acreditaciones):

```
  6  ACREDITADA_EXACTA_CUIT
  5  ACREDITADA_EXACTA_DNI
  1  PENDIENTE_NO_ENCONTRADA_EN_RANGO
 ──
 12   ✅ ninguna fila perdida

 cierra solo         11 · 91.7 %
 requieren atención   1 ·  8.3 %
```

`resumir()` ya devuelve `totalFilas`, `acreditadasTotal`, `pendientes`,
`requierenRevision`, `montoAcreditado`, `montoPendiente`, `tasaAutomatica` y
el desglose completo `porEstado`. La pantalla *Conciliación* es, en su
mayoría, **renderizar un `ResumenConciliacion` que ya se calcula**.

Nota sobre las proporciones del sketch: `455/497 = 91.5 %` automático. La
medición real dio `11/12 = 91.7 %`. La coincidencia es casualidad — doce
filas no predicen nada — pero el orden de magnitud del sketch es realista y
no hay que corregirlo hacia abajo.

---

## 3. Mapeo de los 11 estados a los buckets

El motor tiene 11 estados porque **el motivo importa para resolver**. La
pantalla necesita agrupar porque **el bucket importa para priorizar**. Son
dos niveles distintos, no una contradicción: el bucket es para la lista, el
estado es para la fila abierta.

### Nivel 1 · conciliada o requiere atención

| | Estados |
|---|---|
| **Conciliada automáticamente** | `ACREDITADA_EXACTA_CUIT` · `ACREDITADA_EXACTA_DNI` |
| **Requiere atención** | **todos los demás** |

Es la partición que importa: **todo lo que el sistema no cerró solo es
visible como problema.** No hay tercera categoría.

### Nivel 2 · por qué requiere atención, y qué se puede hacer

| Grupo | Estados del motor | Qué hace Mati |
|---|---|---|
| **A · Pendientes de acreditación** | `PENDIENTE_NO_ENCONTRADA_EN_RANGO` | **Monitorear.** Todavía no aparece en Fullcarga |
| **B · Requieren revisión** | `MATCH_AMBIGUO`<br>`POSIBLE_MATCH`<br>`IDENTITY_MAPPING_REQUIRED`<br>`POSIBLE_DUPLICADO` | **Decidir.** Hay información suficiente; elige una persona |
| **C · Errores de datos** | `ERROR_CUIT`<br>`ERROR_IDENTIFICACION`<br>`COMPROBANTE_INVALIDO`<br>`DATOS_INVALIDOS` | **Pedir corrección al cliente.** El dato de origen está mal |

Los cinco motivos que el sketch dice que Mati ve —«DNI/CUIT dudoso,
transferencia no encontrada, duplicado, match ambiguo, datos incorrectos»—
mapean uno a uno contra estados que ya existen. **No hay que inventar
taxonomía nueva.**

La distinción entre los grupos no es cosmética: son tres colas con dueños y
acciones distintas. **A** no depende de Mati ni del cliente: depende de que
Fullcarga acredite. **B** la cierra Mati sola con lo que ya tiene. **C**
exige volver a hablar con el cliente. Mezclarlas en una sola lista hace que
Mati no sepa por dónde empezar; separarlas **no** significa esconder ninguna.

---

## 4. Consecuencia de la regla: el volumen de pendientes

La regla de §0 no cambia el motor —el estado ya existía— pero **cambia
radicalmente el tamaño de lo que la pantalla tiene que mostrar**, y eso hay
que dimensionarlo antes de diseñarla.

Distribución de atraso medida sobre 510 filas reales con las dos fechas
(`FECHA` contra `FECHA INGRESO`):

| Atraso | Filas | % |
|---|---:|---:|
| Mismo día | 105 | 20,6 % |
| D+1 | 158 | 31,0 % |
| 2 a 7 días | 164 | 32,2 % |
| 8 a 30 días | 41 | 8,0 % |
| Más de 30 días | 42 | 8,2 % |

Atraso máximo observado: **113 días**.

Leído bajo la regla nueva: **al cierre de D+1, alrededor del 48 % de lo
enviado todavía no acreditó** y por lo tanto figura como pendiente. No es el
5 % que sugiere el sketch (`24/497`).

Y como el pendiente es un estado abierto que se arrastra, lo que se acumula
no es el pendiente de un día sino **la cola completa**. Estimación por Little
—volumen declarado de 300–600 operaciones diarias, permanencia media de
6 a 8 días según la tabla de arriba—:

> **La cola de pendientes en régimen es del orden de miles de operaciones,
> no de decenas.**

Es una estimación, no una medición: usa puntos medios de los rangos y el
tramo «más de 30 días» pesa mucho en el resultado. Pero el orden de magnitud
aguanta cualquier supuesto razonable, y **la conclusión de diseño no depende
de afinarla**:

- «Inbox zero» no es un objetivo alcanzable y la pantalla no debe sugerirlo;
- la lista de pendientes **necesita orden y filtro desde el día uno**
  —no es una lista corta que se lee de arriba abajo—;
- el número grande de *pendientes* no debe leerse como que algo se rompió:
  es el estado normal de la operación, y aun así **cada fila es un problema
  abierto**, exactamente como pide la regla.

Esto también dice algo sobre qué medir después: la métrica útil no es cuántos
pendientes hay, sino **si la cola crece o se drena**. Un pendiente que
envejece sin acreditar es distinto de uno que entró ayer, aunque los dos sean
problema desde el día cero.

---

## 5. Sin aging, con antigüedad

**No se crean estados por antigüedad.** Nada de «pendiente normal / demorada
/ reclamo»: no hay regla de negocio confirmada para eso, y no hace falta para
detectar el problema, porque el problema ya existe desde el envío.

**Sí se conserva y se muestra:**

- **fecha de envío** de la operación;
- **días pendiente**, calculado.

Sirven para **ordenar y priorizar**, no para clasificar. Una pendiente de 30
días se muestra antes que una de 1 día; **las dos son pendientes desde el
inicio y ninguna de las dos cambia de estado por el paso del tiempo.**

Consecuencia técnica: `días pendiente` es una **función de la fecha de
consulta**, no un campo que se guarda. Se deriva al leer, como se deriva hoy
`diasEntre()` — aritmética entera de días, sin husos horarios.

---

## 6. Lo que no existe y hay que construir

Tres cosas. Solo una es difícil.

### 6.1 · Resolver una excepción tiene que **persistir** (lo difícil)

Hoy el motor es **puro**: entra planilla + informe, sale resultado. Corrés
dos veces, obtenés lo mismo. Eso es una virtud para testear y es exactamente
lo que hace falta para el benchmark independiente —pero significa que
**«Mati resuelve» hoy no tiene dónde escribirse**. Si mañana corre de nuevo,
la excepción reaparece idéntica.

Hay tres tipos de resolución, y no son iguales:

| Resolución | Alcance | Valor |
|---|---|---|
| **Mapeo de identidad** — «este DNI/CUIT es este depositante» | **Permanente y reutilizable** | Alto: convierte una excepción recurrente en automatización futura |
| **Match manual** — «esta fila es este registro de Fullcarga» | Una operación | Cierra el caso, no enseña nada |
| **Descartar** — duplicado / anulada | Una operación | Cierra el caso |

El mapeo de identidad es el único con efecto compuesto: cada resolución de
Mati **sube la tasa automática del mes siguiente**. Es la diferencia entre
una herramienta que le ahorra tiempo y una que aprende. Debería ser el
primero en construirse.

Restricción que se mantiene, sin excepciones: **el mapeo lo aporta una
persona o el negocio, nunca una fórmula.** No se fabrica un CUIT desde un
DNI, no se asume prefijo, no se genera nada sintético. Lo que se persiste es
una afirmación humana, con quién la hizo y cuándo.

### 6.2 · Re-evaluación con historial

Una operación pendiente **no es un resultado, es un estado abierto**. Cada
informe nuevo de Fullcarga tiene que volver a intentar conciliar **todas**
las operaciones no cerradas, contra una ventana que se mueve.

```
Día 0   enviada                     → PENDIENTE
Día 3   nuevo informe, sin match    → PENDIENTE
Día 8   nuevo informe, encuentra    → ACREDITADA
```

**Hay que guardar el historial del cambio**, no solo el estado final. Tres
razones, y las tres son operativas:

- Mati necesita saber **desde cuándo** algo está pendiente y **cuántas veces
  se intentó**, o no puede distinguir «recién entró» de «hace un mes que no
  aparece»;
- sin historial no se puede responder **si la cola drena** (§4);
- una acreditación que aparece 40 días después tiene que poder auditarse:
  qué informe la trajo y cuándo.

Esto es lo que convierte al motor de **una función** en **un job con
estado**. Es el cambio estructural más grande del MVP, y es consecuencia
directa de la regla de §0 —no una preferencia de diseño.

### 6.3 · Cliente como entidad (lo mecánico)

`conciliar()` recibe hoy las filas de **una** planilla y `resumir()` toma un
`clientAlias` que es, en la práctica, un nombre de archivo. Las pantallas
*Inicio* y *Conciliación* son agregados **entre clientes**, y *Estado por
cliente* exige el corte por cliente.

Falta: el cliente como entidad, y la ingesta de N planillas en una corrida.
Es trabajo directo, sin decisiones abiertas. Vale notar la escala: hoy hay
**una** planilla real de 12 filas; los 497 del sketch son plausibles del lado
Fullcarga —se midieron 247 y 264 acreditaciones en un día— pero el formato
de planilla de los demás clientes **todavía no se vio** (pregunta P-E, sin
responder).

---

## 7. Lo que no se puede afirmar todavía

Honestidad sobre la medición, porque el sketch pone números que suenan
verificados:

- **`11 requieren revisión` y `7 con error` no están medidos.** Sobre las 12
  filas reales hubo **0 revisiones y 0 errores**. No hay base para estimar
  esas tasas; el sketch las inventa como ilustración y está bien que así sea,
  pero no deben tomarse como línea de base.
- **`24 pendientes` sí contradice lo medido.** Es el 4,8 % del total; el
  rezago observado implica cerca del 48 % al cierre de D+1 (§4). El sketch
  ilustra la forma de la pantalla, no el volumen que va a tener.
- **La precisión sigue sin validarse contra Mati.** El arnés está listo y las
  12 filas esperan respuesta en `mati-ground-truth-input.csv`. Hasta que
  vuelva, la afirmación disponible es «91.7 % de cobertura automática», no
  «91.7 % correcto». La regla sigue siendo **precisión antes que cobertura**.

---

## 8. Orden propuesto

1. **Mapeo de estados a buckets** — función pura, testeable, sin UI. Es el
   contrato que después consume la pantalla, y ahora tiene dos niveles (§3).
2. **Persistencia de resoluciones**, empezando por el mapeo de identidad —
   el único con efecto compuesto.
3. **Re-evaluación con historial** — el motor deja de ser one-shot. Es el
   cambio estructural que habilita la regla de §0.
4. **Ingesta multi-cliente** — mecánico, bloqueado por P-E.
5. **UI** — recién acá, y es la parte más rápida de todas.

Los pasos 1 a 4 son motor y no requieren decidir nada de diseño visual. El
paso 5 no debería empezar antes de que vuelva el resultado humano de Mati:
sin eso no sabemos si lo que la pantalla muestra en verde está bien.

---

## 9. Preguntas para NORD

| # | Pregunta | Por qué bloquea |
|---|---|---|
| **F-1** | ¿«Enviado» es el total declarado por el cliente, o un estado propio previo a la conciliación? | Cambia el modelo de datos (§1b) |
| ~~**F-2**~~ | ~~¿A partir de cuántos días un pendiente se convierte en reclamo?~~ | **Cerrada.** No hay período de gracia: el pendiente es problema desde el envío, y no se crean estados por antigüedad (§0, §5) |
| **F-3** | Cuando Mati resuelve una identidad, ¿vale para siempre y para todos los clientes, o solo para ese cliente? | Define el alcance del mapeo persistido (§6.1) |
| **F-4** | ¿Mati puede acreditar a mano algo que Fullcarga **no** muestra? | Si sí, el sistema deja de ser reconciliación y pasa a admitir asientos manuales |
| **F-5** | Una pendiente, ¿se cierra alguna vez sin acreditarse? | Sin baja, la cola de §4 crece para siempre. No es un umbral de aging: es si existe un cierre manual |
