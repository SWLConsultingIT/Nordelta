# POC 3 · Conciliación real · `CLIENT_SAMPLE_01`

> **Nota de nombre.** Este documento es de una etapa anterior y usa «NORD»
> como nombre del producto y como abreviatura del cliente. El nombre visible
> pasó a ser **Pagos Nordelta**; el contenido se conserva tal cual porque
> documenta decisiones tomadas en ese momento.

> Primera conciliación contra datos reales de las dos puntas: una planilla que
> mandó un cliente y el informe de Fullcarga del 01 al 10 de septiembre de
> 2026, descargado automáticamente.
>
> **Sin UI, sin Supabase, sin esquema, sin cuenta corriente, sin deploy, sin
> push.** El cliente se identifica como `CLIENT_SAMPLE_01`: el nombre
> comercial no se usa como identificador técnico ni aparece en este documento.

---

## 1. Resultado

```
12 operaciones en la planilla

  6  ACREDITADA_EXACTA            ← el sistema las cierra solo
  6  IDENTITY_MAPPING_REQUIRED    ← la planilla trae DNI, Fullcarga usa CUIT
 ──
 12  ninguna fila se pierde

  0  pendientes · 0 ambiguas · 0 errores · 0 duplicados
```

> **De las seis operaciones que traían CUIT válido, se acreditaron las seis.
> El 100 % de lo que era conciliable automáticamente, se concilió.**
>
> Las otras seis no fallaron: **traen DNI y Fullcarga identifica por CUIT.**
> Es un problema de identidad, no de matching.

| | |
|---|---|
| Total enviado | $ 5.778.000,00 |
| Acreditado | $ 2.889.000,00 |
| Pendiente | $ 0,00 |
| Cierra solo | 6 · **50 %** |
| Revisa una persona | 6 · **50 %** |

---

## 2. Orden de los insumos

Todo lo real quedó en una sola carpeta, **ignorada por git**:

```
private_samples/
├── fullcarga/                          informes manuales de días sueltos
└── reconciliation_sep01_10/
    ├── client/    Transferencias … .xlsx      la planilla del cliente
    ├── email/     (vacío)                     no hay .eml
    ├── fullcarga/ manual-2026-09-01_10.xls    el informe bajado a mano
    └── README.md
```

Los originales están marcados **sin permiso de escritura**. Toda salida
derivada va a `.tmp/reconciliation_sep01_10/`, también fuera de git:

```
.tmp/reconciliation_sep01_10/
├── 2026-09-01_2026-09-10/automatico-….xls   la descarga automática
├── comparacion-fullcarga.txt                 automático contra manual
├── client-normalized.json
├── fullcarga-normalized.json
├── summary.json
└── exceptions.csv                            lo que tiene que ver Mati
```

**Nada real entró a `src/`, `tests/`, `docs/` ni `public/`.** Los fixtures de
los tests son sintéticos y reproducen los *patrones*, no los datos.

---

## 3. Descarga del rango y su validación

Una sola descarga, `--from 2026-09-01 --to 2026-09-10`. Los ocho checkpoints.

Antes de conciliar se comparó contra el informe que una persona bajó a mano:

| | Manual | Automático | |
|---|---:|---:|---|
| Filas, días cerrados 01→09 | **1249** | **1249** | ✅ |
| Solo en manual | — | — | **0** |
| Solo en automático | — | — | **0** |
| Filas con algún valor distinto | — | — | **0** |
| Suma de INCREMENTO | $ 1.027.997.949,37 | $ 1.027.997.949,37 | ✅ |
| Transferencias · CUIT | 1201 · 1197 | 1201 · 1197 | ✅ |

```
BUSINESS CONTENT EQUIVALENT: YES     →  se continúa
```

Sobre el rango completo 01→10 aparecen **8 filas de más** en el automático, y
cero de menos. No es una discrepancia: **el 10 de septiembre todavía era el
día en curso**, y el informe de un día sigue creciendo mientras ese día
transcurre. El manual se bajó a las 10:25 y el automático a las 11:16.

Por eso la comparación se hizo sobre los días cerrados, y por eso el
comparador ahora acepta `--desde` y `--hasta`.

---

## 4. La planilla del cliente

