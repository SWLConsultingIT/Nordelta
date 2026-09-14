# NORD · Redefinición de alcance y análisis de brecha

> **Nota de nombre.** Este documento es de una etapa anterior y usa «NORD»
> como nombre del producto y como abreviatura del cliente. El nombre visible
> pasó a ser **Pagos Nordelta**; el contenido se conserva tal cual porque
> documenta decisiones tomadas en ese momento.

> **Fase de análisis. No se modificó código, ni esquema, ni migraciones, y no
> se implementó ninguna funcionalidad.** Verificable con `git status`.
>
> Fecha: 8 de septiembre de 2026. **Actualizado el 9 de septiembre** con las
> respuestas confirmadas por NORD (marcadas ✅ RESPONDIDA) y con el research
> técnico de Fullcarga.
>
> **Documento hermano: `NORD_MATI_WORKFLOW_AUTOMATION.md`** — baja al proceso
> concreto de Mati, al research de Fullcarga y al MVP de automatización.
> Este documento sigue siendo el del alcance; aquel es el del flujo.
>
> Insumos: auditoría del código corriendo (`npm test`, `build`, `tsc`, `eslint`,
> y la aplicación abierta en el navegador), las cuatro migraciones, los diez
> documentos de `docs/`, y el flujo operativo relevado con el cliente.

---

## 1. Executive Summary

Nordelta encargó y ya tiene construido un **libro mayor multi-moneda de cuentas
corrientes**: movimientos con partidas, saldos corridos, cierres automáticos,
balance, ajustes y auditoría. Está sano — 273 tests pasan, el build compila, el
núcleo financiero está verificado contra el sistema de producción y hay tres
bugs del sistema viejo que ya son estructuralmente imposibles de reproducir.

Después de las nuevas reuniones apareció un flujo diario que **no estaba
contemplado**: recepción de archivos de clientes, envío a Móvil/Fullcarga,
acreditación y conciliación, con 300 a 600 transferencias por día. Hoy lo
resuelve una persona —Mati— con Excel, colores como estados y matching manual
por CUIT.

**El hallazgo central de este análisis no es que falte un módulo. Es que
descubrimos la mitad de arriba del negocio.** Lo que construimos registra el
*impacto financiero* de los hechos. Lo que apareció es el *hecho operativo* que
los produce. Hoy el sistema empieza a mirar el negocio recién cuando alguien ya
decidió a mano qué cargar; todo el trabajo de decidirlo —que es donde está el
error, la demora y el riesgo— pasa afuera.

> **Actualización del 9-sep.** NORD confirmó cuatro de las preguntas
> bloqueantes, y **la más importante confirmó la hipótesis central de este
> análisis**: una transferencia individual no genera un asiento. La cadena es
> planilla → todas sus transferencias acreditadas → **total de la planilla** →
> cuenta corriente. El puente es uno-a-muchos, y la unidad contable es **la
> planilla**. Ver sección 15.

**Recomendación: Modelo C, la plataforma operativa integral, entregada en el
orden de módulos del Modelo B.** No porque sea la opción ambiciosa, sino porque
es la única en la que el maestro de clientes, la plata y la trazabilidad viven
una sola vez. Las otras dos obligan a sincronizar dos sistemas que hablan de los
mismos clientes y la misma plata, que es exactamente la falla del sistema de
Sheets + BigQuery que vinimos a reemplazar.

**Lo que ya existe se aprovecha casi entero: 75–85 % del código actual sobrevive,
y prácticamente nada se tira.** El núcleo financiero, el sistema de diseño, la
grilla, el exportador y —esto es lo importante— el **canal de conciliación del
importador legacy**, que ya implementa `parse → validate → transform → reconcile
→ classify` con la regla de que ninguna fila puede desaparecer en silencio. Ese
canal se escribió para conciliar el sistema viejo contra el nuevo, y es la misma
forma que necesita conciliar lo enviado contra lo acreditado.

La advertencia honesta: ese 75–85 % es del **código que existe hoy**, que
representa cerca de la mitad del producto final. No estamos casi terminados.
Estamos bien parados.

---

## 2. Qué producto construimos originalmente

### Alcance original

```
MOVIMIENTOS → PARTIDAS → CUENTAS CORRIENTES → SALDOS
           → CIERRES → BALANCE → AJUSTES → AUDITORÍA
```

Con carga keyboard-first, pegado desde Excel, cuatro monedas (ARS/USD/EUR/BRL),
exportaciones y trazabilidad.

### Estado real, verificado corriendo la aplicación

| Compuerta | Resultado |
|---|---|
| `npm test` | **273 pasan, 0 fallan**, 54 salteados (los de Supabase, que necesitan instancia) |
| `npm run build` | **compila**, 11 rutas |
| `npx tsc --noEmit` | **limpio** |
| `npx eslint src --max-warnings=0` | **limpio** |
| Rutas respondiendo | las 9 en 200, verificadas con `curl` y con capturas |

**9.197 líneas** de TypeScript y SQL.

### Rutas y módulos

| Ruta | Qué es | Estado |
|---|---|---|
| `/` | Landing pública, sin ningún dato de cliente a propósito | Completa |
| `/login` | Ingreso. **Supabase Auth realmente cableado** | Completa |
| `/inicio` | Home operativo: neto del día por moneda, actividad reciente, requiere atención | Completa |
| `/carga` | Grilla editable, una fila por partida, pegado desde Excel | Completa |
| `/cuentas` | Contrapartes con saldo por moneda, buscador, filtros | Completa |
| `/cuentas/[id]` | Cuenta corriente con saldo corrido y cierres | Completa |
| `/balance` | Balance general por contraparte y moneda | Completa |
| `/ajustes` | Calcula el ajuste que lleva la cuenta a cero | Completa |
| `/auditoria` | Registro de cambios campo por campo, con antes y después | Completa |
| `/api/export` | CSV de balance, cuenta corriente y caja diaria | Completo |

### Capas

```
src/lib/domain/       Reglas financieras. Verificadas contra el SQL de producción.
src/lib/data/         Punto único de acceso a datos.
src/lib/migracion/    Importador legacy: parse→validate→transform→reconcile→classify.
src/lib/auditoria/    Cálculo de diferencias entre versiones de una entidad.
src/lib/observabilidad/  Registro estructurado con lista de campos prohibidos.
src/lib/supabase/     Clientes de navegador y servidor.
src/components/ui/    ~20 primitivos sobre tokens de diseño.
src/components/grid/  CargaGrid: AG Grid Community + pegado TSV a mano.
supabase/migrations/  Esquema, vistas, RLS y operaciones atómicas.
```

### Qué es productivo y qué es demostración — la distinción crítica

Esto **no coincide** con lo que dice el README, y es el hallazgo más importante
de la auditoría técnica:

| Pieza | Realidad verificada en el código |
|---|---|
| Núcleo financiero (`domain/`) | **Productivo.** Verificado contra PostgreSQL 18 real vía PGlite, 33 casos de paridad |
| Migraciones | **Escritas y probadas en PGlite. Nunca aplicadas** a un Supabase real |
| Auth | **Productivo**: `src/lib/auth/` y `src/proxy.ts` usan Supabase de verdad |
| **Capa de datos** | **Demostración, entera.** `src/lib/data/index.ts` habla **solo** con `almacen` (memoria). **No existe ninguna rama que lea o escriba en Supabase** |
| Dataset | Sintético determinístico: 36 contrapartes, 312 movimientos, 391 partidas |
| Grilla | Productiva en su lógica; persiste contra el almacén en memoria |
| Importador | Productivo y probado (34 casos), pero **solo CLI**, sin pantalla |

