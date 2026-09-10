# POC 2 · Parser del informe de Fullcarga

> # ✅ EXTRACCIÓN DE CUIT = 100 % · VALIDADO SOBRE 5 DÍAS
>
> **502 de 502 transferencias con CUIT válido**, en cinco informes reales
> descargados automáticamente (01, 04, 06, 08 y 09 de septiembre de 2026).
> 518 filas en total. Cero CUIT inválidos, cero patrones desconocidos.
>
> La pregunta que venía abierta desde el análisis de alcance —*«¿se puede
> recuperar el CUIT del campo Observación?»*— **queda contestada que sí, y ya
> no depende de un solo día.**
>
> Ver **§ 12 · Validación multidía**, que corrigió un defecto de clasificación
> y encontró que **solo el 31 % de las acreditaciones son de D+1**.
>
> Sin cambios en el descargador, que quedó VERIFIED en el POC anterior. Sin
> UI, sin Supabase, sin cron, sin cuenta corriente, sin tocar el núcleo
> financiero.

---

## 1. Archivo analizado

| | |
|---|---|
| Origen | Descargado por el POC 1, corrida del 9-sep-2026 |
| Informe | Movimiento de Saldos, fecha pedida 08-09-2026 |
| Formato | `.xls` binario, OLE2 + BIFF8 `0x0600` |
| Tamaño | 32.768 bytes · stream `Workbook` de 30.825 |
| Ubicación | `.tmp/fullcarga/` — **ignorado por git, no se commitea** |

**No se copió ningún dato real a los fixtures.** Todos los CUIT, nombres,
importes y observaciones de los tests son inventados; los CUIT sintéticos son
válidos por dígito verificador pero no corresponden a nadie.

---

## 2. Estructura real

```
fila 0   «Informe Movimiento de Saldos, 08-09-2026»   (título)
fila 1   vacía
fila 2   encabezados · 14 columnas
fila 3   ┐
  …      │ 84 filas de datos
fila 86  ┘
```

Una sola hoja, `Hoja 1`. 685 celdas de texto y 252 numéricas.

**El lector de XLS se implementó a mano, sin dependencias.** No fue una
preferencia estética: `exceljs` solo lee `.xlsx`; SheetJS dejó de publicarse
en npm después de la 0.18.5, que arrastra una vulnerabilidad de contaminación
de prototipo corregida solo en versiones que no están en el registro; y en
esta máquina `npm install` falla con `EACCES`. El subconjunto necesario está
completamente determinado por el archivo real: contenedor OLE2, tabla de
cadenas compartidas, y celdas de texto y número.

---

## 3. Columnas

Las catorce, ubicadas **por nombre y no por posición**:

| # | Encabezado | Tipo | Nota |
|---|---|---|---|
| 0 | CODIGO CLIENTE | texto | 2 valores distintos: el informe abarca una jerarquía |
| 1 | CODIGO DISTRIBUIDOR | — | vacía en todas las filas |
| 2 | CODIGO MAYORISTA | — | vacía en todas las filas |
| 3 | RAZON SOCIAL | texto | 2 valores: dos cuentas de NORD |
| 4 | TARJETA | — | vacía en todas las filas |
| 5 | CREDITO INICIAL | número | saldo antes del movimiento |
| 6 | INCREMENTO | número | **el importe acreditado** |
| 7 | CREDITO FINAL | número | saldo después |
| 8 | FECHA | texto | `YYYY-MM-DD HH:MM:SS.mmm` |
| 9 | FECHA INGRESO | texto | idem, con menos decimales |
| 10 | BANCO | texto | 2 valores |
| 11 | TIPO INCREMENTO | texto | 2 valores |
| 12 | BOLSA DESTINO | texto | «Bolsa General» en las 84 |
| 13 | ` OBSERVACION` | texto | **trae un espacio adelante en el encabezado** |

Ese espacio de la última columna es exactamente por qué el parser busca los
encabezados normalizados en lugar de fijar índices: atarse a la posición 13 es
cómo un informe con una columna nueva rompe el parser en silencio.

**Las dos fechas llegan como texto, no como serial de Excel.** Eso evita todo
el problema de los formatos numéricos de fecha, y el parser las recorta por
posición sin construir un `Date` en ninguna línea.

