# Fullcarga · factibilidad de automatizar la descarga del informe

> **Fase de research. No se modificó código, ni esquema, ni migraciones. No se
> implementó ningún agente.**
>
> **No se intentó iniciar sesión, no se probó ninguna credencial y no se
> sorteó ninguna protección.** Toda la evidencia técnica de este documento
> sale de páginas y archivos **públicos, sin autenticar**: HTML de la pantalla
> de entrada, dos archivos JavaScript estáticos, cabeceras HTTP y una página de
> error del contenedor.
>
> Fecha: 10 de septiembre de 2026.
> Complementa `NORD_MATI_WORKFLOW_AUTOMATION.md` § 9, que abrió la pregunta.

---

## 1. Executive Summary

**Conclusión: GO WITH CONDITIONS.** Vale la pena intentarlo, y las condiciones
son de permiso, no de técnica.

El research resolvió el que era el riesgo número uno hace dos días. La pantalla
de entrada de Titán tiene un **teclado virtual** en el campo de contraseña, y
existía la duda de si transformaba el valor antes de enviarlo —lo que haría
imposible reproducir el login con un cliente HTTP—. Leí los dos únicos archivos
JavaScript que carga la página. **No lo transforma.** El teclado es la librería
abierta VKI 1.12 y solo escribe caracteres en el `.value` del campo; la función
de envío `submitoncelogin()` únicamente valida que los campos no estén vacíos y
deshabilita el botón para evitar el doble envío. La contraseña viaja como un
campo de formulario común sobre HTTPS.

Eso, sumado a lo que ya sabíamos —aplicación **Java sobre Tomcat 8.5.46**,
sesión por cookie **`JSESSIONID`**, login por `POST /TITAN/Login.html` con
campos `usuario` y `password`, **sin captcha ni token anti-CSRF** visibles—
describe el caso más simple y más estable que se puede pedir: **login por
formulario, sesión por cookie, informe por URL**. Es el patrón que mejor se
automatiza sin navegador.

**Pero el obstáculo real no es técnico: es contractual.** Los términos y
condiciones de Fullcarga Argentina **no prohíben la automatización** —no
mencionan bots, scraping ni acceso programático en ninguna cláusula—, pero su
cláusula 16 obliga al usuario a no *«permitir que los Medios sean utilizados o
manipulados por terceros distintos al Usuario»*. Un proceso automático que
corra con la contraseña personal de Mati es discutible bajo esa cláusula, y no
por una tecnicidad: si algo sale mal, la responsabilidad recae sobre la cuenta
de una persona.

> **La pregunta correcta no es «¿podemos técnicamente?» sino «¿nos autorizan?».**
> Y hay una vía mucho mejor que pedir permiso para automatizar una pantalla:
> **pedirle a Fullcarga la integración que ya ofrece comercialmente.**

Fullcarga publica **«Host to Host»** entre sus canales, junto con POS, APP,
Tablet, IVR y Titán. No hay documentación pública que diga si incluye consulta
de movimientos o descarga de informes —**eso hay que preguntarlo**— pero que el
canal exista cambia el orden de las prioridades: primero se pregunta, después
se automatiza.

**Y lo más importante de todo:** nada de esto bloquea el proyecto. Automatizar
**Fullcarga** y automatizar **la conciliación** son dos problemas distintos. El
MVP funciona con Mati subiendo el archivo —que es lo que ya hace hoy— y la
descarga automática se enchufa después sin tocar nada más. El valor está en el
parser y en el matching, no en ahorrarle cinco minutos de trámite.

---

## 2. Qué queremos automatizar

El procedimiento manual de hoy, exactamente:

```
1. Entrar a Fullcarga (Titán)
2. Consultas
3. Informe de Movimiento de Saldos / Ingresos y Créditos
4. Seleccionar una fecha
5. Aceptar
6. Descargar el Excel
```