> **Consecuencia para este análisis:** `usaSupabase` y `esDemo` existen y hoy
> solo gobiernan el botón de restablecer la demo. Los comentarios del archivo
> describen lo que *haría* contra Supabase («invoca `crear_movimientos_lote`»);
> el código no lo hace todavía. **La persistencia real está 100 % por
> construir, para el módulo actual y para cualquier módulo nuevo.**
>
> Esto no es una crítica al trabajo hecho —la costura está en un solo archivo,
> que era el objetivo— pero cambia la conversación de alcance: el costo de
> conectar Supabase se paga **una vez**, y conviene pagarlo con el modelo de
> datos definitivo ya decidido, no dos veces.

### Reglas financieras codificadas y verificadas

- Impacta la cuenta corriente: ingresos, pagos a proveedores, full pagos y
  ajustes. Compras, ventas e impuestos no (`ALLOWED_SECTIONS`).
- La comisión se aplica **antes** de dividir por el tipo de cambio, y solo a
  las patas de transferencia.
- Dos tipos de cambio independientes por movimiento; cada partida resuelve su
  moneda de impacto por separado.
- Cierre de cuenta: las cuatro monedas en cero simultáneamente, redondeadas a
  dos decimales, con la posición anterior distinta de cero.
- Orden canónico determinístico: `fecha → ajustes al final → orden → id`.
- Sin lógica de signo: los egresos se cargan en negativo.

---

## 3. El nuevo proceso descubierto

### Cómo funciona hoy

```
Cliente envía Excel (Gmail o WhatsApp)
  → Mati copia a su Excel operativo
  → normaliza a mano: fechas, importes, espacios, guiones del CUIT
  → revisa números de depósito, define transferencia o depósito
  → adapta al formato de Móvil / Fullcarga
  → envía las operaciones
  → ESPERA, normalmente hasta el día siguiente
  → Fullcarga → Consultas → Informe de Ingresos y Créditos → descarga Excel
  → borra columnas, organiza por cliente, rastrea por CUIT
  → matching manual
  → calcula enviado / acreditado / pendiente
```

**Volumen: 300 a 600 transferencias diarias.**

### Escala relativa — un dato que cambia decisiones de diseño

El libro mayor actual maneja del orden de **50.000 movimientos al año**. El
flujo nuevo, a 400 operaciones diarias hábiles, son unas **100.000 operaciones
al año**: el módulo operativo nace siendo **el doble de grande que todo el
sistema financiero**.

Volviendo sobre esto en la sección 14: es la razón principal por la que una
acreditación **no puede** ser simplemente un movimiento más del libro mayor.

### Los problemas, ordenados por lo que cuestan

| Problema | Qué provoca |
|---|---|
| **Matching manual por CUIT** | Es el cuello de botella. Todo lo demás se acomoda alrededor |
| **Normalización a mano** | Guiones, espacios, formatos de fecha, CUIT mal escritos |
| **Doble carga** | El mismo dato se tipea al menos dos veces: al Excel operativo y al formato de Móvil |
| **Espera de un día** | La acreditación llega al día siguiente; hasta entonces no se sabe qué se acreditó |
| **Colores como estados** | Un estado que no se puede filtrar, ni contar, ni auditar, y que se pierde al copiar |
| **Recepción por dos canales** | Gmail y WhatsApp: no hay una bandeja única ni constancia de qué llegó |
| **Backups por email** | El respaldo es mandarse el archivo a uno mismo |
| **Sumas manuales por cliente** | Enviado, acreditado y pendiente se recalculan a mano cada vez |
| **Importes repetidos** | Dos transferencias iguales del mismo cliente son indistinguibles sin otra clave |

### Las preguntas que el sistema tiene que poder contestar

De la reunión, textuales: cuánto envió cada cliente, cuánto se acreditó, cuánto
sigue pendiente, qué transferencias tienen error, qué CUIT está mal, qué
operaciones no tienen match, qué necesita atención, y a quién todavía hay que
pagar.

**Las nueve son preguntas de estado sobre un conjunto de operaciones.** Ninguna
es una pregunta de saldo contable. Eso, por sí solo, dice que estamos ante una
entidad distinta del movimiento — no una variante de él.

---

## 4. Por qué esto cambia el alcance

No cambia porque haya más pantallas. Cambia por cuatro razones estructurales:

**1. Cambia dónde empieza el sistema.** Hoy el producto arranca cuando alguien
carga un movimiento en la grilla. El proceso real arranca dos pasos antes: un
archivo que llega. Todo el trabajo de convertir ese archivo en algo cargable
—que es donde están el error, la demora y el riesgo— pasa hoy fuera del
sistema.

**2. Aparece un usuario nuevo con otra jornada.** El operador de caja carga
movimientos del día. Mati procesa lotes, espera un día, y concilia. Distinto
ritmo, distintas pantallas, distintos permisos.

**3. Aparece un tipo de dato que el modelo actual no tiene:** algo que está
*pendiente*. Un movimiento es un hecho consumado; una operación enviada y no
acreditada es una promesa. El libro mayor no sabe representar promesas, y no
debería: es su virtud.

**4. Aparecen contrapartes con identidad fiscal.** El CUIT deja de ser un dato
de color y pasa a ser la clave de matching. Hoy el maestro de contrapartes es
solo un nombre normalizado.

### Una hipótesis que apareció en el research y vale confirmar

⚠️ **HIPÓTESIS, no un hallazgo.** El research técnico del 9-sep encontró que
Fullcarga comercializa un servicio de cobranzas llamado **«Fullpago»**. La hoja
diaria del sistema legacy tiene una de sus tres secciones que impactan la
cuenta corriente llamada **«Full Pagos»**, y otra columna llamada **«Pago
Fácil»** —también una red de cobranzas—.

Si «Full Pagos» resultara ser *«operaciones liquidadas a través de Fullcarga»*,
entonces **la decisión D2 —qué es un full pago, abierta desde agosto y
bloqueante del esquema— tendría respuesta**, y además quedaría demostrado que
el módulo operativo nuevo y el libro mayor viejo **ya estaban conectados**: la
misma plata, contada en dos sistemas que no se hablan.

**No lo afirmamos.** La coincidencia de nombres es sugestiva y nada más. Pero
es una pregunta de una sola frase para Lucho o para Mati, y si la respuesta es
sí, cierra una bloqueante y refuerza el Modelo C.

---

## 5. Modelos A, B y C

### Modelo A — Dos productos separados

Una automatización de acreditaciones y conciliación, y aparte el sistema
financiero.

**A favor.** Se entrega antes, aislado. Falla independiente. Se le puede vender
a otro cliente. Cada uno evoluciona a su ritmo, y el ritmo real es distinto.

**En contra.** El maestro de clientes queda duplicado, y con él el problema de
identidad que ya nos costó caro: hoy «Bonomi» y «bonomi» rompen el balance, y
la unicidad sobre `nombre_norm` fue la solución. Dos bases significa dos
verdades sobre quién es un cliente. La pregunta *«a quién todavía hay que
pagar»* necesita el saldo de la cuenta corriente **y** lo pendiente de
acreditar: en el Modelo A ninguna de las dos aplicaciones la puede contestar
sola. Se duplican login, permisos, auditoría, sistema de diseño y capa de
datos. Y Mati termina con dos pestañas y un Excel al medio, que es exactamente
donde está hoy.

**Duplicación estimada:** auth, RLS, perfiles, maestro de contrapartes, sistema
de diseño, capa de datos, exportador, observabilidad. Entre un cuarto y un
tercio del esfuerzo, pagado dos veces y mantenido dos veces.

### Modelo B — Un producto, dos módulos grandes

```
NORD
├── OPERACIÓN   Acreditaciones · Conciliación · Importaciones
└── FINANZAS    Movimientos · Cuentas corrientes · Balance · Ajustes · Auditoría
```

**A favor.** Un login, un maestro, un sistema de diseño, una auditoría. Los dos
módulos comparten `contrapartes`, que es el 90 % del valor de estar juntos. El
riel lateral **ya tiene esta forma**: hoy agrupa «Operación», «Consultas» y
«Control», con Carga sola en Operación. La casa ya está construida para esto.