---

## 4. Clasificación de filas

| Clasificación | Filas | Evidencia |
|---|---:|---|
| `ACREDITACION_TRANSFERENCIA` | **82** | TIPO INCREMENTO «Depósito bancario» + operación de transferencia en la observación |
| `FEE_MANTENIMIENTO` | **2** | TIPO INCREMENTO «Gestión Habilitación y Mantenimiento de Plataforma», importe negativo |
| `DEPOSITO` | 0 | En el enum, **sin evidencia todavía** en este archivo |
| `AJUSTE` | 0 | Ídem |
| `OTRO` / `DESCONOCIDO` | 0 | — |

**La suma da 84: ninguna fila desaparece.** Es el mismo invariante del
importador legacy, y hay un test que lo exige.

> ⚠️ **`DEPOSITO` está en el enum pero no tiene ni un caso** *en este
> archivo*. Todas sus operaciones son transferencias, aunque el TIPO
> INCREMENTO diga «Depósito bancario» —ahí «depósito» describe el ingreso a la
> cuenta de Fullcarga, no la forma en que el cliente pagó—.
>
> ✅ **RESUELTO en la validación multidía (§ 12):** aparecieron tres depósitos
> de efectivo en sucursal reales, y una clasificación nueva,
> `REINTEGRO_BANCARIO`, que corrigió un defecto. Las cifras de esta sección son
> las del primer día; **las vigentes están en § 12**.

---

## 5. Patrones de la observación

La forma general, verificada sobre las 82 filas de transferencia:

```
DD/MM/YYYY - <operación bancaria> - <nombre del depositante> / <concepto libre> / <CUIT>
```

Dos hechos que se **midieron**, no se supusieron:

- **el CUIT es siempre el último token** — 82 de 82;
- **la fecha del principio siempre coincide con FECHA INGRESO** — 82 de 82.

Las cinco operaciones bancarias observadas:

| Operación | Filas |
|---|---:|
| `Transferencia Recibida` | 61 |
| `Transf Recibida Cvu Dif Titular` | 13 |
| `Transferencia Ctas Mobile Banking` | 6 |
| `Credito Transf Online Banking Emp` | 1 |
| `Credito Transf Por Online Banking` | 1 |

Se catalogan las cinco para poder distinguir lo conocido de lo nuevo: una
operación que no esté en la lista se marca como
`TRANSFERENCIA_OPERACION_NUEVA` en lugar de interpretarse a la fuerza.

El concepto libre es donde entra el ruido —el depositante escribe lo que
quiere—, y ahí aparecen números de diez dígitos en cuatro filas. **No
interfieren:** el extractor exige exactamente once dígitos con delimitadores a
ambos lados, y toma el último.

En lugar de una expresión regular gigante hay parsers chicos e independientes
—fecha, operación, CUIT, descripción—, cada uno con sus propios casos de
prueba. Uno puede fallar sin arrastrar a los demás.

---

## 6. Cobertura de extracción de CUIT

```
filas totales                84
filas de acreditación        82
  con CUIT válido            82   ← 100 %
  con CUIT inválido           0
  sin CUIT                    0
  con más de un CUIT          0
patrones desconocidos         0
operaciones no catalogadas    0
```

Las dos filas sin CUIT son las de mantenimiento de plataforma, que **no son
acreditaciones** y por lo tanto no entran en el denominador.

Distribución de prefijos: `27` (43), `20` (26), `30` (7), `23` (6). Es la
distribución esperada de CUIT reales —personas físicas y jurídicas— y es una
confirmación más de que el número extraído es un CUIT y no una referencia
bancaria.

---

## 7. Validación

Se verificó con grep que **el proyecto no tenía validador de CUIT**. Se
implementó uno aislado, separando dos preguntas que se suelen confundir:

- **formato** — ¿son once dígitos? Decide si el texto *parece* un CUIT;
- **validación** — ¿cierra el dígito verificador de módulo 11? Decide si
  *puede existir*.

Un número que pasa el formato y falla la validación es casi siempre un error
de tipeo del cliente, y es exactamente la fila que Mati tiene que mirar. Por
eso son dos estados distintos: `CUIT_INVALIDO` y `CUIT_NO_ENCONTRADO`.

