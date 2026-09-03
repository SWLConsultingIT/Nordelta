# Contexto del proyecto Nordelta

> Documento de traspaso. Si estás retomando este proyecto desde cero, leé esto
> completo antes de tocar nada. Última actualización: 3 de septiembre de 2026.

---

## 1. Qué es

**Nordelta** es una financiera argentina con cuatro oficinas: Nordelta, Oficina
Corrientes (Capital), Puertos y Remeros. Su sistema operativo es un **libro
mayor multi-moneda de cuentas corrientes** (pesos, dólares, euros, reales)
implementado sobre Google Sheets, Apps Script, BigQuery y n8n.

**El proyecto es reemplazarlo entero por una web app con Supabase.** Front y
back. No es un arreglo del sistema actual.

El cliente lo pidió con tres condiciones explícitas:
- La usabilidad tiene que ser **muy parecida al Excel** (los usuarios son
  Excel-nativos y cargan rápido con teclado).
- Hay que **preservar las reglas y fórmulas actuales**, en particular la
  conversión de moneda por tipo de cambio.
- Tiene que ser **extensible**, porque van a querer cargar más cosas.

Su preocupación declarada es que **el front sea simple y se entienda**.
Referencias de calidad que pidió: Stripe (jerarquía de información), Linear
(velocidad y teclado), Ramp (UX financiera). Paleta: **azul y blanco**.

Contactos del lado del cliente: **Santi** (grabó los videos de onboarding, sabe
la parte técnica) y **Lucho** (dueño del conocimiento contable y de negocio).
El canal es un grupo de WhatsApp.

---

## 2. Estado actual

| | |
|---|---|
| Relevamiento del sistema viejo | **Completo.** Leí las 4 queries de BigQuery y los 6 Apps Script |
| Reglas de negocio | **Confirmadas en el código.** 13 de 23 preguntas cerradas |
| Preguntas abiertas | **21**, tres de ellas bloquean el esquema definitivo |
| Bugs encontrados en producción | **5**, tres afectan saldos hoy |
| Esquema de Supabase | **Escrito, sin aplicar** (el conector no está autorizado) |
| Front | **Completo y corriendo.** 9 pantallas + export CSV |
| Datos | Fixtures. La costura a Supabase es un solo archivo |
| Repositorio | `https://github.com/SWLConsultingIT/Nordelta.git` — remoto configurado, **sin pushear** |

---

## 3. El sistema que se reemplaza

Toda la complejidad del sistema viejo viene de una sola limitación: **las
planillas no se saben sumar entre sí**. De ahí se encadena todo lo demás.

```
62 hojas diarias por archivo
   ↓ Apps Script "consolidado", a botón, manual
2 hojas de consolidado por archivo
   ↓ vinculación a BigQuery, hoja por hoja, permiso a mano
4 tablas externas por mes en BigQuery
   ↓ 4 queries en cadena, orquestadas por n8n desde un webhook
tabla Consolidado.Cheques-Transacciones  →  Balance.balance_final
   ↓
Sheet "Cuentas Corrientes"  ──┐
   └── un botón acá dispara el webhook que arranca todo ←┘
```

Piezas concretas:

- **Caja diaria 1** (Nordelta + Corrientes) y **Caja diaria 2** (Puertos +
  Remeros). Un archivo nuevo de cada uno por mes, con una hoja por día por
  oficina, siempre hasta 31.
- **Cheques**: un Sheet con dos hojas, `cheques` y `transferencias a móvil`.
- **Cierre de cuentas corrientes**: seis Sheets. Nadie sabe por qué seis.
- **Clientes**: lista maestra, texto libre, sin unicidad.
- **Cuentas corrientes**: el entregable. Balance general + hojas de búsqueda.
- **BigQuery**: proyecto `financiera-nordelta-f`, datasets `Transacciones`
  (2025), `Transacciones_26`, `Consolidado`, `Balance`.
