# MVP Next Level — Product Experience Pass

Informe de cierre. Cubre lo que se consolidó, lo que se reescribió, lo que se
encontró mirando las pantallas renderizadas y lo que quedó afuera.

Todo se verificó abriendo cada pantalla en Chrome headless y mirando la
captura. Ninguna pantalla se declaró terminada sin verla renderizada.

---

## A · Sistema de diseño consolidado

Antes había tokens sueltos, dos convenciones de tipografía (`label-mono` y
clases ad hoc) y componentes que cada pantalla adaptaba a mano. Ahora hay un
solo sistema, y se consolidó **antes** de tocar las pantallas.

### Tokens (`src/app/globals.css`)

| Grupo | Tokens | Para qué |
|---|---|---|
| Superficies | `ground`, `surface`, `raised`, `sunken` | fondo, tarjeta, encabezado de tabla, celda calculada |
| Azul estructural | `navy`, `navy-2..4` | riel y paneles oscuros |
| Azul de acción | `brand`, `brand-hi`, `brand-lo`, `brand-wash`, `brand-line` | acción, estado activo, dato convertido |
| Líneas | `line`, `line-soft`, `line-hard` | jerarquía por borde, no por sombra |
| Tinta | `ink`, `ink-2..4`, `on-navy`, `on-navy-2..3` | cuatro niveles de texto |
| Semánticos | `pos`, `neg`, `warn` (+ `-wash`, `-line`) | separados del azul a propósito |
| Elevación | `shadow-e1..e4` | casi imperceptible |

Los neutrales llevan un sesgo azulado: un gris puro al lado de este azul se
lee sucio. Cada token tiene su variante oscura definida.

### Escala tipográfica

Siete niveles como `@utility`, y ni uno más: `t-page`, `t-section`, `t-body`,
`t-secondary`, `t-label`, `t-th`, `t-num`. Si algo no entra en ninguno, sobra.
Los números van siempre tabulares — son el contenido de esta aplicación.

### Componentes (`src/components/ui/`)

`Button`, `Card`, `CardBar`, `CardFoot`, `PageHeader`, `Estado`, `Badge`,
`Field`, `Input`, `Select`, `Buscador`, `FilterTabs`, `Toggle`, `Monto`,
`SinValor`, `TiraDeSaldos`, `Vacio`, `Panel`, `Dato`, `TablaShell`, `Th`,
más `ProveedorDeAvisos` / `usarAvisos` para los avisos.

Decisiones que se tomaron una vez y valen en todas las pantallas:

- **`Estado` en lugar de píldora.** Punto de color más texto. Una tabla llena
  de píldoras rellenas compite con los números.
- **`Monto` con símbolo atenuado y decimales en segundo plano.** El ojo va al
  entero, que es lo que se compara.
- **`SinValor` (`—`) en lugar de `0,00`.** Un cero falso confunde: no es lo
  mismo "no hay saldo" que "el saldo es cero".
- **`TiraDeSaldos`**: una superficie con una columna por moneda, en lugar de
  cuatro tarjetas sueltas. Más compacta y se compara de un barrido.
- **`TablaShell`**: toda tabla ancha scrollea dentro de su contenedor. El
  cuerpo de la página nunca scrollea de costado.
- **El ancho de `Buscador` va en el envoltorio**, no en el input: el input
  lleva `w-full` y le ganaría a cualquier clase de ancho.

---

## B · Pantalla por pantalla

| Pantalla | Qué se hizo |
|---|---|
| **Portada** | Reescrita completa. Encabezado, hero con vista del producto real, tres pilares, sección de producto con la grilla de carga, cierre y pie. |
| **Ingreso** | Dos paneles: formulario a la izquierda, identidad sobre navy a la derecha. En pantalla angosta el panel oscuro desaparece — es acompañamiento, no contenido. |
| **Inicio** | Centro de operaciones. El neto del día por moneda arriba, con ingresos y pagos de apoyo; actividad reciente; requiere atención con iconos; accesos. |
| **Carga** | Barra de herramientas propia con filtros y Deshacer / Nueva fila / Guardar. Dos pies: conteo y estado, y totales por moneda. Avisos por toast. Foco marcado en el número de fila. |
| **Cuentas** | Buscador, `FilterTabs` con conteo por filtro, estado como punto + texto, contador de resultados. |
| **Cuenta corriente** | Las dos tarjetas gigantes se reemplazaron por `TiraDeSaldos`. Libro con pie de totales. Corte de cierre como banda con borde propio, no como línea suelta. |
| **Balance** | Tira de totales por moneda arriba, tabla abajo, nota al pie sobre unicidad. |
| **Ajuste de cuenta** | Previsualización vertical: **saldo actual → + ajuste → = saldo resultante**, con los conectores en el hilo. Solo se listan las monedas en juego. |
| **Auditoría** | Filtros con conteo. El panel muestra **solo los campos que cambiaron**, con antes y después lado a lado. |

---

## C · Portada: el producto, no una maqueta

`src/components/marketing/VistaProducto.tsx` compone dos vistas —cuenta
corriente y grilla de carga— con los **mismos tokens, la misma escala
tipográfica y el mismo componente `Monto`** que la aplicación. No son
rectángulos dibujados: lo que se ve en la portada es lo que se ve al entrar.

