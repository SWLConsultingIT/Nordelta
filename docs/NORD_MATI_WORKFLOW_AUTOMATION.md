# NORD · Automatización del flujo operativo de Mati

> **Fase de análisis y research. No se modificó código, ni esquema, ni
> migraciones, ni tests, y no se implementó ninguna funcionalidad.**
>
> Fecha: 9 de septiembre de 2026.
> Complementa `NORD_SCOPE_REDEFINITION.md`, que definió el alcance. Este
> documento baja al proceso concreto de Mati y al research técnico de Fullcarga.

---

## 1. Executive Summary

El objetivo de esta fase no era diseñar funcionalidades: era **contar el trabajo
manual de Mati y decidir cuánto de eso puede dejar de existir**.

De los diecisiete pasos que hoy hace a mano, **once se pueden eliminar por
completo, cuatro quedan asistidos y dos siguen siendo decisión humana**. La
estimación razonada de automatización del flujo está en la sección 5:
**70–85 % del trabajo, con una dependencia crítica** que puede empujarla hacia
abajo.

**La dependencia crítica es una sola, y es el hallazgo central de este
documento.** NORD confirmó que la conciliación se hace por **CUIT + fecha**.
Pero el informe de Fullcarga, según los campos observados —código cliente,
razón social, crédito inicial, incremento, crédito final, fecha, fecha ingreso,
banco, tipo incremento, bolsa destino, observación— **no tiene columna de
CUIT**. Si el CUIT del depositante aparece, tiene que estar dentro del texto de
**Observación**.

> **Todo el matching automático depende de si el CUIT se puede recuperar de
> forma confiable del campo Observación.** No es un detalle de
> implementación: es el eje del que cuelga la mitad del valor del proyecto.
>
> No lo podemos contestar desde acá: **el archivo real no está en el
> repositorio.** Es el pedido número uno de la sección 20, y hay un plan B
> diseñado para el caso de que la respuesta sea que no (sección 8).

Sobre **Fullcarga**, el research dio resultados concretos y verificables. La
plataforma se llama **Titán** (versión 6.6.32), corre sobre **Apache Tomcat
8.5.46**, mantiene sesión con una cookie **`JSESSIONID`** y el login es un
`POST` de formulario clásico a **`/TITAN/Login.html`** con los campos `usuario`
y `password`. No es una aplicación moderna con API JSON: es una aplicación Java
server-side, y eso **es una buena noticia** — este tipo de aplicación se puede
manejar con un cliente HTTP autenticado, que es notoriamente más robusto y
barato de mantener que automatizar un navegador.

**API pública oficial: no encontrada.** Pero Fullcarga publica **«Host to
Host»** entre sus canales de venta, lo que indica que existe un canal de
integración comercial. **Pedirlo por la vía comercial es la opción más sólida de
todas y es la primera recomendación**, porque es la única con contrato,
estabilidad y cero mantenimiento.

**MVP recomendado: MVP 2** —importación, normalización, validación, generación
del archivo Fullcarga, importación del informe y conciliación— **con el parser
construido primero**. El parser es la pieza que **no depende** de cómo llegue el
archivo: sirve igual si el archivo lo baja Mati a mano, un endpoint autenticado
o un navegador automatizado. Construirlo primero desacopla el MVP de la
respuesta de Fullcarga, que es la única dependencia que no controlamos.

---

## 2. Flujo actual

Los diecisiete pasos, tal como se relevaron.

```
 1. RECEPCIÓN            El cliente manda la planilla por Gmail, a veces WhatsApp
 2. TRASLADO             Mati copia el contenido a su Excel operativo
 3. NORMALIZACIÓN        Fechas, formato numérico, espacios, guiones del CUIT,
                         comprobantes, tipo (transferencia o depósito), columnas
 4. VALIDACIÓN           Comprobante sin guiones ni letras; CUIT correcto
 5. ARCHIVO MÓVIL        Arma el archivo con el formato que pide Fullcarga
 6. ENVÍO                Carga el archivo en Fullcarga y confirma que entró
 ── espera hasta el día siguiente ──────────────────────────────────────────
 7. CONCILIACIÓN D+1     Todos los días, siempre sobre el día anterior
 8. DESCARGA             Consultas → Informe de Ingresos y Créditos →
                         fecha → Aceptar → descargar Excel
 9. LIMPIEZA             Borra a mano las columnas que no usa
10. MATCHING             Cruza por CUIT + fecha, usando el monto como señal
11. ACREDITACIÓN         Marca cada transferencia como acreditada
12. CUIT INCORRECTO      Separa la operación, avisa al cliente, espera una
                         planilla nueva. No se toca la planilla anterior
13. CUIT SIMILAR         Detecta a ojo los parecidos
14. CLIENTE / CUIT       Sabe de memoria qué depositantes corresponden a cada cliente
15. ERRORES              CUIT incorrecto, transferencia repetida, datos incorrectos
16. TOTAL POR CLIENTE    Suma enviado, acreditado y pendiente por cliente
17. CUENTA CORRIENTE     Cuando la planilla está 100 % acreditada, su total pasa
                         a la cuenta corriente del cliente
```

**Volumen: 300–600 transferencias por día.** El paso 2 solo, a un par de
segundos por fila revisada, ya es más de una hora de trabajo que no produce
ninguna información nueva.

---

## 3. Reglas confirmadas por NORD

Estas ya no son supuestos. Cierran cuatro de las preguntas abiertas del
documento de alcance.

| Regla | Confirmada | Consecuencia de diseño |
|---|---|---|
| **Número de comprobante** | El formato exacto no importa, pero **no puede tener guiones ni letras**. Si los tiene, Fullcarga marca error en la celda | Validación mecánica, 100 % automatizable. Se rechaza antes de generar el archivo, no después de que Fullcarga lo rechace |
| **Matching** | Principalmente **CUIT + fecha**. El monto es señal adicional. **No alcanza el monto solo**: hay muchas transferencias con el mismo importe | El CUIT es la clave del sistema. Ver sección 8: el informe no lo trae como columna |
| **Acreditaciones** | **Siempre totales.** No existen parciales | Simplifica enormemente el modelo: el estado es binario, pendiente o acreditada. No hay saldos parciales por operación |
| **CUIT incorrecto** | Se separa de la planilla válida, se informa al cliente y **el cliente reenvía en una planilla nueva**. No se modifican planillas anteriores | La planilla es **inmutable** después de enviada. Es una decisión de trazabilidad y hay que respetarla en el modelo |
| **CUIT similar** | Sugerir es útil. **Nunca corregir automáticamente** | Asistido, con confirmación humana obligatoria |
| **Cliente NORD ≠ CUIT** | Un cliente puede recibir transferencias de **muchos depositantes**, cada uno con su CUIT | El CUIT no puede ser una columna de `contrapartes`. Necesita su propia entidad, con relación de muchos a muchos y aprendizaje del histórico |
| **Errores conocidos** | CUIT incorrecto, transferencia repetida, datos incorrectos | Tres clases mínimas, más las que surjan del matching |
| **Cadencia** | Conciliación **todos los días, siempre D+1**, porque durante el día siguen apareciendo acreditaciones | Un proceso diario programado, no en tiempo real. Encaja perfecto con una tarea nocturna |
| **Puente a cuenta corriente** | Una transferencia individual **no** genera un asiento. La cadena es: planilla → todas sus transferencias acreditadas → **total de la planilla** → cuenta corriente | **Confirma la hipótesis central del documento de alcance**: el puente es uno-a-muchos. La unidad contable es la planilla, no la transferencia |