- **n8n** en `https://n8n.srv949269.hstgr.cloud`. De 415 workflows, seis son de
  Nordelta. El principal se llama `Nordel - Big Query - Querys`, id
  `EquLs8EMJG7Pewi0` — **ahí adentro, en los nodos HTTP, está el SQL**, que es la
  única especificación funcional escrita que existe del sistema.

**Nadie consume BigQuery para análisis.** Su único consumidor vivo es el Sheet
que vamos a reemplazar. No es un warehouse, es un motor de consolidación.

---

## 4. Reglas de negocio confirmadas

Todo esto está **verificado leyendo el código**, no inferido. Es la parte más
valiosa del documento.

### Qué impacta la cuenta corriente

Del Apps Script de consolidado, textual:

```js
const ALLOWED_SECTIONS = ['Ingresos', 'Pagos a proveedores', 'Full Pagos'];
```

**Compras y ventas no se consolidan.** Además:
- `Egresos` y `Gastos` se **fusionan** en «Pagos a proveedores», perdiendo la
  distinción.
- **No existe rama para `Impuestos`**: esas filas heredan la sección anterior.
  Hoy funciona por accidente, porque Impuestos cae entre Compras y Ventas.
- El tipo de movimiento **sale del encabezado de sección**, no de la columna D
  (que el script sobrescribe).

### Layout de la hoja diaria 2026 (16 columnas)

```
A Fecha              E PESOS      I REALES            M Transferencia Pesos
B Cliente/Proveedor  F TC         J Pago Facil        N Transferencias en Dolares
C Detalle            G DOLARES    K Comisión (0.00%)  O Transferencias EUROS
D Tipo de Movimiento H EUROS      L TC Transferencia  P Transferencia REALES
```

### Conversión de moneda

Una fila lleva hasta **nueve patas monetarias** con **dos tipos de cambio
independientes**:

- `TC` convierte la pata efectivo: `(PESOS + Pago_Facil) / TC`
- `TC_Transferencia` convierte la pata transferencia:
  `(Transferencia_Pesos × (1 + Comisión)) / TC_Transferencia`
- **Los dos resultados se suman** en dólares.

Reglas finas:
- La **comisión es un porcentaje** y se aplica **antes** de dividir.
- La comisión aplica **solo a las patas de transferencia**, nunca al efectivo ni
  al pago fácil.
- Un tipo de cambio sobre una pata que ya está en dólares no convierte nada.

### Cierre de cuenta

Función de ventana sobre el libro unificado. Se marca un cierre cuando:

- **las cuatro monedas dan cero simultáneamente** (redondeadas a 2 decimales), y
- la posición anterior tenía al menos una moneda distinta de cero.

No es por moneda. La fila «Cuenta Cerrada» se **sintetiza con ceros**: es una
marca, no un movimiento.

### Cheques y transferencias a móvil

- La fecha del movimiento es la **fecha de cobro**, no la de emisión.
- El monto que impacta es `A_pagar` (neto de descuento).
- Filtro **`Fecha_Cobro <= CURRENT_DATE()`**: un cheque entra a la cuenta
  **automáticamente al llegar su fecha**, sin que nadie confirme el cobro, y **no
  existe estado de rechazado**.
- La tasa de descuento y el descuento viajan como datos pero **no suman a ningún
  saldo**.

### Signo

**No hay ninguna lógica de signo en todo el sistema.** Los egresos se cargan en
negativo a mano por el operador.

### Clientes y proveedores

Comparten un mismo directorio: en el consolidado, el proveedor de una
transferencia termina siendo un valor de la columna `CLIENTE`.

---

## 5. Los cinco bugs de producción

**Afectan los saldos hoy, independientemente de la migración.** Tres pueden
estar produciendo números incorrectos sin que nadie lo note.

