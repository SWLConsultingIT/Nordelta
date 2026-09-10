# POC · Fullcarga auth → XLS

> # ✅ HTTP AUTOMATION = VERIFIED
>
> **Prueba en vivo ejecutada y superada el 9-sep-2026, con autorización
> explícita y una cuenta legítima de NORD.** Los ocho checkpoints pasaron y el
> XLS se descargó automáticamente.
>
> ```
> CHECKPOINT 1  Authentication          ✅
> CHECKPOINT 2  Session established     ✅  JSESSIONID
> CHECKPOINT 3  Report form loaded      ✅  HTTP 200
> CHECKPOINT 4  Struts token extracted  ✅  campo "token"
> CHECKPOINT 5  Report generated        ✅  08-09-2026, formato XLS
> CHECKPOINT 6  XLS downloaded          ✅  32.768 bytes
> CHECKPOINT 7  XLS validated           ✅  firma OLE2
> CHECKPOINT 8  XLS saved locally       ✅  .tmp/fullcarga/
> ```
>
> Verificación independiente del archivo: `file(1)` lo reporta como
> **`CDFV2 Microsoft Excel`**, firma `d0 cf 11 e0 a1 b1 1a e1`, 32.768 bytes,
> SHA-256 `18db6824841b…`. **Es un binario de Excel de verdad, no HTML con
> extensión `.xls`** — el riesgo principal que este documento marcaba no se
> materializó.
>
> **Se puede afirmar: podemos descargar automáticamente por HTTP el mismo
> informe que hoy Mati baja a mano.**

Módulo aislado que demuestra la cadena `login → sesión → formulario → token
Struts → POST → descarga del XLS`. **No parsea el contenido del informe, no
toca la conciliación, ni Supabase, ni la interfaz, ni cron.**

---

## 1. Estados de la evidencia

Los tres estados no se mezclan en ninguna parte de este documento.

### ✅ VERIFIED — observado en la inspección autenticada con DevTools

| Hecho | Detalle |
|---|---|
| Sesión por cookie | `JSESSIONID`, aplicación Java sobre Tomcat |
| Login | `POST /TITAN/Login.html` con `usuario` y `password` |
| Teclado virtual | **No transforma ni cifra la contraseña** |
| Formulario del informe | `GET /TITAN/informeIngresosCreditos.html` |
| Token | La página trae un token de Struts dinámico |
| Pedido del informe | `POST /TITAN/informeIngresosCreditos.html` |
| Campos del POST | `struts.token.name`, el token dinámico, `submit`, `clicod`, `__checkbox_jerarquia`, `rs`, `tarjeta`, `banco`, `fechaini`, `fechafin`, `formato` |
| Formato de fecha | `DD-MM-YYYY` |
| Formato pedido | `formato = XLS` |
| Descarga | `GET /TITAN/Informes.html` devuelve el archivo directamente |
| `Content-Type` | `application/vnd.ms-excel` |
| `Content-Disposition` | `attachment; filename="Informe Movimiento de Saldos ... .xls"` |

### 🔶 INFERRED — decisiones de diseño que no se observaron

Cada una es una apuesta explícita, y cada una tiene su forma de fallar clara.

| Decisión | Por qué | Si está mal |
|---|---|---|
| Se pide `Inicio.html` **antes** del `POST` del login | Tomcat entrega ahí el `JSESSIONID` inicial, y algunas configuraciones rechazan un POST sin sesión previa | Sobra una petición. Inofensivo |
| El login lleva los ocultos `topUp=false`, `topUpAdquirencia=false`, `version=""` | Están en el formulario público de ingreso | El servidor los ignora, o rechaza el ingreso |
| ~~La sesión se comprueba pidiendo el formulario del informe~~ **CORREGIDO tras la corrida:** se comprueba sobre la página de aterrizaje del login | Un 200 no prueba nada: la aplicación devuelve 200 con la pantalla de ingreso cuando las credenciales fallan. Pero pedir **otra** pantalla para verificar disparaba el guardián de navegación | Ya no aplica: la verificación no cuesta ninguna petición extra |
| El enlace al informe se toma del menú, con su token de query | Titán rechaza la ruta pelada. **Confirmado en vivo** | Si el menú cambia, el error lo dice con precisión |
| Se reenvían **todos** los campos ocultos del formulario | No sabemos qué significa cada uno; reconstruirlos a mano es cómo se rompe un formulario de Struts | Se manda un campo de más. Suele ser inofensivo |
| Los filtros vacíos van igual (`clicod`, `rs`, `tarjeta`, `banco`, `__checkbox_jerarquia`) | Es lo que manda el navegador cuando Mati no filtra | El servidor podría preferir que no estén |
| `submit=Aceptar` | Es el botón del formulario | Podría llevar otro valor |
| Se mandan `Referer` y `Origin` | Aplicaciones Java a veces los exigen | Inofensivo |
| Las redirecciones se siguen a mano, hasta 5 | Para capturar `Set-Cookie` en cada salto | Un flujo con más saltos fallaría |
| `GET Informes.html` viene **después** del POST, con la sesión guardando el estado | Es el orden observado | Podría necesitar un parámetro |