Dato relevante ya conocido: **el informe se pide indicando solo una fecha.** Un
único parámetro es el caso más simple posible — sugiere una acción del servidor
con un parámetro de fecha, no un flujo con estado de varios pasos.

**Lo que NO estamos evaluando acá:** enviar operaciones a Fullcarga. Esta
investigación es solo sobre la **descarga** del informe, que es lectura. Cargar
operaciones automáticamente es otra discusión, con otro nivel de riesgo, y no
está sobre la mesa.

---

## 3. Evidencia pública encontrada

Todo verificable, todo sin autenticar.

| # | Hallazgo | Cómo se verificó |
|---|---|---|
| 1 | La plataforma se llama **Titán**, versión **6.6.32** | Rutas `resources/6.6.32/...` en el HTML |
| 2 | Entrada de Argentina: `https://www.fullcarga-titan.com.ar/TITAN/` | Enlazada desde el sitio corporativo |
| 3 | La raíz hace **META refresh** a `/TITAN/Inicio.html` | HTML de la raíz |
| 4 | **Apache Tomcat 8.5.46** | La página de error 404 del contenedor lo declara |
| 5 | Sesión por cookie **`JSESSIONID; Path=/TITAN; Secure; HttpOnly`** | Cabecera `set-cookie` |
| 6 | Login: **`POST /TITAN/Login.html`** | `action` y `method` del formulario |
| 7 | Campos: `usuario`, `password`, y ocultos `topUp`, `topUpAdquirencia`, `version` | HTML del formulario |
| 8 | **Sin captcha** en el login | Sin `recaptcha`/`captcha`/`hcaptcha` en el HTML |
| 9 | **Sin token anti-CSRF** en el formulario de login | Sin campo oculto de token; los tres ocultos son banderas |
| 10 | **Sin indicios de MFA/OTP** antes de autenticar | Sin `otp`/`mfa`/`2fa` en el HTML |
| 11 | **El teclado virtual NO transforma la contraseña** | Lectura de `keyboard1.js` y `ui.js` |
| 12 | La página carga **solo dos scripts propios** | `keyboard1.js` y `ui.js` |
| 13 | `submitoncelogin()` solo valida vacíos y evita doble envío | Código completo leído en `ui.js` |
| 14 | Las acciones del servidor usan extensión **`.html`** | `Login.html`, `restaurarpwd.html`, `registro.html`, `tpvwebsell.html` |
| 15 | Detrás de **Akamai** | Instrumentación mPulse/Boomerang, variables `ak.*` |
| 16 | **Un cliente HTTP común recibe `200`** en páginas públicas | `curl` sin cabeceras de navegador |
| 17 | Misma aplicación desplegada por país | `.com.ar`, `.com.co`, `.com.ec`, `.es`, `.cl` |
| 18 | Codificación heredada en la raíz: `ISO-8859-1` | Cabecera `content-type` |
| 19 | **Sin API pública documentada** | Búsquedas sin resultado |
| 20 | Fullcarga publica **«Host to Host»** como canal | Su propia página de soluciones |
| 21 | Los T&C **no prohíben la automatización** | Lectura de los términos AR y del aviso CL |
| 22 | Los T&C **sí restringen el uso de la cuenta por terceros** | Cláusula 16 de los términos AR |

---

## 4. API oficial

**Resultado: NOT FOUND.**

No existe portal de desarrolladores, ni documentación pública, ni referencia a
endpoints REST o SOAP, ni especificación de reportes. Se buscó por API, web
services, integración, developer, reportes y servicios web, en las variantes
del nombre de la empresa y de la plataforma.

**Cómo leerlo:** «no encontrada públicamente» **no** es «no existe». En esta
industria las especificaciones de integración se entregan bajo contrato, no se
publican. La ausencia de documentación pública es lo normal, no una señal
negativa.

**No se inventó ningún endpoint.** Nada de este documento describe una URL de
API que no haya sido observada directamente.