| | |
|---|---|
| Hoja | `Hoja 7` |
| Filas | 13 · 1 encabezado + **12 operaciones** |
| Columnas | 8 de 8 ubicadas, **ninguna desconocida** |
| Filas ocultas | 0 |
| Columnas ocultas | 0 |
| Celdas combinadas | 0 |
| Celdas con fórmula | 0 |

Los ocho encabezados coinciden exactamente con lo esperado: `BANCO`,
`FECHA DEPOSITO`, `IMPORTE`, `NOMBRE`, `DNI/CUIT DEPOSITANTE`,
`NRO DEPOSITO`, `TIPO`, `COMENTARIO`.

**El `.xlsx` es un formato distinto del `.xls` de Fullcarga** —ZIP con XML
contra OLE2 binario—, así que hubo que escribir un segundo lector. También
sin dependencias, y también verificando lo que una planilla ajena puede
esconder: filas y columnas ocultas, celdas combinadas y fórmulas. Acá no hay
ninguna de las cuatro, pero comprobarlo es parte de leer un archivo de un
tercero.

### Tres cosas que corrigen lo que se asumía

**1 · Las fechas son de agosto, no de septiembre.** Van del **25-08 al
01-09**. La conciliación funciona igual —y es la prueba de que el diseño era
correcto—: se cruza contra **FECHA INGRESO** de Fullcarga, que en el informe
de septiembre llega hasta mayo. Contra `FECHA` no habría encontrado nada.

**2 · El número de comprobante no está siempre vacío.** Ocho filas lo traen y
cuatro no. La suposición previa era que faltaba en las doce.

**3 · Solo hay tres importes distintos en doce filas.** Es la confirmación
más fuerte de que **el importe solo no sirve para emparejar**.

---

## 5. Identificación del depositante

La columna `DNI/CUIT DEPOSITANTE` **trae las dos cosas**:

| Tipo | Filas | Forma en el archivo |
|---|---:|---|
| `CUIT_VALIDO` | **6** | Con guiones, once dígitos, verificador correcto |
| `DNI_PROBABLE` | **6** | Celda numérica, ocho dígitos |
| `IDENTIFICACION_INVALIDA` | 0 | — |
| `UNKNOWN` | 0 | — |

**Los seis CUIT validan.** Cero errores de tipeo en esta planilla.

Siempre se conservan las tres cosas: el valor original, el normalizado y el
tipo detectado. **Un DNI nunca se convierte en CUIT.** Se puede hacer
—prefijo de tipo + documento + verificador— y hay quien lo hace. Es adivinar
la identidad fiscal de una persona, y con eso se manda plata a otro lado.

---

## 6. Qué se hizo con las seis filas de DNI

No se emparejaron. Pero **sí se buscó evidencia en la propia data**, sin usar
el nombre para nada.

La señal es estructural: un CUIT es `<tipo 2><documento 8><verificador 1>`, o
sea que un CUIT que contiene ese DNI en la posición del documento **es** el
CUIT de esa persona. Cruzando eso con fecha e importe:

| Fila | Candidatos por fecha + importe | De esos, con el DNI adentro del CUIT |
|---|---:|---:|
| r2 | 0 | 0 |
| r3 | 1 | **1** |
| r4 | 3 | **1** |
| r6 | 3 | **1** |
| r7 | 3 | **1** |
| r10 | 1 | **1** |

**Cinco de las seis tienen exactamente un candidato.** El sistema se lo
muestra a Mati con el motivo escrito, y **no acredita solo**: la relación
entre el cliente y sus depositantes la confirma el negocio, no una
coincidencia estructural.

> Si NORD confirma que esa señal alcanza, **la tasa automática de esta
> planilla pasaría de 50 % a ~92 %** (11 de 12). Es una decisión de negocio
> con un número concreto al lado. **Ver pregunta P-A en la sección 11.**

---

## 7. Las reglas que gobiernan el matching

Ninguna se inventó en este POC:

- **CUIT + fecha de depósito + importe.** La fecha del lado de Fullcarga es
  **FECHA INGRESO**, nunca `FECHA`.
- **Cada acreditación se consume una sola vez.** Dos filas no pueden cobrar el
  mismo registro. Las filas con CUIT se resuelven primero, así el resultado no
  depende del orden.