> **La última fila es la más importante.** El análisis de alcance sostuvo —desde
> el modelo, sin saber la respuesta— que el puente tenía que ser uno-a-muchos
> porque 100.000 operaciones anuales no pueden ser 100.000 asientos. NORD
> confirmó exactamente eso, y además dio la unidad de agrupación: **la
> planilla**. Eso cierra la pregunta P1 del documento de alcance.

### Lo que sigue sin confirmar y afecta el diseño

- **¿Aparece el CUIT del depositante en el informe de Fullcarga?** Sección 8.
- **¿Qué valores de «tipo incremento» son acreditaciones** y cuáles son otra
  cosa? NORD ya advirtió que no todas las filas son acreditaciones.
- **¿Qué determina si una operación es transferencia o depósito?** Hoy Mati lo
  define en el paso 3, y no sabemos con qué criterio.
- **¿Todos los clientes mandan el mismo formato de planilla?**
- **¿Una planilla puede quedar parcialmente acreditada para siempre?** Si una
  transferencia nunca se acredita, ¿la planilla queda trabada y nunca llega a
  la cuenta corriente?

---

## 4. Pain points

Ordenados por costo real, no por molestia declarada.

| # | Pain point | Por qué cuesta | Costo |
|---|---|---|---|
| 1 | **Matching manual por CUIT + fecha** | 300–600 filas cruzadas contra otro archivo, a mano, todos los días | **Alto** |
| 2 | **Copiar y pegar entre planillas** | Trabajo puro de traslado: no produce ninguna información nueva | **Alto** |
| 3 | **Normalización a mano** | Guiones, espacios, fechas, formatos numéricos, fila por fila | **Alto** |
| 4 | **Limpiar el informe de Fullcarga** | Borrar columnas todos los días, siempre las mismas | Medio |
| 5 | **Sumar por cliente a mano** | Se recalcula desde cero cada vez que alguien pregunta | Medio |
| 6 | **Colores como estados** | No se filtra, no se cuenta, no se audita, y se pierde al copiar | **Alto en riesgo** |
| 7 | **Errores que Fullcarga descubre** | Un comprobante con guion se detecta recién cuando Fullcarga rechaza la celda: el ciclo se reinicia | **Alto** |
| 8 | **Detectar CUIT parecidos a ojo** | Depende de que Mati lo note. Un dígito de diferencia manda plata a otro lado | **Alto en riesgo** |
| 9 | **Saber a quién corresponde cada depositante** | Conocimiento en la cabeza de una persona. Si Mati no está, no hay proceso | **Alto en riesgo** |
| 10 | **Backups por email** | El respaldo es mandarse el archivo a uno mismo | Medio |
| 11 | **Descargar el informe a mano** | Login, menú, fecha, aceptar, descargar. Todos los días | Bajo, pero eliminable |
| 12 | **Recepción por dos canales** | Sin bandeja única ni constancia de qué llegó y qué falta | Medio |

**Los pain points 6, 8 y 9 son de riesgo, no de tiempo.** Un sistema que solo
acelerara el trabajo sin atacarlos dejaría el riesgo intacto — y es el que
puede costar plata de verdad.

---

## 5. Trabajo manual eliminable

Clasificación: **FULL AUTO** (sin intervención) · **ASSISTED** (el sistema
propone, la persona confirma) · **MANUAL REQUIRED** (decide una persona).

| Paso actual | Fricción | Riesgo | ¿Automatizable? | Propuesta | Intervención humana |
|---|---|---|---|---|---|
| 1 · Recepción por Gmail/WhatsApp | Media | Perder una planilla | Parcial | Subir el archivo al sistema; Gmail automático más adelante | Subir el archivo (MVP) |
| 2 · Copiar al Excel operativo | **Alta** | Error de traslado | **Sí, entero** | **FULL AUTO** · el archivo se importa | **Ninguna. Este paso desaparece** |
| 3a · Sacar guiones del CUIT | Alta | Rechazo de Fullcarga | **Sí** | **FULL AUTO** · normalización | Ninguna |
| 3b · Corregir fechas y formato numérico | Alta | Error de importe | **Sí** | **FULL AUTO** · el parser ya existe para otros campos | Ninguna |
| 3c · Eliminar espacios | Media | Falla el matching | **Sí** | **FULL AUTO** · ya implementado para nombres | Ninguna |
| 3d · Adaptar columnas al formato Móvil | Alta | Archivo rechazado | **Sí** | **FULL AUTO** · generación del archivo | Ninguna |
| 3e · Definir transferencia o depósito | Media | Clasificación errónea | **TO VALIDATE** | Depende del criterio, hoy desconocido | Por ahora, humana |
| 3f · Eliminar filas problemáticas | Media | Perder una operación | **Sí, mejorándolo** | **FULL AUTO** · se **separan**, no se borran: nada desaparece en silencio | Revisar las separadas |
| 4a · Validar comprobante sin guiones ni letras | Media | **Rechazo de Fullcarga** | **Sí** | **FULL AUTO** · regla mecánica, antes de generar | Ninguna |
| 4b · Validar CUIT | Alta | **Plata a otro lado** | **Sí** | **FULL AUTO** para el formato; **ASSISTED** para el parecido | Confirmar sugerencias |
| 5 · Armar el archivo Fullcarga | Alta | Formato inválido | **Sí** | **FULL AUTO** · un botón | Ninguna |
| 6 · Enviar y confirmar | Baja | No saber si entró | Parcial | Registrar el envío y su acuse | Cargar en Fullcarga |
| 8 · Descargar el informe | Media | Olvidarlo | **Depende** | Sección 9. Con accesos, **FULL AUTO** nocturno | Ninguna, si hay accesos |
| 9 · Limpiar el informe | Media | Borrar de más | **Sí, entero** | **FULL AUTO** · el parser lee lo que necesita e ignora el resto | **Ninguna. Este paso desaparece** |
| 10 · Matching | **Muy alta** | Conciliar mal | **Sí, mayormente** | **FULL AUTO** cuando CUIT+fecha coinciden; **ASSISTED** ante ambigüedad | Solo excepciones |
| 11 · Marcar acreditación | Alta | Estado perdido | **Sí** | **FULL AUTO** · consecuencia del match | Ninguna |
| 12 · CUIT incorrecto | Media | Trazabilidad | Parcial | **FULL AUTO** para detectar y separar; el aviso al cliente es humano | Avisar al cliente |
| 13 · CUIT similar | Alta | **Alto** | **ASSISTED** | Sugerencia con puntaje. **Nunca corrección automática** | **Confirmar. Obligatorio** |
| 14 · Cliente ↔ depositante | Alta | Conocimiento de una sola persona | **ASSISTED** | Aprender del histórico y sugerir | Confirmar el vínculo nuevo |
| 15 · Detectar repetidas | Media | Duplicar plata | **Sí** | **FULL AUTO** · detectar y marcar para revisión | Decidir si es duplicado real |
| 16 · Totales por cliente | Alta | Suma equivocada | **Sí, entero** | **FULL AUTO** · una consulta | **Ninguna. Este paso desaparece** |
| 17 · Puente a cuenta corriente | Media | Asiento incorrecto | Diseñado, no automatizado | Propuesta de asiento al completarse la planilla | **Confirmar el asiento** |