### ✅ VERIFIED EN VIVO — confirmado por la corrida del 9-sep-2026

Todo lo que antes figuraba como no probado, salvo lo que sigue más abajo:

| Hecho | Resultado |
|---|---|
| Las credenciales entran con un `POST` de formulario | **Sí.** El teclado virtual no era obstáculo, como se había deducido |
| Segundo factor o verificación de dispositivo | **No hay.** El ingreso es directo |
| Akamai frente a un cliente que no es navegador | **No molesta.** Ni en las rutas públicas ni en las autenticadas |
| Nombre del campo del token de Struts | `token`, declarado por `struts.token.name` |
| El archivo es un XLS binario | **Sí.** `CDFV2 Microsoft Excel`, firma OLE2, 32.768 bytes |
| Cabeceras de la descarga | `application/vnd.ms-excel` + `attachment` |
| Nombre que manda el servidor | `Informe Movimiento de Saldos 09-09-2026 16.18.08.xls` |

> ⚠️ **Detalle con consecuencias:** el nombre del archivo lleva la **fecha y
> hora de generación**, no la fecha pedida. Para el informe del 08-09 el
> servidor devolvió un archivo llamado «09-09-2026 16.18.08». Por eso el POC
> guarda con nombre propio —`fullcarga-<fecha-pedida>-<hash>.xls`— y conserva
> el original aparte: usar el del servidor haría imposible saber a qué día
> corresponde un archivo.

### 🔴 EL HALLAZGO DE LA PRUEBA — el guardián de navegación

La primera corrida **falló en el checkpoint 4** con `camposOcultos=0`: la
página del informe llegó con HTTP 200, sin ser la pantalla de ingreso, y sin
un solo campo de formulario.

Era la pantalla **«Sesión inhabilitada»** de Titán, que enumera sus causas:
F5, abrir en una pestaña nueva, el botón Volver, *«intentar una acción antes
de que finalizase la anterior»*, y **escribir la URL en la barra de
direcciones**.

La causa era nuestra —**A: request incorrecto**, en la taxonomía del
encargo—, y eran dos cosas a la vez:

1. **Se pedía `informeIngresosCreditos.html` dos veces seguidas**: una para
   verificar la sesión y otra para cargar el formulario. La segunda es, para
   Titán, un F5.
2. **Se pedía la ruta pelada.** Y ahí está lo importante: en Titán **cada
   enlace del menú lleva su propio token de navegación en la query**:

   ```
   /TITAN/informeIngresosCreditos.html?struts.token.name=token&token=EZNFGPP4H7607UBVQ4XWAS0HK5TGJD7W
   ```

   El token de la query es **distinto** del que después viene en los campos
   ocultos del formulario, y **distinto también** del que trae la URL de
   aterrizaje del login. Cada página emite tokens frescos para sus enlaces
   salientes.

**La corrección:** el POST del ingreso aterriza en `MenuHerramientas.html`, y
de esa página se extrae el enlace al informe **tal como lo emitió el
servidor**, con su token. Se navega por ahí, una sola vez. Eso, más eliminar
el GET duplicado, dejó el flujo en cinco peticiones y ni una de más.

**Nada de esto era observable sin la corrida.** Es exactamente lo que la
prueba en vivo tenía que descubrir.

### ⛔ SIGUE SIN PROBAR