- **El nombre no se usa jamás para emparejar.** Sirve para que una persona
  revise. Sin similitud de texto, sin IA.
- **Más de un candidato, no se elige ninguno.** Incluso cuando los candidatos
  son intercambiables. La regla no tiene excepciones que después haya que
  razonar caso por caso.
- **Un CUIT a un dígito de distancia es una sugerencia**, nunca una
  acreditación.
- **No encontrar algo en el rango no es un fallo del matching.** Se midieron
  atrasos de hasta 113 días. Que no sea un fallo del algoritmo **no lo hace
  menos problema para la operación**: NORD confirmó que una transferencia
  enviada y no acreditada es un pendiente desde el día cero, sin período de
  gracia. Ver `NORD_FLUJO_MATI_MVP.md` §0.
- **Importe repetido no es duplicado.** Hace falta que coincidan
  identificación, fecha e importe a la vez, y aun así el resultado es
  «posible». Nada se borra nunca.

---

## 8. Qué trabajo de Mati desaparece

| Paso que hace hoy | Resultado del POC | Automatizable |
|---|---|---|
| Copiar el archivo del cliente a su Excel | Se lee directo del `.xlsx` | **Sí, desaparece** |
| Normalizar el CUIT (guiones, puntos, espacios) | Automático, con el original conservado | **Sí, desaparece** |
| Normalizar importes | Automático, con el dominio financiero existente | **Sí, desaparece** |
| Distinguir DNI de CUIT | Automático y explícito | **Sí, desaparece** |
| Buscar cada CUIT en el informe | Automático | **Sí, desaparece** |
| Cruzar la fecha | Automático, contra FECHA INGRESO | **Sí, desaparece** |
| Cruzar el monto | Automático, en centavos enteros | **Sí, desaparece** |
| Sumar acreditado | Automático | **Sí, desaparece** |
| Sumar pendiente | Automático | **Sí, desaparece** |
| Detectar duplicados | Automático, marcado sin borrar | **Sí, desaparece** |
| Identificar excepciones | Automático, con motivo escrito | **Sí, desaparece** |
| Descargar el informe de Fullcarga | Automático, ya verificado | **Sí, desaparece** |
| **Resolver DNI → cliente** | Se le acerca el candidato | **Asistido**: decide una persona |
| **Confirmar un CUIT a un dígito** | Sugerencia con puntaje | **Asistido** |
| **Elegir entre candidatos ambiguos** | Se listan, no se elige | **Humano, a propósito** |

De once tareas mecánicas, **once desaparecen**. Quedan tres que necesitan a
una persona, y las tres son decisiones, no trabajo.

---

## 9. Ground truth

```
GROUND TRUTH: NOT AVAILABLE
```

**No tenemos el Excel operativo de Mati con el resultado humano de estos
mismos doce movimientos.** Por lo tanto:

- se puede afirmar la **tasa de automatización**: 50 % de las filas, o 100 %
  de las que traían CUIT;
- **no** se puede afirmar precisión: falsos positivos y falsos negativos son
  `NOT AVAILABLE` hasta poder comparar contra el resultado de Mati.

Las seis acreditaciones exactas coinciden en CUIT, fecha e importe
simultáneamente, lo que hace un falso positivo muy improbable — pero
«improbable» no es «medido».

---

## 10. Riesgos

| # | Riesgo | Gravedad | Estado |
|---|---|---|---|
| 1 | **El parser del cliente está escrito contra un solo formato** | **Alta** | Declarado. Las columnas se ubican por nombre y una desconocida se informa |
| 2 | Sin ground truth no hay precisión medida | **Alta** | Hace falta el Excel de Mati con estos mismos movimientos |
| 3 | La mitad del volumen viene con DNI | **Alta** | Es la decisión P-A. Con ella la automatización pasa a ~92 % |
| 4 | Doce operaciones son una muestra chica | Media | Hacen falta más planillas, de más clientes |
| 5 | Cuatro filas sin número de comprobante | Media | Se informa. No se sabe todavía si Fullcarga lo exige |
| 6 | El cliente manda fechas de agosto en una planilla de septiembre | Baja | Resuelto: se concilia contra FECHA INGRESO |

---

## 11. Preguntas para NORD