**Sobre el archivo real: cero inválidos.** Los 82 números de once dígitos
cierran el verificador. Es la evidencia más fuerte de que el último token es el
CUIT y no otra cosa.

**Nunca se corrige nada automáticamente.** Requisito explícito del negocio, y
está sostenido por el diseño: la función de parecidos devuelve candidatos, no
modifica valores.

---

## 8. Excepciones

Lo que este archivo mostró y lo que hay que esperar.

| Excepción | En este archivo | Tratamiento |
|---|---:|---|
| Fee de mantenimiento | 2 | Clasificada aparte, fuera de la conciliación |
| Importe negativo | 2 | Aceptado; son los fees |
| Importe con decimales | 5 | Redondeado a dos con el dominio financiero |
| CUIT inválido | 0 | Se marcaría `CUIT_INVALIDO` y la fila queda para revisar |
| Sin CUIT | 0 | `SIN_CUIT`; la fila no entra a conciliar |
| Varios CUIT | 0 | Se toma el último y se marca para revisión |
| Números de 10 dígitos en el concepto | 4 | No interfieren |
| Operación bancaria nueva | 0 | Se marca, no se fuerza |
| Columna nueva en el informe | 0 | Se lista como desconocida, no rompe |
| Fila vacía | — | Se saltea sin contar |

---

## 9. Propuesta de matching

### Lo que dicen los datos reales

Se midió la unicidad de cada clave posible sobre las 82 acreditaciones:

| Clave | Claves distintas | Filas en colisión |
|---|---:|---:|
| solo importe | 64 | **27** |
| solo CUIT | 75 | 12 |
| CUIT + fecha | 76 | 10 |
| **CUIT + fecha + importe** | **80** | **4** |

Tres lecturas:

**Mati tenía razón sobre el importe.** Veintisiete de ochenta y dos filas
comparten importe con otra. Emparejar por monto sería un desastre.

**CUIT + fecha, la regla que definió NORD, deja diez filas ambiguas** — un
mismo depositante que transfirió más de una vez el mismo día. Agregando el
importe bajan a cuatro.

**Las cuatro que quedan son dos pares genuinamente idénticos:** mismo CUIT,
mismo día, mismo importe. Ningún dato del informe los distingue, y ninguna
regla los va a distinguir. **Es exactamente el caso que decide una persona.**

> **95 % de las acreditaciones quedan identificadas de forma única** por
> CUIT + fecha + importe. Y eso es antes de cruzar contra lo enviado, que
> agrega su propia información.

### Los veredictos

| Veredicto | Condición | ¿Automático? |
|---|---|---|
| `MATCH_EXACTO` | CUIT, fecha e importe coinciden, y hay uno solo | **Sí** |
| `MATCH_PROBABLE` | CUIT y fecha coinciden, el importe no | No |
| `POSIBLE_MATCH` | El CUIT difiere en **un** dígito | **Nunca** |
| `AMBIGUO` | Varios candidatos igual de buenos | No |
| `SIN_MATCH` | Ningún envío con ese CUIT | No |

Dos decisiones de diseño que conviene defender:

**Una coincidencia exacta siempre le gana a un parecido.** Los parecidos se
buscan recién cuando no hay ningún CUIT exacto. Si pudieran competir, un
dígito de más mandaría plata a otra persona. Hay un test que lo fija.

**Tolerancia de fecha en cero por defecto.** En el archivo real la fecha de la
observación coincide exactamente con FECHA INGRESO en las 82 filas: no hay
evidencia que justifique una ventana, y abrirla sin datos solo agrega falsos
positivos. El parámetro existe por si NORD dice que hace falta.

### Parecido entre CUIT

Se eligió **distancia de Hamming** —cuántos dígitos difieren posición a
posición— sobre Levenshtein, y sobre cualquier cosa con IA. Un CUIT tiene
estructura posicional fija, así que comparar posición a posición es lo que
corresponde; Levenshtein consideraría «parecidos» dos números desplazados, que
en un identificador fiscal no significa nada.

El umbral por defecto es **un** dígito. Con dos, la sugerencia deja de ser útil
y empieza a ser ruido. El resultado se muestra como *«Posible coincidencia:
difiere en 1 dígito»* y **espera confirmación**.

---

## 10. Riesgos

