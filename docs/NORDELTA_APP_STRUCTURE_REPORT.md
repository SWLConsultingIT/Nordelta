# Nordelta · Propuesta de arquitectura de producto

**Septiembre de 2026 · versión para revisión interna**

Fuente editable del informe. El PDF presentable se genera con
`scripts/armar_informe_estructura.py`.

**Sobre la numeración.** Este documento tiene 33 secciones más dos anexos. El
PDF cubre el mismo contenido en 41 secciones, porque parte las más densas —
acreditaciones, importación, conciliación — en una página por wireframe para
que se puedan leer. El contenido es el mismo; sólo cambia el corte.

> **APP CODE MODIFIED: NO.** Este informe no cambió una línea de la
> aplicación. Lo único que se agregó al repositorio son los dos archivos de
> este informe y su generador — detalle en la sección 33.

---

## Índice

| | Sección |
|---|---|
| 1 | [Executive summary](#1--executive-summary) |
| 2 | [Qué problema estamos resolviendo](#2--qué-problema-estamos-resolviendo) |
| 3 | [Cómo funciona hoy](#3--cómo-funciona-hoy) |
| 4 | [Principales pain points](#4--principales-pain-points) |
| 5 | [Qué existe actualmente en la app](#5--qué-existe-actualmente-en-la-app) |
| 6 | [Qué conservamos](#6--qué-conservamos) |
| 7 | [Qué cambia](#7--qué-cambia) |
| 8 | [Arquitectura de información propuesta](#8--arquitectura-de-información-propuesta) |
| 9 | [Sitemap](#9--sitemap) |
| 10 | [Módulos principales](#10--módulos-principales) |
| 11 | [Home](#11--home) |
| 12 | [Acreditaciones](#12--acreditaciones) |
| 13 | [Importación de archivos](#13--importación-de-archivos) |
| 14 | [Validación de CUIT](#14--validación-de-cuit) |
| 15 | [Conciliación](#15--conciliación) |
| 16 | [Matching](#16--matching) |
| 17 | [Clientes](#17--clientes) |
| 18 | [Cuenta corriente](#18--cuenta-corriente) |
| 19 | [Carga manual](#19--carga-manual) |
| 20 | [Balance](#20--balance) |
| 21 | [Ajustes](#21--ajustes) |
| 22 | [Auditoría](#22--auditoría) |
| 23 | [User flows](#23--user-flows) |
| 24 | [Arquitectura técnica](#24--arquitectura-técnica) |
| 25 | [Infraestructura y hosting](#25--infraestructura-y-hosting) |
| 26 | [Arquitectura de datos](#26--arquitectura-de-datos) |
| 27 | [Integraciones](#27--integraciones) |
| 28 | [Accesos necesarios](#28--accesos-necesarios) |
| 29 | [MVP](#29--mvp) |
| 30 | [Roadmap](#30--roadmap) |
| 31 | [Decisiones pendientes](#31--decisiones-pendientes) |
| 32 | [Riesgos](#32--riesgos) |
| 33 | [Próximos pasos](#33--próximos-pasos) |
| A | [Anexo · Matriz de pantallas](#anexo-a--matriz-de-pantallas) |
| B | [Anexo · Principios de UX y dirección visual](#anexo-b--principios-de-ux-y-dirección-visual) |

---

## 1 · Executive summary

### El hallazgo

La aplicación que existe hoy resuelve **la mitad contable** del negocio:
movimientos, partidas, cuenta corriente multi-moneda, balance, cierres y
auditoría. Está construida, probada y verde.

La última reunión con el cliente reveló que **la mitad operativa —donde se va
el día del operador— no está construida**: entre 300 y 600 transferencias
diarias que hoy se procesan copiando y limpiando Excel a mano, sin ningún
estado explícito y sin conciliación sistemática.

### La consecuencia arquitectónica

No hay que reescribir lo que existe. Hay que **construir la mitad que falta y
coserla a la que ya está**, y las dos mitades se tocan en un único punto:

```
una conciliación confirmada genera el movimiento contable
```

Ese es el seam. Todo lo que está aguas arriba de esa línea es nuevo. Todo lo
que está aguas abajo ya funciona.

| | Mitad operativa · **nueva** | Mitad contable · **existe** |
|---|---|---|
| Naturaleza | pipeline con estados | libro mayor |
| Volumen | 300–600 filas/día | ~15 movimientos/día |
| Pregunta | ¿dónde está trabada la plata? | ¿cuánto nos debe este cliente? |
| Verdad | lo que el banco acreditó | el saldo calculado |
| Unidad | la transferencia | el movimiento con sus partidas |

### Lo que proponemos

1. **Dos módulos nuevos**: Acreditaciones (ingesta y bandeja) y Conciliación
   (enviado contra acreditado), más la ingesta de Excel que los alimenta.
2. **Una arquitectura de información nueva** de cuatro grupos, que reordena
   las pantallas existentes alrededor de las preguntas que el operador hace,
   no alrededor de las tablas de la base.
3. **Una Home que es un centro de operaciones**: el pipeline del día primero,
   la plata después.
4. **Conservar el motor financiero completo** — 863 líneas de dominio, 976 de
   esquema, 273 tests — sin tocarlo.
5. **Vercel + Supabase Pro** como infraestructura, que es lo que el código ya
   supone, con una alternativa evaluada.

### Los tres bloqueantes

No se puede cerrar el esquema de la mitad nueva sin tres respuestas del
cliente. Están en la sección 31, y son:

- **N1** · ¿A qué granularidad una conciliación confirmada impacta la cuenta
  corriente? Una por transferencia, una por lote, o una por cliente y día.
- **N2** · ¿El archivo «Ingresos y créditos» trae algún identificador de
  operación? Sin él, el matching depende de CUIT + importe + fecha.
- **N3** · ¿Nordelta cobra comisión por la transferencia y se registra en la
  cuenta corriente del cliente?

Y siguen abiertos los dos bloqueantes financieros anteriores (**D1** asiento
espejo del proveedor, **D2** qué es un «full pago»).

### Lo que hace falta antes de escribir código

Archivos reales. **Tres a cinco Excel de clientes distintos y tres a cinco
descargas de «Ingresos y créditos»**. Sin esas muestras, cualquier parser y
cualquier regla de matching que diseñemos es una apuesta. Es el primer punto
del checklist de accesos y la primera tarea del roadmap.

---

## 2 · Qué problema estamos resolviendo

Nordelta es una operación financiera argentina con cuatro oficinas —Nordelta,
Corrientes, Puertos y Remeros— cuyo trabajo diario se reparte en dos
actividades distintas.

**La primera es contable.** Registrar lo que cada contraparte debe o le deben,
en cuatro monedas, con conversiones y comisiones, y poder cerrar una cuenta.
Eso hoy vive en Google Sheets con Apps Script, BigQuery y n8n, y es lo que la
aplicación actual ya reemplaza.

**La segunda es operativa, y es la que consume el día.** Un cliente manda un
Excel con transferencias a hacer. Alguien lo limpia, lo normaliza, corrige
CUIT, arma el archivo, lo carga en un sistema externo, espera, descarga los
créditos, y después rastrea a mano qué se acreditó y qué no. Entre 300 y 600
transferencias por día, con colores y filtros como único sistema de estado.

El problema real no es que las planillas sean lentas. Es que **el estado de la
operación no existe como dato**: vive en el color de una celda, en un filtro
que alguien dejó puesto, y en la memoria del operador. De ahí se derivan casi
todos los síntomas: no se puede responder «cuánto falta acreditar de este
cliente» sin recalcular a mano, no se puede saber quién cambió qué, y no se
puede repartir el trabajo entre dos personas sin pisarse.

La aplicación tiene que hacer dos cosas al mismo tiempo, y las dos son
condición de adopción:

- **Mantener la velocidad de Excel.** Los usuarios son rápidos con teclado.
  Un ERP lleno de formularios modales es más lento que lo que tienen y no se
  adopta.
- **Agregar lo que Excel no puede dar**: estado explícito, trazabilidad,
  validación antes de procesar, consistencia entre oficinas e información en
  tiempo real.

---

## 3 · Cómo funciona hoy

### La cadena contable · lo que la app ya reemplaza

```
62 hojas diarias por archivo
    ↓  Apps Script «consolidado», a botón, manual
2 hojas de consolidado por archivo
    ↓  vinculación a BigQuery, hoja por hoja, permiso a mano
4 tablas externas por mes en BigQuery
    ↓  4 queries en cadena, orquestadas por n8n desde un webhook
Consolidado.Cheques-Transacciones  →  Balance.balance_final
    ↓
Sheet «Cuentas Corrientes»  ──┐
    └── un botón acá dispara el webhook que arranca todo ←┘
```

Nadie consume BigQuery para análisis. Su único consumidor vivo es el Sheet
que la aplicación reemplaza: no es un warehouse, es un motor de consolidación.

### La cadena de acreditaciones · lo que falta construir

```
CLIENTE
   ↓ manda Excel
GMAIL  ·  ocasionalmente WHATSAPP
   ↓
operador copia la información
   ↓
normaliza el Excel  ·  corrige formatos  ·  limpia CUIT  ·  corrige errores
   ↓
prepara el archivo
   ↓
carga en el SISTEMA EXTERNO
   ↓
se procesan las transferencias
   ↓  (más tarde)
descarga «Ingresos y créditos»
   ↓
limpia el Excel otra vez
   ↓
rastrea operaciones  ·  hace matching  ·  separa por cliente
   ↓
calcula enviado  ·  calcula acreditado  ·  calcula pendiente
```

De los quince pasos, **once son manuales**. Y el resultado —enviado,
acreditado, pendiente por cliente— se recalcula desde cero cada vez que
alguien pregunta.

---

## 4 · Principales pain points

| | Pain point | Por qué duele | Qué lo resuelve |
|---|---|---|---|
| **A** | **Volumen**: 300–600 transferencias/día | Cualquier paso manual se multiplica por 600 | Ingesta con validación y preview editable |
| **B** | **CUIT erróneo**: con guiones, mal formateado, con dígitos cambiados | Una transferencia a un CUIT inexistente se rechaza o —peor— va a otro | Normalización + dígito verificador + «posible coincidencia» |
| **C** | **Importes repetidos** | No se puede asumir `importe = transferencia`: dos operaciones legítimas comparten monto | Matching por tupla de señales, nunca por importe solo |
| **D** | **Acreditación no inmediata** | Lo enviado y lo acreditado son dos universos que se cruzan más tarde | Dos ejes de estado separados: proceso y acreditación |
| **E** | **Acreditaciones parciales o progresivas** | El total enviado de un cliente difiere del acreditado en un momento dado | Totales por cliente: enviado / acreditado / pendiente, en vivo |
| **F** | **Canales dispersos**: Gmail, WhatsApp, Excel, Drive | No hay una bandeja única; algo se puede perder y nadie se entera | Una bandeja de acreditaciones con el archivo origen guardado |
| **G** | **Tracking manual** con colores, filtros, marcas y sumas | El estado no es un dato: no se puede consultar, ni auditar, ni repartir | Estados explícitos y persistidos |

El pain point **G** es el que ordena todo el diseño. El resto son
consecuencias suyas.

### Y los defectos del sistema contable actual

Están documentados en `LEGACY_BUGS.md` y siguen vigentes en producción. Dos
de ellos **pierden plata**: una operación que mezcla efectivo y transferencia,
y una que mezcla dólares con pesos convertidos. Se pueden cuantificar en pesos
exactos apenas tengamos un export del histórico.

---

## 5 · Qué existe actualmente en la app

Auditado sobre el código, no sobre documentación previa. Estado al 7 de
septiembre de 2026.

### Compuertas de calidad

| Compuerta | Resultado |
|---|---|
| `npm test` | **273 pasan**, 54 salteados (Supabase, requieren instancia), 13 archivos |
| `npx tsc --noEmit` | limpio |
| `npx eslint src --max-warnings=0` | limpio |
| `npm run build` | compila · 11 rutas |

### Rutas reales

```
/                    portada
/login               ingreso (modo demostración sin contraseña)
/inicio              resumen del día
/carga               grilla de carga diaria
/cuentas             listado de contrapartes con saldo
/cuentas/[id]        libro de cuenta corriente + panel de detalle
/balance             totales por moneda
/ajustes             ajuste de cuenta a cero
/auditoria           registro de cambios
/api/export          CSV de cuenta o balance
```

### Volumen de código por área

| Área | Líneas | Archivos | Qué es |
|---|---|---|---|
| `src/app` | 3026 | 24 | rutas, pantallas y Server Actions |
| `tests` | 3146 | 20 | 273 tests, incluida paridad contra PostgreSQL 18 real |
| `src/components` | 1815 | 7 | sistema de diseño, grilla, riel, vistas de portada |
| `supabase/migrations` | 976 | 4 | esquema, vistas, RLS, operaciones atómicas |
| `src/lib/data` | 932 | 3 | capa de acceso + almacén de demostración |
| `src/lib/migracion` | 910 | 4 | importador del histórico con garantía de cero pérdida |
| `src/lib/domain` | 863 | 7 | motor financiero: dinero, tipo de cambio, saldos, parseo |
| `src/lib/observabilidad` | 219 | 2 | medición sin registrar secretos ni importes |
| `src/lib/supabase` | 36 | 2 | clientes de navegador y servidor |

### El motor financiero, en concreto

- **Modelo movimiento + partidas.** Un movimiento tiene N partidas, una por
  pata monetaria. Reemplaza la fila ancha de dieciséis columnas del legacy,
  donde el medio de pago estaba codificado en cuál columna llenabas.
- **Cuatro monedas** —ARS, USD, EUR, BRL— que nunca se suman entre sí.
- **Redondeo idéntico a Postgres.** `redondear()` replica el
  medio-lejos-de-cero de `round(numeric)`, con épsilon relativo acotado, y hay
  tests de paridad contra PostgreSQL 18 corriendo en WASM.
- **Conversión y comisión** en el mismo orden que la columna generada de la
  base: la comisión se aplica **antes** de dividir por el tipo de cambio.
- **Orden canónico del saldo corrido**: fecha → ajuste de cierre al final →
  orden → id. Resuelve el bug 4 del legacy, donde el cierre podía variar
  entre corridas.
- **Seguridad por fila** en las cuatro vistas, con `security_invoker = true`.
  Sin eso, una vista se salta el RLS.
- **Auditoría genérica** por triggers sobre movimientos, partidas y
  contrapartes, con valor anterior, valor nuevo y motivo.

### Lo que existe y todavía no se probó

- Los **54 tests de Supabase** están escritos y nunca corrieron: necesitan una
  instancia real. Están `READY TO TEST`, no `TESTED`.
- El **modo demostración** usa un almacén en memoria con dataset sintético
  determinístico. Ejercita los mismos caminos de código que la versión con
  base, pero no aplica RLS ni valida invariantes: esas garantías son de
  Postgres.

---

## 6 · Qué conservamos

La respuesta corta: **el motor financiero completo y el sistema de diseño
completo.** Lo que se rediseña es la capa de navegación y la Home.

### Matriz de reutilización

| Área | Estado | Acción | Por qué |
|---|---|---|---|
| `lib/domain/dinero.ts` · `fx.ts` · `saldos.ts` | **REUSE AS-IS** | ninguna | Verificado contra PostgreSQL real. Tocarlo es riesgo puro. |
| `lib/domain/parseo.ts` · `contrapartes.ts` | **REUSE AS-IS** | ninguna | La interpretación de categorías y la normalización de nombres sirven igual para la ingesta de Excel. |
| `lib/format.ts` (`parseMonto`) | **REUSE AS-IS** | ninguna | Acepta `1.234,56`, `(1.500)`, `$ 1.500`. Es exactamente lo que necesita la ingesta. |
| `supabase/migrations/0001-0004` | **KEEP + ADD** | 4 migraciones nuevas | El esquema contable no se toca. La mitad operativa se agrega al lado. |
| `lib/migracion/importador.ts` | **REUSE + GENERALIZE** | extraer el contrato | Ya tiene un modelo de cinco estados que garantiza cero pérdida silenciosa. Es el contrato que la ingesta de Excel necesita. |
| `components/ui/*` | **REUSE AS-IS** | ninguna | Sistema consolidado hace una semana: tokens, siete niveles de tipografía, 21 componentes. |
| `components/grid/CargaGrid.tsx` | **REFACTOR** | extraer `GrillaEditable` | El preview de la importación **es** una grilla editable con errores por celda, pegado y deshacer. Reutilizar el shell es la mejor palanca del proyecto. |
| `components/shell/Rail.tsx` | **REUSE + EXTEND** | agregar grupos y contadores | Ya soporta grupos. Faltan los ítems nuevos y los badges de pendientes. |
| `lib/data/index.ts` | **REFACTOR** | partir por módulo | Hoy es un módulo plano para un dominio. Pasa a `data/contabilidad`, `data/acreditaciones`, `data/conciliacion`. Mismo patrón, más archivos. |
| `lib/data/memoria.ts` · `dataset.ts` | **REUSE + EXTEND** | sumar el dataset operativo | Para poder demostrar los módulos nuevos sin datos reales. |
| `lib/observabilidad/*` | **REUSE AS-IS** | ninguna | Nunca registra importes, saldos, nombres ni tokens. |
| `lib/auth/*` · `proxy.ts` | **REUSE AS-IS** | sumar rutas nuevas al matcher | La frontera de seguridad es RLS + `exigirSesion()`, no el proxy. |
| `app/(app)/cuentas` · `cuentas/[id]` | **REUSE + EXTEND** | pestañas operativas | El libro funciona. Se le suma el resumen enviado/acreditado/pendiente. |
| `app/(app)/balance` | **REUSE AS-IS** | ninguna | Cumple su función. |
| `app/(app)/carga` | **REUSE AS-IS** | ninguna | Es el activo de velocidad del producto. No se toca. |
| `app/(app)/auditoria` | **REUSE + EXTEND** | entidades nuevas | El diff por campo ya está y está testeado. Solo hay que registrar las entidades nuevas. |
| `app/(app)/ajustes` | **EXISTE — FUSIONAR** | mover al cliente | Es una acción sobre una cuenta, no una sección. Ya existe el enlace profundo `?cuenta=<id>`. |
| `app/(app)/inicio` | **EXISTE — REDISEÑAR** | centro de operaciones | Hoy responde «qué pasó hoy» en lo contable. Falta el pipeline operativo. |
| `app/page.tsx` (portada) | **REUSE + AJUSTAR** | sumar la capacidad nueva | Se reconstruyó hace una semana. Solo falta que cuente la conciliación. |
| `api/export` | **REUSE + EXTEND** | export de transferencias | Mismo formato: `;` + BOM UTF-8, formato argentino. |
| `tests/*` (273) | **KEEP** | ninguna | Ni un test de dominio se reescribe. Se agregan los de los módulos nuevos. |

### Lo que se descarta

Nada. **Ninguna pieza del trabajo existente se tira.** Lo más agresivo que
propone este informe es mover Ajustes de la navegación a la pantalla del
cliente, y rediseñar la Home.

---

## 7 · Qué cambia

| | Hoy | Propuesta |
|---|---|---|
| **Portada** | Hero con el producto real, tres pilares, vista de carga, cierre | Igual, sumando la capacidad de conciliación al relato |
| **Ingreso** | Dos paneles, modo demostración sin contraseña | Igual, más selector de oficina al entrar (**TO VALIDATE**) |
| **Home** | Neto del día por moneda, actividad reciente, requiere atención, accesos | **Centro de operaciones**: pipeline del día, conciliación, estado por cliente, y después la plata |
| **Navegación** | Inicio · Carga · Cuentas · Balance · Ajustes · Auditoría | Cuatro grupos: Operación · Cuentas · Control · Configuración. Ajustes sale del riel |
| **Carga** | Grilla AG Grid, pegado desde Excel, impacto en vivo | Sin cambios. Convive con la ingesta de archivos bajo el grupo Operación |
| **Acreditaciones** | **no existe** | **Módulo nuevo**: bandeja de lo que los clientes mandaron, con estados |
| **Conciliación** | **no existe** | **Módulo nuevo**: enviado contra acreditado, con matching asistido |
| **Importación** | Solo el importador del histórico legacy, por línea de comandos | **Pantalla nueva**: subir Excel, validar, previsualizar, corregir, confirmar |
| **Cuentas** | Listado con saldo por moneda y estado | Igual, más filtro cliente/proveedor y columna de pendiente de acreditación |
| **Cuenta corriente** | Tira de saldos, libro con saldo corrido, corte de cierre, panel de partidas | Igual, dentro de una pantalla de cliente con pestañas: Resumen · Cuenta corriente · Transferencias · Errores |
| **Balance** | Totales por moneda + tabla + export | Sin cambios |
| **Ajustes** | Pantalla propia con selector de contraparte | Acción dentro del cliente. Misma lectura vertical actual → ajuste → resultante |
| **Auditoría** | Filtros, tabla, panel con solo los campos que cambiaron | Igual, sumando lotes, transferencias y decisiones de conciliación |
| **Configuración** | **no existe** | **Pantalla nueva**: oficinas, usuarios y roles, mapeo de columnas por cliente, tolerancias de matching |

---

## 8 · Arquitectura de información propuesta

### El criterio

La estructura se organiza alrededor de **las preguntas que alguien hace**, no
alrededor de las tablas de la base. Cada pantalla responde una pregunta y se
llama como la pregunta.

| Pregunta | Pantalla |
|---|---|
| ¿Qué pasó hoy? ¿Dónde está trabado el trabajo? | Inicio |
| ¿Qué me mandaron los clientes y qué está listo para enviar? | Acreditaciones |
| ¿Qué envié y qué se acreditó? | Conciliación |
| ¿Cómo cargo lo que no vino en un archivo? | Carga |
| ¿Cuánto nos debe cada uno? | Cuentas |
| ¿Qué pasó con este cliente? | Cliente |
| ¿Cuánto hay en total, por moneda? | Balance |
| ¿Quién cambió qué? | Auditoría |

### Cuatro decisiones de estructura, con su razón

**1 · Acreditaciones y Conciliación son dos pantallas, no una.**
Comparten datos pero responden preguntas distintas, en momentos distintos del
día: a la mañana se recibe y se envía, a la tarde se concilia. Fusionarlas
obligaría a un selector de modo, que es exactamente el «filtro que alguien
dejó puesto» que estamos tratando de eliminar. Van cruzadas por enlaces
profundos en las dos direcciones.

**2 · Importar no es una sección: es una acción de Acreditaciones.**
Vive en `/acreditaciones/importar` como un flujo de pasos. Nadie entra a la
aplicación a «usar el importador»; entra a procesar lo que le mandó un
cliente.

**3 · Cliente y cuenta corriente son una sola pantalla con pestañas.**
Hoy `/cuentas/[id]` ya es el libro de la cuenta. La operación —transferencias
enviadas, acreditadas, pendientes, con error— es información **del mismo
cliente**, y separarla en dos pantallas obligaría al operador a saltar entre
ellas para responder «¿le debemos o le falta acreditar?». Se integra como
pestañas sobre una cabecera común con los cuatro números.
La alternativa —una pantalla operativa y otra contable— se descarta porque
duplica la búsqueda y la cabecera.

**4 · Ajustes sale de la navegación.**
Un ajuste es una acción sobre **una** cuenta. Tenerlo como ítem de menú
obliga a elegir la contraparte de nuevo, cuando lo natural es llegar desde su
libro. El enlace profundo ya existe.

**5 · «Clientes» y «Contrapartes» son la misma tabla.**
En el modelo, una contraparte puede ser cliente, proveedor o los dos —el
esquema ya tiene `es_cliente` y `es_proveedor`. Crear dos entradas de
navegación para la misma tabla es cómo empiezan los duplicados. Una sola
pantalla, **Cuentas**, con filtro por tipo.

### Grupos del riel

```
(sin grupo)     Inicio
OPERACIÓN       Acreditaciones · Conciliación · Carga
CUENTAS         Cuentas · Balance
CONTROL         Auditoría · Configuración
```

Los ítems de Operación llevan contador de pendientes en el riel: es la única
forma de que el operador sepa que hay trabajo sin entrar a mirar.

---

## 9 · Sitemap

```
/                                   Portada · pública
│
└── /login                          Ingreso
    │
    └── APP · requiere sesión
        │
        ├── /inicio                 Centro de operaciones
        │
        ├── OPERACIÓN
        │   ├── /acreditaciones                 Bandeja
        │   │   ├── /importar                   Ingesta de Excel · pasos
        │   │   ├── /lote/[id]                  Un archivo recibido
        │   │   └── /[id]                       Una transferencia · panel
        │   │
        │   ├── /conciliacion                   Enviado vs acreditado
        │   │   ├── /importar                   Ingesta de «Ingresos y créditos»
        │   │   └── /[id]                       Un caso a resolver
        │   │
        │   └── /carga                          Grilla diaria · existe
        │
        ├── CUENTAS
        │   ├── /cuentas                        Listado · existe
        │   │   └── /[id]                       Cliente
        │   │       ├── ?tab=resumen            Enviado · acreditado · pendiente
        │   │       ├── ?tab=cuenta             Cuenta corriente · existe
        │   │       ├── ?tab=transferencias     Historial operativo
        │   │       ├── ?tab=errores            CUIT y validaciones
        │   │       └── /ajustar                Ajuste a cero · existe, se muda
        │   │
        │   └── /balance                        Balance general · existe
        │
        ├── CONTROL
        │   ├── /auditoria                      Registro de cambios · existe
        │   └── /configuracion
        │       ├── /oficinas
        │       ├── /usuarios                   Roles y alcance
        │       ├── /clientes-archivos          Mapeo de columnas por cliente
        │       └── /conciliacion               Tolerancias de matching
        │
        └── /api/export                         CSV · existe, se extiende
```

Rutas que **existen hoy**: `/`, `/login`, `/inicio`, `/carga`, `/cuentas`,
`/cuentas/[id]`, `/balance`, `/ajustes`, `/auditoria`, `/api/export`.
Todo lo demás es nuevo.

---

## 10 · Módulos principales

```
┌─────────────────────── MITAD OPERATIVA · NUEVA ───────────────────────┐
│                                                                       │
│   INGESTA          ACREDITACIONES          CONCILIACIÓN               │
│   ───────          ──────────────          ────────────               │
│   archivo →        bandeja con             enviado contra             │
│   normalizado →    estados →               acreditado →               │
│   validado         exportable              decisión humana            │
│                                                                       │
└───────────────────────────────┬───────────────────────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │      LA COSTURA       │
                    │                       │
                    │  una conciliación     │
                    │  confirmada genera    │
                    │  el movimiento        │
                    │  contable             │
                    └───────────┬───────────┘
                                │
┌───────────────────────────────▼───────────────────────────────────────┐
│                    MITAD CONTABLE · EXISTE                            │
│                                                                       │
│   CARGA MANUAL     CUENTA CORRIENTE        BALANCE                    │
│   ────────────     ────────────────        ───────                    │
│   movimiento +     saldo corrido por       totales por                │
│   partidas         moneda · cierres        moneda                     │
│                                                                       │
└───────────────────────────────┬───────────────────────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │       AUDITORÍA       │
                    │  atraviesa las dos    │
                    │  mitades              │
                    └───────────────────────┘
```

### Los siete módulos

| Módulo | Responsabilidad | Estado |
|---|---|---|
| **Ingesta** | Leer un archivo, normalizarlo, validarlo y no perder nada en silencio | NUEVO |
| **Acreditaciones** | Ser la bandeja única de lo que los clientes mandaron, con estado explícito | NUEVO |
| **Conciliación** | Comparar enviado contra acreditado y registrar la decisión con su evidencia | NUEVO |
| **Carga manual** | Registrar movimientos que no vienen de un archivo, a velocidad de Excel | EXISTE |
| **Cuentas** | Saldo por contraparte y por moneda, libro y cierres | EXISTE |
| **Balance** | Totales por moneda, sin mezclar | EXISTE |
| **Auditoría** | Quién, qué, cuándo, valor anterior y nuevo — en las dos mitades | EXISTE, se extiende |

### Por qué la costura es una sola línea

Porque si cada transferencia fuera un movimiento contable, la cuenta corriente
de un cliente activo tendría **600 filas por día** y sería ilegible. La
conciliación agrega: N transferencias confirmadas producen **un** movimiento
con sus partidas.

A qué nivel se agrupa —por transferencia, por lote, o por cliente y día— es la
decisión **N1**, y es bloqueante. Hasta que se responda, el módulo de
conciliación se construye dejando la decisión en un solo punto del código.

---

## 11 · Home

### Qué tiene que responder

En orden de urgencia: **¿dónde está trabado el trabajo?** después **¿qué
necesita mi decisión?** después **¿a quién afecta?** y al final **¿cuánta
plata se movió?**

Eso descarta la Home de cuatro tarjetas y un gráfico: las tarjetas no dicen
dónde está el trabajo, y un gráfico de barras no se acciona.

### Composición propuesta

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Hoy                                     Nordelta ▾   7 sep   usuario ▾    │
│ lunes 7 de septiembre de 2026 · 418 transferencias · ● saldos al día      │
├───────────────────────────────────────────────────────────────────────────┤
│ PIPELINE DEL DÍA                                                          │
│                                                                           │
│  Recibidas → Validadas → Listas → Enviadas → Acreditadas → Pendientes     │
│     418         392        392       341         259           82         │
│  $ 84,2 M     $ 79,1 M   $ 79,1 M  $ 68,4 M    $ 51,9 M      $ 16,5 M     │
│                    ↘ 26 con error                                         │
│                                                                           │
│  [cada etapa es un enlace a la bandeja ya filtrada]                       │
├─────────────────────────────────────────┬─────────────────────────────────┤
│ CONCILIACIÓN                            │ REQUIERE ATENCIÓN               │
│                                         │                                 │
│  247  match exacto        confirmados   │  26  CUIT inválido              │
│   12  posible match     → decidir       │   9  CUIT desconocido           │
│   82  sin match           pendientes    │   4  importe fuera de rango     │
│                                         │   2  archivo sin cliente        │
│  [ Conciliar 12 ]  ← acción primaria    │  1 lote sin enviar de ayer      │
├─────────────────────────────────────────┴─────────────────────────────────┤
│ ESTADO POR CLIENTE                                    ordenado por        │
│                                                       pendiente ↓         │
│  Cliente          Enviado    Acreditado   Pendiente   Err   Estado        │
│  ──────────────────────────────────────────────────────────────────────    │
│  Cliente A       $ 24,0 M     $ 12,4 M    $ 11,6 M     3   ● parcial      │
│  Cliente B       $ 18,2 M     $ 18,2 M          —      —   ● completo     │
│  Cliente C        $ 9,4 M      $ 4,5 M     $ 4,9 M    12   ● con errores  │
│  ...                                                                      │
├─────────────────────────────────────────┬─────────────────────────────────┤
│ NETO DEL DÍA POR MONEDA                 │ ACTIVIDAD RECIENTE              │
│  ARS       USD       EUR       BRL      │  10:42 conciliación confirmada  │
│  +6,45 M   +18.286   +3.400    +2.600   │  10:31 lote importado · 218     │
│  (existe hoy, se conserva)              │  09:58 movimiento cargado       │
└─────────────────────────────────────────┴─────────────────────────────────┘
```

### Las decisiones de diseño

- **El pipeline es una tira, no seis tarjetas.** Las seis cifras son etapas
  de un mismo flujo; dibujarlas como una tira muestra dónde se acumula el
  trabajo, que es justo la pregunta. Seis tarjetas sueltas no lo muestran.
- **Cada número es un enlace** a la bandeja filtrada. Un número que no se
  puede accionar no merece estar en la Home.
- **Conciliación tiene la acción primaria de la pantalla.** Es lo único que
  requiere decisión humana.
- **La plata va abajo.** No porque no importe, sino porque el saldo está
  siempre disponible en Cuentas y en Balance, y el trabajo trabado no.
- **Sin gráficos.** No hay ninguna pregunta de esta lista que un gráfico
  responda mejor que una cifra con su etiqueta.

---

## 12 · Acreditaciones

### Qué es

La bandeja única de todo lo que los clientes mandaron. Reemplaza «el Excel que
está en la carpeta» y «el mail que quedó sin leer».

### Dos ejes de estado, no uno

La lista de estados de la conversación inicial —Recibida, Pendiente de
revisión, Con error, Lista para enviar, Enviada, Acreditada, Pendiente— mezcla
dos cosas distintas en un solo enum, y eso se rompe rápido: **una
transferencia puede estar «enviada» y «pendiente de acreditación» al mismo
tiempo.**

La propuesta separa los ejes:

**Eje 1 · Estado de proceso** — dónde está la transferencia en el camino
hacia el sistema externo.

```
recibida ──→ validada ──→ lista ──→ enviada
    │            │
    └────────────┴──→ con_error ──→ (corregida) ──→ validada
                          │
                          └──→ descartada   ← requiere motivo
```

**Eje 2 · Estado de acreditación** — sólo aplica desde `enviada`.

```
pendiente ──→ acreditada
    │
    └──→ rechazada   ← el sistema externo la devolvió
```

Y el **total por cliente** es la suma: enviado, acreditado, pendiente. La
parcialidad vive ahí, a nivel agregado.

> **TO VALIDATE** · Si una transferencia individual puede acreditarse
> parcialmente, el eje 2 necesita un monto acreditado además del estado.
> La lectura de la reunión es que la parcialidad es agregada, no por
> transferencia (decisión **N4**).

> **TO VALIDATE** · Las etiquetas exactas y si hace falta un paso de
> aprobación antes de `lista → enviada` (decisión **N6**).

### Los datos de una transferencia

| Campo | Origen | Nota |
|---|---|---|
| Cliente | del lote, o de una columna del archivo | debe resolver a una contraparte |
| Archivo origen | el lote | el archivo original queda guardado |
| Fecha | del lote o del archivo | |
| CUIT | del archivo | se guarda el original **y** el normalizado |
| Titular | del archivo | para el contraste con el CUIT |
| Importe | del archivo | parseado con el formato argentino |
| Moneda | del archivo o por defecto | **TO VALIDATE** N9: ¿siempre ARS? |
| Banco / CBU | del archivo | señal de matching |
| Referencia externa | del sistema externo, si la da | **N2**, bloqueante |
| Estado de proceso | del sistema | eje 1 |
| Estado de acreditación | de la conciliación | eje 2 |
| Errores | de la validación | lista, no un booleano |
| Observaciones | del operador | texto libre |

### La pantalla

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Acreditaciones                                    [ Importar archivo ]    │
│ 418 transferencias · 26 con error · 82 pendientes de acreditar            │
├───────────────────────────────────────────────────────────────────────────┤
│ [buscar CUIT, titular, importe]   Todas 418 │ Con error 26 │ Listas 392   │
│                                   Enviadas 341 │ Pendientes 82            │
│ Cliente ▾   Lote ▾   Fecha ▾   Banco ▾                    [ Exportar ]    │
├───────────────────────────────────────────────────────────────────────────┤
│  ☐  CUIT           Titular            Importe   Banco    Proc.   Acred.   │
│ ─────────────────────────────────────────────────────────────────────────  │
│  ☐  20-12345678-9  Nombre del titular  $ 240.000  Galicia  enviada ● pend │
│  ☐  27-98765432-1  Otro titular         $ 85.500  Nación   enviada ● acred│
│  ☐  30-1234567-8   Titular tercero     $ 120.000  —        ● error  —     │
│      └─ CUIT inválido · el dígito verificador no cierra                   │
│  ☐  ...                                                                   │
├───────────────────────────────────────────────────────────────────────────┤
│ 418 filas · 26 con error          Seleccionadas: 0    ARS $ 84.213.500,00 │
└───────────────────────────────────────────────────────────────────────────┘
```

- **Paginación por servidor desde el día uno.** 600 filas por día son 15.000
  por mes; una tabla sin paginar no sobrevive el segundo mes.
- **El error se muestra en la fila**, debajo, no en un ícono con tooltip. El
  operador tiene que poder barrer la lista y ver qué está mal sin hacer clic.
- **La selección múltiple existe** porque las acciones son de lote: marcar
  como enviadas, exportar, descartar con motivo.
- **`Exportar`** genera el archivo normalizado para el sistema externo. Este
  botón, solo, elimina el paso más caro del flujo actual.

---

## 13 · Importación de archivos

### El flujo

```
1  ELEGIR ARCHIVO          .xlsx / .xls / .csv        arrastrar o buscar
        ↓
2  IDENTIFICAR CLIENTE     sugerido por el nombre del archivo o
                           el mapeo guardado; confirmable a mano
        ↓
3  MAPEAR COLUMNAS         se aplica el mapeo guardado de ese cliente.
                           Si es la primera vez, se mapea una vez y queda.
        ↓
4  NORMALIZAR              CUIT sin guiones · importe en formato argentino ·
                           fecha · banco · titular
        ↓
5  VALIDAR                 columnas faltantes · CUIT · importes ·
                           duplicados dentro del archivo · duplicados
                           contra lo ya recibido (por hash del archivo)
        ↓
6  PREVIEW EDITABLE        grilla con el valor original y el normalizado,
                           errores marcados por celda, contador por tipo
        ↓
7  EL OPERADOR CORRIGE     en la misma grilla, con teclado
        ↓
8  CONFIRMAR               entra a la bandeja. El archivo original se guarda.
```

### La pantalla del preview

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Importar archivo                                        Paso 3 de 3       │
│ transferencias-septiembre.xlsx · Cliente A · 218 filas                    │
├───────────────────────────────────────────────────────────────────────────┤
│  ●  192 listas      ●  22 con error      ○  4 duplicadas                  │
│                                                                           │
│  Todas 218 │ Con error 22 │ Duplicadas 4          [ Solo errores ]        │
├───────────────────────────────────────────────────────────────────────────┤
│  #   CUIT (original)   CUIT           Titular       Importe      Estado   │
│ ─────────────────────────────────────────────────────────────────────────  │
│  1   20-12345678-9     20123456789    Titular A     $ 240.000    ● lista  │
│  2   27.98765432.1     27987654321    Titular B      $ 85.500    ● lista  │
│  3   30-1234567-8      ⚠ 3012345678   Titular C     $ 120.000    ● error  │
│      └─ tiene 10 dígitos, faltan 1 · el verificador no cierra             │
│  4   20-11111111-2     20111111112    Titular D   ⚠ "cien mil"   ● error  │
│      └─ no se pudo leer como número                                       │
│  5   23-45678901-4     23456789014    Titular E     $ 310.000  ○ duplicada│
│      └─ igual a la fila 89 de este archivo                                │
├───────────────────────────────────────────────────────────────────────────┤
│  Se van a importar 192 de 218.   22 con error y 4 duplicadas quedan       │
│  registradas y visibles: ninguna fila se descarta en silencio.            │
│                                                                           │
│  [ Confirmar 192 ]   [ Importar todas y revisar después ]   [ Cancelar ]  │
└───────────────────────────────────────────────────────────────────────────┘
```

### Las tres reglas de la ingesta

1. **Se guarda el original y el normalizado.** Siempre las dos columnas. Si
   más adelante hay una discusión sobre qué mandó el cliente, la respuesta
   está en la base.
2. **Ninguna fila se descarta en silencio.** Es el mismo contrato de cinco
   estados que ya implementa `lib/migracion/importador.ts` para el histórico
   legacy, y es el activo que se reutiliza acá.
3. **El archivo original se archiva.** En Storage, referenciado por el lote,
   con su hash para no procesar dos veces lo mismo.

### Mapeo de columnas por cliente

> **TO VALIDATE** (decisión **N11**) · Si cada cliente manda su propio
> formato de Excel, hace falta un mapeo por cliente. El diseño lo asume
> porque es robusto en los dos escenarios: si todos mandan el mismo formato,
> hay un solo mapeo por defecto y nadie lo nota.

El mapeo se aprende la primera vez y queda guardado en Configuración. Si un
archivo llega con columnas que no coinciden, el paso 3 lo señala en lugar de
adivinar.

---

## 14 · Validación de CUIT

El CUIT argentino tiene once dígitos y **el último es un verificador módulo
11**. Eso permite detectar la mayoría de los errores de tipeo de forma
determinística, sin consultar nada y sin inventar ninguna regla de negocio.

### Los cinco resultados

| Resultado | Qué significa | Qué hace el sistema |
|---|---|---|
| **Exacto** | Once dígitos, verificador correcto, y ya conocido para este cliente | Sigue sin marca |
| **Normalizado** | Venía con guiones, puntos o espacios; limpio es válido | Sigue, guardando el original |
| **Inválido** | No tiene once dígitos, o el verificador no cierra | **Bloquea**: no se envía así |
| **Desconocido** | Es válido pero no lo vimos antes para este cliente | Advierte, no bloquea |
| **Similar** | Inválido, y a uno o dos dígitos de un CUIT conocido de ese cliente | **Sugiere** una corrección. Nunca la aplica sola |

### La regla que no se cruza

```
Un CUIT sospechoso genera «posible coincidencia».
Nunca un match confirmado.
```

Corregir un CUIT solo, aunque el sistema esté casi seguro, significa mandar
plata a otra persona. La sugerencia se muestra con las dos versiones al lado
y la corrección la aplica una persona.

> **TO VALIDATE** (decisión **N7**) · Cuando el CUIT está mal, ¿lo corrige
> Nordelta o hay que pedirle el archivo de nuevo al cliente? Cambia si la
> corrección en el preview es suficiente o si hace falta un estado
> «devuelto al cliente».

---

## 15 · Conciliación

### Qué es

Comparar **lo que enviamos** contra **lo que el banco acreditó**, y dejar
registrada la decisión con la evidencia que la sostiene.

Es el módulo más valioso del proyecto y el más delicado: una conciliación mal
confirmada mueve un saldo que después nadie sabe de dónde salió.

### Los cuatro resultados

| Resultado | Criterio | Quién decide |
|---|---|---|
| **MATCH EXACTO** | La tupla identifica **una sola** transferencia sin ambigüedad | El sistema, y queda auditado |
| **POSIBLE MATCH** | Coincide en parte, o coincide con más de una | **La persona** |
| **SIN MATCH** | No hay candidato | Queda pendiente y visible |
| **ERROR** | La acreditación no se puede interpretar | Va a revisión |

### La pantalla

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Conciliación                                     [ Importar créditos ]    │
│ 341 enviadas · 259 acreditadas · 12 a decidir · 82 sin match · 7 error    │
├───────────────────────────────────────────────────────────────────────────┤
│  A decidir 12 │ Sin match 82 │ Confirmadas 247 │ Con error 7              │
│  Cliente ▾   Fecha ▾   Banco ▾   Importe ▾                                │
├───────────────────────────────────────────────────────────────────────────┤
│  Caso 1 de 12                                                             │
│                                                                           │
│  ┌─────────────────────────────┬─────────────────────────────┐            │
│  │ ENVIADA                     │ ACREDITACIÓN                │            │
│  │                             │                             │            │
│  │ Cliente A                   │ —                           │            │
│  │ CUIT   20-12345678-9        │ CUIT   20-12345678-0   ⚠    │            │
│  │ Monto  $ 240.000,00     ✓   │ Monto  $ 240.000,00    ✓    │            │
│  │ Fecha  05/09/2026       ✓   │ Fecha  05/09/2026      ✓    │            │
│  │ Banco  Galicia          ✓   │ Banco  Galicia         ✓    │            │
│  │ Titular  Titular A      ✓   │ Titular  TITULAR A     ✓    │            │
│  └─────────────────────────────┴─────────────────────────────┘            │
│                                                                           │
│         POSIBLE MATCH · 4 de 5 señales · difiere 1 dígito de CUIT         │
│         ⚠ hay otra transferencia con el mismo monto y fecha               │
│                                                                           │
│  [ Confirmar ]  [ Rechazar ]  [ Buscar otra coincidencia ]  [ Pendiente ] │
│                                                                           │
│  Al confirmar: se registra quién, cuándo y con qué señales.               │
└───────────────────────────────────────────────────────────────────────────┘
```

### Las decisiones de diseño

- **Se muestran las señales, no un porcentaje solo.** Un «96 %» no le dice al
  operador qué mirar. Cinco señales con su tilde o su alerta, sí.
- **Se avisa cuando hay ambigüedad.** Si otra transferencia también encaja, el
  operador tiene que saberlo antes de confirmar. Es el pain point C.
- **Un caso a la vez, con navegación de teclado.** Doce casos a decidir se
  resuelven más rápido de uno en uno con `Enter` que en una tabla con checkboxes.
- **`Buscar otra coincidencia`** abre la búsqueda contra todas las
  transferencias abiertas del cliente, no sólo las candidatas.
- **Toda confirmación queda auditada con su evidencia.** No sólo «confirmado
  por X»: también qué señales había en ese momento.

---

## 16 · Matching

### Las señales

| Señal | Fuerza | Nota |
|---|---|---|
| **Referencia externa** | decisiva | Si el sistema externo la da. Decisión **N2** |
| **CUIT** exacto | fuerte | Con verificador válido |
| **Importe** exacto | media | **Nunca alcanza solo**: los importes se repiten |
| **Fecha** dentro de ventana | media | La ventana es configurable |
| **Banco** | débil | Confirma, no identifica |
| **Titular** normalizado | débil | Sirve de contraste, no de clave |
| **CUIT** a 1–2 dígitos | sospecha | Genera sugerencia, jamás confirmación |

### La regla de auto-match

```
AUTO-MATCH SEGURO
  hay referencia externa coincidente
      — o —
  CUIT exacto + importe exacto + fecha en ventana
      Y la tupla identifica UNA SOLA transferencia abierta

SUGERENCIA  (todo lo demás con al menos dos señales)
  el operador decide

SIN MATCH
  ninguna señal fuerte
```

**La condición de unicidad es la que importa.** Si dos transferencias abiertas
comparten CUIT, importe y fecha, no hay auto-match: hay dos sugerencias. Sin
esa condición, el sistema reproduciría el pain point C con más velocidad.

### Lo que no vamos a hacer

- No vamos a confirmar automáticamente por importe y fecha.
- No vamos a corregir un CUIT solos.
- No vamos a prometer un porcentaje de automatización **antes de medirlo
  contra archivos reales**. La tasa de auto-match depende enteramente de si
  existe la referencia externa (**N2**), y eso no lo sabemos todavía.

Un auto-match es reversible y queda auditado igual que uno manual.

---

## 17 · Clientes

### La decisión: una pantalla, con pestañas

La operación y el libro contable son información **del mismo cliente**, y las
preguntas se cruzan todo el tiempo: «¿le debemos, o es que le falta
acreditar?». Separarlas en dos pantallas obliga a buscar dos veces.

```
┌───────────────────────────────────────────────────────────────────────────┐
│ ← Cuentas                                                                 │
│ Cliente A                                        [ Ajustar a cero ]       │
│ Cliente · 118 movimientos · ● con cierre registrado                       │
├───────────────────────────────────────────────────────────────────────────┤
│  ENVIADO         ACREDITADO        PENDIENTE        ERRORES               │
│  $ 24.010.500    $ 12.400.000      $ 11.610.500     3                     │
│  186 transf.     142 transf.       41 transf.       3 CUIT               │
├───────────────────────────────────────────────────────────────────────────┤
│  Resumen │ Cuenta corriente │ Transferencias │ Errores                    │
├───────────────────────────────────────────────────────────────────────────┤
│  SALDO DE CUENTA CORRIENTE                                                │
│   ARS            USD           EUR           BRL                          │
│   $ 4.182.500    −US$ 2.400    —             —                            │
│                                                                           │
│  ÚLTIMOS MOVIMIENTOS                          ver la cuenta completa →    │
│  ...                                                                      │
│                                                                           │
│  ACREDITACIONES ABIERTAS                      ver todas →                 │
│  41 transferencias pendientes por $ 11.610.500                            │
└───────────────────────────────────────────────────────────────────────────┘
```

Los cuatro números de la cabecera son **operativos**, no contables: enviado,
acreditado, pendiente y errores. El saldo de cuenta corriente vive en su
pestaña, porque es otra pregunta.

> **Cuidado con la confusión.** «Pendiente de acreditar» **no** es lo mismo
> que «saldo de cuenta corriente». Uno es plata en tránsito en el sistema
> externo, el otro es lo que las dos partes se deben. La pantalla los tiene
> que mantener visiblemente separados, y por eso los cuatro números
> operativos están arriba y el saldo está adentro de su pestaña, nunca
> mezclados en la misma tira.

> **TO VALIDATE** (decisión **N8**) · ¿Los clientes que mandan archivos de
> transferencias son las mismas contrapartes que tienen cuenta corriente? Si
> son universos distintos, la pantalla se parte en dos y esta decisión se
> revierte.

---

## 18 · Cuenta corriente

La pantalla existente **se conserva**. Responde lo que tiene que responder:
fecha, concepto, impacto, moneda, saldo corrido y cierres, con el detalle de
partidas en un panel.

### La cadena completa

```
ARCHIVO DEL CLIENTE
      ↓  ingesta · normaliza · valida
TRANSFERENCIA                       ← estado de proceso
      ↓  envío al sistema externo
ACREDITACIÓN                        ← lo que el banco devolvió
      ↓  conciliación · decisión humana con evidencia
MOVIMIENTO                          ← granularidad: decisión N1
      ↓  una partida por pata monetaria
PARTIDA                             ← moneda y monto de impacto
      ↓  saldo corrido en orden canónico
CUENTA CORRIENTE
      ↓  suma por moneda, sin mezclar
BALANCE

           AUDITORÍA registra cada paso del que decidió una persona
```

**Todo lo que está debajo de MOVIMIENTO ya existe, está probado y no se
toca.** El proyecto de esta etapa es construir lo de arriba y conectar la
flecha.

### Trazabilidad hacia atrás

Un movimiento generado por una conciliación tiene que poder abrirse hasta el
archivo original. El esquema ya tiene `movimientos.origen jsonb`, que hoy usa
el importador legacy y sirve para esto sin cambiar la tabla. Se propone además
un `lote_id` nullable para poder hacer el join sin leer JSON.

---

## 19 · Carga manual

**No se toca.** Es el activo de velocidad del producto y se acaba de pulir:
la grilla entra completa a 1280 px, el impacto queda fijado a la derecha, el
pegado desde Excel interpreta categorías, medios y montos en formato
argentino, y hay deshacer con `⌘Z`.

### Cómo convive con la ingesta

Las dos viven bajo **Operación**, y la diferencia es de origen, no de
naturaleza:

| | Importar archivo | Carga manual |
|---|---|---|
| Origen | un cliente mandó un Excel | alguien registra algo que pasó |
| Volumen | cientos de filas | unidades |
| Produce | transferencias a enviar | movimientos contables |
| Cuándo | a la mañana, por lote | durante el día |

No compiten: **producen cosas distintas**. Una transferencia no es un
movimiento hasta que se concilia.

### La palanca de reutilización

El preview de la importación **es** una grilla editable con errores por celda,
pegado y deshacer — exactamente `CargaGrid`. Se propone extraer un
`GrillaEditable` genérico y que las dos pantallas lo usen. Es la mejor
relación entre esfuerzo y resultado de todo el proyecto: el comportamiento ya
está escrito y probado.

---

## 20 · Balance

**Se conserva sin cambios.**

| | |
|---|---|
| **Quién lo usa** | Supervisor y administración. No el operador en su día |
| **Cuándo** | Al cierre del día, y cuando alguien pregunta un total |
| **Desde dónde** | Riel, grupo Cuentas. Y desde Inicio |
| **Qué necesita** | Ver los totales por moneda, filtrar, buscar, exportar |

La regla que no se negocia: **las cuatro monedas nunca se suman entre sí.** No
hay «total general» porque no significa nada. Eso ya está implementado así.

> Si el negocio pide un total consolidado, hace falta una cotización de
> referencia con fecha, y eso es la decisión **D5**. No se inventa.

---

## 21 · Ajustes

La funcionalidad **se conserva completa**: la lectura vertical `SALDO ACTUAL →
+ AJUSTE → = SALDO RESULTANTE`, la propuesta automática del negativo de cada
saldo, y el aviso de que la cuenta queda cerrada cuando las cuatro monedas dan
cero.

**Lo que cambia es dónde vive.** Sale del riel y pasa a ser una acción del
cliente, en su pantalla. Razón: un ajuste es siempre sobre **una** cuenta, y
tenerlo como ítem de menú obliga a elegir la contraparte otra vez cuando ya
estabas mirándola. El enlace profundo `/ajustes?cuenta=<id>` ya existe.

Un ajuste no toca ningún saldo: **genera un movimiento contable explícito** con
categoría de ajuste y una partida por moneda con saldo. Esa propiedad es la
que lo hace auditable y no se cambia.

---

## 22 · Auditoría

**Se conserva y se extiende.** Ya responde quién, qué, cuándo, valor anterior
y valor nuevo, y el panel muestra **sólo los campos que cambiaron** — con
nueve tests que lo cubren. No muestra JSON crudo.

### Lo que hay que agregar

| Entidad nueva | Qué registrar |
|---|---|
| **Lote** | quién lo importó, de qué archivo, cuántas filas entraron y cuántas quedaron con error |
| **Transferencia** | cada corrección de CUIT o importe, con el valor original |
| **Envío** | quién marcó un lote como enviado, y cuándo |
| **Conciliación** | quién confirmó o rechazó, **y qué señales había** en ese momento |
| **Descarte** | quién descartó una fila y con qué motivo |

La conciliación es la más importante: es la única decisión humana del sistema
que mueve un saldo sin que nadie escriba un importe. Sin la evidencia
guardada, dentro de tres meses no se puede reconstruir por qué se confirmó.

---

## 23 · User flows

### Flow 1 · Recepción

```
Cliente manda archivo (Gmail / WhatsApp / entrega directa)
      ↓
Operador abre Acreditaciones → Importar archivo
      ↓
Elegir archivo → identificar cliente → aplicar mapeo de columnas
      ↓
Normalizar: CUIT, importes, fechas, banco
      ↓
VALIDAR ─────────────────┐
      ↓                  ↓
    OK                 ERROR
      ↓                  ↓
      │            preview con la fila marcada
      │                  ↓
      │            corregir en la grilla ──→ revalidar
      │                  │
      │                  └──→ descartar con motivo
      ↓                  ↓
CONFIRMAR (las filas OK entran; las de error quedan visibles)
      ↓
Bandeja de acreditaciones · estado «lista»
      ↓
Exportar archivo normalizado → sistema externo
      ↓
Marcar lote como «enviado»      ← ¿requiere aprobación? decisión N6
```

### Flow 2 · Conciliación

```
Descargar «Ingresos y créditos» del sistema externo
      ↓
Conciliación → Importar créditos
      ↓
Normalizar y validar
      ↓
MATCHING ASISTIDO
      ↓
   ┌──────────────┬──────────────────┬───────────────┐
   ↓              ↓                  ↓               ↓
MATCH          POSIBLE            SIN MATCH        ERROR
EXACTO         MATCH                 ↓               ↓
   ↓              ↓             queda pendiente   revisión
auto-           el operador       y visible
confirmado      decide
auditado          ↓
   │        ┌─────┴─────┬──────────────┐
   │        ↓           ↓              ↓
   │    Confirmar   Rechazar    Buscar otra
   │        │           │              │
   └────────┴───────────┘              │
            ↓                          │
     transferencia ACREDITADA          │
            ↓                    vuelve al caso
     genera MOVIMIENTO contable
     (granularidad: decisión N1)
            ↓
     CUENTA CORRIENTE → BALANCE
```

### Flow 3 · Cliente

```
Buscar cliente (Cuentas, o el buscador global)
      ↓
Pantalla del cliente · cabecera con los cuatro números
      ↓
   ENVIADO ── ACREDITADO ── PENDIENTE ── ERRORES
      ↓
   ┌──────────┬──────────────────┬──────────────────┬──────────┐
   ↓          ↓                  ↓                  ↓          ↓
Resumen   Cuenta corriente   Transferencias     Errores    Ajustar
          (saldo corrido)    (historial          (CUIT)     a cero
                              operativo)
```

### Flow 4 · Carga manual

```
Operación → Carga · elegir fecha y oficina
      ↓
Escribir con teclado, o pegar un bloque desde Excel
      ↓
Validación en vivo por celda: monto, tipo de cambio, comisión, contraparte
      ↓
Impacto calculado a la derecha, en vivo · «no impacta» cuando corresponde
      ↓
GUARDAR (atómico: cabecera + partidas, o nada)
      ↓
MOVIMIENTO + PARTIDAS
      ↓
CUENTA CORRIENTE (saldo recalculado) → BALANCE
      ↓
AUDITORÍA
```

### Flow 5 · Ajuste y cierre

```
Cliente → Cuenta corriente → Ajustar a cero
      ↓
El sistema propone el negativo de cada saldo con moneda
      ↓
Previsualizar: SALDO ACTUAL → + AJUSTE → = SALDO RESULTANTE
      ↓
      ¿las cuatro monedas dan cero?
      ↓                        ↓
     sí                       no
      ↓                        ↓
Registrar el ajuste      Registrar el ajuste
      ↓                        ↓
MOVIMIENTO con categoría de ajuste
      ↓                        ↓
CUENTA CERRADA           queda saldo
      ↓
corte visible en el libro
      ↓
AUDITORÍA con el motivo
```

---

## 24 · Arquitectura técnica

### Recomendación: conservar el stack

Se auditó lo que hay y **no hay ninguna razón fuerte para cambiarlo**. El
stack actual es moderno, chico y adecuado al problema.

| Capa | Hoy | Propuesta | Por qué |
|---|---|---|---|
| **Frontend** | Next.js 16.3.4 · App Router · React 19.2 · TS 5 | **conservar** | Server Components dejan las consultas del lado del servidor: menos datos financieros viajando al navegador |
| **Estilos** | Tailwind CSS 4 · `@theme` · sin `tailwind.config.js` | **conservar** | Los tokens ya están definidos en CSS y funcionan |
| **Grilla** | AG Grid Community 36 | **conservar** | El portapapeles de rango es Enterprise; el pegado está hecho a mano y funciona |
| **Backend** | Server Actions + funciones `security invoker` en Postgres | **conservar** | Las operaciones compuestas son atómicas en la base, no en el cliente |
| **Base** | PostgreSQL 18 (Supabase) | **conservar** | Columnas generadas, enums y CHECK hacen imposibles estados inválidos |
| **Auth** | Supabase Auth + `@supabase/ssr` | **conservar** | Se integra con RLS: el usuario de la sesión **es** el sujeto de la política |
| **Storage** | — | **agregar Supabase Storage** | Los archivos originales tienen que archivarse |
| **Tests** | Vitest 5 + PGlite (PostgreSQL 18 en WASM) | **conservar** | La paridad TS ↔ Postgres se verifica contra Postgres real, no contra un mock |
| **Ingesta de Excel** | — | **agregar** una librería de lectura de `.xlsx` | Del lado del servidor. No se sube nada a un servicio de terceros |
| **Observabilidad** | módulo propio, sin secretos | **conservar** + agregar el error tracking del hosting | |

### Lo que se agrega, y nada más

1. **Lectura de `.xlsx`** del lado del servidor (Server Action o Route
   Handler). El archivo no pasa por ningún servicio externo.
2. **Supabase Storage** para archivar los originales, con política de acceso.
3. **Paginación por servidor** en las tablas de acreditaciones y conciliación.
   Es la única concesión que exige el volumen.
4. **Un job diario** para el dump lógico de respaldo independiente (ver 25).

### Lo que NO vamos a hacer

Nada de microservicios, colas, Kafka, CQRS ni event sourcing. El volumen
—600 filas por día, 15.000 por mes— entra cómodo en una sola base Postgres
con índices razonables. Meter infraestructura distribuida acá agregaría
puntos de falla y ninguna capacidad.

Tampoco dashboards de BI por defecto: no hay ninguna pregunta de la sección 8
que un gráfico responda mejor que una cifra.

### Nota sobre el volumen

La estimación anterior en `CONTEXTO.md` era de ~50.000 filas/año. Con 300–600
transferencias diarias el orden real es **90.000–180.000 filas/año sólo de
transferencias**, más las acreditaciones. Sigue siendo chico para Postgres —
menos de 1 GB a varios años— pero **cambia el diseño de la interfaz**: sin
paginación por servidor, las tablas de la mitad operativa no sobreviven el
segundo mes.

---

## 25 · Infraestructura y hosting

### Recomendación

```
FRONTEND        Vercel                        ~20 USD/mes (Pro)
BASE · AUTH ·   Supabase Pro                   ~25 USD/mes
STORAGE
RESPALDO        dump lógico diario a           ~0
                almacenamiento propio
                                              ─────────────────
                                              ~45 USD/mes
```

**Por qué.** Es lo que el código ya supone: `@supabase/ssr`, RLS con
`security_invoker`, Server Actions de Next 16. Elegir otra cosa significaría
reescribir la autenticación y la seguridad por fila, que es la parte más
delicada de lo que ya está hecho, sin ganar nada.

**Por qué Pro y no Free.** No es por volumen —entrarían de sobra en Free—
sino porque **el plan gratuito pausa el proyecto tras una semana de
inactividad y no tiene ningún backup**. Para una financiera eso no es una
opción.

### Ambientes

| Ambiente | Frontend | Base | Datos |
|---|---|---|---|
| **Producción** | Vercel · dominio propio | Supabase `nordelta-prod` | reales |
| **Staging** | Vercel · preview por rama | Supabase `nordelta-staging` | copia anonimizada |
| **Desarrollo** | local | modo demostración en memoria | sintéticos |

El modo demostración **ya funciona sin base**, así que se puede desarrollar y
demostrar sin tocar datos reales. Es una ventaja que ya está construida.

### Respaldos

| | |
|---|---|
| **Supabase Pro** | backup diario, retención 7 días |
| **PITR** | +100 USD/mes. **No al arrancar.** Recomendado desde el momento en que entren datos reales de clientes y el histórico migrado |
| **Dump independiente** | Recomendado desde el día uno: un dump lógico diario a almacenamiento propio (Drive o S3). Protege contra la pérdida de la cuenta, que ningún backup del proveedor cubre |

### Alternativa evaluada · VPS propio

Ya tienen infraestructura en Hostinger (n8n corre en `srv949269.hstgr.cloud`),
así que es una opción real.

| | Vercel + Supabase · **recomendado** | VPS propio con Docker |
|---|---|---|
| Costo | ~45 USD/mes | ~15–25 USD/mes |
| Puesta en marcha | horas | días |
| Backups | incluidos | los hacés vos, y los probás vos |
| TLS, actualizaciones, monitoreo | incluidos | tuyos |
| Auth + RLS | integrados, ya usados por el código | Supabase self-hosted (mantenimiento) o construirlo |
| Escalar | automático | manual |
| Vendor lock-in | medio: **Postgres es estándar y el dump es portable**; lo atado es Auth y Storage | bajo |
| Necesita | nadie de infra | alguien que se ocupe |

**Veredicto.** Sin una persona dedicada a infraestructura, el VPS transfiere
al equipo de producto trabajo que no es de producto — y el primer backup que
no se probó se descubre el día que hace falta. Los 20–30 USD de diferencia no
justifican ese riesgo en una operación financiera.

Una tercera opción —Vercel + Neon + Auth.js— se descarta porque pierde Storage
y la integración de auth con RLS, que es justo lo que el código ya aprovecha.

### Sobre el lock-in

Es acotado y conviene decirlo con precisión: **la base es PostgreSQL estándar
y las migraciones son SQL plano**, así que los datos y el esquema son
portables a cualquier Postgres. Lo que quedaría atado a Supabase es
autenticación y almacenamiento de archivos. Migrar eso sería un proyecto de
días, no de meses.

---

## 26 · Arquitectura de datos

> **Nada de esto se aplicó.** Es la propuesta conceptual. El esquema actual
> —cuatro migraciones— no se modificó.

### El flujo

```
   CLIENTE                                        SISTEMA EXTERNO
      │                                                  │
      │ archivo                                          │ «Ingresos
      ↓                                                  ↓  y créditos»
┌───────────┐                                     ┌──────────────┐
│  lotes    │  archivo recibido, hash, canal,     │ lotes_credito│
│           │  quién y cuándo, archivo en Storage │              │
└─────┬─────┘                                     └──────┬───────┘
      │                                                  │
      ↓                                                  ↓
┌────────────┐                                    ┌──────────────┐
│ lote_filas │  fila cruda + normalizada          │acreditaciones│
│            │  + errores. Nada se pierde         │              │
└─────┬──────┘                                    └──────┬───────┘
      │ validación                                       │
      ↓                                                  │
┌────────────────┐                                       │
│ transferencias │  estado_proceso · estado_acreditacion  │
│                │  cuit + cuit_norm + cuit_valido        │
└───────┬────────┘                                       │
        │                                                │
        └──────────────────┬─────────────────────────────┘
                           ↓
                  ┌─────────────────┐
                  │ conciliaciones  │  transferencia ↔ acreditación
                  │                 │  tipo · señales · quién · cuándo
                  └────────┬────────┘
                           │  confirmada
                           ↓
        ══════════════ LA COSTURA ══════════════
                           ↓
                  ┌─────────────────┐
                  │  movimientos    │  EXISTE · granularidad = N1
                  └────────┬────────┘
                           ↓
                  ┌─────────────────┐
                  │    partidas     │  EXISTE · una por pata monetaria
                  └────────┬────────┘
                           ↓
                  ┌─────────────────┐
                  │  v_cta_cte      │  EXISTE · saldo corrido
                  └────────┬────────┘
                           ↓
                  ┌─────────────────┐
                  │   v_balance     │  EXISTE · totales por moneda
                  └─────────────────┘

     contrapartes ──── referenciada por transferencias y movimientos
     auditoria    ──── registra toda decisión humana de las dos mitades
```

### Las tablas nuevas

| Tabla | Para qué | Claves |
|---|---|---|
| `lotes` | Un archivo recibido de un cliente | `contraparte_id`, `canal`, `archivo_ref`, `hash`, `recibido_por`, `estado`, contadores |
| `lote_filas` | La fila tal como vino **y** normalizada, con sus errores | `lote_id`, `nro_fila`, `crudo jsonb`, `normalizado jsonb`, `errores jsonb`, `estado` |
| `transferencias` | La orden de transferencia, ya normalizada | `lote_id`, `contraparte_id`, `cuit`, `cuit_norm`, `cuit_valido`, `titular`, `importe`, `moneda`, `banco`, `referencia_externa`, `estado_proceso`, `estado_acreditacion` |
| `lotes_credito` | Un archivo «Ingresos y créditos» descargado | `archivo_ref`, `hash`, `importado_por`, contadores |
| `acreditaciones` | Una línea de crédito del sistema externo | `lote_credito_id`, `cuit`, `importe`, `fecha`, `banco`, `referencia_externa` |
| `conciliaciones` | El vínculo y la decisión | `transferencia_id`, `acreditacion_id`, `tipo` (auto/manual), `señales jsonb`, `estado`, `decidido_por`, `decidido_en`, `movimiento_id` |
| `contraparte_canales` | Direcciones y remitentes de cada cliente | `contraparte_id`, `tipo` (email/whatsapp), `valor` — habilita la ingesta futura desde email |
| `mapeos_columnas` | Cómo se leen los archivos de cada cliente | `contraparte_id`, `mapeo jsonb`, `version` |

### Las relaciones que importan

```
lote          1 ──── N  lote_filas
lote_filas    1 ──── 1  transferencia        (las válidas)
lote          N ──── 1  contraparte
transferencia N ──── 1  contraparte
transferencia 1 ──── 0..1 conciliacion
acreditacion  1 ──── 0..1 conciliacion
conciliacion  N ──── 0..1 movimiento         ← la costura · N1 define el N
movimiento    1 ──── N  partida              EXISTE
movimiento    N ──── 1  contraparte          EXISTE
```

La relación `conciliacion N ──── 1 movimiento` es la que expresa la
agregación: varias conciliaciones confirmadas pueden apuntar al mismo
movimiento contable. Si **N1** resuelve «una por transferencia», el N pasa a
ser 1 y no hay que cambiar nada más.

### Sobre el esquema existente

No cambia. Lo único que se propone agregarle es un `movimientos.lote_id`
nullable, para poder hacer el join hacia atrás sin leer el `origen jsonb` que
ya existe. Es una columna nullable: no rompe nada ni exige migrar datos.

### Índices que va a necesitar el volumen

Concreto, porque el volumen lo exige: `transferencias` por
`(contraparte_id, estado_acreditacion)`, por `(cuit_norm, importe, fecha)`
para el matching, y por `lote_id`. `acreditaciones` por
`(cuit, importe, fecha)` y por `referencia_externa`.

---

## 27 · Integraciones

### Mapa de sistemas externos

| Sistema | Rol hoy | Destino | Cuándo |
|---|---|---|---|
| **Gmail** | Los clientes mandan los Excel acá | **INTEGRATE** · lectura para ingesta automática | Fase 6. En el MVP el archivo se sube a mano |
| **WhatsApp** | Canal ocasional para archivos | **TO VALIDATE** · si es excepción, se registra el canal a mano | Decisión **N12** |
| **Excel** | Formato de intercambio con los clientes | **KEEP PERMANENTLY** | Los clientes no van a cambiar. La app tiene que leerlo bien |
| **Drive** | Donde se guardan los archivos | **REPLACE** por Supabase Storage | Fase 2. Migrar el histórico de archivos es opcional |
| **Sistema externo de transferencias** | Se le carga el archivo y se le descargan los créditos | **INTEGRATE** si tiene API; si no, **KEEP** con archivos | **Bloqueante para el diseño**: hay que saber qué exporta |
| **Google Sheets** (Caja diaria, Cheques, Cierres, Clientes, Cuentas Corrientes) | El sistema contable actual | **REPLACE** | Fase 5, con marcha en paralelo |
| **Apps Script** (6 archivos) | Consolidación y cierres | **REPLACE** | Fase 5. Ya está reimplementado y probado |
| **BigQuery** (`financiera-nordelta-f`) | Motor de consolidación, no warehouse | **REMOVE EVENTUALLY** | Fase 5. Único consumidor vivo es el Sheet que se reemplaza |
| **n8n** (`srv949269.hstgr.cloud`) | Orquesta las 4 queries de BigQuery | **REMOVE EVENTUALLY** para Nordelta | Fase 5. **Ojo**: de 415 workflows sólo 6 son de Nordelta. No se toca el resto |

### Nota de seguridad

El token de la API de n8n se pegó en una conversación. **Hay que rotarlo.**
Nunca se escribió en ningún archivo ni commit — verificado — pero estuvo
expuesto en un canal de chat.

### La integración que define el proyecto

**El sistema externo de transferencias.** Todo el módulo de conciliación
depende de qué formato tiene «Ingresos y créditos» y de si trae un
identificador de operación (**N2**). Con identificador, el matching es casi
determinístico. Sin él, depende de heurísticas y la tasa de sugerencias sube
mucho.

No se puede estimar el ahorro de tiempo de la conciliación sin ver ese
archivo.

---

## 28 · Accesos necesarios

Checklist para pedirle al cliente. **Sin contraseñas en este documento**: acá
va qué acceso hace falta y para qué.

### Bloqueantes para diseñar

| | Qué | Para qué | Prioridad |
|---|---|---|---|
| ☐ | **3–5 Excel reales de clientes distintos** | Diseñar el parser y el mapeo de columnas. Sin esto cualquier ingesta es una apuesta | **BLOQUEANTE** |
| ☐ | **3–5 descargas reales de «Ingresos y créditos»** | Diseñar el matching y saber si hay identificador de operación (**N2**) | **BLOQUEANTE** |
| ☐ | **Nombre y URL del sistema externo** de transferencias | Saber si tiene API, export programable, o sólo pantalla | **BLOQUEANTE** |

Los archivos pueden venir anonimizados en los nombres, pero **con la
estructura de columnas intacta y los CUIT con su forma real** (se pueden
alterar dígitos manteniendo el formato).

### Para construir

| | Qué | Para qué |
|---|---|---|
| ☐ | Casilla de **Gmail** operativa, lectura | Ver la forma real de los mails y, en fase 6, la ingesta automática |
| ☐ | Carpeta de **Drive** donde guardan los archivos | Entender la organización actual y evaluar migrar el histórico |
| ☐ | **Sheets**: Caja diaria 1 y 2, Cheques, los 6 de cierre, Clientes, Cuentas Corrientes | Migración del histórico y marcha en paralelo |
| ☐ | **BigQuery**, proyecto `financiera-nordelta-f`, lectura | Export del histórico y cuantificar los bugs 5 y 6 en pesos |
| ☐ | **n8n** — ya lo tenemos | Nada más que leer los 6 workflows. **Rotar el token** |
| ☐ | **Apps Script** — ya los tenemos (6 archivos) | Ya analizados |
| ☐ | **Lista de usuarios** con oficina y rol | Definir permisos (decisión **D9**) |
| ☐ | **Export del histórico 2025–2026** | Migración y cuantificación de los defectos |

### Para poner en producción

| | Qué | Para qué |
|---|---|---|
| ☐ | Dominio o subdominio | Publicar la aplicación |
| ☐ | Quién paga y administra Vercel y Supabase | Titularidad de las cuentas, no de nuestro lado |
| ☐ | Un contacto técnico del lado del cliente | Para DNS y accesos |
| ☐ | Definir la política de retención de archivos | Los CUIT de terceros son datos personales (Ley 25.326). Hay que definir cuánto se guardan y quién los ve |

---

## 29 · MVP

### El criterio

El MVP de esta etapa **no es «todo el sistema»**. Es el mínimo que demuestre
valor real en la operación diaria. Y como la mitad contable ya está
construida, el MVP se define por la mitad operativa.

**El valor demostrable más rápido es el archivo normalizado**: hoy alguien
limpia un Excel a mano dos veces por lote. Una pantalla que lo hace en un
minuto, con los errores señalados antes de procesar, ya paga el proyecto sin
que exista todavía la conciliación.

### MVP

| Módulo | Alcance |
|---|---|
| **Portada** | Existe. Ajustar el relato |
| **Ingreso** | Existe |
| **Home** | Rediseñada: pipeline del día, conciliación, estado por cliente |
| **Importar Excel** | Flujo completo: archivo → mapeo → normalización → validación → preview editable → confirmar |
| **Acreditaciones** | Bandeja con los dos ejes de estado, filtros, paginación, corrección, descarte con motivo |
| **Exportar normalizado** | El archivo para el sistema externo. **Este es el valor inmediato** |
| **Importar créditos** | Ingesta de «Ingresos y créditos» |
| **Conciliación** | Matching asistido, cuatro resultados, confirmación con evidencia |
| **Cliente** | Cabecera con enviado / acreditado / pendiente / errores + pestañas |
| **Cuenta corriente** | Existe |
| **Carga manual** | Existe |
| **Balance** | Existe |
| **Auditoría** | Existe + las cinco entidades nuevas |
| **Configuración** | Mínima: mapeo de columnas por cliente y ventana de fechas del matching |

**Condicional:** la generación automática del movimiento contable desde una
conciliación confirmada entra al MVP **si N1 y N3 están respondidas**. Si no,
la conciliación queda registrada y el movimiento se carga a mano — que es un
paso más, pero no bloquea el resto.

### Fase 2

- Ingesta automática desde Gmail
- Matching automático seguro con medición de la tasa real
- Cheques con estado de cobro y rechazo (decisión **D7**)
- Notificaciones de lote sin enviar y de pendientes viejos
- Roles y permisos completos (decisión **D9**)
- Migración del histórico y marcha en paralelo

### Futuro

- WhatsApp como canal formal
- API directa del sistema externo, si existe
- Préstamos como entidad, **si se confirma que existen** (decisión **D4**)
- Consolidación multi-moneda con cotización de referencia (decisión **D5**)

### Fuera de alcance, explícitamente

Dashboards de BI, aplicación móvil, portal para que el cliente cargue solo,
reportes configurables, y cualquier automatización de decisiones de matching
ambiguas.

---

## 30 · Roadmap

Las duraciones son **estimaciones sujetas a las respuestas de la fase 0** y al
tamaño del equipo. Se dan en semanas de una persona dedicada.

### Fase 0 · Accesos y definiciones · 1–2 semanas, en paralelo

| | |
|---|---|
| **Objetivo** | Tener los archivos reales y las tres respuestas bloqueantes |
| **Entregables** | Muestras de Excel y de créditos analizadas · N1, N2, N3 respondidas · mapeo de columnas de los clientes principales documentado |
| **Dependencias** | El cliente. Es la única fase que no depende de nosotros |
| **Riesgos** | Que las muestras no lleguen. Sin ellas la fase 2 arranca a ciegas |
| **Validación** | Reunión de treinta minutos revisando un archivo real en pantalla |
| **Código** | Ninguno |

### Fase 1 · Shell, navegación y Home · 1–2 semanas

| | |
|---|---|
| **Objetivo** | Que la estructura nueva sea navegable, aunque los módulos estén vacíos |
| **Entregables** | Riel con los cuatro grupos · rutas nuevas con estados vacíos · Home rediseñada con el pipeline · Ajustes movido al cliente |
| **Dependencias** | Aprobación de este informe |
| **Riesgos** | Bajos. Es reordenar lo que existe |
| **Validación** | El cliente navega la estructura y confirma que los nombres son los suyos |

### Fase 2 · Ingesta e Acreditaciones · 3–4 semanas

| | |
|---|---|
| **Objetivo** | Eliminar la limpieza manual del Excel. **Primer valor real** |
| **Entregables** | Tablas `lotes`, `lote_filas`, `transferencias` · lectura de `.xlsx` · normalización y validación de CUIT · `GrillaEditable` extraída de `CargaGrid` · preview editable · bandeja con estados · exportar normalizado |
| **Dependencias** | Fase 0 (archivos reales), fase 1 |
| **Riesgos** | Que los archivos sean más heterogéneos de lo previsto. Mitigación: el mapeo por cliente lo absorbe |
| **Validación** | El operador procesa un lote real y compara el tiempo contra su método actual, con cronómetro. Ya hay un protocolo escrito para esto |

### Fase 3 · Conciliación · 3–4 semanas

| | |
|---|---|
| **Objetivo** | Reemplazar el matching manual con colores y filtros |
| **Entregables** | Tablas `lotes_credito`, `acreditaciones`, `conciliaciones` · ingesta de créditos · motor de señales · pantalla de decisión · totales por cliente |
| **Dependencias** | Fase 2 · **N2 respondida** |
| **Riesgos** | **El más alto del proyecto.** Sin identificador de operación la tasa de sugerencias puede ser alta y el ahorro menor al esperado. Mitigación: medir sobre datos reales antes de prometer un número |
| **Validación** | Conciliar un día real en paralelo con el método actual y comparar resultados fila por fila |

### Fase 4 · La costura · 1–2 semanas

| | |
|---|---|
| **Objetivo** | Que una conciliación confirmada genere el movimiento contable |
| **Entregables** | Generación del movimiento con la granularidad de **N1** · trazabilidad hacia el archivo original · auditoría de la decisión con su evidencia |
| **Dependencias** | Fase 3 · **N1 y N3 respondidas** |
| **Riesgos** | Si N1 cambia después de implementado, hay que rehacer movimientos ya generados. Mitigación: la decisión queda aislada en un solo punto del código |
| **Validación** | Un movimiento generado se abre hasta el archivo del cliente, y el saldo coincide con el cálculo manual |

### Fase 5 · Supabase real, histórico y paralelo · 3–5 semanas

| | |
|---|---|
| **Objetivo** | Datos reales, con el sistema viejo todavía andando |
| **Entregables** | Proyecto Supabase de producción y staging · los 54 tests corridos contra base real · histórico 2025–2026 migrado y conciliado · runbook de marcha en paralelo ejecutado |
| **Dependencias** | Fase 4 · accesos a BigQuery y Sheets · **D1 y D2 respondidas** |
| **Riesgos** | Diferencias con el legacy por los bugs 5 y 6, que **hacen que el legacy esté mal, no el sistema nuevo**. Hay que poder explicar cada diferencia |
| **Validación** | El criterio y las tolerancias ya están escritos en `RECONCILIATION_STRATEGY.md` |

### Fase 6 · Automatizaciones · 2–3 semanas

| | |
|---|---|
| **Objetivo** | Sacar los pasos manuales que quedaron |
| **Entregables** | Ingesta desde Gmail · matching automático seguro con su tasa medida · notificaciones |
| **Dependencias** | Fases 3 y 5 con datos reales corriendo |
| **Riesgos** | Automatizar sobre reglas no validadas. Mitigación: no se automatiza nada cuya tasa de acierto no se haya medido en producción |
| **Validación** | Una semana de operación con la ingesta automática y revisión manual en paralelo |

### En una línea

```
F0 accesos ─┬─ F1 shell ── F2 ingesta ── F3 conciliación ── F4 costura ─┬─ F6 automatizar
            │                                                          │
            └──────────────── F5 Supabase real + histórico ────────────┘
```

La fase 5 puede correr en paralelo desde el final de la fase 2: no depende de
la conciliación.

---

## 31 · Decisiones pendientes

### Nuevas · del flujo de acreditaciones

| # | Pregunta | Prioridad | Bloquea |
|---|---|---|---|
| **N1** | ¿A qué granularidad una conciliación confirmada impacta la cuenta corriente? Una por transferencia, una por lote y cliente, o una por cliente y día | **BLOCKER** | Fase 4. Y el esquema de `conciliaciones` |
| **N2** | ¿«Ingresos y créditos» trae algún identificador de operación? | **BLOCKER** | Fase 3. Define si el matching es determinístico o heurístico |
| **N3** | ¿Nordelta cobra comisión por la transferencia? ¿Se registra en la cuenta corriente del cliente? | **BLOCKER** | Fase 4. Define si el movimiento tiene una o dos partidas |
| **N4** | ¿Una transferencia individual puede acreditarse parcialmente, o la parcialidad es sólo agregada por cliente? | HIGH | El eje 2 de estados |
| **N5** | ¿Qué pasa con una transferencia enviada que nunca se acredita? ¿Hay plazo? ¿Se devuelve? | HIGH | Un estado terminal que hoy no existe |
| **N6** | ¿Quién autoriza el envío de un lote? ¿Hay paso de aprobación? | HIGH | Fase 2 y los roles |
| **N7** | Con el CUIT mal, ¿corrige Nordelta o se le pide el archivo de nuevo al cliente? | HIGH | Si hace falta un estado «devuelto al cliente» |
| **N8** | ¿Los clientes de acreditaciones son las mismas contrapartes de la cuenta corriente? | MEDIUM | Si la pantalla de cliente es una o dos |
| **N9** | ¿Las transferencias son siempre en pesos? | MEDIUM | El campo moneda de `transferencias` |
| **N10** | ¿Cuántos clientes mandan archivos por día, y cuántos archivos cada uno? | MEDIUM | Dimensionar la bandeja y la paginación |
| **N11** | ¿Cada cliente manda su propio formato de Excel, o es siempre el mismo? | MEDIUM | Si el mapeo por cliente es obligatorio |
| **N12** | ¿WhatsApp es excepción o canal regular? | LOW | Si se registra el canal a mano |

### Anteriores · siguen abiertas

Detalle completo en `OPEN_BUSINESS_DECISIONS.md`. Las que afectan a esta
etapa:

| # | Pregunta | Prioridad |
|---|---|---|
| **D1** | ¿Sigue vigente el asiento espejo del proveedor de transferencia? | **BLOCKER** |
| **D2** | ¿Qué es un «full pago» y qué lo distingue? | **BLOCKER** |
| **D5** | ¿De dónde sale el tipo de cambio? ¿Hay que preservar cotizaciones? | HIGH |
| **D7** | ¿Cuándo impacta contablemente un cheque? ¿Existe el rechazo? | HIGH |
| **D8** | ¿Qué debe pasar al editar un movimiento histórico? | HIGH |
| **D9** | ¿Quiénes usan el sistema y qué ve cada uno? | MEDIUM |
| **D3 · D4 · D6 · D10–D14** | Ver el documento | HIGH a LOW |

**D1** merece un párrafo: la query de 2025 emitía un movimiento espejo a
nombre del proveedor de la transferencia, y esa rama **no existe** en la de
2026. Si tenía que seguir existiendo, **faltan asientos de proveedor desde
enero de 2026** y eso es un incidente, no una decisión de diseño.

### Roles · propuesta preliminar

> **TO VALIDATE** en su totalidad (decisión **D9**). El esquema ya implementa
> cuatro roles con el default más restrictivo posible: un perfil nuevo no ve
> nada. Eso es el mínimo razonable, no el modelo definitivo.

| Rol | Podría | TO VALIDATE |
|---|---|---|
| **Operador** | Importar, corregir, conciliar, cargar movimientos de su oficina | ¿Ve las otras oficinas? |
| **Supervisor** | Todo lo del operador + editar histórico, ajustar cuentas, aprobar envíos | ¿Aprueba envíos? |
| **Admin** | Configuración, usuarios, auditoría completa | ¿Quién puede borrar? |

Las tres preguntas de la derecha no se inventan.

---

## 32 · Riesgos

Ordenados por probabilidad × impacto. Sin riesgos teóricos de relleno.

| | Riesgo | Impacto | Mitigación |
|---|---|---|---|
| **1** | **El sistema externo es una caja negra.** Si no exporta un identificador de operación, el matching queda dependiendo de heurísticas | **Alto.** Es el corazón de la fase 3 | **N2** es lo primero de la fase 0. Si la respuesta es «no hay identificador», el alcance de la fase 3 se replantea antes de empezar |
| **2** | **Calidad de los archivos recibidos.** Sin muestras reales, cualquier parser es una apuesta | **Alto.** Puede invalidar la fase 2 | 3–5 archivos por canal antes de escribir código. Mapeo por cliente para absorber la heterogeneidad |
| **3** | **Matching ambiguo a volumen.** 600 por día con importes repetidos genera muchas sugerencias | **Alto.** Si el operador tiene que decidir 200 casos por día, no ganó nada | Nunca auto-confirmar sin tupla única. **Medir la tasa real sobre datos reales antes de prometer ahorro** |
| **4** | **Adopción.** El operador es rápido en Excel. Si la ingesta es más lenta que su limpieza manual, no se usa | **Alto.** Es el riesgo de producto | Cronómetro en la fase 2, con el protocolo que ya está escrito. Si pierde, se rediseña antes de seguir |
| **5** | **Los tres bloqueantes sin respuesta.** N1, N2, N3 —y D1, D2 del lado contable | **Alto** sobre el cronograma | Fase 0 dedicada. Ninguna otra fase arranca sin ellas |
| **6** | **Doble trabajo en la transición.** Operar los dos sistemas en paralelo duplica el esfuerzo del operador | Medio | La fase 2 entrega valor inmediato —el archivo normalizado— así que el paralelo es ganancia neta, no costo puro |
| **7** | **Reglas de negocio no documentadas.** Ya pasó: los seis Sheets de cierre, el «full pago», el asiento espejo | Medio | Todo lo no confirmado se marca `TO VALIDATE` y no se implementa. Ya hay 26 decisiones abiertas registradas |
| **8** | **Volumen en la interfaz.** 15.000 filas por mes rompen cualquier tabla sin paginar | Medio | Paginación por servidor desde el día uno. Riesgo controlado si se respeta |
| **9** | **Migración del histórico.** Los bugs 5 y 6 hacen que el legacy tenga saldos mal | Medio | Herramientas ya construidas y probadas. La estrategia y las tolerancias están escritas |
| **10** | **Datos personales de terceros.** Se van a almacenar CUIT y titulares que no son clientes de Nordelta | Medio | RLS ya existe. Falta definir retención y acceso a los archivos originales. Es una decisión del cliente, no técnica |
| **11** | **Los 54 tests de Supabase nunca corrieron** | Bajo, pero es una incógnita | Fase 5, contra la instancia real. Está `READY TO TEST`, no `TESTED` |

### El riesgo que no está en la tabla

Construir la conciliación **antes** de tener los archivos reales. Sería el
error más caro posible: tres o cuatro semanas de trabajo sobre supuestos.
Por eso la fase 0 existe y no tiene código.

---

## 33 · Próximos pasos

### De su lado, esta semana

1. **Revisar y aprobar o corregir este informe.** En particular la
   arquitectura de información de la sección 8 y el alcance del MVP de la 29.
2. **Pedirle al cliente los tres bloqueantes de acceso**: Excel reales,
   descargas de «Ingresos y créditos» reales, y qué es el sistema externo.
3. **Agendar la reunión de las tres decisiones** — N1, N2, N3 — más D1 y D2
   que siguen pendientes de la etapa anterior.
4. **Rotar el token de n8n.**

### De nuestro lado, apenas se apruebe

1. Analizar las muestras de archivos y documentar el mapeo real de columnas.
2. Fase 1: shell, navegación nueva y Home. Es la única fase que se puede
   arrancar sin esperar nada del cliente.
3. Escribir la propuesta de migraciones nuevas —cuatro archivos SQL— para
   revisión, sin aplicarlas.

### Lo que no vamos a hacer hasta que se apruebe

Nada de código de aplicación. Ni una ruta, ni un componente, ni una
migración.

---

## Anexo A · Matriz de pantallas

| Pantalla | Objetivo | Usuario | Datos | Acción primaria | Estado |
|---|---|---|---|---|---|
| **Portada** | Comunicar qué es el sistema | Cualquiera | Ninguno real | Ingresar | EXISTE — MANTENER |
| **Ingreso** | Entrar | Todos | Sesión | Ingresar | EXISTE — MANTENER |
| **Inicio** | ¿Dónde está trabado el trabajo? | Operador, supervisor | Pipeline del día, conciliación, clientes | Conciliar | EXISTE — REDISEÑAR |
| **Acreditaciones** | ¿Qué me mandaron y qué está listo? | Operador | Transferencias con estado | Exportar normalizado | NUEVA |
| **Importar archivo** | Convertir un Excel en transferencias válidas | Operador | Archivo, mapeo, errores | Confirmar | NUEVA |
| **Lote** | ¿Qué pasó con este archivo? | Operador | Filas crudas y normalizadas | Corregir | NUEVA |
| **Conciliación** | ¿Qué envié y qué se acreditó? | Operador | Enviadas, acreditaciones, señales | Confirmar match | NUEVA |
| **Importar créditos** | Traer lo que acreditó el banco | Operador | Archivo del sistema externo | Confirmar | NUEVA |
| **Carga** | Registrar lo que no vino en archivo | Operador | Movimientos del día | Guardar | EXISTE — MANTENER |
| **Cuentas** | ¿Cuánto nos debe cada uno? | Supervisor | Saldo por contraparte y moneda | Abrir cliente | EXISTE — MANTENER |
| **Cliente** | ¿Qué pasó con este cliente? | Operador, supervisor | Operativo + contable | Según pestaña | EXISTE — FUSIONAR |
| **Cuenta corriente** | ¿Qué movimientos movieron el saldo? | Supervisor | Libro con saldo corrido | Ver partidas | EXISTE — MANTENER (pasa a pestaña) |
| **Balance** | ¿Cuánto hay, por moneda? | Supervisor, administración | Totales por moneda | Exportar | EXISTE — MANTENER |
| **Ajustar a cero** | Cerrar una cuenta | Supervisor | Saldo, ajuste, resultante | Registrar ajuste | EXISTE — FUSIONAR (al cliente) |
| **Auditoría** | ¿Quién cambió qué? | Admin, supervisor | Registro de solo agregado | Ver el cambio | EXISTE — MANTENER + extender |
| **Configuración** | Mapeos, usuarios, tolerancias | Admin | Configuración | Guardar | NUEVA |
| **Ajustes (ruta propia)** | — | — | — | — | **ELIMINAR** como ítem de navegación |

Ninguna pantalla existente se elimina. Lo único que desaparece es la
**entrada de menú** de Ajustes, cuya funcionalidad se conserva completa dentro
del cliente.

---

## Anexo B · Principios de UX y dirección visual

### Los diez principios

1. **Velocidad de Excel, control de sistema.** Teclado primero. Si una tarea
   frecuente necesita el mouse, está mal diseñada.
2. **Los errores se ven antes de procesar, no después.** Validar en el
   preview, no al confirmar.
3. **Ningún dato desaparece en silencio.** Lo que no se pudo interpretar
   queda visible, contado y sin aplicar.
4. **Un match dudoso es una sugerencia, nunca una decisión.** Vale para el
   CUIT y para la conciliación.
5. **El estado vive en el dato, no en el color de la celda.** Es el
   principio que ordena todo el proyecto: reemplaza el sistema de colores,
   filtros y marcas por estados consultables y auditables.
6. **En cada pantalla se sabe qué falta hacer**, sin filtrar ni sumar a mano.
7. **Las monedas no se suman entre sí. Nunca.**
8. **Toda decisión humana queda registrada con su evidencia**, no sólo con su
   autor.
9. **El cero real y el dato ausente se distinguen.** `0,00` y `—` no
   significan lo mismo.
10. **Una pantalla, una pregunta.** Si una pantalla necesita un selector de
    modo para responder dos preguntas, son dos pantallas.

### Dirección visual

El sistema ya está construido y consolidado. Esta etapa lo usa, no lo
reinventa.

| | |
|---|---|
| **Paleta** | Azul y blanco. El azul es identidad y se reserva para la acción, el estado activo y el dato calculado. Nunca decora |
| **Neutrales** | Con sesgo azulado apenas perceptible: un gris puro al lado de este azul se lee sucio |
| **Semánticos** | Verde, rojo y ámbar, separados del azul a propósito |
| **Tipografía** | Siete niveles y ni uno más. Números siempre tabulares, formato argentino |
| **Densidad** | Alta donde hay muchas filas —bandeja, conciliación, grilla— y aireada donde hay una decisión |
| **Jerarquía** | La hace el borde, no la sombra. La elevación es casi imperceptible |
| **Estado** | Punto de color más texto, no píldora rellena: una tabla llena de píldoras compite con los números |
| **Referencias de nivel** | Stripe, Linear, Ramp, Mercury. Como vara de calidad, no para copiar |

### Lo que no

Plantilla SaaS genérica, glassmorphism, degradados de adorno, tableros llenos
de gráficos, tarjetas que no aportan, diseño infantil, y cualquier gráfico que
no responda mejor que una cifra con su etiqueta.