**En contra.** Nada estructural — pero se queda corto en una cosa: dos módulos
que conviven no dicen **qué relación** hay entre una acreditación conciliada y
un movimiento. Y esa relación es justamente la pregunta que el negocio necesita
que el sistema tenga contestada. Si la dejamos sin definir, la reconstruye una
persona en Excel, que es el problema original con otro nombre.

### Modelo C — Plataforma operativa integral

```
Archivo del cliente → Validación → Envío → Acreditación → Conciliación
                                                              ↓
        Auditoría ← Balance ← Cuenta corriente ← Movimiento financiero
```

**A favor.** Es lo que el negocio realmente hace. Nordelta es una financiera que
recibe pedidos, los ejecuta contra un tercero, verifica que se cumplieron y
recién ahí los asienta. El modelo refleja esa cadena, y cada eslabón queda
trazable hasta el archivo y la fila que lo originaron —capacidad que el
esquema ya practica en `movimientos.origen`, con `source_file`, `source_sheet`
y `source_row`.

Además responde sola la pregunta que ninguna otra puede: *a quién hay que
pagar* = saldo de la cuenta corriente **menos** lo pendiente de acreditar.

**En contra.** Es el de mayor alcance y el que más se puede sobre-diseñar. El
riesgo real y concreto: **acoplar la conciliación al asiento contable antes de
saber cuál es la regla del asiento**, e inventar una regla financiera. Ese
riesgo se administra con un límite explícito, que está en la sección 6.

---

## 6. Recomendación

### La recomendación

> **Modelo C: NORD es una plataforma operativa integral, con la cadena
> completa como modelo conceptual desde el día uno — construida y entregada en
> el orden de módulos del Modelo B, y con el puente entre Operación y Finanzas
> explícito, visible y al principio accionado por una persona.**

No es el Modelo B con otro nombre. La diferencia es dónde se decide la
relación: en el Modelo B, la relación entre una acreditación y un movimiento
queda sin definir y la resuelve alguien en una planilla. En el Modelo C es una
entidad del sistema —con nombre, estado y auditoría— y lo único que se pospone
es **cuánta intervención humana necesita para dispararse**.

### Por qué

**1. El maestro de clientes es uno solo, y ya nos costó caro.** El bug de
producción que rompe el balance general hoy es que «Bonomi» y «bonomi» son dos
clientes. La solución fue una columna generada con restricción de unicidad. Dos
bases con dos maestros reintroduce ese bug a escala de sistema.

**2. Las preguntas del negocio cruzan el límite.** *«¿A quién todavía hay que
pagar?»* es saldo de cuenta corriente **menos** pendiente de acreditar. Un
modelo que no puede contestarla sin exportar a Excel no resolvió el problema:
lo mudó.

**3. Ya tenemos construido el motor de conciliación.** `src/lib/migracion/`
implementa `parse → validate → transform → reconcile → classify` con cinco
estados de clasificación y el invariante de que **ninguna fila puede
desaparecer en silencio** — la suma de los estados tiene que dar el total del
archivo, y hay un test que lo exige. Se escribió para conciliar el sistema
viejo contra el nuevo. Es exactamente la forma de conciliar lo enviado contra
lo acreditado. Esto no es una analogía cómoda: es el mismo canal con otro
origen de datos.

**4. La persistencia real está por construir de todos modos.** Como la capa de
datos no tiene implementación de Supabase, el costo de conectar la base se paga
una sola vez. Pagarlo con el modelo definitivo decidido es notoriamente más
barato que pagarlo ahora y otra vez en tres meses.

**5. El sistema viejo falló por estar partido.** Sheets, Apps Script, BigQuery y
n8n fallan en las costuras: el semáforo que falla en abierto, la carrera de 30
segundos, los permisos que hay que dar a mano cada mes. Elegir el Modelo A es
elegir volver a tener costuras.

### Qué riesgo tiene

| Riesgo | Gravedad | Cómo se contiene |
|---|---|---|
| **Inventar la regla del asiento contable** | **Alto** | El puente se diseña, no se automatiza. Hasta que NORD conteste P1, una conciliación **no genera** ningún movimiento sola |
| Que el módulo operativo inunde el libro mayor | Alto | 100.000 operaciones al año no pueden ser 100.000 movimientos. Ver sección 14 |
| Sobre-diseño por adelantado | Medio | El MVP de la sección 17 excluye explícitamente lo que no está validado |
| Diferir de nuevo la conexión a Supabase | Medio | Es prerrequisito del MVP, no trabajo paralelo |
| Que el volumen cambie el perfil de rendimiento | Bajo | 100k filas/año es trivial para Postgres. Importa para la UI: listas de 600 filas necesitan paginación del lado del servidor |
| Que Mati quede sin sistema durante la transición | Medio | Su Excel sigue siendo el oficial hasta que la conciliación cierre igual varios días seguidos |

### Qué depende de validación con NORD

La recomendación de plataforma integral **no depende** de ninguna respuesta
pendiente: se sostiene por el maestro único de clientes y por las preguntas que
cruzan el límite.

Lo que sí depende de validación es **el grado de automatización del puente**
(sección 15) y **el nivel de agregación del asiento** (sección 14). Las dos son
preguntas BLOCKER de la sección 18, y las dos están aisladas: no bloquean el
resto del diseño.

---

## 7. Gap Analysis

Clasificación: **KEEP** · **KEEP + REDESIGN** · **EXTEND** · **NEW** ·
**REMOVE** · **TO VALIDATE**

| Área | Clasificación | Fundamento |
|---|---|---|
| **Landing** | KEEP | Pública, sin datos de cliente. Habrá que sumarle el mensaje operativo cuando el alcance esté cerrado |
| **Login** | KEEP | Supabase Auth cableado de verdad. Es de lo poco no-demo que hay |
| **Home** | **KEEP + REDESIGN** | La estructura sirve (neto del día, actividad, requiere atención) pero hoy contesta preguntas financieras. La jornada empieza en la operación. Sección 12 |
| **Carga** | KEEP | La carga manual no desaparece: caja diaria, compras, ventas e impuestos siguen entrando así |
| **Movimientos** | KEEP | El modelo movimiento + partidas es correcto y está verificado |
| **Contrapartes** | **EXTEND** | Faltan CUIT, email y alias. Es la extensión más importante del esquema |
| **Cuentas** | KEEP | Sirve tal cual |
| **Cuenta corriente** | **EXTEND** | Sumar el origen operativo de un movimiento: de qué acreditaciones salió |
| **Balance** | KEEP | Sin cambios |
| **Ajustes** | KEEP | Sin cambios |
| **Auditoría** | **EXTEND** | Es agnóstica de entidad por diseño: cubre las entidades nuevas sin tocar la tabla. Falta que la pantalla las muestre |
| **Importación de archivos** | **NEW** (con base fuerte) | El canal existe y está probado; falta pantalla, otro formato de origen y persistencia del archivo |
| **Acreditaciones** | **NEW** | Sección 13 |
| **Conciliación** | **NEW** (con base fuerte) | `conciliarFila()`, `Diferencia` y `MotivoDiferencia` ya existen. Sección 14 |
| **Clientes** | **EXTEND** | Mismo maestro, con identidad fiscal y de contacto |
| **CUIT** | **NEW** | No existe en ningún lado salvo un `text` libre en `partida_cheque`. Sin normalizar ni validar |
| **Estados operativos** | **NEW** | El sistema no tiene noción de «pendiente». Un movimiento es un hecho consumado |
| **Matching** | **NEW** + **TO VALIDATE** | El mecanismo se puede construir; **los campos de matching los define NORD** |
| **Archivos** | **NEW** | No hay almacenamiento de archivos. Supabase Storage sería la opción natural |
| **Email ingestion** | **NEW** + **TO VALIDATE** | Sección 20: no construir todavía |
| **Backups** | KEEP | Backup diario del plan Pro. Reemplaza mandarse el archivo por mail. Falta probar una restauración |
| **Fullcarga / Móvil** | **NEW** + **TO VALIDATE** | Sin accesos ni documentación. Por ahora: importar y exportar archivos, nunca integración directa |
| **Data layer** | **EXTEND** | Punto único correcto, pero **sin implementación de Supabase**. Se construye una vez, para los dos módulos |
| **Modelo de datos** | **EXTEND** | Nada se reemplaza. Se suma un dominio operativo aguas arriba. Sección 11 |

