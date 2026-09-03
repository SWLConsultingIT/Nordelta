# Protocolo de prueba · carga diaria

Compara **Excel legacy** contra **Nordelta web** cargando exactamente el
mismo trabajo. El objetivo no es confirmar que la aplicación es mejor: es
**medirlo**. Si sale más lenta, se arregla antes de avanzar.

> No cambiar la interfaz antes de correr esto. Cualquier rediseño sin la
> medición de base es una opinión.

---

## Antes de empezar

**Quién** · La persona que carga todos los días, no alguien del equipo
técnico. Idealmente dos personas, para tener dos muestras.

**Qué hace falta**

- La planilla del mes en curso, abierta y lista.
- La aplicación en `/carga`, con la fecha y la oficina ya elegidas.
- Un cronómetro. El del teléfono alcanza.
- Este documento impreso o en otra pantalla.

**Qué decirle a quien prueba**

> Vamos a cargar el mismo trabajo dos veces, una en cada sistema. No estamos
> evaluándote a vos: estamos midiendo el sistema. Si algo te traba, decilo en
> voz alta — eso es justamente lo que queremos anotar.

**Orden** · Alternar quién va primero entre las dos personas. Quien carga
segundo ya conoce los datos y va más rápido; alternando, ese efecto se
reparte.

**Datos** · Usar movimientos reales del día anterior, no inventados. Un dato
inventado no tiene los casos raros que hacen lento el trabajo real.

---

## Test A · Diez movimientos a mano

Diez movimientos simples de una sola pata: efectivo, sin tipo de cambio.

Se cronometra desde que empieza a escribir el primero hasta que el décimo
queda guardado.

| Métrica | Excel | Web |
|---|---|---|
| Tiempo total | | |
| Tiempo por movimiento | | |
| Veces que usó el mouse | | |
| Teclas de más (correcciones) | | |
| Errores que quedaron cargados | | |
| Veces que se trabó o dudó | | |

---

## Test B · Cincuenta movimientos pegados desde Excel

Se le da un bloque de cincuenta filas ya armado en Excel. Tiene que llevarlo
al sistema.

En Excel es copiar y pegar. En la web es copiar y pegar sobre la grilla.

| Métrica | Excel | Web |
|---|---|---|
| Tiempo total | | |
| El pegado entró completo | sí / no | sí / no |
| Valores que quedaron mal interpretados | | |
| Correcciones necesarias después de pegar | | |

**Qué mirar con atención en la web**

- Que los montos con separador de miles entren bien (`2.400.000,00`).
- Que las categorías escritas en texto se interpreten (`Ingresos`).
- Que las monedas escritas se interpreten (`Dólares`, `u$s`).
- Que un valor que no se pueda interpretar **quede marcado** y no se invente.

---

## Test C · Una operación mixta

Un movimiento con **efectivo más transferencia, con comisión y tipo de
cambio**. Es el caso donde el sistema legacy pierde plata.

| Métrica | Excel | Web |
|---|---|---|
| Tiempo | | |
| Quedó bien cargado | sí / no | sí / no |
| Tuvo que calcular algo a mano | sí / no | sí / no |
| Vio el resultado en dólares antes de guardar | sí / no | sí / no |

**Lo importante acá no es el tiempo.** Es si el operador puede ver, antes de
guardar, qué va a impactar en la cuenta del cliente. En la planilla eso se ve
recién después de consolidar.

---

## Test D · Corregir un error

Se le pide cargar un movimiento con un error deliberado —un monto con un
dígito de más— y después corregirlo.

| Métrica | Excel | Web |
|---|---|---|
| Tiempo hasta detectar el error | | |
| Tiempo hasta corregirlo | | |
| El sistema lo avisó solo | sí / no | sí / no |
| Se pudo deshacer | sí / no | sí / no |

---

## Test E · Buscar y modificar un movimiento de otro día

Se le pide encontrar un movimiento de la semana pasada de un cliente y
cambiarle el concepto.

| Métrica | Excel | Web |
|---|---|---|
| Tiempo hasta encontrarlo | | |
| Cuántas pantallas o pestañas abrió | | |
| Lo encontró | sí / no | sí / no |

En la planilla esto implica saber en cuál de dos archivos y en cuál de
sesenta y dos hojas está. Es la prueba donde más ventaja debería sacar la
aplicación — si no la saca, algo está mal en la búsqueda.

---

## Métricas instrumentadas

La grilla mide sola, en desarrollo, la duración del pegado y del guardado. Al
final de la sesión, en la consola del navegador:

```js
import("/_next/static/chunks/...")  // o directamente:
window.__nordeltaMediciones          // el detalle crudo
```

Y para el resumen con percentiles, desde el código de la aplicación:
`resumenDeMediciones()` en `src/lib/observabilidad/medicion.ts`.

Eso da los números de máquina. Los de arriba son los números de persona, que
son los que deciden.

---

## Criterio de resultado

| Resultado | Qué significa | Qué hacemos |
|---|---|---|
| **La web es más rápida** en A y B | El proyecto está en camino | Se avanza |
| **Empatan** | Aceptable: la web gana en C, D y E igual | Se avanza, anotando qué molestó |
| **La web es más lenta** en A o B | No se avanza | Se arregla y se vuelve a medir |

La aplicación puede permitirse ser un poco más lenta en el Test A —una
operación suelta— si gana claramente en B, D y E. Lo que no puede pasar es
ser más lenta en el pegado, que es el caso de volumen.

---

## Qué anotar aparte de los números

Las frases textuales. «Acá no sé qué poner», «esto en el Excel lo hacía con
una tecla», «¿por qué no me deja?». Eso vale más que los milisegundos: dice
exactamente qué hay que cambiar.

Y sobre todo, la pregunta del final:

> Si mañana tuvieras que cargar el día entero en uno de los dos, ¿cuál
> elegís?

---

## Resultado

| | |
|---|---|
| Fecha | |
| Quién probó | |
| Quién tomó el tiempo | |
| Test A | Excel ___ · Web ___ |
| Test B | Excel ___ · Web ___ |
| Test C | Excel ___ · Web ___ |
| Test D | Excel ___ · Web ___ |
| Test E | Excel ___ · Web ___ |
| Veredicto | más rápida / igual / más lenta |
| Qué hay que arreglar | |

**Estado actual: NO EJECUTADO.** No hay ningún número medido todavía, y por
eso el estado de la carga en `PRODUCTION_READINESS.md` figura sin evidencia.