| # | Riesgo | Gravedad | Estado |
|---|---|---|---|
| 1 | **Un solo día de muestra.** Todo lo medido sale de un archivo | **Alta** | Hace falta correr el parser sobre varios días, sobre todo un fin de semana y un feriado |
| 2 | Un banco distinto podría escribir la observación de otra forma | Media | Los dos bancos de este archivo se comportan igual; con un tercero puede cambiar. El parser lo marcaría como patrón desconocido, no lo inventaría |
| 3 | Un día sin movimientos podría no traer encabezados | Media | El parser falla con un mensaje explícito. El camino del contenedor chico —mini-stream— está implementado **y probado** |
| 4 | `DEPOSITO` sin ningún caso real | Media | El enum existe; la regla que lo distinga se escribe cuando aparezca uno |
| 5 | El CUIT podría no ser del depositante sino del titular de la cuenta | Media | **Pregunta abierta para NORD.** En «Transf Recibida Cvu Dif Titular» —13 filas— el titular difiere por definición |
| 6 | Dos transferencias idénticas el mismo día | Baja | 2 pares en 82. Van a excepción, que es lo correcto |
| 7 | Lector de XLS propio | Baja | Probado con archivos sintéticos en los dos caminos del contenedor. Si el informe pasara a `.xlsx`, falla con un mensaje que lo dice |

---

## 11. Conclusión

**El parser funciona sobre el archivo real y la extracción de CUIT es del
100 % sobre las filas que importan.** La dependencia crítica que el análisis de
alcance marcaba como «de esto cuelga la mitad del valor del proyecto» quedó
resuelta a favor.

Tres hallazgos que cambian el diseño de lo que sigue:

**Se concilia contra FECHA INGRESO, no contra FECHA.** Las 84 filas comparten
la misma FECHA —la del informe—, mientras que FECHA INGRESO abarca **treinta
días distintos**, desde el 18 de mayo. Una acreditación procesada hoy puede
corresponder a una transferencia de hace meses. Conciliar contra una fecha que
es igual en todas las filas no discrimina nada.

**Eso rompe el supuesto de D+1 para una parte del volumen.** El proceso diario
no puede asumir que lo que se acredita hoy se envió ayer: hay que buscar contra
una ventana histórica de envíos pendientes, no contra el día anterior.

**El monto sí sirve, pero acompañado.** Solo, colisiona en 27 de 82 filas.
Sumado a CUIT y fecha, deja apenas 4.

### Lo que queda para Mati

Con estos números, sobre un día como el analizado:

- **~78 de 82 acreditaciones** identificables sin ambigüedad;
- **2 pares idénticos** que ninguna regla puede separar;
- **2 filas de fee** que no son acreditaciones;
- más lo que aporte el lado de lo enviado, que todavía no tenemos.

### Siguiente POC recomendado

**Parser de la planilla del cliente**, que es la otra mitad del par. Sin ella
el matching no se puede medir de verdad: hoy sabemos que las acreditaciones se
pueden identificar, pero no contra qué. Hace falta **una o dos planillas
reales de clientes distintos** —el pedido sigue abierto desde el análisis de
alcance—.

Y en paralelo, barato: **correr este parser sobre tres o cuatro días más**,
incluido un fin de semana. Es la única forma de saber si el 100 % de hoy es la
regla o la suerte de un día.

---

*Sin cambios en el descargador, el esquema, las migraciones ni el núcleo
financiero. Nada subido al remoto.*

---

## 12. Validación multidía

> Ejecutada el 10-sep-2026. Cinco informes descargados con el downloader HTTP
> —los ocho checkpoints en las cinco corridas— y procesados con **el parser
> sin modificar**, para ver si el resultado del primer día se sostenía.

### Por informe

| Fecha | Día | Filas | Acred. | Transf. | CUIT | Cobertura | Inválidos | Sin CUIT | Patrones ? | Tipos ? |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2026-09-01 | martes | 8 | 6 | 6 | 6 | **100 %** | 0 | 0 | 0 | 0 |
| 2026-09-04 | viernes | 162 | 160 | 160 | 160 | **100 %** | 0 | 0 | 0 | 0 |
| 2026-09-06 | **domingo** | **0** | 0 | 0 | 0 | — | 0 | 0 | 0 | 0 |
| 2026-09-08 | martes | 84 | 82 | 82 | 82 | **100 %** | 0 | 0 | 0 | 0 |
| 2026-09-09 | miércoles | 264 | 257 | 254 | 254 | **100 %** | 0 | 3 | 0 | 1 |