**Nada quedó clasificado como REMOVE.** Es el resultado más relevante del
análisis: el alcance se amplía, no se corrige.

---

## 8. Qué reutilizamos

Clasificación: **REUSE AS-IS** · **REUSE + EXTEND** · **REUSE + UI REDESIGN** ·
**REFACTOR LATER** · **REPLACE**

| Pieza | Clasificación | Detalle |
|---|---|---|
| **Lógica financiera** (`dinero`, `fx`) | **REUSE AS-IS** | Redondeo con semántica de `numeric`, conversión con comisión antes de dividir. Verificado contra PostgreSQL real. No se toca |
| **Movimientos + partidas** | **REUSE AS-IS** | El modelo resiste el alcance nuevo sin cambios |
| **Saldos y cierres** (`saldos.ts`) | **REUSE AS-IS** | Orden canónico determinístico, acumulación a precisión completa |
| **Contrapartes** (`contrapartes.ts`) | **REUSE + EXTEND** | `normalizarNombre()` queda igual. Se le suma normalización de CUIT al lado, misma forma: normalizar sin destruir el original |
| **Auditoría** | **REUSE AS-IS** | Agnóstica de entidad por diseño (`entidad`, `entidad_id`). Cubre acreditaciones y conciliaciones sin migración |
| **Data layer** | **REUSE + EXTEND** | El patrón es correcto y la regla de acceso único se cumple (verificado por grep). Se extiende con el dominio operativo y con la implementación real de Supabase |
| **Grilla** (`CargaGrid`) | **REUSE + EXTEND** | Es el activo de UI más valioso: pegado TSV a mano, errores por celda, deshacer de 50 pasos, totales por moneda, impacto fijado a la derecha. La revisión de un lote importado es la misma interacción con otras columnas |
| **Parser** (`parseo.ts`) | **REUSE + EXTEND** | `interpretarFecha`, `separarBloquePegado` y los sinónimos sirven igual. Se suman los del dominio nuevo |
| **Normalización / importador** (`migracion/`) | **REUSE + EXTEND** | **El activo más subestimado.** `parse→validate→transform→reconcile→classify`, cinco estados, «ninguna fila desaparece en silencio», `conciliarFila()`, `Diferencia`, `MotivoDiferencia` y reportes. El motor de conciliación ya está escrito y probado; le falta otro origen de datos |
| **Fixtures** | **REUSE + EXTEND** | 36 contrapartes y 312 movimientos determinísticos. Hay que sumar un lote de acreditaciones sintéticas con errores plantados a propósito |
| **Exports** | **REUSE + EXTEND** | Punto y coma y BOM UTF-8 para Excel argentino, generado del lado del servidor. La misma pieza genera el archivo para Móvil |
| **UI shell** | **REUSE AS-IS** | Tokens, escala tipográfica, ~20 primitivos, riel con secciones. El riel **ya** separa Operación de Consultas y Control |
| **Home** | **REUSE + UI REDESIGN** | Los componentes se quedan (`TiraDeSaldos`, «Requiere atención»); cambia qué preguntas contesta |
| **Cuentas** | **REUSE AS-IS**, y sirve de plantilla | Fila por entidad, columnas por moneda, estado, buscador, filtros con conteo: es casi literalmente la vista «por cliente: enviado / acreditado / pendiente» |
| **Balance** | **REUSE AS-IS** | Sin cambios |
| **Observabilidad** | **REUSE + EXTEND** | Registro con campos prohibidos. **Hay que sumar `cuit` a la lista de prohibidos**: es dato fiscal identificatorio |
| **Migraciones existentes** | **REUSE AS-IS** | Nada se revierte. Se agregan migraciones nuevas |
| **Almacén en memoria** | **REFACTOR LATER** | Sirvió y sirve para demostrar. Cuando Supabase esté conectado queda solo para demo y tests |

**REPLACE: ninguna pieza.**

### Cuánto sobrevive

Sobre 9.197 líneas, por peso de archivo:

| Clasificación | Aproximado |
|---|---|
| REUSE AS-IS | 55–65 % |
| REUSE + EXTEND | 20–25 % |
| REUSE + UI REDESIGN | ~8 % |
| REFACTOR LATER | ~8 % |
| REPLACE | ~0 % |

> **75–85 % del código actual es reutilizable**, y prácticamente nada se tira.
>
> **La salvedad que hay que decir en voz alta:** eso es porcentaje del código
> *que existe*, no del producto *final*. Contra el alcance completo del Modelo C,
> lo construido es del orden del **40–55 %**. Y de eso, la persistencia real
> todavía no está hecha en ninguna parte.

---

## 9. Qué falta

Ordenado por lo que bloquea a lo demás.

**Fundaciones (sirven a los dos módulos)**
1. Implementación real de Supabase en la capa de datos. No existe hoy.
2. Migraciones aplicadas a un proyecto real.
3. Almacenamiento de archivos (Supabase Storage), inexistente.
4. Paginación del lado del servidor: 600 filas por día no entran en el patrón actual de traer todo y filtrar en memoria.

**Dominio operativo (todo nuevo)**
5. CUIT como concepto: normalización, validación, búsqueda, similitud.
6. Estados operativos, incluido «pendiente».
7. Entidades de archivo, operación, acreditación y match.
8. Motor de matching con umbrales y sugerencias.
9. Formato del archivo de Móvil, en las dos direcciones.

**Interfaz**
10. Bandeja de importación con revisión previa a confirmar.
11. Pantalla de conciliación con las tres zonas: exactas, posibles, sin match.
12. Vista por cliente: enviado / acreditado / pendiente / error.
13. Home reordenada alrededor de la jornada operativa.

**Del negocio**
14. Las quince decisiones de la sección 18, más las catorce que ya estaban abiertas.

---

## 10. Modelo conceptual

### La cadena que propone el cliente

```
CLIENTE → ARCHIVO RECIBIDO → OPERACIONES SOLICITADAS → VALIDACIÓN
       → ENVÍO A MÓVIL → ACREDITACIONES → CONCILIACIÓN
       → MOVIMIENTO → PARTIDAS → CUENTA CORRIENTE → BALANCE
```

**Sí tiene sentido, y describe el negocio mejor que el modelo actual.** Con una
corrección importante, que es el aporte central de este análisis:

### La cadena no es una tubería de uno a uno

Dibujada en fila, la cadena sugiere que cada operación produce un movimiento.
**Casi con seguridad no es así, y modelarlo así sería un error caro.**

Hoy Mati agrupa por cliente antes de que nada llegue a la cuenta corriente. Un
cliente que manda 80 transferencias en un día no genera 80 asientos: genera una
posición. A 100.000 operaciones anuales, el uno-a-uno haría que el libro mayor
—hoy legible, con 312 movimientos de demostración— pase a ser ilegible, y que
la pregunta «cuál es el saldo de este cliente» tenga que recorrer decenas de
miles de filas de detalle operativo.

La corrección es un eslabón intermedio:

```
CLIENTE
   ↓
ARCHIVO RECIBIDO ──────── (qué llegó, cuándo, por qué canal, quién lo mandó)
   ↓
OPERACIÓN SOLICITADA ──── N por archivo · CUIT, importe, tipo, nº de depósito
   ↓  validación · normalización · detección de error
ENVÍO A MÓVIL ─────────── lote · genera el archivo del formato requerido
   ↓
ACREDITACIÓN ──────────── N desde el informe de Ingresos y Créditos
   ↓
   ├── MATCH ──────────── operación ←→ acreditación, con score y motivo
   ↓
CONCILIACIÓN ──────────── cierre por cliente y período: enviado, acreditado, pendiente
   ↓
   ══════ EL PUENTE ══════   ← una decisión del negocio, no una consecuencia técnica
   ↓
MOVIMIENTO + PARTIDAS ─── el asiento contable, en el nivel de agregación que NORD defina
   ↓
CUENTA CORRIENTE → BALANCE → AUDITORÍA
```

**La conciliación es el eslabón que falta en la cadena del cliente**, y es
justo el que hace que el puente sea uno-a-pocos en vez de uno-a-uno.

### La línea divisoria

Todo lo que está **arriba** del puente responde *«¿qué pasó y en qué estado
está?»*. Todo lo que está **abajo** responde *«¿cuánto debe cada uno?»*.

Son dos preguntas distintas, con dos ciclos de vida distintos: una operación
cambia de estado muchas veces; un asiento contable, una vez asentado, se
corrige con auditoría y motivo. Mezclarlas es lo que obliga hoy a usar colores
en una planilla.

---

## 11. Impacto en el modelo de datos

**No se propone ningún cambio de esquema en esta fase.** Esto es el inventario
de qué se puede representar hoy y qué no.

| Concepto | ¿Hoy? | Detalle |
|---|---|---|
| Cliente | **Sí** | `contrapartes`, con `nombre_norm` único generado |
| Email del cliente | **No** | No existe en el maestro |
| CUIT del cliente | **No** | Solo un `text` libre en `partida_cheque`, sin normalizar ni validar |
| Archivo recibido | **No** | No hay entidad ni almacenamiento |
| Canal de recepción | **No** | Gmail / WhatsApp / carga manual |
| Archivo de origen | **Parcial** | `movimientos.origen` guarda `source_file`, pero como rastro de migración, no como entidad |
| Fila de origen | **Parcial** | Ídem: `source_row` dentro de `origen` |
| CUIT informado (crudo) | **No** | — |
| CUIT normalizado | **No** | El patrón existe para nombres y es directamente trasladable |
| Número de depósito | **No** | — |
| Operación enviada | **No** | — |
| Estado de la operación | **No** | El sistema no tiene noción de «pendiente» |
| Fecha de envío | **No** | — |
| Acreditación | **No** | — |
| Fecha de acreditación | **No** | — |
| Importe acreditado | **No** | — |
| Match | **No** | — |
| Score del match | **No** | — |
| Motivo del match | **Parcial** | Existe `MotivoDiferencia` en la conciliación legacy: mismo patrón, otro dominio |
| Operación pendiente | **No** | — |
| Error | **Parcial** | El importador clasifica errores por fila, pero en memoria, no persistido |
| Conciliación | **No** como entidad | La lógica existe (`conciliarFila`) |
| Movimiento financiero | **Sí** | Completo y verificado |
| **Cuenta propia / caja** | **No** | Ver sección 16. Hay `oficinas` como etiqueta, pero **no hay libro de fondos propios** |

**Resumen: de 23 conceptos, 2 existen completos, 5 parciales y 16 no existen.**
El dominio operativo es territorio nuevo — pero se apoya en patrones que el
esquema ya practica: columna normalizada generada con unicidad, trazabilidad
de origen en `jsonb`, auditoría agnóstica de entidad.

### Qué NO habría que hacer

- **No** meter la acreditación adentro de `partidas` como un `medio_pago` más:
  confunde el hecho con su impacto y hereda restricciones que no le
  corresponden (por ejemplo, que un monto no pueda ser cero).
- **No** poner el CUIT en `contrapartes` sin decidir antes si un cliente puede
  tener varios (P4 de la sección 18).
- **No** tocar `movimientos` ni `partidas`. El dominio nuevo se apoya arriba.

---

## 12. Home

La Home actual **no es un dashboard SaaS genérico** —eso ya se cuidó— pero
contesta preguntas financieras: neto del día por moneda, actividad reciente,
qué requiere atención. Bajo el alcance nuevo, la jornada no empieza ahí.

### Estructura conceptual propuesta

**Franja 1 · La operación de hoy.** Cinco números en una tira: recibidas,
enviadas, acreditadas, pendientes, con error. Cada uno es un filtro, no un
adorno: se hace clic y se llega a la lista. El componente `TiraDeSaldos` ya
tiene esta forma.

**Franja 2 · Lo que necesita a una persona.** El panel «Requiere atención»
actual, con el contenido nuevo: sin match, CUIT inválido, coincidencias
dudosas esperando confirmación, acreditaciones sin operación. **Ordenado por
plata en juego, no por antigüedad.** Es la única zona de la pantalla que pide
acción; todo lo demás informa.

**Franja 3 · Conciliación.** Exactas / posibles / sin match, con el monto de
cada grupo. Un número solo no alcanza: 40 sin match puede ser trivial o el día
entero.

**Franja 4 · Clientes.** Los que tienen pendiente, con enviado / acreditado /
pendiente. Truncada a los primeros, con acceso al listado completo.

**Franja 5 · Finanzas.** Reducida a accesos: cuentas, balance, carga. Sigue
importando, pero deja de ser lo primero.

**Principio.** La Home tiene que contestar *«¿qué hago ahora?»*, no *«cómo va
el negocio?»*. Para lo segundo está el balance. Si Mati abre NORD y no ve en
tres segundos qué necesita su atención, la pantalla falló.

**TO VALIDATE:** si la Home debe ser distinta según el rol. Un operador de caja
y Mati no empiezan el día con la misma pregunta.

---

## 13. Acreditaciones · modelo conceptual

**Entrada.** Un archivo del cliente (Excel, por Gmail o WhatsApp, hoy). Un
informe de Ingresos y Créditos descargado de Fullcarga. Eventualmente, carga
manual de una operación suelta.

**Procesamiento.**
1. Persistir el archivo tal como llegó, antes de tocarlo. Sin esto no hay
   forma de auditar una discusión con el cliente.
2. Detectar el formato y mapear columnas. **TO VALIDATE:** si cada cliente
   manda un formato distinto, hace falta un mapeo por cliente.
3. Normalizar: CUIT sin guiones ni espacios, fechas, importes en formato
   argentino, espacios raros. Todo esto ya existe para otros campos.
4. Validar: CUIT bien formado, importe positivo, fecha razonable, número de
   depósito presente.
5. Clasificar cada fila, con el mismo invariante del importador: **ninguna fila
   desaparece en silencio**, y la suma de los estados da el total del archivo.
6. Identificar el cliente. Por el maestro; y como sugerencia, por el email
   remitente. **Nunca como asignación automática.**

**Estados.** Preliminares, **TO VALIDATE** con NORD:
`recibida → validada → enviada → acreditada`, más `con_error` y `anulada`.

Dos reglas que sí conviene fijar desde el diseño, porque son de correctitud:
- Una operación con error **no puede** pasar a enviada. Fue un requerimiento
  explícito.
- Una operación nunca se borra: se anula, con motivo y con auditoría.

**Acciones del usuario.** Importar. Revisar el lote antes de confirmarlo —en
una grilla, que es lo que ya sabemos hacer bien. Corregir una fila con el
original siempre a la vista. Marcar error. Anular con motivo. Confirmar el
lote. Generar el archivo para Móvil.

**Salida.** Un lote de operaciones válidas, el archivo con el formato de Móvil,
y un reporte de lo que no se pudo procesar y por qué.

**Principio de diseño que hay que sostener:** el sistema **sugiere**, la persona
**decide**. Una corrección automática que se equivoca en un CUIT manda plata a
otro lado. Fue un requerimiento explícito del cliente y conviene tratarlo como
regla del módulo, no como preferencia.