**1. Carrera de 30 segundos.** El Apps Script de Cuentas Corrientes hace
`enviarWebhook()` → `sleep(30000)` → `refreshAllDataSources()`. Pero la cadena de
n8n corre 4 jobs de BigQuery secuenciales y tarda minutos, y las queries son
`CREATE OR REPLACE TABLE`. El Sheet refresca a los 30 segundos fijos **sin
esperar**, así que puede leer una tabla a medio reconstruir.

**2. `removeDuplicateRows_` borra movimientos legítimos.** Deduplica por firma de
fila completa. Dos pagos idénticos al mismo cliente el mismo día se colapsan en
uno, en silencio.

**3. El semáforo falla en abierto.** Caja diaria escribe el estado en
`script!C2`; Cuentas Corrientes lee `script!D2` y `D4` de su propia hoja. Si la
hoja `script` no existe, los dos scripts hacen `return` con un warning y **siguen
como si estuviera libre**.

**4. El cierre de cuenta no es determinístico.** El `ROW_NUMBER()` ordena por
fecha, cierres al final, y concepto — sin más desempate. Dos movimientos iguales
del mismo día quedan en orden arbitrario y **qué fila dispara el cierre puede
cambiar entre corridas**.

**5. La regla de PESOS del consolidado 2026 pierde plata.** La condición que
anula `PESOS` mira **los dos** tipos de cambio, pero `DOLARES` solo recupera la
pata efectivo cuando `TC > 0`. En cualquier fila que mezcle una pata convertida
con una pata en pesos sin convertir, **la pata sin convertir desaparece**.

Verificado reproduciendo las fórmulas — efectivo 100.000 ARS sin TC más
transferencia 50.000 ARS a 1.485:

| | PESOS | DOLARES |
|---|---|---|
| 2026 | `NULL` ← se pierden los 100.000 | 34 |
| 2025 | 100.000 | 34 |

**El rediseño de 2026 introdujo el bug.** Hay una query de diagnóstico en la
sección G del documento de arquitectura para medir el impacto real.

*Menores:* el export deja spreadsheets `Temp_...` huérfanos para siempre; la rama
de alerta de errores con gpt-5-mini está cableada pero sin prompt; en el
validador de cierres el comentario y el código discrepan en las columnas.

---

## 6. El modelo de datos

**Decisión central: movimiento + partidas.** Una fila de la planilla lleva hasta
nueve montos con dos tipos de cambio, así que el modelo plano de «un monto y una
moneda por fila» no representa el dominio.

```
movimientos      cabecera: fecha, oficina, contraparte, concepto,
                 categoría, afecta_cta_cte, orden
partidas         una por pata monetaria: medio_pago, moneda_nominal,
                 monto_nominal, tipo_cambio, comision_pct
                 + moneda_impacto y monto_impacto  ← columnas GENERADAS
partida_cheque   detalle 1:1, con el campo estado que hoy no existe
movimientos_audit append-only por trigger
```

Por qué importa: **cada partida resuelve su moneda de impacto de forma
independiente**, así que el bug 5 se vuelve estructuralmente imposible.

Otras decisiones:
- `contrapartes.nombre_norm` es una columna generada con `unique`, lo que hace
  imposible volver a tener «Sanchez» y «sanchez» como dos clientes distintos.
- `movimientos.orden` da un **desempate estable** al saldo corrido, que es lo que
  arregla el bug 4.
- **Los saldos y los cierres son vistas, no tablas.** Se calculan al consultar.
  Eso elimina el botón «Actualizar» y los minutos de espera.
- `afecta_cta_cte` hace explícita la regla de `ALLOWED_SECTIONS`, que hoy es
  implícita: depende de entre qué encabezados cae la fila.

Las migraciones están en `supabase/migrations/`: `0001_schema.sql`,
`0002_vistas.sql`, `0003_rls.sql`. **Escritas, sin aplicar.**

---

## 7. La aplicación

### Stack

Next.js 16.3 (App Router, Turbopack) · React 19.2 · Tailwind 4 (config CSS-first
con `@theme`, **no hay tailwind.config.js**) · Supabase (`@supabase/ssr`) · AG
Grid Community 36 · tsx para scripts.