---

## 5. Host-to-Host

**Resultado: POSSIBLE — hay que preguntar.**

Fullcarga lista **«Host to Host»** entre sus medios de venta, junto a POS, APP,
Tablet, IVR y Titán, y describe la plataforma Titán como *«modular, totalmente
integrable y adaptable»*.

**Lo que no sabemos, y es exactamente lo que hay que preguntar:** en esta
industria «host to host» normalmente significa un canal transaccional —enviar
operaciones— y no necesariamente un canal de **consulta de movimientos o
descarga de informes**, que es lo que necesitamos. Las dos cosas pueden viajar
por el mismo canal o pueden ser productos distintos.

**Por qué igual es la primera opción a explorar:** si existe y cubre consultas,
gana por lejos. Tiene contrato, credenciales propias, especificación escrita,
estabilidad y cero mantenimiento de interfaz. Ninguna automatización de
pantalla compite con eso. Y averiguarlo cuesta un mail.

---

## 6. Arquitectura web

| Aspecto | Hallazgo |
|---|---|
| Tipo de aplicación | **Java server-side**, no un SPA con API JSON |
| Contenedor | **Apache Tomcat 8.5.46** |
| Ruteo | Acciones del servidor expuestas con extensión `.html` |
| Sesión | Cookie `JSESSIONID`, ámbito `/TITAN`, `Secure` y `HttpOnly` |
| Redirecciones | La raíz hace META refresh a `Inicio.html` |
| Codificación | `ISO-8859-1` en la raíz, `UTF-8` en la pantalla de entrada |
| Front-end | HTML server-side, XHTML 1.0 Transitional, dos scripts propios |
| CDN / WAF | Akamai, con instrumentación mPulse |

**Por qué esto es una buena noticia.** Una aplicación así responde a peticiones
HTTP con cookie de sesión y devuelve documentos. **No hay estado de cliente que
reproducir, ni un grafo de llamadas asíncronas que orquestar.** Si el informe
se pide con una URL y una fecha, un cliente HTTP puede pedirlo igual que el
navegador.

Que sea una aplicación de generación anterior —Tomcat 8.5.46 es de 2019, la
codificación es heredada— juega **a favor** de la estabilidad: este tipo de
sistema cambia de URL con muy poca frecuencia. La contracara es que una versión
vieja del contenedor es un asunto de seguridad de Fullcarga, no nuestro, pero
conviene tenerlo anotado.

---

## 7. Login y sesión

### El flujo, según el HTML observado

```
GET  /TITAN/                → META refresh
GET  /TITAN/Inicio.html     → formulario + Set-Cookie: JSESSIONID
POST /TITAN/Login.html      → usuario, password, topUp, topUpAdquirencia, version
                            → (presumiblemente) sesión autenticada sobre la misma cookie
```

### El teclado virtual: el riesgo que se resolvió

El campo de contraseña lleva `class="keyboardInput1"` y la página carga
`keyboard1.js`. La duda era si el teclado cifraba, codificaba o alteraba el
valor antes de enviarlo.

**No lo hace.** Es la librería abierta **VKI (Virtual Keyboard Interface)
versión 1.12**, y todas sus escrituras sobre el campo son de la forma:

```js
value = self.VKI_target.value.substr(0, srt) + text + self.VKI_target.value...
```

Concatenación de texto plano. **No hay cifrado, hash, codificación ni
ofuscación en ninguna parte del archivo.** Es una comodidad de entrada —el
patrón habitual contra registradores de teclado— y nada más.

El manejador de envío, completo:

```js
function submitoncelogin(theForm) {
    if (theForm.id_nombre.value == '' || theForm.id_pass.value == '') {
        alert('Debe rellenar los campos del formulario');
        return false;
    } else {
        var button = document.getElementById("btn");
        button.disabled = true;                      // evita el doble envío
        button.style = "opacity: 0.7; ...";
        theForm.id_pass.disabled = false;
        return true;
    }
}
```