**P-A · BLOCKER.** Cuando la planilla trae un DNI y en el informe hay **un
solo** movimiento con la misma fecha, el mismo importe y un CUIT que contiene
ese DNI en la posición del documento: **¿alcanza para acreditar solo?** De la
respuesta dependen 5 de las 12 filas de esta planilla y, probablemente, la
mitad del volumen de todos los clientes.

**P-B · HIGH.** ¿Los clientes tienen que mandar CUIT y no DNI? Si se puede
pedir en el origen, el problema desaparece en vez de resolverse.

**P-C · HIGH.** ¿Existe una tabla de depositantes por cliente, aunque sea en
una planilla? Sería el mapa de identidad que hoy falta.

**P-D · MEDIUM.** ¿Fullcarga exige el número de comprobante? Cuatro de doce no
lo traen.

**P-E · MEDIUM.** ¿Todos los clientes mandan este mismo formato de ocho
columnas?

---

## 12. Conclusión

| | |
|---|---|
| Parser del cliente | **VERIFIED FOR THIS FORMAT** |
| Rango de Fullcarga | **VERIFIED** — 1249 contra 1249, al centavo |
| Conciliación real | **PARTIALLY VERIFIED** — funciona; falta ground truth |
| ¿Reduce el trabajo de Mati? | **Sí**, con evidencia |

**El pipeline completo corrió de punta a punta contra datos reales de las dos
puntas.** Cliente manda planilla → NORD la entiende → Fullcarga ya está
descargado → NORD concilia → Mati ve seis excepciones en vez de doce filas.

Lo que falta no es técnico. Es **una decisión** —P-A— y **un archivo**: el
Excel de Mati con el resultado humano de estos mismos doce movimientos, para
poder medir precisión y no solo cobertura.

### Siguiente paso

Pedirle a Mati que concilie estos doce movimientos como lo hace siempre, y
comparar. Es media hora de su tiempo y convierte «funciona» en «funciona y
sabemos con cuánta precisión».

---

## 13. POC 3B · Arnés de validación contra el resultado humano

> Preparado el 10-sep-2026. **El ground truth todavía no llegó**, así que las
> métricas de precisión siguen en `NOT AVAILABLE`. Lo que está listo es todo
> lo demás: la planilla ciega para Mati, el resultado del sistema guardado
> aparte, y el evaluador que los cruza.

### Por qué la planilla va ciega

El archivo que se le manda a Mati **no lleva el resultado del sistema**. Si lo
viera, dejaría de ser una medición independiente y pasaría a ser una revisión
de lo que hizo la máquina — y una persona que ve un «ACREDITADA» tiende a
confirmarlo.

```
mati-ground-truth-input.csv     ← lo que ve Mati. Columna «resultado» vacía
automation-result.csv           ← lo que hizo el sistema. NO se comparte
```

Las filas se identifican con `ROW_01` … `ROW_12`, un identificador neutro que
no depende de ningún dato real, más el número de fila de su propia planilla
para que pueda ubicarse. Las identificaciones van enmascaradas.

### El estado nuevo: `POTENTIAL_IDENTITY_MATCH`

Antes las seis filas con DNI compartían un solo estado. Ahora se separan:

| Estado | Filas | Qué es |
|---|---:|---|
| `POTENTIAL_IDENTITY_MATCH` | **5** | Un solo candidato: el CUIT contiene ese DNI en la posición del documento **y** coinciden fecha e importe |
| `IDENTITY_MAPPING_REQUIRED` | 1 | Sin ningún candidato en el rango |

**Ninguno de los dos acredita.** El estado existe para poder medir, cuando
llegue la respuesta de Mati, qué precisión tendría la regla **si** NORD la
habilitara. Sigue marcada `TO VALIDATE`.

### Los dos reglamentos que se van a comparar

| | Acredita | En esta planilla |
|---|---|---:|
| `ACTUAL` | Solo `ACREDITADA_EXACTA` | 6 de 12 · **50 %** |
| `CON_DNI` | Agrega `POTENTIAL_IDENTITY_MATCH` | 11 de 12 · **92 %** |

### Regla de aceptación

> **PRECISIÓN antes que COBERTURA.**