### Agregado

```
informes analizados          5
filas totales                518
acreditaciones relevantes    505
  transferencias             502
  depósitos en efectivo        3   ← sin CUIT por naturaleza
CUIT extraídos               502 / 502
cobertura sobre transferencias  100 %
días con cobertura 100 %     4 / 5   (el quinto no tuvo movimientos)
patrones de observación      104 distintos
patrones desconocidos          0
```

Clasificación acumulada, que **suma exactamente 518**: 502 transferencias,
8 fees de plataforma, 3 depósitos en efectivo, 3 reintegros bancarios y
2 desconocidas. Ninguna fila desaparece.

### El día sin movimientos

**El informe del domingo llegó con cero filas de datos y el parser lo procesó
sin incidentes.** Es el caso que el POC anterior listaba como riesgo sin poder
probarlo: un archivo de 4.608 bytes, por debajo del corte de 4.096 del
contenedor OLE2 en su stream interno, que ejercita el camino del mini-stream.
Estaba implementado y probado con archivos sintéticos; ahora está confirmado
contra uno real.

### El defecto que encontró la validación

Uno solo, y es exactamente para lo que servía correr varios días.

Aparecieron tres filas con TIPO INCREMENTO **`Reintegro de G. Bancario`**, cuyo
texto dice *«Reintegro de gastos bancarios **depósito** $X BANCO … »*. Esa
palabra hacía que el clasificador las tomara por **depósitos de un cliente**,
cuando son una devolución de comisiones del banco: plata que no vino de
nadie.

**Corregido** con una guarda que evalúa el reintegro antes que el depósito, y
una clasificación propia `REINTEGRO_BANCARIO`. Cubierto por dos tests con
datos sintéticos.

También se corrigió el **denominador de la cobertura**. Un depósito de
efectivo en sucursal no tiene depositante identificado —el efectivo no dice
quién lo llevó—, así que contarlo como «sin CUIT» ensuciaba la métrica sin
significar nada. Ahora hay dos números: cobertura sobre transferencias, que es
el que importa, y cobertura sobre relevantes, que se conserva para comparar.

### Patrones y operaciones nuevas

Aparecieron seis operaciones bancarias que el primer informe no tenía. **El
parser las marcó en lugar de forzarlas**, que es el comportamiento buscado:

| Operación nueva | Filas | Qué es | Tratamiento |
|---|---:|---|---|
| `Deposito De Efectivo En Sucursal` | 2 | Efectivo en ventanilla | `DEPOSITO`. Correcto |
| `Deposito Efvo Caja Suc 0770` | 1 | Ídem, con número de sucursal | `DEPOSITO`. Correcto |
| `Reintegro de gastos bancarios …` | 3 | Devolución de comisiones | `REINTEGRO_BANCARIO` tras la corrección |
| `TRF  IN COEL <11 dígitos>` | 1 | Narrativa bancaria abreviada | `DESCONOCIDO` |
| `TRANSF.BANEL <11 dígitos>` | 1 | Ídem | `DESCONOCIDO` |
| `Shopping Nordelta trx ID …` | 1 | Crédito de otro origen | `DESCONOCIDO` |

> **Las dos narrativas abreviadas traen un CUIT válido embebido en el propio
> texto de la operación**, no al final como el resto —se verificó el dígito
> verificador de los dos—. El parser **igual les extrajo el CUIT**, pero no las
> clasificó como transferencia porque `TRF` no es `TRANSF`.
>
> **Se decidió no tocar el parser por esto.** Son 2 filas en 518 —el 0,4 %—, y
> agregar `TRF` a la detección sería ajustar la regla a dos casos. `DESCONOCIDO`
> significa «Mati lo mira», el CUIT ya está extraído para que lo vea, y si el
> patrón se repite es un cambio de una línea con su test. **UNKNOWN es mejor
> que adivinar.**

### FECHA contra FECHA INGRESO · el hallazgo más importante