Valida vacíos, deshabilita el botón, envía. **No toca el valor de la
contraseña.** Y no hay otro script en la página que pudiera hacerlo: son dos, y
los dos están leídos.

> **Consecuencia:** un `POST` de formulario con `usuario` y `password` en texto
> plano sobre HTTPS es, hasta donde la evidencia pública permite afirmar,
> equivalente a lo que hace el navegador.

### Clasificación de las protecciones

| Protección | Estado | Nota |
|---|---|---|
| Captcha | **NOT FOUND** | Ningún indicio en el HTML de entrada |
| MFA / OTP | **NEED AUTHENTICATED INSPECTION** | No hay indicios antes de autenticar, pero puede aparecer **después** del login |
| Token CSRF | **NOT FOUND** en el login | Puede existir en formularios internos. Hay que mirarlo |
| Teclado virtual | **FOUND — resuelto, no es obstáculo** | VKI 1.12, texto plano |
| Verificación de dispositivo | **NEED AUTHENTICATED INSPECTION** | Un login desde una IP nueva podría dispararla |
| Tokens de vida corta | **NEED AUTHENTICATED INSPECTION** | Habitual en URLs de descarga |
| WAF / Akamai | **FOUND** | No bloquea clientes HTTP comunes en páginas públicas. Las rutas autenticadas pueden tener otra política |
| Bloqueo explícito de automatización | **NOT FOUND** | Ni técnico observable ni contractual |

**Las cuatro filas «NEED AUTHENTICATED INSPECTION» son el motivo de la sección
13.** Ninguna se puede responder sin una sesión legítima, y ninguna se va a
responder adivinando.

---

## 8. El endpoint del informe

**Es la pregunta central y todavía no tiene respuesta.** No se puede: la
pantalla de Consultas está detrás del login.

Lo que sí se puede afirmar, y acota mucho el espacio de posibilidades:

- La aplicación **no es un SPA**, así que el botón de descarga casi con certeza
  dispara una **navegación o un envío de formulario**, no una llamada asíncrona
  que arma el archivo en el navegador.
- Las acciones siguen el patrón `/TITAN/<Algo>.html`.
- El informe se pide **con un solo parámetro: la fecha**.

De ahí salen tres escenarios, en orden de probabilidad:

| # | Escenario | Probabilidad | Consecuencia |
|---|---|---|---|
| 1 | `GET`/`POST` a una acción con la fecha, y respuesta con `Content-Disposition: attachment` | **Alta** | **Ideal.** Se reproduce con un cliente HTTP directamente |
| 2 | El servidor genera el archivo y redirige a una URL temporal | Media | Viable: hay que seguir la redirección. Ojo con tokens de vida corta |
| 3 | Flujo de varios pasos con estado en la sesión | Baja | Reproducible pero más frágil. Empuja hacia el navegador |

**El escenario 1 es el que hace que todo esto valga la pena, y es el más
probable dado el tipo de aplicación.** Confirmarlo lleva diez minutos con
DevTools.

---

## 9. Automatización de navegador

**Clasificación: VIABLE BUT FRAGILE — respaldo, no primera opción.**

Con Playwright: abrir un contexto persistente, autenticarse, navegar a
Consultas, elegir la fecha, disparar la descarga y capturar el archivo.

| Dimensión | Evaluación |
|---|---|
| Estabilidad | Media. Funciona hasta que cambia una pantalla |
| Cambios de interfaz | **Su punto débil.** Cualquier rediseño lo rompe, y falla de formas difíciles de diagnosticar |
| MFA | Lo tolera mejor: permite intervención o sesión persistente |
| Captcha | No lo resuelve, y **no se debe intentar resolverlo** |
| Teclado virtual | **Inmune**: escribe en el campo como una persona |
| Expiración de sesión | Se maneja reautenticando |
| Mantenimiento | **El más alto de las tres opciones** |
| Ejecución remota | Necesita un entorno con navegador: más infraestructura, más costo, más superficie |