Un falso positivo es plata dada por cobrada. Un falso negativo es una fila que
Mati mira de más. **No son comparables**, y por eso el umbral propuesto para
habilitar cualquier regla automática es **precisión del 100 %**: cero falsos
positivos y al menos una acreditación —precisión perfecta sobre cero casos no
significa nada, y el evaluador lo contempla—.

`ERROR`, `DUPLICADA` y `OTRO` cuentan como **no acreditada**. Si el sistema
acreditó algo que Mati marcó como error, **es un falso positivo**, que es
exactamente lo que hay que detectar.

### Cómo se usa

```bash
# 1 · generar los dos archivos
npm run ground-truth -- preparar <planilla.xlsx> <informe.xls> --out <dir>

# 2 · cuando Mati devuelva el suyo
npm run ground-truth -- evaluar <planilla.xlsx> <informe.xls> <mati.csv> --out <dir>
```

El lector de respuestas es tolerante a propósito —acepta punto y coma o coma,
mayúsculas, acentos, columnas de más que agrega Excel— y **salta las filas sin
responder en vez de inventarles un resultado**. Un archivo que volvió por
correo y pasó por Excel no tiene por qué venir prolijo.

### Verificación del arnés

Se probó con dos respuestas sintéticas, para comprobar que mide en los dos
sentidos:

| Escenario simulado | ACTUAL | CON_DNI | Veredicto |
|---|---|---|---|
| Mati acredita las 12 | precisión 100 %, recall 50 % | precisión 100 %, recall 91,7 % | apto |
| Mati **no** acredita ROW_05 | precisión 83,3 %, **1 falso positivo** | precisión 90,9 %, 1 falso positivo | **no apto** |

El segundo caso es el importante: **el arnés detecta el falso positivo y baja
el veredicto**, en lugar de reportar una mejora de cobertura y callar el
costo.

### Estado

```
GROUND TRUTH:            NOT AVAILABLE
Precisión actual:        NOT AVAILABLE
Recall actual:           NOT AVAILABLE
Regla DNI confirmada:    NO — pendiente de NORD
Arnés listo:             SÍ
```

Falta **una sola cosa**: que Mati llene la columna `resultado` de
`mati-ground-truth-input.csv`. Son doce filas.

---

## 14. Independent Reconciliation Benchmark

> **No es ground truth humano y no se llama así.** Es una segunda
> conciliación, escrita desde cero, que replica el procedimiento manual
> conocido para comprobar si el matcher automático llega al mismo lugar por
> otro camino.
>
> `INDEPENDENT_BENCHMARK_HASH: 3f40177df6f1`

### Cómo se garantizó la independencia

El benchmark **no importa** `conciliar`, `emparejar`, `cuitsParecidos`,
`acreditacionesConciliables`, `parsearInforme`, `parsearPlanillaCliente` ni
`analizarIdentificacion`. Reutiliza solo lo permitido: los lectores de bytes
`leerLibro` y `leerXlsx`, `verificaDigito` y `normalizarCuit`, `redondear` del
dominio financiero, y la conversión de serial de Excel.

Todo lo demás lo hace por su cuenta: mapea las columnas, **extrae el CUIT del
campo Observación**, clasifica CUIT contra DNI y decide.

Y el orden es parte del método: el benchmark **se escribe a disco y se le saca
el SHA-256 antes** de que el proceso cargue el matcher. La carga es un
`import()` dinámico posterior al congelamiento — no es una convención, es una
imposibilidad de que el resultado previo influya.

### Resultado · filas con CUIT

| | |
|---|---:|
| Filas con CUIT | 6 |
| Benchmark acreditó | **6** |
| Automatización acreditó | **6** |
| Mismas decisiones | **6** |
| Decisiones distintas | **0** |
| **Mismo registro de Fullcarga** | **6** |
| Acuerdo de decisión | **100 %** |
| Acuerdo de registro exacto | **100 %** |

```
INDEPENDENT CUIT VALIDATION: PASS
```

No solo coinciden las decisiones: **las dos implementaciones apuntan
exactamente a las mismas seis filas del informe** —424, 427, 430, 431, 433 y
434—. Cero discrepancias.

### Resultado · filas con DNI

Exploratorio. **No acreditan.**

| | |
|---|---:|
| Filas con DNI | 6 |
| Candidatos únicos | **5** |
| Ambiguos | 0 |
| Sin candidato | 1 |
| Potenciales de la automatización | 5 |
| **Mismo candidato elegido** | **5** |
| Acuerdo de candidato | **100 %** |