### Correr

```bash
cd nordelta-ops
npm install
npm run dev          # http://localhost:3000
npm run verificar    # 12 casos de reglas de negocio contra producción
npm run build
```

### Estructura

```
src/lib/domain/     Reglas de negocio. fx.ts espeja las columnas generadas.
src/lib/data/       ÚNICO punto de acceso a datos. La costura a Supabase vive acá.
src/lib/supabase/   Clientes de navegador y servidor.
src/components/ui/  Primitivos. icons.tsx son SVG inline.
src/components/grid/ CargaGrid.tsx — la grilla editable.
src/app/            Rutas. (app)/ es el grupo con el riel lateral.
supabase/migrations Esquema, vistas y RLS.
scripts/            verificar-reglas.mts
```

### Pantallas

| Ruta | Qué es |
|---|---|
| `/` | Landing pública. **Sin ningún dato de cliente, a propósito.** |
| `/login` | Ingreso. Supabase Auth cableado, con modo demo. |
| `/inicio` | Home operativo: neto del día, actividad reciente, qué requiere atención. |
| `/carga` | La grilla editable. **La pantalla que decide el proyecto.** |
| `/cuentas` | Listado de contrapartes con saldo. |
| `/cuentas/[id]` | Cuenta corriente: saldo corrido, cierres, filtro desde el último cierre. |
| `/balance` | Balance general con búsqueda y totales. |
| `/ajustes` | Ajustes de cuenta. Calcula el ajuste que lleva el saldo a cero. |
| `/auditoria` | Registro de cambios. Capacidad nueva. |
| `/api/export` | CSV de balance, cuenta corriente y caja diaria. |

### Reglas de arquitectura que hay que respetar

1. **La lógica financiera no vive en el front.** `src/lib/domain/fx.ts` calcula
   para dar respuesta inmediata en la grilla, pero la autoridad son las columnas
   generadas de Postgres. Si discrepan, **la base tiene razón**.
2. **Todo acceso a datos pasa por `src/lib/data/index.ts`.** Ningún componente
   importa Supabase directamente.
3. **`npm run verificar` tiene que pasar siempre.** Si un caso falla, se cambió
   una regla financiera sin querer.

### Notas de implementación

- **El pegado de rangos desde Excel es feature Enterprise de AG Grid**, no
  Community. Está implementado a mano en `CargaGrid.tsx`: un handler de `paste`
  que parsea el TSV y escribe desde la celda con foco.
- **La grilla usa una fila por partida**, no la fila ancha de 16 columnas. Es más
  simple y mapea 1:1 con la base, pero **falta validarlo con la gente que carga,
  cronómetro en mano contra el Sheet actual**.
- El export es **server-side** a propósito, para que el archivo sea idéntico
  siempre. Usa punto y coma y BOM UTF-8, que es lo que hace que Excel en
  configuración regional argentina lo abra bien.
- Descartados: **Handsontable** (licencia comercial sin beneficio) y
  **Luckysheet/Univer** (resuelven fórmulas escritas por el usuario, que es
  justamente lo que no queremos que vuelva a pasar).

---

## 8. Infraestructura

**Supabase Pro, 25 USD/mes.** El razonamiento importa más que el número: por
volumen entrarían en el plan gratuito de sobra (~50.000 filas/año, menos de 1 GB
en total). Lo que descalifica al Free es que **pausa el proyecto tras una semana
de inactividad y no tiene ningún backup**. PITR son 100 USD/mes más y no está
justificado al arrancar. Con Vercel Pro el total es ~45 USD/mes.

---

## 9. Las 21 preguntas abiertas

**Tres bloquean el esquema definitivo:**