**Cuándo se justifica:** solo si la inspección autenticada muestra que el
endpoint no se puede reproducir —por MFA, por tokens de vida corta, o porque el
WAF distingue clientes en rutas internas—.

**Un punto a favor que no hay que perder:** Playwright y el cliente HTTP
**comparten todo lo que viene después**. El parser, la clasificación y el
matching no se enteran de cómo llegó el archivo. Elegir mal el transporte cuesta
el transporte, no el módulo.

---

## 10. Restricciones

### Lo que dicen los términos de Fullcarga

Se leyeron los términos y condiciones de Argentina y el aviso de Chile.

**No hay ninguna cláusula que prohíba la automatización.** Ni bots, ni
scraping, ni acceso programático, ni interfaces automáticas: el texto es
**silencioso** sobre el tema. Y el silencio no es permiso.

Dos cláusulas sí son pertinentes:

**Cláusula 7 (AR) — interferencia.** Prohíbe *«cualquier acción o uso de
dispositivo, software o cualquier otro medio tendente a interferir tanto en las
actividades y operaciones del comercio»*. Es amplia. Una descarga diaria de un
informe propio, a volumen humano, difícilmente sea «interferir» — pero la
redacción da lugar a interpretación, y no somos nosotros quienes la
interpretan.

**Cláusula 16 (AR) — uso por terceros. Esta es la que importa.** Obliga al
usuario a no *«permitir que los Medios sean utilizados o manipulados por
terceros distintos al Usuario»*. Y el aviso de Chile refuerza que *«el Usuario
es el responsable único y final de mantener en secreto (…) sus contraseñas
personales, claves de acceso»*.

> **Traducción práctica:** un proceso automático corriendo con la contraseña
> personal de Mati es, como mínimo, discutible bajo esa cláusula. Y el problema
> no es legal en abstracto: **si algo sale mal, la responsabilidad queda sobre
> la cuenta de una persona.**

### Lo que se desprende

1. **La autorización tiene que venir de Nordelta por escrito**, no de una
   conversación. Es su cuenta y su relación comercial.
2. **Idealmente, un usuario técnico dedicado**, no las credenciales personales
   de Mati. Separa responsabilidades, permite revocar sin dejar a nadie afuera y
   deja rastro propio en la auditoría de Fullcarga.
3. **Lo más limpio es preguntarle a Fullcarga.** Si autorizan —mejor aún, si
   dan una integración— la cláusula 16 deja de ser un tema.

**No inferimos autorización de la factibilidad técnica.** Que se pueda no
significa que se deba, y esa distinción es justamente lo que se pidió cuidar.

### Higiene operativa, si se avanza

- Credenciales en un gestor de secretos, **nunca en texto plano ni en el
  repositorio**. La aplicación ya tiene la disciplina: el historial completo
  está revisado y sin secretos.
- Una sola corrida diaria en horario de baja actividad. **Sin reintentos
  agresivos**: si falla, se avisa y se reintenta una vez más tarde.
- **Guardar el archivo original antes de interpretarlo.** Reprocesar es gratis;
  volver a pedirlo, no.
- Idempotencia: correr dos veces sobre la misma fecha no puede duplicar nada.
- Registrar cada corrida —cuándo, qué fecha, resultado— sin registrar jamás la
  credencial.
- Si Fullcarga pide parar, se para. Sin discusión.

---

## 11. Matriz de alternativas