- Cuánto dura la sesión y cómo se comporta al expirar.
- Qué pasa con dos sesiones simultáneas del mismo usuario (Titán lo lista como
  causa de «Sesión inhabilitada» — **relevante si el proceso corre mientras
  Mati está trabajando**).
- Si el formato del informe cambia entre días con y sin movimientos.
- El contenido del XLS: **no se parseó nada**, por diseño.

---

## 2. Arquitectura

```
src/lib/fullcarga/
├── errores.ts       8 clases de error. Ninguna puede contener un secreto
├── redaccion.ts     lista cerrada de mensajes + redacción de secretos
├── fechas.ts        ISO → DD-MM-YYYY, sin usar Date en ninguna línea
├── cookies.ts       frasco en memoria, con ámbito por Path
├── http.ts          fetch + cookies + redirecciones a mano + charset
├── formulario.ts    campos ocultos y token de Struts
├── descarga.ts      Content-Disposition, saneo, firma del archivo, sha256
├── tipos.ts         Descargador · InformeDescargado
├── config.ts        variables de entorno, validadas antes de la red
├── descargador.ts   orquesta los seis pasos
└── index.ts         superficie pública

scripts/fullcarga-poc.mts        CLI con --dry-run y --live
tests/fullcarga/
├── servidor-simulado.ts   un Titán de juguete, en node:http
├── unidades.test.ts       41 casos
├── e2e-simulado.test.ts   18 casos, flujo completo
└── cli.test.ts             8 casos, el script en un proceso aparte
```

Equivalencia con los nombres del encargo — el repositorio está escrito en
castellano y se respetó esa convención:

| Encargo | Acá |
|---|---|
| `FullcargaDownloader` | `Descargador` |
| `HTTPFullcargaDownloader` | `DescargadorHTTP` |
| `DownloadedReport` | `InformeDescargado` |
| `login()` | `autenticar()` |

**Aislamiento:** el módulo no importa nada de `data/`, `supabase/`, `domain/`
ni de la interfaz, y nada de la aplicación lo importa a él. Lo usan el script
y sus tests.

---

## 3. Dependencias

**Ninguna nueva.** Node 22 ya trae `fetch`, `Headers.getSetCookie()` y
`node:crypto`.

Se evaluó `tough-cookie` + `fetch-cookie`. Se descartó porque el frasco que
hace falta es de un solo host y una sola cookie —cincuenta líneas—, porque en
esta máquina `npm install` falla con `EACCES` y un POC sin instalaciones es
estrictamente mejor, y porque cambiarlo después es reemplazar un archivo.

---

## 4. Uso

```bash
# Ensayo. Es el modo por defecto: no sale una petición a la red.
npm run fullcarga:poc -- --date 2026-09-08 --dry-run

# Rango de fechas
npm run fullcarga:poc -- --from 2026-09-01 --to 2026-09-08 --dry-run

# Tráfico real. Requiere --live explícito y las dos credenciales.
npm run fullcarga:poc -- --date 2026-09-08 --live
```

Variables, solo por entorno, en `.env.local` (que no se commitea):

```
FULLCARGA_USERNAME=
FULLCARGA_PASSWORD=
FULLCARGA_BASE_URL=     # opcional
```

---

## 5. Manejo de secretos

| Regla | Cómo se hace cumplir |
|---|---|
| Credenciales solo por entorno | No hay parámetro de CLI ni archivo que las pueda traer |
| Se validan antes de la red | `leerConfiguracion()` corre antes de abrir un socket. Hay un test |
| Nunca se imprimen | `describir()` dice «definida» o «AUSENTE», nunca el valor |
| El `JSESSIONID` vive solo en memoria | No hay serialización a disco en ninguna parte |
| Un frasco de cookies interpolado no filtra nada | `toString()` y `toJSON()` devuelven solo los nombres. Hay un test |
| El token nunca se registra | Los checkpoints informan el **nombre** del campo, que es dinámico y sirve para diagnosticar. El valor no sale |
| No se registra HTML autenticado | Puede traer datos de la cuenta |
| Los logs son de lista cerrada | `Registrador.paso()` solo acepta ocho mensajes |
| Los errores no llevan secretos | El contexto solo admite escalares, y hay tests que lo verifican |
| `.tmp/` y `private_samples/` ignorados por git | Las descargas traen datos reales de la cuenta |

**La base tiene que ser `https`.** `leerConfiguracion()` lo exige: no se
mandan credenciales sin cifrar.