### Cuánto se elimina

| Clasificación | Pasos |
|---|---|
| **FULL AUTO** | 13 |
| **ASSISTED** | 4 |
| **MANUAL REQUIRED** | 3 |
| **TO VALIDATE** | 2 |

**Los pasos que desaparecen enteros:** copiar y pegar entre planillas, limpiar
el informe, y sumar por cliente. Los tres son trabajo que no produce
información: solo mueven datos de un lugar a otro.

**Estimación de automatización del flujo: 70–85 %**, razonada así — el trabajo
de traslado, normalización, validación, generación y suma es del orden de tres
cuartos del tiempo y es casi todo automatizable; el matching es el otro cuarto
y se automatiza en su mayoría, **siempre que el CUIT sea recuperable del
informe**. Si el CUIT no se puede recuperar, la franja cae a **55–70 %**: se
elimina todo el trabajo de preparación, pero el matching queda asistido en vez
de automático. Ver sección 8.

---

## 6. Flujo objetivo

```
PLANILLA DEL CLIENTE
   ↓  se sube al sistema (más adelante, Gmail automático)
IDENTIFICAR CLIENTE ─────────── por remitente o a mano · sugerido, nunca impuesto
   ↓
IMPORTAR Y GUARDAR EL ORIGINAL ─ el archivo tal como llegó, intacto
   ↓
NORMALIZAR ──────────────────── CUIT sin guiones, fechas, importes, espacios
   ↓
VALIDAR ─────────────────────── comprobante sin guiones ni letras · CUIT bien
                                formado · duplicados · datos completos
   ↓
   ├── SEPARAR ERRORES ──────── no se borran: quedan identificados y trazables
   ↓
PLANILLA LISTA ───────────────── Mati revisa en una grilla y confirma
   ↓
GENERAR ARCHIVO FULLCARGA ───── un botón, con el formato exacto
   ↓
ENVÍO ───────────────────────── se registra qué se envió y cuándo
   ↓
   ═══ espera D+1 ═══
   ↓
INFORME DE FULLCARGA ────────── automático si hay accesos; si no, se sube
   ↓
CLASIFICAR FILAS ────────────── qué es acreditación y qué es otro incremento
   ↓
MATCHING ────────────────────── CUIT + fecha, con el monto como señal
   ↓
   ├── EXACTO ──────────────── se acredita solo
   ├── POSIBLE ─────────────── espera a Mati
   └── SIN MATCH ───────────── requiere atención, en las dos direcciones
   ↓
REGISTRAR FECHA DE ACREDITACIÓN
   ↓
¿PLANILLA 100 % ACREDITADA?
   ├── NO → sigue pendiente, visible por cliente
   └── SÍ ↓
TOTAL DE LA PLANILLA
   ↓  ═══ EL PUENTE · lo confirma una persona ═══
CUENTA CORRIENTE → BALANCE → AUDITORÍA
```

**La diferencia con el flujo actual no es que tenga menos pasos.** Es que **de
los diecisiete pasos manuales quedan tres**: subir el archivo, revisar
excepciones y confirmar el asiento. Todo lo demás lo hace el sistema.

---

## 7. Diseño por excepciones

El principio que gobierna el módulo:

> **El caso normal es automático. La excepción la decide Mati.**
> Y ninguna operación desaparece en silencio: toda fila termina en un estado
> explícito, y la suma de los estados da el total del archivo.

El invariante de la segunda línea **ya está implementado y probado** en
`src/lib/migracion/estados.ts`, con un test que lo exige.

| Situación | Tratamiento | Por qué |
|---|---|---|
| CUIT + fecha coinciden, monto coincide | **Automático** | Es el caso normal. Debería ser la enorme mayoría |
| CUIT + fecha coinciden, monto no | **Excepción** | NORD confirmó que no hay acreditaciones parciales, así que un monto distinto es una anomalía real |
| CUIT parecido a uno conocido | **Sugerencia con puntaje** | **Nunca corrección automática.** Un dígito manda plata a otro lado |
| Dos candidatos posibles | **Excepción** | Elegir por el sistema sería adivinar |
| CUIT mal formado | **Error** | Se separa, se avisa al cliente, se espera planilla nueva |
| Transferencia repetida | **Excepción** | Puede ser un duplicado o dos transferencias iguales legítimas. Solo el negocio sabe |
| Fila del informe no clasificable | **Excepción** | Nunca ignorarla: quedaría plata sin explicar |
| Acreditación sin operación enviada | **Excepción** | Es la dirección que más se olvida y la que más importa: entró plata que nadie pidió |
| Depositante nuevo para un cliente conocido | **Sugerencia** | Se aprende del histórico, lo confirma una persona |

**Regla de oro del diseño:** ante la duda, el sistema **no decide**. Marca,
explica por qué duda, y espera. Es más lento en el caso raro y evita el error
que cuesta plata.

---

## 8. Research Fullcarga · el archivo y el CUIT

### El hallazgo crítico

Los campos observados en el informe:

```
código cliente · razón social · crédito inicial · incremento · crédito final
fecha · fecha ingreso · banco · tipo incremento · bolsa destino · observación
```

**No hay ninguna columna de CUIT.** Y NORD confirmó que el matching se hace por
**CUIT + fecha**.

Las columnas identifican **al cliente de NORD que recibió el crédito** (código
cliente, razón social), no **al depositante que mandó la plata**. El CUIT del
depositante, si aparece, tiene que estar dentro del texto libre de
**Observación**.

> **De acá cuelga la mitad del valor del proyecto.** Si el CUIT se puede
> extraer de Observación con confiabilidad alta, el matching automático por
> CUIT + fecha funciona como NORD lo describe. Si no, hay que conciliar con
> otra combinación de campos, y el matching pasa de automático a asistido.

**No lo podemos resolver desde acá: el archivo real no está en el repositorio.**
Lo verifiqué. Es el pedido número uno de la sección 20.