| Opción | Evidencia | Viabilidad | Robustez | Dependencias | Riesgo | Recomendación |
|---|---|---|---|---|---|---|
| **1 · API oficial** | Ninguna pública | **UNKNOWN** | Máxima, si existe | Respuesta de Fullcarga | Bajo | **Preguntar ya.** Costo cero |
| **2 · Host-to-Host** | Publicado como canal; alcance desconocido | **POSSIBLE** | Máxima | Respuesta comercial; puede tener costo | Bajo | **Primera opción a explorar.** Es la única con contrato |
| **3 · Endpoint HTTP interno** | Login por formulario, `JSESSIONID`, sin captcha ni CSRF, **teclado virtual descartado** | **LIKELY** · falta inspección autenticada | Alta: estas apps casi no cambian de URL | Sesión autorizada; DevTools; posible MFA | Medio | **Opción técnica preferida.** Confirmar con la sección 13 |
| **4 · Browser automation** | Playwright sobre la interfaz actual | **VIABLE BUT FRAGILE** | Media | Entorno con navegador; mantenimiento | Medio-alto | **Respaldo**, solo si la 3 se cae |
| **5 · Descarga manual** | Es lo que se hace hoy | **VIABLE HOY** | **Máxima**: no depende de nada | Cinco minutos de Mati | Ninguno | **El fallback del MVP.** No es un fracaso |

---

## 12. Información que falta

**Solo se resuelve con una sesión autorizada** (sección 13):

1. Método, URL y parámetros exactos del informe.
2. Si el archivo viene con `Content-Disposition: attachment` o por redirección.
3. Si hay token anti-CSRF en los formularios internos.
4. Si hay MFA, verificación de dispositivo o control por IP después del login.
5. Cuánto dura la sesión y cómo se comporta al expirar.
6. Si el WAF trata distinto a un cliente no-navegador en rutas autenticadas.
7. Formato real del archivo: extensión, codificación y si es Excel o CSV.

**Solo se resuelve preguntándole a Fullcarga** (sección 14):

8. Si existe API o Host-to-Host con consulta de movimientos o descarga de
   informes.
9. Si autorizan el acceso programático a la cuenta de Nordelta.
10. Si pueden dar un usuario técnico dedicado.
11. Si hay ambiente de prueba.

**Solo lo decide Nordelta:**

12. Autorización por escrito para la inspección y para la automatización.
13. Quién es el titular de la cuenta que se va a usar.

---

## 13. Qué verificar con DevTools

**Procedimiento para ejecutar con Mati, en su sesión legítima, con
autorización previa de Nordelta.** Son diez minutos y responde casi todo lo que
falta.

### Antes de empezar

- Autorización de Nordelta **por escrito**. Aunque sea un mensaje en el grupo.
- Lo maneja **Mati**, en su propia sesión. Nadie más escribe la contraseña.
- Es **solo observación**: se hace la descarga de siempre, mirando qué pasa.
- **No se comparten capturas con la contraseña ni con la cookie de sesión a la
  vista.** La cookie `JSESSIONID` es equivalente a estar autenticado: si se
  filtra, se filtró la sesión.

### Paso a paso

1. Abrir **Chrome** e ir a la pantalla de entrada de Titán. **Todavía no
   autenticarse.**
2. Abrir **DevTools** con `F12` o `⌘⌥I`. Ir a la pestaña **Network**.
3. Marcar **`Preserve log`** ← *imprescindible*: sin esto, la navegación borra
   el registro y se pierde justo la petición que interesa.
4. Marcar **`Disable cache`**.
5. Dejar el filtro en **`All`** (no en `Fetch/XHR`: si el archivo llega por
   navegación, en `Fetch/XHR` no aparece).
6. **Ahora sí, que Mati se autentique.**
7. Ir a **Consultas → Informe de Movimiento de Saldos / Ingresos y Créditos**.
8. **Limpiar el registro** con el ícono 🚫, para que quede solo lo que sigue.
9. Seleccionar la fecha y presionar **Aceptar / Descargar**.

### Qué mirar, y qué anotar

En la petición que produce el archivo —la que tiene un tamaño de respuesta
grande o un tipo de documento— abrir **Headers** y anotar:

| Dato | Dónde | Por qué importa |
|---|---|---|
| **URL completa** | *General → Request URL* | Es **el** dato. Sin esto no hay nada |
| **Método** | *General → Request Method* | `GET` o `POST`: cambia cómo se reproduce |
| **Código de estado** | *General → Status Code* | Un `302` significa redirección: hay un paso más |
| **Query parameters** | pestaña *Payload* | Cómo se codifica la fecha |
| **Form data** | pestaña *Payload* | Si es `POST`. **Ver si hay algún token** |
| **`Content-Type`** de la respuesta | *Response Headers* | Excel real, CSV o HTML |
| **`Content-Disposition`** | *Response Headers* | Si dice `attachment`, es descarga directa → **escenario ideal** |
| **`Cookie`** enviada | *Request Headers* | Si alcanza con `JSESSIONID` o hay más |
| **Cadena de redirecciones** | La secuencia de filas | Si hay `302`, anotar el destino |
| **`Referer`** | *Request Headers* | Algunas apps lo exigen |

### Cómo capturarlo sin transcribir a mano

Clic derecho sobre la petición → **Copy → Copy as cURL**, y pegarlo en un
archivo de texto.

> ⚠️ **Ese texto contiene la cookie de sesión.** Tratarlo como una credencial:
> mandarlo por un canal privado, **borrar o reemplazar el valor de
> `JSESSIONID`** antes de compartirlo, y no pegarlo nunca en un chat grupal ni
> en el repositorio.

Alternativa más segura y igual de útil: **exportar el HAR** (ícono de descarga
en la barra de Network) y **sanearlo** antes de compartir — o simplemente
completar la tabla de arriba a mano, que es lo mínimo necesario.

### La pregunta que este test contesta

> **¿El botón de descarga es una sola petición HTTP con la fecha como
> parámetro?**
>
> **Si sí** → el endpoint es reproducible, la opción 3 se confirma y la
> automatización sin navegador es cuestión de días, no de semanas.
>
> **Si no** → se pasa a Playwright, y el resto del módulo no se entera.

### Test complementario, solo si el primero sale bien

Con la sesión ya abierta en el navegador, **pedir el mismo informe cambiando
únicamente la fecha en la URL**. Si devuelve el archivo del otro día, queda
demostrado que el informe se parametriza con la fecha y que no hay estado de
sesión intermedio. **Es una consulta más de lectura, del mismo tipo que las que
Mati hace todos los días** — no es un intento de sortear nada.

---

## 14. Qué preguntarle a Fullcarga

Borrador. **No enviado.** Lo tiene que mandar Nordelta, no nosotros: la
relación comercial es suya y una consulta de integración que llega de un
tercero suele morir en el primer filtro.

---

> **Asunto:** Consulta técnica — integración para consulta de movimientos e
> informes
>
> Estimados,
>
> Somos el equipo de tecnología de **[Nordelta]**, cliente de Fullcarga
> (cuenta **[número / razón social]**).
>
> Estamos desarrollando un sistema interno de conciliación y necesitamos
> consultar si existe algún mecanismo programático para obtener la información
> que hoy descargamos manualmente desde Titán, en **Consultas → Informe de
> Movimiento de Saldos / Ingresos y Créditos**.
>
> Concretamente quisiéramos saber:
>
> 1. ¿Existe una **API** (REST, SOAP u otra) disponible para clientes?
> 2. Vimos que ofrecen **Host to Host** como canal. ¿Incluye **consulta de
>    movimientos o descarga de informes**, o es solo transaccional?
> 3. ¿Hay alguna forma de recibir el informe diario **automáticamente** —por
>    ejemplo depositado en un **SFTP**, o enviado por correo en un formato
>    fijo—?
> 4. Si nada de lo anterior existe: ¿**autorizan** que un proceso propio de
>    Nordelta, con credenciales de nuestra cuenta, descargue diariamente el
>    informe? En ese caso, ¿pueden habilitarnos un **usuario técnico dedicado**,
>    distinto del usuario de la persona que opera?
> 5. ¿Hay **documentación técnica** y **ambiente de prueba** disponibles?
> 6. ¿Qué mecanismo de **autenticación** se usa en esa integración?
>
> El volumen sería **una consulta diaria**, del informe de nuestra propia
> cuenta.
>
> Quedamos a disposición para firmar lo que corresponda.
>
> Saludos cordiales,
> **[nombre]** — **[cargo]** — **[Nordelta]**

