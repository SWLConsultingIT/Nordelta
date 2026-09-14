# Reporte semanal para el cliente

Un PDF de **una hoja A4** todos los viernes: qué hicimos, qué quedó
pendiente de nuestro lado, qué necesitamos del cliente y qué sigue.

```
npm run weekly-report -- --from 2026-09-07 --to 2026-09-11
```

Sin fechas toma el lunes a viernes de la semana en curso, que es el caso de
todos los viernes:

```
npm run weekly-report
```

La salida va a `Salidas/Reportes/Pagos Nordelta - Weekly Report - AAAA-MM-DD.pdf`
—fuera del repositorio, porque es material para el cliente— junto con una
vista previa en PNG en `.vistas/` para revisarlo sin abrir el PDF.

## Qué sale solo y qué se carga a mano

**Del repositorio** sale el *Progreso semanal*, y nada más. El generador lee
los commits del período, mira **qué rutas se tocaron** y de ahí deduce qué
temas hubo. Un tema entra al reporte si —y solo si— hubo commits que
tocaron sus rutas.

Lo que el generador **no** hace es redactar. Las frases están escritas de
antemano en `scripts/reporte/temas.ts` y revisadas una vez; el changelog
decide cuáles aparecen y en qué orden, no qué dicen. Es la diferencia entre
un reporte que se puede mandar sin leerlo y uno que hay que auditar todas
las semanas.

Tampoco sale una sola palabra del repositorio al PDF: ni asuntos de commit,
ni hashes, ni ramas, ni rutas de archivo. Hay un test que lo comprueba
armando un changelog con lo peor que podría traer un commit.

**A mano** va todo lo demás, en un archivo por semana:

```
reports/weekly/2026-09-11.json     ← la fecha es la del VIERNES
```

Si no existe, el generador lo crea en blanco la primera vez. Se copia de
`reports/weekly/_PLANTILLA.json`.

```json
{
  "weekStart": "2026-09-07",
  "weekEnd": "2026-09-11",
  "status": "ON TRACK",
  "progressExtra": ["logros que el changelog no puede ver"],
  "pending":   ["abierto de NUESTRO lado"],
  "openItems": ["lo que necesitamos del CLIENTE"],
  "nextSteps": ["qué hacemos la semana que viene"]
}
```

`pending` y `openItems` no se mezclan: uno es nuestra deuda y el otro la de
ellos, y el reporte los pone enfrentados justamente para que se lea la
diferencia.

`status` acepta `ON TRACK`, `AT RISK`, `BLOCKED` o `null`. **En `null` el PDF
sale sin sello**, a propósito: un estado general es una afirmación
comercial y no se deduce de un changelog.

## Topes

Seis viñetas de progreso, cinco de cada una de las otras tres. Lo que sobra
se recorta y el comando avisa cuánto recortó. Es un resumen ejecutivo, no
un changelog: si hay más de seis cosas importantes en una semana, elegir
cuáles son las seis es parte del trabajo.

## Validación

El comando no dice que salió bien porque el archivo exista. Antes de
imprimir mide el alto real del contenido contra la hoja; después verifica
el PDF ya escrito. Si algo no entra, hay texto cortado o el documento se
fue a dos páginas, **termina con error** y lo dice.

## Cuando aparece un tema nuevo

Si se trabajó en algo que no encaja en ningún tema, el comando lista esas
rutas bajo «Sin clasificar» y **no las inventa en el reporte**. Ahí hay que
agregar un tema a `scripts/reporte/temas.ts` con la frase que corresponda,
o dejarlo así si no es trabajo que le interese al cliente.