### Qué hay que analizar cuando llegue el archivo

1. ¿Aparece un CUIT dentro de Observación, y en qué proporción de las filas?
2. ¿Con qué patrón? ¿Prefijo fijo, posición fija, mezclado con otro texto?
3. ¿Hay más de un formato según el banco de origen?
4. ¿Qué valores toma **tipo incremento**, y cuáles son acreditaciones de
   transferencia y cuáles otra cosa? NORD ya avisó que no todas las filas lo son.
5. ¿Qué es **bolsa destino**? Es candidata a ser la conexión con Móvil general
   contra cajas y puntos (sección 16 del documento de alcance).
6. ¿**fecha** y **fecha ingreso** difieren, y cuál es la que hay que usar para
   el matching? Con conciliación D+1 esto importa: si la fecha de ingreso es la
   del día anterior y la fecha es la de acreditación, la clave de matching
   cambia.
7. ¿El **crédito inicial + incremento = crédito final** cierra fila a fila? Si
   cierra, es una validación de integridad gratis que detecta un archivo
   truncado o mal parseado.

### El plan B, si el CUIT no está en Observación

Diseñado para que el proyecto no dependa de una sola respuesta:

**Matching por (cliente NORD + fecha + importe + banco).** El «código cliente»
del informe identifica al cliente de NORD, así que el universo de candidatos se
reduce de 600 operaciones diarias a las de **un solo cliente en un solo día**.
Dentro de ese universo, el importe repetido deja de ser un problema grave: dos
transferencias del mismo monto, del mismo cliente, el mismo día, el mismo banco
son mucho menos probables que dos del mismo monto en todo el día.

El resultado sería:
- Cliente con una sola operación pendiente ese día → **match automático**.
- Cliente con varias, importes distintos → **match automático por importe**.
- Cliente con varias del mismo importe → **excepción**, con los candidatos
  listados.

Es peor que CUIT + fecha, pero **sigue eliminando la mayor parte del trabajo
manual**. Por eso la franja de automatización baja a 55–70 % en vez de
derrumbarse.

### Sobre el formato del archivo que hay que generar

El formato de salida se identificó en la operatoria como **«CSV Macintosh»**.
Eso, en Excel, es una opción de guardado concreta: **CSV (Macintosh)** escribe
los saltos de línea con **CR solo** (`\r`), no `CRLF` ni `LF`, y usa la
codificación **Mac OS Roman** en lugar de UTF-8.

Es un detalle chico con consecuencias reales:

- Node.js y cualquier exportador moderno escriben `\n` por defecto. Un archivo
  con el separador de línea equivocado puede ser rechazado, o peor: leerse como
  una sola fila gigante.
- El exportador que ya tiene la aplicación usa **punto y coma y BOM UTF-8**,
  que es lo correcto para Excel argentino y **no** es lo que necesita
  Fullcarga. Hacen falta **dos dialectos de exportación**, no uno.
- El sitio de Titán responde con `charset=ISO-8859-1` en su página de entrada,
  lo que es coherente con una plataforma de codificación heredada.

**TO VALIDATE:** el separador de campos (coma o punto y coma), la codificación
exacta, el orden de columnas y si hay fila de encabezado. Se confirma con **un
archivo que Fullcarga haya aceptado**, no con documentación. Es el pedido número
dos.

---

## 9. Opciones de automatización de la descarga

### Lo que se verificó, con evidencia

Todo lo que sigue sale de consultar **páginas públicas sin autenticación**. No
se intentó ningún acceso, no se usó ninguna credencial y no se probó el login.

| Hallazgo | Evidencia |
|---|---|
| La plataforma se llama **Titán**, versión **6.6.32** | Rutas de recursos `resources/6.6.32/...` |
| Es una aplicación **Java server-side**, no un SPA | Cookie `JSESSIONID; Path=/TITAN; Secure; HttpOnly` |
| Corre sobre **Apache Tomcat 8.5.46** | La página de error 404 del contenedor lo expone |
| **Login por formulario clásico** | `POST /TITAN/Login.html`, campos `usuario` y `password`, más tres ocultos (`topUp`, `topUpAdquirencia`, `version`) |
| **Sin token anti-CSRF visible** en el formulario de login | Inspección del HTML |
| **Sin captcha** en el formulario de login | Inspección del HTML |
| Hay un **teclado virtual** en el campo de contraseña | `keyboard1.js`, `class="keyboardInput1"` |
| Las acciones del servidor se exponen con extensión **`.html`** | `Login.html`, `restaurarpwd.html`, `registro.html`, `tpvwebsell.html` |
| Está detrás de **Akamai** | Instrumentación mPulse/Boomerang y variables `ak.*` |
| **Un cliente HTTP común no es bloqueado** en las páginas públicas | `curl` sin cabeceras de navegador devuelve `200` |
| **La misma aplicación está desplegada por país** | `.com.ar`, `.com.co`, `.com.ec`, `.es` con las mismas rutas |
| **API pública oficial: no encontrada** | Sin portal de desarrolladores ni documentación pública |
| Fullcarga publica **«Host to Host»** como canal de venta | Su propia página de soluciones |

### Las cinco alternativas

#### A · API oficial — **NO ENCONTRADA, pero hay que preguntar**

No existe portal de desarrolladores ni documentación pública. **Pero Fullcarga
lista «Host to Host» entre sus canales**, lo que en esta industria significa
integración máquina a máquina para clientes que la piden.

- **Cómo funcionaría:** contrato de integración, credenciales propias, endpoint
  documentado.
- **Esfuerzo:** bajo en desarrollo, incierto en tiempo comercial.
- **Robustez:** **la más alta.** Un contrato no se rompe cuando cambia una pantalla.
- **Riesgos:** que no lo ofrezcan al perfil de cuenta de Nordelta, o que tenga costo.
- **Mantenimiento:** mínimo.
- **Recomendación:** **preguntarlo ya, por la vía comercial.** Es gratis
  preguntar, y si la respuesta es sí, todas las demás alternativas sobran. Es la
  gestión de mejor relación valor/esfuerzo de esta sección y **nadie la había
  puesto sobre la mesa**.

#### B · Endpoint interno autenticado — **VIABLE EN PRINCIPIO · NECESITA ACCESO**

El mecanismo, dado que es una aplicación Java con sesión por cookie:

```
POST /TITAN/Login.html  (usuario, password)   → recibe JSESSIONID
GET/POST <acción del informe>  (fecha)        → devuelve el archivo
```

- **Cómo funcionaría:** un cliente HTTP mantiene la cookie de sesión y pide el
  informe con la fecha. Sin navegador, sin interfaz.