---

**Por qué está redactado así:** pregunta por la integración **antes** de pedir
permiso para automatizar la pantalla. Si existe el canal oficial, la pregunta 4
sobra. Y si no existe, la 4 llega en el mismo mail y no hace falta una segunda
vuelta. La pregunta 3 —SFTP o correo— está puesta a propósito: **es la que más
seguido tiene respuesta afirmativa en empresas de este tipo**, y sería la
solución más simple de todas.

---

## 15. Recomendación

**Tres carriles en paralelo, con una decisión de ingeniería que hace que el
orden no importe para arrancar.**

**Carril 1 · El mail (Nordelta, esta semana).** Cuesta un mail y puede volver
innecesario todo lo demás. Es lo primero porque tiene el mayor tiempo de espera
y no depende de nosotros.

**Carril 2 · La inspección con DevTools (diez minutos con Mati).** Con
autorización escrita. Contesta si el endpoint es reproducible y despeja MFA,
CSRF y tokens de una sola vez.

**Carril 3 · Playwright.** Solo si el carril 2 muestra que el endpoint no se
puede reproducir. **No se empieza antes**: sería construir el respaldo antes de
saber si hace falta.

### La decisión que desacopla todo

> **El parser del informe se construye primero, y no depende de cómo llegue el
> archivo.**

Es la misma decisión de `NORD_MATI_WORKFLOW_AUTOMATION.md` § 10 y se refuerza
acá: **la automatización de la descarga no está en el camino crítico del MVP.**

Y hay una razón de proporción que conviene decir en voz alta: **automatizar la
descarga le ahorra a Mati unos cinco minutos por día. El matching le ahorra
horas.** Sería un error dejar que la parte más barata del beneficio, y la única
que depende de un tercero, marque el ritmo del proyecto.

---

## 16. Go / No-Go

```
CONCLUSIÓN:  GO WITH CONDITIONS
```

**Go**, porque la evidencia técnica es favorable y el obstáculo que parecía más
serio —el teclado virtual— quedó descartado leyendo código público. El patrón
es el más simple y estable que se puede pedir: formulario, cookie, informe por
URL.

**With conditions**, y las condiciones son tres:

1. **Autorización escrita de Nordelta**, y preferentemente un **usuario técnico
   dedicado** en lugar de las credenciales personales de Mati. La cláusula 16
   de los términos no es un detalle.
2. **La inspección con DevTools confirma el endpoint.** Si aparece MFA, un
   token de vida corta o un WAF que distinga clientes, se pasa a Playwright — o
   se deja la descarga manual, que no es un fracaso.
3. **El MVP no depende de esto.** Si en tres semanas no hay respuesta de
   Fullcarga ni ventana con Mati, el módulo se construye igual con carga
   manual del archivo.

**No es No-Go** porque no hay ninguna prohibición ni barrera técnica conocida.
**No es Go a secas** porque falta un permiso que no es nuestro y una inspección
que no se hizo.

### Definición de terminado, para esta fase

> Tenemos evidencia suficiente para saber que **vale la pena intentarlo**, cuál
> es el mecanismo más sólido, qué falta para confirmarlo, y —lo más
> importante— que **el MVP de conciliación no depende de la respuesta**.

---

*Sin cambios en código, esquema, migraciones, tests ni funcionalidades. No se
implementó ningún agente. No se intentó ningún acceso autenticado.*