---

## 6. Validación de la descarga

Premisa: **un HTTP 200 no significa que tengamos el informe.**

Se valida, en este orden:

1. **Firma del archivo** — OLE2 (`D0 CF 11 E0 A1 B1 1A E1`) para `.xls`, o ZIP
   (`PK\x03\x04`) para `.xlsx`.
2. **No es HTML.** Y si es HTML, se distingue si es la pantalla de ingreso
   —`FullcargaSessionExpiredError`— o un error de la aplicación.
3. **No está vacío.**
4. **El `Content-Type` es compatible** con una planilla.
5. Se saca el nombre de `Content-Disposition` y **se sanea**: sin rutas, sin
   caracteres de control, sin los que rompen en Windows o macOS.
6. Se calcula el **SHA-256**.

> ⚠️ **El riesgo abierto más importante de este POC.** Muchos exportadores de
> Java emiten una **tabla HTML** con `Content-Type: application/vnd.ms-excel`
> y extensión `.xls`: Excel la abre igual, pero **no es un archivo OLE2**.
>
> Si Fullcarga hace eso, el validador va a rechazar una descarga que en
> realidad es correcta, y va a fallar con
> `FullcargaInvalidReportError: en lugar del informe llegó una página HTML`.
>
> **Eso no es un fallo del POC: es exactamente el resultado que necesitamos
> saber**, y el mensaje lo dice sin ambigüedad. Si pasa, la corrección es de
> una línea —aceptar HTML tabular como formato válido— y además cambia el
> diseño del parser que viene después. Por eso se prefirió un validador
> estricto que informa con precisión antes que uno permisivo que acepta
> cualquier cosa.

---

## 7. Estado de las compuertas

| Compuerta | Resultado |
|---|---|
| `npm test` | **343 pasan**, 0 fallan (eran 273; 70 nuevos) |
| E2E simulado | **21 casos**, flujo completo contra un `node:http` real |
| Ensayo (`--dry-run`) | **PASA**, verificado a mano y por test |
| `npx tsc --noEmit` | limpio |
| `npx eslint` | limpio, sobre `src`, el script y los tests nuevos |
| `npm run build` | compila |
| **Prueba en vivo** | **✅ PASA** — los 8 checkpoints, XLS descargado y validado |

### Dos defectos que encontraron los tests, y valen la pena

**El orden de validación de la descarga.** Al agregar la comprobación de
`Content-Disposition: attachment`, un test empezó a fallar: si esa cabecera se
mira **antes** que los bytes, una página de error tapa el diagnóstico útil
—«llegó la pantalla de ingreso»— con uno inútil —«faltaba una cabecera»—.
Se invirtió el orden: primero qué son los bytes.

**Un test que salía a Internet.** Cuando apareció `.env.local` con credenciales
reales, el caso «`--live` sin variables de entorno» empezó a cargarlas y
**disparó una petición real a Fullcarga durante `npm test`**. Un test que le
pega a un tercero es un defecto, no un test. Ahora corre desde una carpeta
temporal vacía, y además afirma que no aparece `authentication started` en la
salida.

El E2E no usa un doble de `fetch`: levanta un servidor real en `127.0.0.1` con
puerto efímero, así que ejercita el mismo cliente HTTP —cookies,
redirecciones, juego de caracteres— que va a correr contra Fullcarga. Lo único
simulado es el otro extremo.

Que el ensayo no toca la red se demuestra apuntando `FULLCARGA_BASE_URL` a un
host que no resuelve: si intentara conectarse, fallaría.

**Todo lo del servidor simulado es sintético.** El XLS es un archivo con firma
OLE2 fabricado a mano, las credenciales son de juguete y el token se inventa en
cada corrida. No hay un solo dato de Fullcarga ni de Nordelta.

> **Nota:** `private_samples/fullcarga/` **no existe** en este working dir.
> El XLS real descargado a mano no está disponible, así que no se pudo
> contrastar la firma del archivo contra uno verdadero. Es lo que resolvería
> de antemano la duda de la sección 6.

---

## 8. Qué mirar en la prueba en vivo

Los siete checkpoints dicen exactamente dónde se cortó:

```
CHECKPOINT 1  Authentication          empezó el ingreso
CHECKPOINT 2  Session established     hay JSESSIONID y la sesión responde
CHECKPOINT 3  Report form loaded      el formulario llegó y no es la pantalla de ingreso
CHECKPOINT 4  Struts token extracted  se resolvió el nombre del campo
CHECKPOINT 5  Report generated        el POST fue aceptado
CHECKPOINT 6  XLS downloaded          llegaron bytes
CHECKPOINT 7  XLS validated           la firma es de una planilla
CHECKPOINT 8  XLS saved locally       quedó escrito en .tmp/fullcarga/
```

Lectura de cada corte:

| Se cortó en | Probablemente | Qué hacer |
|---|---|---|
| 1 → 2 | Credenciales, o segundo factor, o el WAF | Comparar el POST contra el del navegador: nombres de campos, cabeceras, redirecciones. **No pasar a Playwright todavía** |
| 2 → 3 | La sesión no sobrevive, o la ruta cambió | Revisar la cookie y la URL |
| 3 → 4 | El token no está donde esperamos | Mirar el HTML del formulario en DevTools |
| 4 → 5 | El payload no le gusta al servidor | Comparar campo por campo contra el del navegador |
| 5 → 6 | La descarga necesita algo más | Revisar si hay un parámetro o una redirección |
| 6 → 7 | **Probablemente el caso de la sección 6** | Ver si el archivo es HTML tabular |
| 7 → 8 | Permisos de escritura | Revisar `.tmp/` |

**Si el login falla, el procedimiento es comparar, no migrar.** Nombres de
campos, cabeceras, redirecciones, nombres de cookies, tipo de contenido,
`Referer` y `Origin`, campos ocultos. Sin comparar valores secretos. Solo
después de eso se evalúa Playwright.

---

## 9. Condiciones antes de la prueba en vivo

Se mantienen las de `FULLCARGA_DOWNLOAD_FEASIBILITY.md` § 16:

1. **Autorización escrita de Nordelta**, y preferentemente un **usuario
   técnico dedicado** en lugar de las credenciales personales de Mati. La
   cláusula 16 de los términos de Fullcarga restringe el uso de la cuenta por
   terceros.
2. **Una sola corrida**, de un solo día, en horario de baja actividad.
3. **Sin reintentos automáticos.** Si falla, se lee el checkpoint y se decide.

El objetivo de la prueba es uno solo: **auth → XLS**. Nada de parser, nada de
conciliación, nada de cron.

---

## 10. Cómo destrabar la prueba en vivo

El POC está terminado y verde. Falta **una sola cosa**: que las credenciales
existan en el entorno de la máquina donde se corra.

Dos formas, las dos válidas. **Ninguna pasa por el chat.**

**A · Archivo `.env.local`** (la convención del repositorio, ignorado por git):

```
FULLCARGA_USERNAME=...
FULLCARGA_PASSWORD=...
```

> ⚠️ Un script corrido con `tsx` **no lee `.env.local` solo** —eso lo hace
> Next.js—. El script ahora lo carga explícitamente con `process.loadEnvFile()`.
> Sin eso, definir las credenciales ahí no habría tenido ningún efecto y el
> modo en vivo habría fallado diciendo que faltan variables que sí estaban.

**B · Solo para la sesión de terminal**, sin dejar rastro en disco:

```bash
read -rs FULLCARGA_PASSWORD && export FULLCARGA_PASSWORD
export FULLCARGA_USERNAME='...'
```

Después, la corrida:

```bash
npm run fullcarga:poc -- --date 2026-09-08 --live
```

Para comprobar que quedaron definidas **sin imprimirlas**, el modo de ensayo
ya lo dice:

```bash
npm run fullcarga:poc -- --date 2026-09-08 --dry-run
```

Tiene que mostrar `FULLCARGA_USERNAME  definida`.

### Recordatorio de las condiciones

1. **Un usuario técnico dedicado**, no las credenciales personales de Mati: la
   cláusula 16 de los términos de Fullcarga restringe el uso de la cuenta por
   terceros.
2. **Una sola corrida**, de un solo día con informe conocido, en horario de
   baja actividad.
3. **Sin reintentos.** Si falla, se lee el checkpoint y se decide.

---

## 11. Resultado de la prueba en vivo · 9-sep-2026