Cada uno de los cinco se verificó por separado: documento central, fecha
exacta, importe exacto, candidato único, y que el registro no hubiera sido
consumido por otra fila. **Los cinco cumplen las cinco condiciones.**

```
DNI BUSINESS RULE: STILL TO VALIDATE
```

### La sexta fila con DNI · diagnóstico

`ROW_02` · depósito 2026-08-27 · $ 153.500.

| Búsqueda | Resultado |
|---|---:|
| A · mismo documento, cualquier fecha | **0** |
| B · misma fecha + mismo importe | 0 |
| C · mismo importe, cualquier fecha | 3 |
| D · documento a un dígito de distancia | **0** |

Como las fechas de la planilla son de agosto y la ventana analizada empezaba
el 1 de septiembre, se descargó además el informe del **25 al 31 de agosto**
—1228 filas— para descartar que se hubiera acreditado antes.

**El documento no aparece en ninguna de las dos ventanas: 2.487 filas que
cubren desde cuatro días antes del depósito hasta catorce días después.**

```
Status: IDENTITY ISSUE / PENDING
```

Con diecisiete días de cobertura alrededor del depósito, «fuera de rango» pasa
a ser poco probable. Quedan dos lecturas, y las dos las resuelve una persona:
el documento de la planilla está mal escrito, o la transferencia nunca se
acreditó. **No se modificó ningún estado.**

### Qué queda demostrado

> **«Una implementación independiente del procedimiento manual conocido
> encuentra exactamente las mismas seis acreditaciones que el matcher
> automático para las filas con CUIT.»** → **SÍ**
>
> **«Para cinco de las seis filas con DNI, las dos implementaciones encuentran
> el mismo candidato único.»** → **SÍ**

Esto **no** dice que el resultado sea correcto —para eso hace falta el
resultado humano—. Dice que el matcher no tiene un error de implementación que
lo aleje del procedimiento que replica: dos caminos distintos llegan al mismo
lugar, registro por registro.

---

## 15. Regla DNI → CUIT · CONFIRMADA POR NORD

> NORD confirmó que quiere automatizar la conciliación cuando la planilla
> viene con DNI, siempre que la acreditación se pueda identificar de forma
> inequívoca. La regla **deja de estar en `TO VALIDATE`**.
>
> `INDEPENDENT_BENCHMARK_HASH: 8a9d2c410f26`

### Cómo quedó implementada

La comparación va **siempre en un solo sentido**: se parte de un **CUIT real
devuelto por Fullcarga** y se mira si su documento es el DNI informado.
Nunca al revés. **No se fabrica ningún CUIT, no se asume prefijo, no se
genera nada sintético.**

`dniCoincideConCuit(dni, cuit)` exige **tres** condiciones, y las tres son
necesarias:

1. el CUIT es **válido**, verificador incluido — si no, sus dígitos centrales
   no significan nada;
2. el CUIT es de **persona física**;
3. el documento coincide exacto, rellenando a ocho dígitos los DNI de siete.

Sobre eso, la conciliación agrega **fecha de depósito = fecha de ingreso**,
**importe = incremento**, y **unicidad**.

### Cómo se determina «persona física»

Por el prefijo, que es el par de dígitos inicial del CUIT y declara el tipo de
sujeto:

| Prefijo | Sujeto |
|---|---|
| `20` `23` `24` `27` | **persona física** |
| `30` `33` `34` | persona jurídica |

Se verificó contra los datos: sobre las 1197 acreditaciones del informe del 01
al 10 de septiembre, los prefijos observados fueron 20 (527), 27 (518),
23 (103) y 24 (5) —personas—, más 30 (39) y 33 (5) —empresas—.

**Importa por correctitud, no por prolijidad:** en un CUIT de empresa esos
ocho dígitos centrales son parte del identificador societario y compararlos
contra un DNI no significa nada. El proyecto no tenía una función para esto
—se verificó con grep— así que se agregó `esPersonaFisica()` en `cuit.ts`.

### Orden de resolución