---

## 14. Conciliación · modelo conceptual

**INPUT.** Las operaciones enviadas (lo que dijimos que mandábamos) y las
acreditaciones del informe de Fullcarga (lo que el tercero dice que entró).

**PROCESS.** Emparejar unas con otras y clasificar el resultado en tres zonas:

| Zona | Qué es | Qué se hace |
|---|---|---|
| **Exacta** | Coincide por los campos que NORD defina como identificatorios | Se confirma sola, queda registrada |
| **Posible** | Coincide parcialmente: CUIT parecido, importe igual y fecha distinta, importe cercano | **Se sugiere. Una persona confirma o rechaza** |
| **Sin match** | Enviada sin acreditar, o acreditada sin operación | Requiere atención. Las dos direcciones importan |

**Los campos de matching son una decisión del negocio, no técnica** (P2 de la
sección 18). Los candidatos evidentes son CUIT, importe, fecha y número de
depósito, pero cuál manda y cuánta tolerancia hay lo define NORD. Con 300–600
operaciones diarias, importes repetidos del mismo cliente el mismo día van a
ser comunes: **el importe solo no alcanza como clave**.

**OUTPUT.** Por cliente y período: enviado, acreditado, pendiente, con error.
Y la lista de lo que necesita una decisión humana.

**ACCIONES DEL USUARIO.** Confirmar o rechazar una sugerencia. Emparejar a
mano. Deshacer un match. Marcar una diferencia como aceptada, con motivo.
Cerrar la conciliación de un período. **TO VALIDATE:** qué significa cerrarla y
si se puede reabrir.

### Cómo no duplicar el mismo hecho tres veces

Esta es la parte que más importa hacer bien.

| Entidad | Qué afirma | Identidad | Ciclo de vida |
|---|---|---|---|
| **Operación solicitada** | «El cliente pidió mandar $X al CUIT Y» | Archivo + fila; nº de depósito | Cambia de estado muchas veces |
| **Acreditación** | «Móvil informa que entraron $Z el día W» | El registro del informe de Fullcarga | Prácticamente inmutable: es un dato de un tercero |
| **Match** | «Esta operación y esta acreditación son el mismo hecho» | El par | Se crea, se confirma, se puede deshacer |
| **Conciliación** | «Para este cliente y período, esto es lo enviado, lo acreditado y lo pendiente» | Cliente + período | Se cierra |
| **Movimiento + partidas** | «Esto impacta el saldo de esta contraparte en esta moneda» | Interna | Se asienta; se corrige con auditoría y motivo |

Tres afirmaciones sobre plata, y **no son la misma plata contada tres veces**:
son un pedido, la confirmación de un tercero y un asiento contable. Que
normalmente coincidan en el monto no las hace la misma entidad — de hecho, **el
valor del módulo está justamente en los casos donde no coinciden.**

**La regla que evita la duplicación:**

> **La operación registra el hecho. El movimiento registra el impacto. El monto
> vive en la operación; el movimiento lo referencia, no lo recopia.**

En la práctica: un movimiento generado por conciliación guarda **de qué
conciliación salió**, y esa conciliación sabe qué operaciones cubre. El monto
del asiento es una consecuencia trazable, no un número tipeado de nuevo. Si el
asiento y la suma de sus operaciones difieren, es un error detectable — y
conviene que haya un chequeo que lo detecte.

**Corolario sobre agregación.** ✅ **RESPONDIDA (9-sep).** Que un movimiento
pueda cubrir N operaciones es lo que hace que el libro mayor no se inunde.
**NORD confirmó el nivel de agregación: la planilla.** Una transferencia
individual acreditada no genera un asiento; cuando *todas* las transferencias
de una planilla están acreditadas, el **total de la planilla** pasa a la cuenta
corriente.

Eso convierte a la **planilla** en la unidad contable del puente, y le da una
propiedad valiosa: una planilla es también la unidad natural de conversación
con el cliente —«tu planilla del 8 está acreditada»—, así que el asiento y la
comunicación coinciden. También explica por qué NORD no quiere que se modifique
una planilla ya enviada: es un documento, no un borrador.

---

## 15. Conexión con cuentas corrientes

> ✅ **RESPONDIDA EN PARTE (9-sep).** NORD confirmó **la unidad**: el asiento se
> genera a partir del **total de una planilla completamente acreditada**, no de
> cada transferencia. Sigue abierto **el grado de automatización**: si el
> sistema asienta solo al completarse la planilla, o propone y una persona
> confirma.
>
> La recomendación de abajo **no cambia**: construir la Alternativa 2. Con la
> unidad ya definida, la propuesta de asiento es concreta —el total de la
> planilla, para ese cliente, con la fecha de la última acreditación— y
> automatizarla después es trabajo menor.
>
> Aparece además una pregunta nueva que antes no se veía: **¿qué pasa con una
> planilla que nunca se completa?** Si una sola transferencia no se acredita
> jamás, su total no llega nunca a la cuenta corriente. Es Q4 del documento de
> automatización.

**El resto de esta sección se mantiene como quedó el 8-sep.**

Las dos alternativas:

**Alternativa 1 · La conciliación genera el movimiento automáticamente.**
Al cerrar la conciliación de un cliente, el sistema asienta.
*A favor:* cero doble carga, cero desfasaje, la cadena completa sin
intervención. *En contra:* un error de matching se vuelve un error contable
sin que nadie lo haya mirado. Y hay que definir qué pasa al deshacer un match
sobre una conciliación ya asentada — un asiento no se borra, se reversa.

**Alternativa 2 · La conciliación confirma, y una persona asienta.**
La conciliación deja lista una propuesta de asiento; alguien la revisa y la
confirma.
*A favor:* control humano en el punto exacto donde el error cuesta plata. Es
compatible con cualquier respuesta que NORD dé después. *En contra:* un paso
manual por día y por cliente.

**Alternativa 3 · No genera movimientos en absoluto.** La conciliación es un
proceso operativo y el asiento sigue cargándose por caja diaria como hoy.
*A favor:* acoplamiento cero. *En contra:* la doble carga sigue existiendo, y
la pregunta «a quién hay que pagar» sigue necesitando dos sistemas.

**Qué recomendamos hacer mientras no haya respuesta:** construir la Alternativa
2. No porque sea el punto medio, sino porque es la única que **no cierra
ninguna puerta**: si NORD después dice «automatizalo», automatizar una
propuesta que ya existe y ya se ve en pantalla es trabajo menor. Si hubiéramos
construido la 1 y la respuesta fuera otra, habría que desarmar asientos ya
generados.

**Lo que hay que preguntarle a NORD** (P1 y P5 de la sección 18):
1. Cuando se concilia lo que un cliente mandó, ¿eso ya es un movimiento de su
   cuenta corriente, o es un paso previo que después alguien asienta?
2. ¿El asiento es por operación, por cliente y día, o por conciliación cerrada?
3. Si aparece una diferencia después de asentar, ¿se corrige el asiento o se
   hace uno de ajuste? *(Es la misma pregunta que D8, que ya estaba abierta.)*
4. Lo pendiente de acreditar, ¿es deuda del cliente en su cuenta corriente, o
   es un estado operativo que todavía no llegó a la contabilidad?

**La pregunta 4 es la más importante de las cuatro** y probablemente decide las
otras tres. Si lo pendiente es deuda, la cuenta corriente tiene que mostrarlo y
el puente es contable. Si es solo estado operativo, el puente es informativo y
los dos módulos quedan mucho más sueltos.

---

## 16. Móvil general contra cajas y puntos

### Qué apareció

La plata entra a **una cuenta general de Móvil**, pero se imputa o se retira
desde puntos distintos: Nordelta, Remeros, Puertos y otros. Se quiere poder
comprobar **ingresado/facturado contra retirado, sin agujeros**.

### Por qué es relevante

Porque es **un tipo de cuenta que el sistema no tiene**.