**Corridas reales: dos.** La primera falló en el checkpoint 4 y produjo el
hallazgo del guardián de navegación (§ 1). La segunda, con la corrección,
completó los ocho checkpoints.

| | |
|---|---|
| Fecha pedida | 2026-09-08 |
| Formato | XLS |
| Cuenta | `gestionypagos` (cuenta operativa de NORD) |
| Peticiones | 5 · sin reintentos |
| Resultado | **XLS descargado y validado** |
| Tamaño | 32.768 bytes |
| `Content-Type` | `application/vnd.ms-excel` |
| `Content-Disposition` | `attachment` |
| Nombre del servidor | `Informe Movimiento de Saldos 09-09-2026 16.18.08.xls` |
| Guardado como | `.tmp/fullcarga/fullcarga-2026-09-08-18db6824841b.xls` |
| SHA-256 | `18db6824841b113475871af09ee6f84b35d93935216a225095f9f7bfd0174faa` |
| `file(1)` | `CDFV2 Microsoft Excel` |

El flujo definitivo, cinco peticiones:

```
GET  /TITAN/Inicio.html                        → JSESSIONID
POST /TITAN/Login.html                         → 302 → MenuHerramientas.html
     (de esa página sale el enlace al informe, con su token de navegación)
GET  /TITAN/informeIngresosCreditos.html?struts.token.name=token&token=…
     (el formulario, con su propio token en campos ocultos)
POST /TITAN/informeIngresosCreditos.html       → informe generado
GET  /TITAN/Informes.html                      → el archivo
```

### Pendientes de higiene, con prioridad

1. **Rotar la contraseña de `gestionypagos`.** Se compartió en un canal de
   chat durante esta sesión. No es una hipótesis: está expuesta.
2. **Pedir un usuario técnico dedicado** antes de pasar esto a una corrida
   diaria. La cláusula 16 de los términos de Fullcarga restringe el uso de la
   cuenta por terceros, y con una cuenta compartida cualquier acción
   automática queda mezclada con la de las personas en la auditoría de ellos.
3. **Verificar el comportamiento con dos sesiones simultáneas.** Titán lista
   «iniciar sesión en otro navegador» como causa de «Sesión inhabilitada»: si
   el proceso corre mientras Mati está adentro, podría echarla. Es la razón
   más fuerte para el punto 2, y **hay que probarlo antes de programar
   cualquier corrida automática**.
4. **Borrar `.env.local`** cuando no se use.

### Qué NO se hizo, por diseño

No se parseó el contenido del XLS. No se tocó la conciliación, ni el matching,
ni la cuenta corriente, ni la interfaz, ni Supabase, ni cron, ni Gmail. No se
implementó Playwright: **no hace falta.** No se subió nada al remoto.

---

## 12. Verificación contra una descarga manual

> Ejecutada el 10-sep-2026, cuando apareció en `Samples/` un informe que una
> persona había bajado a mano de Titán el 09-09 a las 14:33 —conserva el
> nombre original que pone Fullcarga—.

Permitió comprobar de forma independiente la afirmación central del POC:
**que lo que baja el proceso automático es lo mismo que baja Mati.**

Se compararon fila por fila, por huella de contenido —fecha de ingreso,
importe, observación y tipo de movimiento—, el informe manual del 09-09
contra el que el POC descargó del mismo día:

| | Manual (persona, 09-09 14:33) | Automático (POC, 10-09) |
|---|---:|---:|
| Filas | 147 | 264 |
| FECHA del informe | 2026-09-09 | 2026-09-09 |
| Rango de FECHA INGRESO | 2026-05-29 … 2026-09-09 | 2026-05-29 … 2026-09-09 |

```
filas del manual presentes en el automático   145 / 145
solo en el manual                                   0
solo en el automático                             117
```

> **Cero filas perdidas.** Todo lo que la persona bajó a mano está en la
> descarga automática, con contenido idéntico. Las 145 huellas sobre 147
> filas son las dos transferencias exactamente iguales que ya conocíamos.

### El hallazgo que trajo la comparación

**Las 117 filas de más no son una diferencia entre los métodos: son plata que
se acreditó después de las 14:33.** El informe de un día **sigue creciendo
durante ese día**.

Consecuencia operativa, y explica por qué la conciliación es D+1: **bajar el
informe del día D durante el día D devuelve una foto parcial.** El proceso
automático tiene que correr con el día ya cerrado. Refuerza el horario
nocturno que proponía la arquitectura de automatización.