```
1. CUIT exacto + fecha + importe          → ACREDITADA_EXACTA_CUIT
2. DNI en CUIT de persona + fecha + imp   → ACREDITADA_EXACTA_DNI
3. CUIT a un dígito                       → POSIBLE_MATCH  (sugerencia)
4. sin candidato                          → pendiente / revisión
```

El CUIT va primero **a propósito**: es identidad directa, mientras que el DNI
es identidad derivada del documento embebido. Ante competencia por el mismo
registro, gana la evidencia más fuerte. Y el parecido de CUIT sigue último:
**no se usa nada aproximado hasta agotar las reglas exactas.**

### Lo que cambió en el uno a uno

Antes, dos filas que pretendían la misma acreditación se resolvían por orden:
la primera se la llevaba. **Eso era elegir arbitrariamente**, y la regla nueva
lo prohíbe explícitamente.

Ahora cada fase calcula **todas** las pretensiones antes de asignar nada. Una
fila se queda con un registro solo si tiene exactamente un candidato **y**
ninguna otra fila pretende ese mismo registro. Si dos compiten, **las dos
quedan `MATCH_AMBIGUO`** y decide una persona. El resultado ya no depende del
orden de las filas en el archivo.

### Resultado sobre `CLIENT_SAMPLE_01`

Recalculado desde los datos, sin ningún valor fijado:

| | |
|---|---:|
| Filas | 12 |
| `ACREDITADA_EXACTA_CUIT` | **6** |
| `ACREDITADA_EXACTA_DNI` | **5** |
| `PENDIENTE_NO_ENCONTRADA_EN_RANGO` | **1** |
| Ambiguas · errores · duplicados | **0** |
| **Automáticas** | **11 · 91,7 %** |
| Revisión manual | 1 · 8,3 % |
| Enviado | $ 5.778.000,00 |
| **Acreditado** | **$ 5.624.500,00** |
| Pendiente | $ 153.500,00 |

### Acuerdo con el benchmark independiente

Se volvió a correr el benchmark, con la misma regla **implementada por
separado** —su propia lista de prefijos de persona física, su propia
detección de contención—:

| | Benchmark | Automatización | Acuerdo |
|---|---:|---:|---:|
| Acreditadas por CUIT | 6 | 6 | **100 %** |
| Mismo registro de Fullcarga | — | — | **100 %** |
| Acreditadas por DNI | 5 | 5 | **100 %** |
| Mismo registro de Fullcarga | — | — | **100 %** |
| Ambiguas · conflictos | 0 | 0 | — |
| Sin candidato | 1 | 1 | — |

Las dos implementaciones eligen **los mismos once registros**: 424, 425, 426,
427, 428, 429, 430, 431, 432, 433 y 434.

Cada acreditación por DNI se verificó por separado: documento, fecha, importe
y **persona física**. Las cinco cumplen las cuatro.

### La fila que quedó pendiente

`ROW_02` sigue en `PENDIENTE_NO_ENCONTRADA_EN_RANGO`. **No se forzó nada.**

Su documento no aparece en ningún CUIT de persona física del informe, ni con
otra fecha, ni con un dígito de diferencia. Y ya se había descartado que
estuviera en la ventana previa: se descargó también el informe del 25 al 31 de
agosto, y sobre **2.487 filas** que cubren desde cuatro días antes del
depósito hasta catorce días después, ese documento no está.

Quedan dos lecturas y las dos las resuelve una persona: el DNI de la planilla
está mal escrito, o la transferencia nunca se acreditó.

### Qué evita un falso positivo

Siete protecciones, y ninguna es cosmética:

1. **El CUIT tiene que validar.** Sin verificador correcto, los dígitos
   centrales no son un documento.
2. **Solo persona física.** Un CUIT de empresa nunca entra a la regla.
3. **Nunca se fabrica un CUIT** desde un DNI, ni se prueba un prefijo.
4. **Fecha e importe exactos.** El importe se compara en centavos enteros; la
   fecha, sin tolerancia — no hay evidencia que justifique una ventana.
5. **Unicidad.** Dos candidatos son cero acreditaciones.
6. **Uno a uno con detección de contención.** Dos filas peleando por un
   registro dejan a las dos en revisión.
7. **El CUIT consume antes que el DNI.** La identidad derivada nunca le gana
   a la directa.

Y sigue en pie lo de siempre: **el nombre no se usa jamás** para emparejar.