1. **El asiento espejo del proveedor de transferencia.** La query de 2025 emite
   un segundo movimiento a nombre de `Proveedor_Transferencia`, con su propio
   `TC_Transferencia_Proveedor` y su propia `Comision_Proveedor`. **Esa rama no
   existe en la query de 2026.** Si sigue vigente, un movimiento necesita poder
   referenciar dos contrapartes. Si se perdió sin querer al rearmar el dataset,
   **faltan asientos de proveedor desde enero** y es un incidente.
2. **Qué es un «full pago».** Es una de las tres secciones que sí se consolidan,
   pero el código la trata igual que a las otras dos.
3. **Confirmar que un préstamo no es una entidad con capital, interés y plazo.**
   No hay rastro de nada de eso en las 4 queries ni en los 6 scripts: «préstamo»
   parece ser texto libre en el campo Detalle, y el «pasaje automático a dólares»
   es la regla de tipo de cambio. Alcanza una frase de confirmación.

Las otras 18 están en el documento enlazado abajo, agrupadas por quién las
contesta. Las más urgentes para Lucho: qué es una transferencia a móvil, de dónde
sale el tipo de cambio y si hay que preservar cotizaciones históricas, y qué debe
pasar al editar un movimiento viejo.

---

## 10. Salvedad sobre el criterio de aceptación

El criterio acordado es que **ante las mismas entradas, el sistema viejo y el
nuevo produzcan resultados financieros idénticos**. Necesita una excepción
explícita: **tres de los comportamientos del sistema actual son defectos, no
reglas** (los bugs 2, 4 y 5). Si el sistema nuevo los reprodujera, la
conciliación cerraría perfecto y el resultado seguiría estando mal.

La conciliación tiene que hacerse **contra el sistema viejo corregido**, o
documentar cada diferencia esperada antes de empezar a comparar. Es algo a
acordar con el cliente **antes** de la marcha en paralelo.

---

## 11. Gotchas del entorno

- **`/Users/fran/.npm/_cacache` tiene archivos con dueño root** y cualquier
  `npm install` falla con `EACCES`. El workaround sin sudo es exportar
  `npm_config_cache` a un directorio escribible. El fix permanente sería
  `sudo chown -R 501:20 /Users/fran/.npm`.
- **El conector de Supabase no está autorizado** en claude.ai, así que las
  migraciones no se pueden aplicar desde acá.
- **El token de la API de n8n se compartió en un chat** y conviene rotarlo. Se
  usó para extraer el SQL, que ya está documentado acá.

---

## 12. Material de referencia

| Documento | Para qué |
|---|---|
| [Arquitectura, secciones A–L](https://claude.ai/code/artifact/2cbb30af-32c7-4034-9a6c-707539d55e6b) | El principal: mapa del sistema, matriz de reglas, modelo, mapeo legado→nuevo |
| [Las 21 preguntas abiertas](https://claude.ai/code/artifact/c1e0816c-cec5-4cbc-9bb5-4189abeceaab) | Agrupadas por quién las contesta. Es el que conviene llevar a la reunión con Lucho |
| [Plan de migración](https://claude.ai/code/artifact/2143c7db-92e3-4020-8fd5-53e42f137549) | Plan de Supabase, fases, riesgos, costos |
| [Prototipo HTML original](https://claude.ai/code/artifact/85a9224d-acfe-4d74-9f78-66fd929c998a) | Maqueta previa a la app. Superada por el código, se conserva como referencia |
| `Transcripts/*.srt` | Los dos videos de onboarding de Santi. ASR con errores y cuatro cortes de audio |

---

## 13. Qué sigue

1. **Una hora con Lucho.** Es el insumo con mejor relación valor/esfuerzo del
   proyecto: cierra las tres bloqueantes y nueve reglas de negocio.
2. **Correr la query de diagnóstico del bug 5** para saber si es un incidente en
   curso o una posibilidad teórica. Diez minutos.
3. **Autorizar el conector de Supabase** y aplicar las migraciones.
4. **Cronometrar la grilla** contra el Sheet actual con la gente que carga. Si es
   más lenta, no se avanza: se arregla.
5. Avisarle al cliente de los cinco bugs.