Y una advertencia para cuando esto sea un proceso diario: **volver a bajar un
día ya descargado puede traer filas nuevas**. La idempotencia no puede
apoyarse en «este día ya lo tengo»; tiene que ser por identidad de fila.

---

## 13. Validación final contra la operación manual

> 10-sep-2026. NORD bajó a mano el informe del **08-09-2026** con el mismo
> filtro que usó el proceso automático —fecha inicio y fecha fin en 08-09—.
> Reproducible con:
>
> ```bash
> npm run fullcarga:comparar -- \
>   "../Samples/fullcarga/manual-2026-09-08.xls" \
>   ".tmp/fullcarga/fullcarga-2026-09-08-18db6824841b.xls" \
>   --fecha 2026-09-08
> ```

### La fecha se valida contra la columna, no contra el título

El título interno del libro manual dice **«Informe Movimiento de Saldos,
10-09-2026»**, que es el día en que la persona lo generó. **El informe es del
08-09.** Por eso la validación mira la columna `FECHA`, y el comparador
ignora el título a propósito.

| | Manual | Automático |
|---|---|---|
| Valores distintos en `FECHA` | `2026-09-08` | `2026-09-08` |
| Filas con otra fecha | 0 | 0 |

**ROW DATE VALIDATION: PASS.**

### Resultado

| Comprobación | Manual | Automático | |
|---|---|---|---|
| XLS válido, OLE2 | sí | sí | ✅ |
| Columnas ubicadas | 14/14 | 14/14 | ✅ |
| Encabezado en la fila | 2 | 2 | ✅ |
| Tamaño | 50.688 bytes | 32.768 bytes | — |
| SHA-256 | `4bc3c190…` | `18db6824…` | **NO idénticos** |
| **Filas** | **84** | **84** | ✅ |
| Solo en manual | — | — | **0** |
| Solo en automático | — | — | **0** |
| Filas con algún valor distinto | — | — | **0** |
| **Suma de INCREMENTO** | **$ 67.815.586,96** | **$ 67.815.586,96** | ✅ |
| Suma por banco | coincide | coincide | ✅ |
| Suma por tipo de incremento | coincide | coincide | ✅ |
| Transferencias | 82 | 82 | ✅ |
| CUIT extraídos | 82 (100 %) | 82 (100 %) | ✅ |

```
BYTE-FOR-BYTE IDENTICAL:      NO
ROW DATE VALIDATION:          PASS
BUSINESS CONTENT EQUIVALENT:  YES
AUTOMATIC DOWNLOAD VERIFIED:  YES
```

### La única diferencia, y por qué no es una

**Los archivos pesan distinto —50.688 contra 32.768 bytes— y sus SHA-256 no
coinciden.** Es lo esperable y no afecta al contenido: un `.xls` guarda
metadatos de generación, estilos y relleno de sectores del contenedor OLE2, y
los dos archivos los produjo Fullcarga en momentos distintos. El manual además
pasó por Excel, que reescribe el archivo al abrirlo.

**Lo que importa es que las 84 filas son idénticas en las catorce columnas**, y
que la suma del dinero coincide **al centavo**: la comparación se hace en
centavos enteros, sin coma flotante, así que no hay tolerancia de redondeo
escondida.

> **FULLCARGA DOWNLOADER = VALIDATED AGAINST MANUAL OPERATION.**
>
> Ya no es «funciona y parece lo mismo»: está demostrado contra un archivo que
> bajó una persona, con el mismo filtro, fila por fila y peso por peso.

### Diferencia con la comparación de la § 12

La § 12 comparó el informe del **09-09** y dio 145 de 145 filas contenidas,
con 117 filas de más en el automático. **No era una discrepancia entre
métodos:** el manual de ese día se había bajado a las 14:33, con el día
abierto, y el automático al día siguiente, con el día cerrado.

Esta comparación del 08-09 lo confirma por contraste: **con los dos archivos
tomados sobre un día ya cerrado, la coincidencia es exacta**, 84 contra 84 y
cero diferencias. Las dos observaciones juntas dicen lo mismo desde dos
ángulos: el proceso automático trae exactamente lo mismo que la persona,
**siempre que el día esté cerrado.**