- **Esfuerzo:** bajo, **si el login se puede reproducir**.
- **Robustez:** alta. Estas aplicaciones cambian de URL con muy poca frecuencia.
- **Riesgos concretos, en orden:**
  1. **El teclado virtual.** Si `keyboard1.js` transforma o codifica la
     contraseña antes de enviarla, un `POST` directo falla. Hay que verificarlo
     mirando una autenticación real. **Es el riesgo número uno.**
  2. **MFA.** No se ve en el login, pero puede aparecer después.
  3. **Akamai en rutas autenticadas.** Las públicas no bloquean a `curl`; las
     internas pueden tener otra política.
  4. **Expiración de sesión** y necesidad de reautenticar.
- **Mantenimiento:** bajo.
- **Recomendación:** **es la opción técnica preferida** una vez descartada la A.

#### C · Descarga directa autenticada — parte de B

Que una sesión válida más una fecha alcancen para bajar el archivo **es
exactamente la hipótesis de B**. El dato de que Mati ya puede bajar el informe
indicando **solo una fecha** es una señal fuerte de que el informe se
parametriza con un único campo, que es el caso más simple posible.

#### D · Automatización de navegador — **VIABLE COMO RESPALDO**

- **Cómo funcionaría:** **Playwright** con un contexto persistente: entra,
  navega a Consultas, elige la fecha, descarga.
- **Esfuerzo:** medio. Más código y más infraestructura que B.
- **Robustez:** media. Sobrevive al teclado virtual y a Akamai porque **es** un
  navegador de verdad; se rompe cuando cambia la interfaz.
- **Riesgos:** frágil ante rediseños, más lento, necesita un entorno con
  navegador, y falla de formas difíciles de diagnosticar.
- **Mantenimiento:** el más alto de las tres.
- **Recomendación:** **respaldo, no primera opción.** Su ventaja real es que
  **es inmune al riesgo número uno de B**: si el teclado virtual transforma la
  contraseña, el navegador lo ejecuta igual que una persona.

#### E · RPA — **NO RECOMENDADO**

Una herramienta de RPA sobre un escritorio agrega una máquina que hay que
mantener prendida, sin ninguna ventaja sobre Playwright. Solo tendría sentido si
Fullcarga fuera una aplicación de escritorio, y no lo es.

### Conclusión explícita

```
AUTOMATIZACIÓN DE LA DESCARGA DE FULLCARGA

  A · API oficial ................ NO ENCONTRADA · preguntar por «Host to Host»
  B · Endpoint interno ........... VIABLE EN PRINCIPIO · NECESITA ACCESO
  C · Descarga autenticada ....... es la hipótesis de B
  D · Navegador (Playwright) ..... VIABLE COMO RESPALDO
  E · RPA ........................ NO RECOMENDADO

  ESTADO GENERAL: NECESITA ACCESO para confirmar B.
                  Ninguna alternativa quedó descartada por imposible.
```

---

## 10. Recomendación técnica

**Una estrategia de tres carriles, en este orden — y una decisión de ingeniería
que hace que el orden no importe para arrancar.**

**Carril 1 · Preguntar por la integración oficial.** Es una conversación
comercial, cuesta un mail y puede volver todo lo demás innecesario. Se hace
ahora, en paralelo con todo.

**Carril 2 · Reproducir el login y el endpoint del informe.** Con una cuenta y
permiso explícito de Nordelta, observar una autenticación real y una descarga
real, y verificar si un cliente HTTP las puede repetir. **Una hora de trabajo
contesta la pregunta.**

**Carril 3 · Playwright como respaldo**, solo si el carril 2 se choca con el
teclado virtual, con MFA o con el WAF.

### La decisión que desacopla todo

> **El parser del informe se construye primero, y es independiente de cómo
> llegue el archivo.**

Sirve igual si el archivo lo baja Mati a mano, si lo trae un endpoint
autenticado o si lo descarga un navegador automatizado. Es **la pieza de mayor
valor y menor riesgo** del proyecto entero: contesta la pregunta crítica del
CUIT en Observación, permite construir el matching, y **no depende de ningún
acceso que no tengamos**.

Consecuencia práctica: **la automatización de la descarga deja de ser un
bloqueante.** El MVP funciona con Mati subiendo el archivo —lo que ya hace hoy—
y la descarga automática se enchufa después sin tocar nada del resto.

### Arquitectura de la automatización, cuando esté

```
03:00 (configurable, con margen sobre el cierre del día)
  ↓
obtener el informe del día anterior
  ↓
GUARDAR EL ORIGINAL SIN TOCAR ────── si el parseo falla, el archivo está
  ↓                                   y se reprocesa sin volver a Fullcarga
parsear y clasificar filas
  ↓
extraer acreditaciones
  ↓
matching automático
  ↓
dejar las excepciones marcadas
  ↓
Mati entra a la mañana y ve SOLO las excepciones
```

Dos principios operativos: **guardar el original antes de interpretarlo**
—reprocesar es gratis, volver a pedirlo no—, y **idempotencia**: correr el
proceso dos veces sobre el mismo día no puede duplicar nada. El esquema actual
ya practica ese patrón con el índice único sobre el origen de la migración.

---

## 11. Modelo conceptual

Sin cambios de esquema. Entidades y relaciones.

```
CLIENTE NORD ─────────────┬──── 1:N ──── ARCHIVO RECIBIDO ──── 1:1 ──── PLANILLA
  (= contrapartes, ya existe)                (el original, intacto)
      │                                                             │
      │ N:M                                                         │ 1:N
      ↓                                                             ↓
  DEPOSITANTE ──── 1:N ──── CUIT              TRANSFERENCIA SOLICITADA
  (quién manda la plata)                       cuit · importe · fecha ·
                                               comprobante · tipo · estado
                                                              │
                                          ┌───────────────────┤
                                          │                   │
                                    1:1 opcional        1:1 opcional
                                          ↓                   ↓
                                       ERROR              MATCH ──── 1:1 ──── ACREDITACIÓN
                                                          score ·              (fila del informe)
                                                          motivo
PLANILLA (todas sus transferencias acreditadas)
   ↓
TOTAL DE LA PLANILLA ──── 1:1 ──── MOVIMIENTO FINANCIERO ──── CUENTA CORRIENTE
                                    (ya existe, completo)      (ya existe)

ARCHIVO FULLCARGA GENERADO ──── 1:1 ──── ENVÍO ──── 1:1 ──── PLANILLA
INFORME FULLCARGA ──── 1:N ──── ACREDITACIÓN
```

### La relación que NORD acaba de aclarar y que cambia el modelo

**Cliente NORD ≠ CUIT.** Un cliente recibe transferencias de muchos
depositantes distintos.

Eso descarta la solución simple —una columna `cuit` en `contrapartes`— y pide
tres niveles: el **cliente** (a quién le acreditamos), el **depositante** (quién
mandó la plata) y el **CUIT** (su identificación fiscal, que puede ser más de
una).