Hoy el modelo lleva cuentas de **terceros**: cuánto le debe cada contraparte a
Nordelta. Lo que esto pide es una cuenta **propia**: cuánta plata hay en la
cuenta de Móvil, cuánta salió por cada punto, y si las dos cosas cierran.

`oficinas` existe, pero es una **etiqueta** sobre el movimiento: dice dónde se
originó, no constituye un saldo. No hay libro de fondos propios, y por lo tanto
la pregunta *«¿cuánto quedó en Móvil?»* **hoy no se puede contestar**, ni en el
sistema nuevo ni en el viejo.

### Dónde encajaría

Como un segundo eje del mismo libro mayor: **cuentas propias** (Móvil general,
caja Nordelta, caja Puertos…) con su propio saldo, donde un movimiento afecta
una cuenta propia además de —o en lugar de— una cuenta de tercero.

Es el patrón contable clásico de partida doble, y el modelo actual está a mitad
de camino: ya tiene partidas por pata monetaria, pero cada partida declara
*qué* moneda y *cuánto*, no *de qué cuenta sale y a cuál entra*.

**Es la única extensión del análisis que tocaría el núcleo del modelo
financiero.** Todo el resto se apoya aguas arriba sin moverlo.

### Qué información falta

- Los puntos o cajas, ¿son las cuatro oficinas o son otra cosa? El indicio de
  que hay «otros» sugiere que no coinciden.
- ¿Qué significa «facturado» acá, y en qué se diferencia de «ingresado»?
- ¿Se mueve plata entre puntos? Si sí, es una transferencia interna, que es
  otra entidad.
- ¿Se necesita el saldo de Móvil en tiempo real, o alcanza con un cierre?

### Si afecta el alcance

**Sí, y bastante — por eso queda explícitamente fuera del MVP.**

Es una tercera pieza, del mismo tamaño conceptual que las otras dos, y es la
única que obliga a extender el núcleo financiero en vez de apoyarse arriba.
Meterla en el MVP significaría rediseñar el modelo de partidas mientras se
construye el módulo operativo: dos cambios estructurales a la vez, cada uno
tapando los errores del otro.

**Recomendación: relevarlo en profundidad, con el detalle con que se relevó
el flujo de acreditaciones, y tratarlo como fase siguiente.** Es una necesidad
real y va a volver.

---

## 17. MVP recomendado

### Las tres opciones

| | Alcance | Valor para Mati | Riesgo |
|---|---|---|---|
| **MVP A** | Solo conciliación | Parcial: le resuelve el matching pero sigue normalizando y armando el archivo a mano | Bajo |
| **MVP B** | Acreditaciones + conciliación | **Alto: le resuelve el día completo** | Medio |
| **MVP C** | + integración con cuenta corriente | Alto, más el cierre de la cadena | **Alto: exige una regla contable que NORD todavía no definió** |

### Recomendación: **MVP B**

**Acreditaciones + conciliación, con el puente a cuenta corriente diseñado en
el modelo pero no automatizado.**

**Por qué B y no A.** El matching es el cuello de botella, pero llegar a él
requiere datos normalizados. Un MVP de solo conciliación obligaría a Mati a
seguir normalizando a mano *y además* a cargar el resultado en otro lado: más
trabajo, no menos. Peor: la calidad del matching depende de la calidad de la
normalización, así que el MVP A se juzgaría a sí mismo con datos sucios.

**Por qué B y no C.** Porque la regla que convierte una conciliación en un
asiento es exactamente la pregunta que NORD no contestó todavía. Construirla
ahora es inventar una regla financiera — que es la línea que este proyecto no
cruzó ni una vez, y que es la razón por la que el núcleo actual es confiable.
Además, la integración es la parte **más barata** de agregar después: es un
puente entre dos orillas que ya existen. Construir el puente primero es
construirlo hacia una orilla no confirmada.

**Qué incluye el MVP B**
1. Importar el archivo del cliente, guardarlo tal como llegó.
2. Normalizar automáticamente, con CUIT como caso central.
3. Detectar CUIT inválido y marcar la fila con error, sin dejarla avanzar.
4. Revisar el lote en una grilla antes de confirmarlo.
5. Generar el archivo para Móvil.
6. Importar el informe de Ingresos y Créditos.
7. Matching automático con las tres zonas: exacta, posible, sin match.
8. Confirmar o rechazar sugerencias, y emparejar a mano.
9. Vista por cliente: enviado / acreditado / pendiente / error.
10. Home reordenada alrededor de la jornada operativa.
11. Auditoría de todo lo anterior — sale casi gratis: la tabla ya es agnóstica.

**Qué queda afuera, a propósito:** la generación automática de movimientos,
Gmail, cajas y puntos, integración directa con Móvil, y el matching avanzado
sin reglas confirmadas.

**Prerrequisito que no se puede saltear.** El MVP B necesita persistencia real,
y hoy no hay ninguna. **Conectar Supabase deja de ser una tarea de
infraestructura y pasa a ser el primer paso del MVP.**

---

## 18. Decisiones pendientes para NORD

Quince preguntas, en lenguaje de negocio.

### BLOCKER — sin esto no se puede diseñar el módulo

**P1. ✅ RESPONDIDA EN PARTE.** ~~Cuando se concilia lo que un cliente mandó,
¿eso ya es un movimiento de su cuenta corriente?~~ **El asiento es por
planilla completamente acreditada, por su total.** Ni por operación ni por día.
**Sigue abierto** si el sistema asienta solo o propone y alguien confirma.

**P2. ✅ RESPONDIDA.** **CUIT + fecha**, con el monto como señal adicional.
NORD confirmó explícitamente que el importe solo no alcanza.
⚠️ **Pero aparece un problema nuevo:** el informe de Fullcarga **no tiene
columna de CUIT**. Ver `NORD_MATI_WORKFLOW_AUTOMATION.md` § 8, que es hoy el
riesgo número uno del proyecto.

**P3. ¿Qué hace hoy Mati cuando una transferencia nunca se acredita?**
¿La reenvía, la anula, la reclama? Define el ciclo de vida de una operación.

**P4. ✅ RESPONDIDA.** **Cliente NORD ≠ CUIT.** Un cliente recibe
transferencias de muchos depositantes distintos, cada uno con su CUIT. El CUIT
**no puede ser una columna** de `contrapartes`: hacen falta tres niveles
—cliente, depositante y CUIT—. Con una consecuencia útil: el vínculo se puede
**aprender del histórico** y sugerir.

### HIGH — afectan una regla o un saldo

**P5. Lo que un cliente mandó y todavía no se acreditó, ¿es deuda suya en la
cuenta corriente, o es un estado operativo que aún no llegó a la
contabilidad?**
Probablemente la pregunta que decide P1.

**P6. ✅ RESPONDIDA.** **Las acreditaciones son siempre totales. No existen
parciales.** Una transferencia está pendiente o acreditada, y nada en el medio.
Simplifica el modelo de forma importante: el estado es binario y no hay saldos
parciales por operación.

**P7. ¿Todos los clientes mandan el archivo en el mismo formato?**
Si cada uno manda el suyo, hace falta un mapeo de columnas por cliente, y eso
es alcance.

**P8. ✅ RESPONDIDA EN PARTE.** Ante un CUIT incorrecto, la operación **se
separa de la planilla válida**, se le informa al cliente, y **el cliente
reenvía en una planilla nueva**. NORD fue explícito: **no se modifican
planillas anteriores.** Eso hace que la planilla enviada sea **inmutable**, y
es una decisión de trazabilidad que el modelo tiene que respetar.
**Sigue abierto** qué pasa con las otras clases de error.

**P9. ¿Qué diferencia una transferencia de un depósito, y cambia en algo lo que
el sistema tiene que hacer?**
Aparece como una decisión en el flujo actual y no sabemos qué la determina.