Sobre 510 filas con las dos fechas:

| Atraso | Filas | % |
|---|---:|---:|
| Mismo día | 105 | 20,6 % |
| **D+1** | **158** | **31,0 %** |
| 2 a 7 días | 164 | 32,2 % |
| 8 a 30 días | 41 | 8,0 % |
| Más de 30 días | 42 | 8,2 % |
| Fecha de ingreso posterior | 0 | 0 % |

Rango de FECHA INGRESO: **2026-05-18 a 2026-09-09**. Atraso máximo:
**113 días**.

> **El supuesto de D+1 no se sostiene.** Solo el 31 % de las acreditaciones
> corresponden al día anterior; la mitad del volumen tiene entre dos y treinta
> días, y **el 8 % pasa el mes**.
>
> Consecuencia directa sobre el diseño del matching: **no se puede buscar
> contra los envíos del día anterior.** Hace falta una ventana de envíos
> pendientes de al menos **120 días**, y una operación enviada tiene que poder
> quedar abierta meses sin que el sistema la dé por perdida.
>
> Y una consecuencia operativa: **una planilla puede quedar incompleta durante
> meses** por una sola transferencia que se acredita tarde. Refuerza la
> pregunta Q4 del documento de automatización —qué pasa con una planilla que
> nunca se completa— y sugiere que el total no puede esperar al 100 %
> indefinidamente.

Ninguna fila tiene FECHA INGRESO posterior a FECHA: el orden temporal es
consistente en las 510.

### CVU con distinto titular

| | |
|---|---|
| Filas | **120** de 502 · **23,8 %** de las acreditaciones |
| Con CUIT extraído | **120 / 120** |
| Patrones distintos | 11 |
| Por informe | 09-01: 2 · 09-04: 34 · 09-06: 0 · 09-08: 13 · 09-09: **71** |

Casi una de cada cuatro acreditaciones, y en el informe del 09-09 fueron el
28 %. La extracción de CUIT funciona igual de bien que en el resto.

> ⚠️ **TO VALIDATE WITH NORD.** No se asume qué representa ese CUIT. Por el
> nombre de la operación —«distinto titular»— el CUIT podría ser del titular
> de la cuenta de origen y no de quien efectivamente mandó la plata. **Con el
> 23,8 % del volumen en juego, la respuesta cambia contra qué se concilia.**

### Colisiones

| Fecha | Acred. | Solo importe | Solo CUIT | CUIT + fecha | CUIT + fecha + importe |
|---|---:|---:|---:|---:|---:|
| 2026-09-01 | 6 | 0 | 0 | 0 | 0 |
| 2026-09-04 | 160 | 55 | 14 | 6 | 2 |
| 2026-09-06 | 0 | 0 | 0 | 0 | 0 |
| 2026-09-08 | 82 | 27 | 12 | 10 | 4 |
| 2026-09-09 | 254 | 87 | 28 | 18 | 2 |
| **TOTAL** | **502** | **169** | **54** | **34** | **8** |

Unicidad, sobre 502 acreditaciones:

| Clave | Filas identificadas sin ambigüedad |
|---|---:|
| Solo importe | 66,3 % |
| Solo CUIT | 89,2 % |
| CUIT + fecha de ingreso | 93,2 % |
| **CUIT + fecha + importe** | **98,4 %** |

Sobre cinco veces más datos que en el primer informe, la conclusión se
sostiene y se afina: **el importe solo es inservible** —una de cada tres filas
colisiona— y **CUIT + fecha + importe deja 8 filas ambiguas de 502**. Son
transferencias genuinamente idénticas: mismo depositante, mismo día, mismo
monto. Ningún dato del informe las separa.

### Conclusión de la validación

**El 100 % de extracción de CUIT se sostiene** sobre cinco veces más volumen,
cuatro días con datos y un día vacío. La confianza en el parser pasa de
*«funcionó con un archivo»* a **alta**.

Lo que cambió: un defecto de clasificación corregido, una clasificación nueva
con evidencia real, y el denominador de la cobertura hecho honesto.

Lo que aprendimos y no sabíamos: **el D+1 es apenas el 31 %**, y eso reescribe
el diseño de la ventana de matching antes de haberla construido. Encontrarlo
ahora costó cuatro descargas.