Con una consecuencia útil: **la relación cliente ↔ CUIT se puede aprender del
histórico.** Si un CUIT apareció veinte veces en planillas del Cliente A,
cuando vuelva a aparecer el sistema puede sugerir el vínculo con confianza
alta. Eso convierte el conocimiento que hoy está en la cabeza de Mati (pain
point 9) en un dato del sistema. **Sugerencia, nunca imposición.**

### Qué ya existe y qué no

| Entidad | Estado |
|---|---|
| Cliente NORD | **Existe** · `contrapartes`, con nombre normalizado único |
| Movimiento financiero, cuenta corriente, balance, auditoría | **Existen y están verificados** |
| Depositante, CUIT | **No existen** |
| Archivo recibido, planilla | **No existen** |
| Transferencia solicitada, estado | **No existen** |
| Archivo Fullcarga generado, envío | **No existen** |
| Informe Fullcarga, acreditación | **No existen** |
| Match, score, motivo | **No existen** · el patrón sí: `MotivoDiferencia` en la conciliación legacy |
| Error | **Parcial** · el importador ya clasifica errores por fila, en memoria |
| Total de planilla → asiento | **No existe** · las dos puntas existen, falta el puente |

---

## 12. Estados

Preliminares. **TO VALIDATE** con NORD antes de escribir cualquier enum: en
Postgres son baratos de crear y caros de cambiar con datos adentro.

**PLANILLA**

```
Recibida → En revisión → Lista → Enviada → Parcialmente acreditada → Acreditada
                            └──────────────→ Con errores
```

**TRANSFERENCIA**

```
Pendiente → Enviada → Acreditada
     └───────────────→ Error
```

NORD confirmó que las acreditaciones son **siempre totales**, así que este ciclo
es limpio y binario en su desenlace: o se acredita, o queda pendiente. **No hay
estado intermedio de monto parcial.**

**ERROR**

```
CUIT incorrecto · Comprobante inválido · Repetida · Datos incorrectos
Sin match · Match ambiguo
```

### Dudas que hay que resolver antes de fijarlos

- **«Parcialmente acreditada» puede ser un estado permanente.** Si una
  transferencia nunca se acredita, ¿la planilla queda trabada para siempre y su
  total nunca llega a la cuenta corriente? Hay que definir la salida: un plazo,
  una anulación de la transferencia, o un asiento parcial.
- **¿«Con errores» convive con los otros estados?** Una planilla puede estar
  enviada *y* tener dos filas con error. Probablemente el error sea un atributo
  de la transferencia y la planilla tenga un contador, no un estado excluyente.
- **¿Una planilla se puede anular entera?**
- **«Sin match» y «Match ambiguo» son estados del match, no de la
  transferencia.** Vale separarlos para no mezclar dos ciclos de vida.

---

## 13. La mañana de Mati

### Hoy

Abrir mails. Abrir Excels. Copiar. Pegar. Limpiar. Descargar. Separar. Buscar.
Sumar. Conciliar. **Trabajar todo el día para saber qué pasó ayer.**

### Objetivo

Entra a NORD. La primera pantalla dice:

```
┌─ ACREDITACIONES DE AYER · lunes 8 de septiembre ──────────────────┐
│                                                                    │
│    420          389              18            8           5      │
│  recibidas   conciliadas     requieren      CUIT      repetidas   │
│              automáticamente  revisión    incorrectos             │
│                                                                    │
│              ↑ 93 %          ↑ lo único que necesita a una persona │
└────────────────────────────────────────────────────────────────────┘

┌─ REQUIERE ATENCIÓN · ordenado por plata en juego ─────────────────┐
│  8 CUIT incorrectos ............ $ 4.200.000   → avisar al cliente │
│  5 repetidas ................... $ 1.850.000   → confirmar         │
│  3 sin match ................... $   920.000   → revisar           │
│  2 match ambiguo ............... $   340.000   → elegir            │
└────────────────────────────────────────────────────────────────────┘

┌─ CLIENTES ────────────────────────────────────────────────────────┐
│  Cliente        Enviado        Acreditado      Pendiente          │
│  Cliente A      $ 12.400.000   $ 12.400.000    —          ✓ lista │
│  Cliente B      $  8.900.000   $  7.100.000    $ 1.800.000        │
└────────────────────────────────────────────────────────────────────┘
```

Trabaja **solo sobre las 18 excepciones**. Cuando termina, las planillas que
quedaron 100 % acreditadas le ofrecen su total para pasar a la cuenta corriente,
y ella confirma.

**El cambio no es que la pantalla sea más linda. Es que el trabajo pasó de 420
filas a 18**, y que las 18 están ordenadas por lo que cuestan.

### Tres decisiones de diseño que sostienen esto

1. **Ordenar por plata, no por antigüedad.** Ocho CUIT incorrectos por
   $4.200.000 importan más que veinte diferencias de mil pesos.
2. **Cada número es un filtro, no un cartel.** Se hace clic y se llega a la
   lista. El componente `TiraDeSaldos` ya funciona así.
3. **Una sola zona pide acción.** El resto informa. Si todo grita, nada se
   escucha.

---

## 14. Integración con la aplicación existente

```
OPERACIÓN                        FINANZAS
├── Planillas                    ├── Movimientos
├── Transferencias               ├── Cuentas corrientes
├── Acreditaciones      ═══╗     ├── Balance
├── Conciliación           ║     ├── Ajustes
└── Archivos               ║     └── Auditoría
                           ║
              EL PUENTE ═══╝  planilla 100 % acreditada → total → asiento
                              (propuesto por el sistema, confirmado por una persona)
```

| Área | Hoy | Propuesta | Reutilización | Cambio |
|---|---|---|---|---|
| Núcleo financiero | Verificado contra Postgres real | Sin cambios | **AS-IS** | Ninguno |
| Movimientos + partidas | Completo | Recibe el total de la planilla | **AS-IS** | Ninguno |
| Cuentas corrientes | Completo | Suma el origen operativo | **AS-IS** | Aditivo |
| Balance, Ajustes | Completos | Sin cambios | **AS-IS** | Ninguno |
| Auditoría | Agnóstica de entidad | Cubre planillas y matches sin migrar | **AS-IS** | Solo la pantalla |
| Contrapartes | Nombre normalizado único | Se le cuelgan depositantes y CUIT | **EXTEND** | Aditivo |
| **Grilla de carga** | AG Grid, pegado TSV, errores por celda, deshacer 50 pasos | **Es la pantalla de revisión de la planilla** | **REUSE + EXTEND** | Otras columnas |
| **Canal del importador** | `parse→validate→transform→reconcile→classify`, 5 estados, nada desaparece | **Es el motor de conciliación** | **REUSE + EXTEND** | Otro origen |
| Parser | Fechas, montos argentinos, TSV, sinónimos | Suma CUIT y comprobante | **REUSE + EXTEND** | Aditivo |
| Normalización | `normalizarNombre()` espejo de la columna generada | Mismo patrón para CUIT | **REUSE + EXTEND** | Aditivo |
| **Exportador** | `;` + BOM UTF-8 para Excel argentino, server-side | **Necesita un segundo dialecto** para Fullcarga (CR, Mac OS Roman) | **REUSE + EXTEND** | Aditivo |
| Sistema de diseño | ~20 primitivos sobre tokens | Sin cambios | **AS-IS** | Ninguno |
| Riel | Ya separa Operación / Consultas / Control | Se llena la sección Operación | **AS-IS** | Solo ítems |
| Home | Financiera | **Centro de operaciones** | **REUSE + UI REDESIGN** | Reordenar |
| Cuentas | Fila por contraparte, columnas, estado, filtros | **Plantilla de la vista por cliente** | **AS-IS como patrón** | Ninguno |
| Capa de datos | Punto único, **sin implementación de Supabase** | Se construye una vez, para los dos módulos | **EXTEND** | Grande, inevitable |
| Observabilidad | Campos prohibidos en el registro | **Sumar `cuit`**: es dato fiscal | **REUSE + EXTEND** | Una línea |
| Almacén en memoria | Sirve la demo | Queda para demo y tests | **REFACTOR LATER** | Ninguno |