**P10. Cuando se termina de conciliar un día, ¿queda cerrado?**
¿Puede aparecer una acreditación tardía de un día ya cerrado, y qué se hace?

**P11. ¿Quién más va a usar esto además de Mati, y qué tendría que ver cada
uno?**
Se cruza con D9, que ya estaba abierta.

### MEDIUM — afectan diseño o alcance

**P12. Si un CUIT se parece mucho a uno conocido pero no es igual, ¿qué debería
hacer el sistema?**
Confirmamos que sugerir, nunca corregir. Falta saber qué hace la persona
después.

**P13. ¿Cuánto tiempo hacia atrás hay que poder consultar?**
Define volumen, archivado y qué se migra.

**P14. Los puntos o cajas de Móvil, ¿son las cuatro oficinas o son otra cosa?**
Sección 16.

**P15. ¿Hay algún límite, tope o control que hoy Mati aplique de memoria?**
Monto máximo por operación, clientes con condiciones especiales, algo que se
revise a ojo. Suele ser conocimiento tácito que no aparece en ningún archivo.

> Las catorce decisiones previas de `OPEN_BUSINESS_DECISIONS.md` **siguen
> abiertas** y no las reemplaza ninguna de estas. D1 y D2 siguen bloqueando el
> esquema financiero.

---

## 19. Riesgos

| # | Riesgo | Gravedad | Mitigación |
|---|---|---|---|
| 1 | **Inventar la regla contable del puente** | Alta | El MVP B lo excluye. Se construye la propuesta, no el asiento automático |
| 2 | **Inundar el libro mayor** con 100.000 operaciones anuales | Alta | El puente es uno-a-muchos por diseño. Sección 14 |
| 3 | **Corrección automática de un CUIT equivocado** | Alta | Sugerir, nunca corregir. Requerimiento explícito del cliente, tratado como regla del módulo |
| 4 | **Que el proyecto financiero quede parado** mientras se construye lo operativo | Alta | Conectar Supabase sirve a los dos y va primero |
| 5 | Dependencia de Fullcarga sin accesos ni documentación | Alta | Solo archivos, en las dos direcciones. Ninguna integración directa |
| 6 | El formato del informe de Fullcarga cambia sin aviso | Media | Validar estructura al importar y fallar con un mensaje claro, nunca interpretar de más |
| 7 | Dato fiscal (CUIT) en registros y exportaciones | Media | Sumar `cuit` a la lista de campos prohibidos de observabilidad |
| 8 | Rendimiento de listas de 600 filas | Media | Paginación del lado del servidor desde el principio |
| 9 | Que el alcance crezca hacia cajas y puntos durante el MVP | Media | Está explícitamente fuera. Sección 16 |
| 10 | Que Mati quede sin herramienta durante la transición | Media | Su Excel sigue siendo el oficial hasta que la conciliación cierre igual varios días seguidos |
| 11 | Los tres bloqueantes previos siguen sin resolverse | Alta | Conector de Supabase, export legacy y la hora con Lucho. Ninguno es trabajo nuestro |
| 12 | Que el análisis se lea como «casi terminado» | Media | 75–85 % del código actual se reutiliza, pero es ~40–55 % del producto final |

---

## 20. Qué NO desarrollar todavía

Cada línea tiene su razón, sacada del análisis.

1. **Generación automática de movimientos desde la conciliación.** La regla no
   existe. Construirla es inventarla. *(P1, P5.)*
2. **Matching avanzado** —fuzzy, umbrales, ponderaciones, aprendizaje— antes de
   saber qué campos identifican una operación. Un motor de similitud sobre
   campos equivocados es peor que no tener nada: da confianza falsa. *(P2.)*
3. **Automatización de Gmail.** Ingesta automática, parseo de adjuntos,
   identificación por remitente. El módulo tiene que funcionar con carga manual
   del archivo primero; si el matching no sirve, automatizar la entrada no
   arregla nada.
4. **Cajas y puntos de Móvil.** Es la única extensión que toca el núcleo
   financiero. Necesita su propio relevamiento. *(Sección 16, P14.)*
5. **Integración directa con Móvil o Fullcarga.** Sin accesos, sin
   documentación, sin ambiente de prueba. Archivos en las dos direcciones.
6. ~~**Acreditaciones parciales.**~~ ✅ **RESUELTO (9-sep):** NORD confirmó que
   **no existen**. Las acreditaciones son siempre totales. No hay que
   construirlas, y el modelo de estados se simplifica.
7. **Cualquier cambio de esquema no validado**, incluidos los que este
   documento propone conceptualmente. Nada se aplica hasta que el alcance se
   apruebe.
8. **Estados operativos definitivos.** Los de la sección 13 son preliminares.
   Un enum en Postgres es barato de crear y caro de cambiar con datos adentro.
9. **Mapeo de formatos por cliente**, hasta saber si los formatos difieren.
   *(P7.)*
10. **Cierre y reapertura de períodos de conciliación.** No sabemos qué
    significa cerrar. *(P10.)*
11. **Reportes y analítica sobre lo operativo.** Primero que el dato exista y
    sea confiable.
12. **Aplicación móvil o notificaciones.** No apareció como necesidad.

---

## 21. Próximos pasos

**Ahora, antes de escribir una línea de código**

1. **Revisar este documento con Fran** y decidir el modelo. Todo lo demás
   depende de eso.
2. **Llevarle a NORD las cuatro preguntas BLOCKER.** Se pueden contestar en una
   conversación, y conviene la misma reunión donde estén las de Lucho: las
   catorce decisiones viejas siguen abiertas.
3. **Pedir tres archivos reales, anonimizados:** un Excel de cliente, un
   informe de Ingresos y Créditos, y el Excel operativo de Mati con sus colores
   intactos. **Este es el insumo más valioso de todos.** El Excel de Mati es la
   especificación funcional del módulo, igual que el SQL de BigQuery resultó
   ser la del sistema financiero.
4. **Ver a Mati trabajar un día entero**, con el mismo criterio con que se
   escribió el protocolo de `CARGA_USABILITY_TEST.md`. Lo que hace de memoria no
   va a aparecer en ningún archivo. *(P15.)*

**Cuando el alcance esté aprobado**

5. **Conectar Supabase.** Aplicar las migraciones, correr los 54 tests de
   integración e implementar la capa de datos real. Sirve a los dos módulos y
   es prerrequisito de todo.
6. **Cerrar el modelo de datos operativo** con las respuestas en la mano, y
   recién ahí escribir las migraciones nuevas.
7. **Construir el MVP B** en el orden en que el valor aparece: importar y
   normalizar → revisar y confirmar → generar el archivo de Móvil → importar el
   informe → matching → vista por cliente.
8. **Correrlo en paralelo con el Excel de Mati** hasta que la conciliación dé
   igual varios días seguidos. Mismo criterio que la marcha en paralelo del
   módulo financiero, y por la misma razón.

**Lo que sigue en pie del plan anterior**

Los tres bloqueantes previos no se movieron: autorizar el conector de Supabase,
conseguir el export del histórico legacy, y la hora con Lucho. **Ninguno es
trabajo nuestro, y el primero ahora bloquea las dos mitades del producto.**

---

## Cierre

> **Ahora sabemos qué estamos construyendo:** no una aplicación financiera ni
> una automatización de conciliación, sino **una plataforma operativa donde el
> hecho operativo y su impacto financiero viven en el mismo sistema sin ser la
> misma cosa**.
>
> Y sabemos cómo aprovechar lo hecho: **el 75–85 % del código actual se
> reutiliza y casi nada se tira**, incluido —el hallazgo que más ahorra— el
> motor de conciliación que ya está escrito y probado dentro del importador
> legacy.
>
> Lo que falta para poder empezar son cuatro respuestas del cliente y tres
> archivos reales.

---

*Sin cambios en código, esquema, migraciones ni funcionalidades. Este documento
es el único archivo agregado.*