Restricción respetada: la portada es una página sin autenticación y **no
muestra ningún dato real**. Los datos de las vistas son los sintéticos del
modo demostración y están rotulados como tales ("Vista real de la aplicación ·
datos de demostración").

---

## D · Problemas encontrados mirando las capturas

Todo lo de esta sección se detectó viendo la pantalla renderizada, no leyendo
el código.

1. **La grilla de carga cortaba la columna de impacto.** Era el peor problema:
   el impacto es el dato que le dice al operador si cargó bien. Las columnas
   sumaban ~1270 px sobre ~1156 disponibles a 1440.
   → Anchos recalculados, contraparte y detalle reparten el espacio libre, y
   **el impacto queda fijado a la derecha** (`pinned: "right"`), así que no
   depende del ancho de la pantalla. Entra completa a 1280 sin scroll.

2. **El bloque de usuario del riel se superponía con la navegación.**
   → `md:grid md:grid-rows-[auto_1fr_auto] md:h-screen md:sticky`.

3. **En la vista del hero se pisaban impacto y saldo** (`+$ 3.200.000,00$
   3.200.000,00`): las columnas no daban.
   → Anchos de la vista corregidos.

4. **La comisión de la vista de carga se partía en dos líneas** y el
   encabezado quedaba truncado.
   → Columna fija de 58 px, `whitespace-nowrap`, y la sección se ensanchó.

5. **En el panel de ingreso la retícula tapaba el contenido** (opacidad .14
   sobre navy) y los tres bloques quedaban dispersos por `justify-between`.
   → Retícula a .06, contenido centrado, "volver" absoluto al pie.

6. **Los rótulos al pie de los tres pilares quedaban a distinta altura.**
   → `flex-col` + `mt-auto`.

7. **El placeholder del buscador de auditoría se cortaba** aunque tenía ancho
   declarado: el `w-full` del input le ganaba a la clase de ancho.
   → `Buscador` acepta `ancho`, que se aplica al envoltorio.

8. **`label-mono` quedaba viva en `ReiniciarDemo.tsx`** después del cambio de
   sistema: una clase que ya no existía.
   → Migrada a `t-label`. Barrido completo: no quedan usos de clases viejas.

### Dos hallazgos que no eran visuales

9. **La grilla prometía impacto en categorías que no van a la cuenta
   corriente.** Un movimiento de categoría `impuesto`, `compra` o `venta`
   mostraba un importe en la columna de impacto y se sumaba al total del día,
   cuando por definición no impacta.
   → Ahora muestra `no impacta` y queda fuera del total, igual que en el
   libro de la cuenta y en Inicio. No se cambió ninguna regla: se dejó de
   mostrar un número que la regla ya decía que no aplica.

10. **La auditoría de la demostración solo tenía altas.** La pantalla no podía
    mostrar lo que la hace valiosa —el antes y el después—.
    → Se sembraron cuatro correcciones históricas (concepto, categoría,
    partidas, nombre de contraparte) con su motivo y su autor. Son registros
    de demostración: no tocan ningún movimiento ni ningún saldo.

---

## E · QA visual

Chrome headless, capturas revisadas una por una:

```
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --no-sandbox --hide-scrollbars \
  --screenshot=salida.png --window-size=1440,900 \
  --virtual-time-budget=8000 http://localhost:3000/carga
```

| Resolución | Estado |
|---|---|
| 1440 × 900 | Las nueve pantallas revisadas. Sin truncamientos en la grilla. |
| 1366 × 768 | Grilla completa sin scroll horizontal. |
| 1280 × 800 | Grilla completa sin scroll horizontal; contraparte y detalle caen a su mínimo. El padding del contenedor baja a `px-4` por debajo de `sm`. |

Las nueve rutas responden 200 y el log del servidor no tiene errores ni
advertencias.

---

## F · Lo que no se tocó

Por indicación explícita, y verificado con `git diff`:

- Reglas financieras y cálculos (`src/lib/domain/dinero.ts`, `fx.ts`,
  `saldos.ts`, `parseo.ts`, `contrapartes.ts`).
- El modelo movimientos + partidas.
- Migraciones (`supabase/migrations/`) y RLS.
- Importador y lógica de tipo de cambio.
- Cierres y su ordenamiento canónico.
- Los doce archivos de test de dominio que ya existían.
- La capa de acceso a datos (`src/lib/data/index.ts`), salvo la siembra de
  auditoría de la demostración, que no es dato financiero.

---

## G · Compuertas de calidad y lo que queda

| Compuerta | Estado |
|---|---|
| `npm test` | **273 pasan**, 54 salteados (los de Supabase, que necesitan instancia). 13 archivos. |
| `npx tsc --noEmit` | limpio |
| `npx eslint src --max-warnings=0` | limpio |
| `npm run build` | compila; 11 rutas |

Nueve tests nuevos en `tests/auditoria.test.ts` cubren el cálculo de
diferencias, que era lógica nueva y sin verificar: distingue el cero del valor
ausente, no lista un campo que quedó igual, e incluye una clave que aparece o
desaparece.

### Lo que queda pendiente

- **Modo oscuro sin interruptor.** Todos los tokens tienen variante oscura y
  la clase `.dark` funciona, pero no hay control en la interfaz. Es una
  decisión de producto, no trabajo pendiente de implementación.
- **Los tests de `tests/supabase/`** (54) siguen sin ejecutarse: necesitan una
  instancia real. Distinción vigente: están `READY TO TEST`, no `TESTED`.
- **El panel de detalle de auditoría y el de un movimiento** se verificaron
  por código y por test, no por captura: Chrome headless no puede hacer clic.
  Por eso se extrajo `diferencias()` a `src/lib/auditoria/diff.ts` y se
  cubrió con tests.
- **Sin push al remoto.** Siguen los commits locales, incluido el de este
  pase, sin subir a `github.com/SWLConsultingIT/Nordelta`.