**Nada se reemplaza.** Igual que en el análisis de alcance: el producto se
extiende, no se corrige.

---

## 15. MVP recomendado

| | Alcance | Valor para Mati | Dependencias |
|---|---|---|---|
| MVP 1 | Importar + normalizar + validar + generar CSV | Le saca los pasos 2 a 6 | Formato del archivo Fullcarga |
| **MVP 2** | **MVP 1 + importar el informe + conciliar** | **Le saca casi el día entero** | **+ el archivo real del informe** |
| MVP 3 | MVP 2 + descarga automática | Le saca un trámite de cinco minutos | + accesos a Fullcarga |
| MVP 4 | MVP 3 + puente automático a cuenta corriente | Cierra la cadena | + decisión de negocio |

### Recomendación: **MVP 2**

**Por qué no el 1.** Le sacaría la preparación pero le dejaría el matching, que
es el cuello de botella. Peor: dejaría el trabajo partido en dos sistemas —el
nuestro para preparar, su Excel para conciliar— y **tendría que seguir copiando
entre los dos**. Un MVP que agrega un traslado de datos no está mejorando el
proceso.

**Por qué no el 3.** La descarga automática es cinco minutos de su día. El
matching es horas. Y depende de accesos que no controlamos: **la parte más
barata del beneficio con la dependencia más cara**. Además, gracias a la
decisión de la sección 10, se puede enchufar después sin tocar nada.

**Por qué no el 4.** El puente automático necesita respuestas de negocio que
todavía no están —qué pasa con una planilla que nunca se completa, qué pasa si
aparece una diferencia después de asentar—. El MVP 2 deja la propuesta de
asiento lista para que una persona confirme, que es donde queríamos estar.

**Orden de construcción dentro del MVP 2** — por valor y por riesgo, no por
capas:

1. **El parser del informe de Fullcarga.** Primero, porque contesta la pregunta
   crítica del CUIT y **no depende de ningún acceso**.
2. Importar la planilla del cliente, guardando el original.
3. Normalizar y validar, con el CUIT como caso central.
4. Pantalla de revisión sobre la grilla que ya existe.
5. Generar el archivo Fullcarga, con su dialecto propio.
6. Motor de matching con las tres zonas.
7. Vista por cliente: enviado, acreditado, pendiente, con error.
8. Home como centro de operaciones.

El paso 1 es contraintuitivo —normalmente se empieza por la entrada— y es el
orden correcto: **es el paso que puede cambiar el diseño de los otros siete.**

---

## 16. Métricas

Sin baseline medido no hay forma de saber si mejoramos. Los valores de «hoy»
son **estimaciones a confirmar cronometrando un día real**, con el mismo
criterio del protocolo de `CARGA_USABILITY_TEST.md`.

| Métrica | Hoy (a confirmar) | Objetivo del MVP 2 |
|---|---|---|
| Tiempo diario de conciliación | 2–4 h | **< 30 min** |
| Tiempo de preparación por planilla | 15–30 min | **< 2 min** |
| Operaciones de copiar y pegar por día | Decenas | **0** |
| Excels manipulados por día | 3–6 | **0** |
| Transferencias auto-conciliadas | 0 % | **> 85 %** con CUIT · **> 60 %** con el plan B |
| Excepciones que requieren a una persona | 100 % | **< 15 %** |
| Responder «¿cuánto se acreditó del Cliente X?» | Minutos, con planilla abierta | **< 5 segundos** |
| Errores detectados **antes** de Fullcarga | ~0 % | **> 95 %** de los mecánicos |
| Transferencias que hay que reprocesar | A confirmar | Bajar a la mitad |
| Planillas sin constancia de recepción | Posible hoy | **0** |

**La métrica que manda es la última fila de la mitad de arriba:** «tiempo diario
de conciliación». Si no baja de horas a minutos, el proyecto no cumplió, por
más funcionalidades que tenga.

**Cómo medir el baseline sin instrumentar nada:** acompañar a Mati un día entero
con un cronómetro, anotando cuándo empieza y termina cada paso de la sección 2.
Es medio día de trabajo y vuelve el resto del proyecto medible.

---

## 17. Dependencias

### Podemos hacer ahora, sin nada de nadie

- Diseñar el modelo de datos operativo.
- Construir el parser sobre un archivo de ejemplo, en cuanto llegue.
- Normalización y validación de CUIT y comprobante.
- Motor de matching, con los campos configurables.
- Pantalla de revisión sobre la grilla existente.
- Implementar la capa de datos contra Supabase — **bloqueada por el conector**,
  pero es trabajo nuestro y sirve a los dos módulos.

### Necesitamos datos de NORD *(bloqueante del MVP)*

1. **Un informe de Fullcarga real**, anonimizado. **El pedido número uno.**
2. **Un archivo generado que Fullcarga haya aceptado.** Es la única
   especificación confiable del formato.
3. **Una planilla de cliente real** — dos o tres, de clientes distintos, para
   saber si los formatos difieren.
4. **El Excel operativo de Mati**, con los colores intactos. Es la
   especificación funcional del módulo.

### Necesitamos accesos a Fullcarga *(no bloqueante)*

5. Una cuenta y **permiso explícito por escrito** para observar una
   autenticación y una descarga.
6. Saber si hay MFA.
7. Respuesta comercial sobre «Host to Host».

**Nada de esto bloquea el MVP 2**, gracias a que el parser es independiente del
transporte.

### Necesitamos decisiones de negocio

8. Qué pasa con una planilla que nunca se completa.
9. Qué determina transferencia contra depósito.
10. Si lo pendiente es deuda del cliente en su cuenta corriente.
11. Quién más usa el sistema y qué ve.

---

## 18. Riesgos

| # | Riesgo | Gravedad | Mitigación |
|---|---|---|---|
| 1 | **El CUIT no es recuperable del informe** | **Alta** | Plan B por cliente + fecha + importe + banco, sección 8. El proyecto sigue en pie con menos automatización |
| 2 | **El teclado virtual impide reproducir el login** | Media | Playwright como respaldo. No afecta al MVP |
| 3 | **Corregir automáticamente un CUIT equivocado** | **Alta** | Nunca corregir. Sugerir con puntaje y confirmación obligatoria. Regla del módulo |
| 4 | **Perder una operación en silencio** | **Alta** | El invariante «ninguna fila desaparece» ya está implementado y con test |
| 5 | Clasificar mal una fila del informe | Media | Toda fila no clasificable es una excepción visible, nunca se descarta |
| 6 | El formato del informe cambia sin aviso | Media | Validar estructura al importar y fallar con mensaje claro. Guardar siempre el original |
| 7 | Credenciales de Fullcarga mal manejadas | **Alta** | Sección 20 |
| 8 | Que Akamai bloquee el cliente automatizado | Media | Verificado que no bloquea páginas públicas; las autenticadas hay que probarlas. Playwright lo evita |
| 9 | Dato fiscal en registros y exportaciones | Media | Sumar `cuit` a los campos prohibidos de observabilidad |
| 10 | Rendimiento con 600 filas por día | Media | Paginación del lado del servidor desde el principio |
| 11 | Que Mati quede sin herramienta en la transición | Media | Su Excel sigue siendo el oficial hasta que la conciliación coincida varios días seguidos |
| 12 | Automatizar sobre un proceso mal entendido | Media | Acompañarla un día entero antes de construir |
| 13 | **Que una planilla quede trabada para siempre** | Media | Definir la salida antes de implementar el puente |
| 14 | Que el proyecto financiero se detenga | Media | Conectar Supabase sirve a los dos y va primero |

---

## 19. Preguntas abiertas

Las que quedaron después de las respuestas de NORD. **Q1 a Q4 bloquean el
diseño del matching.**

**BLOCKER**

**Q1.** ¿El CUIT del depositante aparece en el informe de Fullcarga? Si no
figura como columna, ¿está dentro de Observación? *(Se contesta con el
archivo, no con una respuesta.)*

**Q2.** ¿Qué valores puede tomar «tipo incremento» y cuáles son acreditaciones
de transferencia de cliente?

**Q3.** ¿«Fecha» y «fecha ingreso» son distintas? ¿Cuál se usa para conciliar?

**Q4.** Si una transferencia de una planilla nunca se acredita, ¿qué pasa con
la planilla y con su total?

**HIGH**

**Q5.** ¿Qué determina si una operación es transferencia o depósito?

**Q6.** ¿Todos los clientes mandan el mismo formato de planilla?

**Q7.** ¿Qué es «bolsa destino»? ¿Se relaciona con los puntos o cajas de Móvil?

**Q8.** Lo enviado y no acreditado, ¿es deuda del cliente en su cuenta
corriente, o solo un estado operativo?

**Q9.** ¿Existe MFA en Fullcarga? ¿Hay más de un usuario?

**Q10.** ¿Se puede pedir la integración «Host to Host» a Fullcarga?

**MEDIUM**

**Q11.** ¿Cuánto tiempo hacia atrás hay que poder consultar planillas y
acreditaciones?

**Q12.** ¿Puede llegar una acreditación de un día ya conciliado? ¿Qué se hace?

**Q13.** ¿Hay topes o controles que Mati aplique de memoria?

**Q14.** ¿Quién más va a usar el módulo y qué tendría que ver cada uno?

**Q15.** ¿El separador y la codificación exactos del archivo de Fullcarga?

> Las quince de `NORD_SCOPE_REDEFINITION.md` § 18 y las catorce de
> `OPEN_BUSINESS_DECISIONS.md` siguen vigentes en lo que no quedó contestado.

---

## 20. Próximos pasos

**Esta semana, sin escribir código**

1. **Pedir los cuatro archivos** de la sección 17: informe real de Fullcarga,
   archivo generado aceptado, dos o tres planillas de clientes distintos, y el
   Excel operativo de Mati con los colores. **El informe es el número uno: de
   él depende la pregunta Q1 y con ella la mitad del valor del proyecto.**
2. **Mandar el mail comercial a Fullcarga** preguntando por la integración
   «Host to Host» o cualquier API de reportes. Cuesta un mail y puede volver
   innecesario todo el research de automatización.
3. **Acompañar a Mati un día entero, con cronómetro**, midiendo los pasos de la
   sección 2. Es el baseline de la sección 16 y va a revelar pasos que no
   aparecen en ninguna descripción.
4. **Llevar las cuatro preguntas BLOCKER** a la misma conversación.

**Cuando llegue el informe real**

5. **Analizar el archivo y contestar Q1, Q2 y Q3.** Es medio día y decide el
   diseño del matching.
6. **Construir el parser.** Primera pieza de código del módulo, y la de mayor
   valor por unidad de riesgo.

**Cuando el alcance esté aprobado**

7. **Conectar Supabase.** Prerrequisito de todo y sirve a los dos módulos.
8. **Cerrar el modelo de datos operativo** con las respuestas en la mano, y
   recién ahí escribir migraciones.
9. **Construir el MVP 2** en el orden de la sección 15.
10. **Correrlo en paralelo con el Excel de Mati** hasta que la conciliación
    coincida varios días seguidos.

---

## Cierre

> **Entendemos qué hace Mati:** diecisiete pasos, 300–600 transferencias por
> día, de los cuales **once se pueden eliminar por completo**.
>
> **Sabemos qué tareas desaparecen:** copiar y pegar entre planillas, limpiar el
> informe, y sumar por cliente. Las tres son puro traslado de datos.
>
> **Sabemos cómo automatizar la conciliación:** matching por CUIT + fecha con el
> monto como señal, con las tres zonas y las excepciones ordenadas por plata en
> juego. **Con una dependencia crítica identificada** —que el CUIT sea
> recuperable del informe— **y un plan B diseñado** para si no lo es.
>
> **Sabemos si Fullcarga se puede descargar automáticamente:** es una aplicación
> Java con sesión por cookie, sin captcha ni CSRF visibles en el login, detrás
> de Akamai, que no bloquea clientes HTTP comunes en sus páginas públicas.
> **Viable en principio; necesita accesos para confirmarlo.** Y hay una vía
> comercial —«Host to Host»— que sería más sólida que cualquier automatización.
>
> **Y tenemos un MVP diseñado alrededor de reducir trabajo operativo**, no de
> agregar funcionalidades: el MVP 2, empezando por el parser, que es la pieza
> que no depende de ningún acceso que no tengamos.
>
> Primero simplificar el trabajo. Después construir.

---

*Sin cambios en código, esquema, migraciones, tests ni funcionalidades. Los
únicos archivos agregados son este documento y `NORD_SCOPE_REDEFINITION.md`.*
