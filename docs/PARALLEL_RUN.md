# Runbook · marcha en paralelo

Un mes calendario cargando en los dos sistemas y conciliando todos los días.
Es caro y molesto, y es lo único que compra confianza en un sistema contable.

---

## Antes de arrancar

### Requisitos que no se negocian

| | Evidencia |
|---|---|
| La suite de Supabase pasó | `docs/SUPABASE_VALIDATION.md` completado |
| D1 y D2 resueltas | `docs/OPEN_BUSINESS_DECISIONS.md` actualizado |
| La carga no es más lenta que el Excel | `docs/CARGA_USABILITY_TEST.md` con números |
| El histórico importado y conciliado | `reconciliation/RESUMEN.md` sin diferencias sin explicar |
| El cliente aceptó las diferencias esperadas | Por escrito, en el grupo de WhatsApp alcanza |

El último importa más de lo que parece. **Cuatro de los seis defectos legacy
producen números incorrectos.** Si el cliente no acordó de antemano que el
sistema nuevo va a diferir del viejo en esos casos, cada diferencia se va a
discutir como si fuera un error nuestro.

### Respaldos

1. **Snapshot del legacy.** Copia de los Sheets del mes en curso y del
   anterior, en una carpeta con la fecha, en solo lectura. No se toca más.
2. **Export de BigQuery.** `Consolidado.Cheques-Transacciones` y
   `Balance.balance_final` a CSV. Es el punto de comparación para toda la
   conciliación.
3. **Backup de Supabase.** El plan Pro hace backup diario. Verificar que
   existe **y probar la restauración** antes de empezar: un backup que nunca
   se restauró no es un backup.

### Importación del histórico

```bash
npm run migrar:legacy -- --dry-run <export.csv> --hoja "<nombre>" --salida reconciliation
```

Mirar `reconciliation/RESUMEN.md` **antes** de escribir nada. Criterio de
avance:

- `UNEXPLAINED_DIFFERENCE` = 0;
- `INVALID_SOURCE` revisado fila por fila y resuelto o aceptado;
- `BLOCKED_BUSINESS_RULE` = 0 después de resolver D1 y D3;
- la clasificación cierra: analizadas + vacías = total del archivo.

---

## Durante

### Quién carga y dónde

**Los dos sistemas, todos los días, los mismos movimientos.** No dividir el
trabajo: la comparación necesita los mismos datos en los dos lados.

| | |
|---|---|
| Sistema de referencia | El Sheet. Sigue siendo el oficial durante todo el mes |
| Sistema en prueba | Nordelta web |
| Orden | Primero el Sheet, después la web. Si algo falla en la web, el día ya está cargado donde corresponde |
| Quién | Las mismas personas de siempre, en sus oficinas |

El doble trabajo es real y hay que decirlo de frente al equipo. Un mes.

### Qué se compara y cada cuánto

**Todos los días, al cierre.** Por contraparte y por moneda:

| Comparación | Legacy | Nuevo |
|---|---|---|
| Saldo por contraparte y moneda | `Balance.balance_final` | `v_balance` |
| Movimientos del día | Hoja del día | `/carga` con esa fecha |
| Cierres de cuenta detectados | Filas `Cuenta Cerrada` | `v_cta_cte` con `es_cierre` |

**Nunca sumar monedas distintas.** Un total mezclado de pesos, dólares, euros
y reales no significa nada y esconde diferencias.

Quince minutos por día. Si tarda más, algo está mal en la herramienta de
comparación, no en el proceso.

### Bitácora

Una fila por día en una planilla compartida:

| Fecha | Movimientos legacy | Movimientos nuevo | Diferencias | Sin explicar | Quién concilió |
|---|---|---|---|---|---|

---

## Diferencias

### Clasificación

Toda diferencia entra en una de estas. Si no entra en ninguna, es del último
tipo por definición.

| Tipo | Qué es | Acción |
|---|---|---|
| **Esperada** | Bug legacy documentado (5 o 6) | Anotar el monto. **El nuevo es el correcto** |
| **Error de carga** | Alguien cargó distinto en cada sistema | Corregir el que esté mal. No es una diferencia del sistema |
| **Regla no implementada** | El nuevo no hace algo que el viejo sí | Escalar. Puede ser una regla que nadie contó |
| **Sin explicar** | Ninguna de las anteriores | **Frenar la conciliación del día y escalar** |

### Escalamiento

| Tipo | A quién | Cuándo |
|---|---|---|
| Esperada | Nadie, se anota | — |
| Error de carga | Quien cargó | El mismo día |
| Regla no implementada | Lucho | Dentro de 24 h |
| Sin explicar | Equipo técnico | **En el momento** |

Una diferencia sin explicar es la señal más importante de todo el proceso:
significa que hay una regla que ninguno de los dos lados entendió. **No se
sigue cargando hasta entenderla.** Esa es la única razón para pausar la
marcha en paralelo.

### Resolución

Toda diferencia se cierra con una de estas tres:

1. **Se corrige el sistema nuevo** y se agrega un test de regresión. Sin el
   test, la corrección no está terminada.
2. **Se documenta como diferencia esperada** en `LEGACY_BUGS.md`, con el
   monto.
3. **Se corrige el dato** en el sistema donde estaba mal.

---

## Criterio de éxito

Para avanzar al corte hacen falta las cinco:

| | |
|---|---|
| Un mes calendario completo | Sin saltear días |
| Cero diferencias sin explicar en los últimos quince días | El arranque puede tener ruido; el final no |
| Todas las diferencias esperadas cuantificadas y aceptadas | Por escrito |
| Los saldos coinciden al centavo, descontando las esperadas | Por contraparte y por moneda |
| El equipo prefiere el sistema nuevo | Preguntado explícitamente, no supuesto |

La última no es blanda. Si al final del mes preferirían volver al Excel, el
sistema no está listo, por más que los números cierren.

---

## Rollback

### Durante la marcha en paralelo

No hace falta rollback: el Sheet sigue siendo el sistema oficial. Si la web
falla, se deja de cargar ahí y se sigue normal. **Ese es todo el valor de
correr en paralelo.**

### Después del corte

| Problema | Respuesta |
|---|---|
| Un saldo mal en una contraparte | Asiento de ajuste. No editar historia |
| Una regla mal implementada | Corregir, agregar test, recalcular. Las vistas se recalculan solas |
| Pérdida de datos | Restaurar del backup diario. Pérdida máxima: un día de carga |
| Falla que no se resuelve en el día | **Volver al Sheet.** Está congelado, no borrado |

### Volver al Sheet

Es viable durante los primeros tres meses después del corte, con este costo:

1. Los Sheets se reabren para escritura.
2. Se exportan los movimientos cargados en la web desde el corte
   (`/api/export`) y se cargan a mano en las hojas del día.
3. Se corre el consolidado y la cadena de queries del legacy.
4. Se verifica que el balance coincida con `v_balance` del sistema nuevo.

El paso 2 es manual y es el que duele. Por eso los Sheets se congelan en
lugar de archivarse, y por eso los workflows de n8n **no se borran hasta los
tres meses**: se pausan.

### Qué NO se hace en el corte

- No borrar los Sheets.
- No borrar el proyecto de BigQuery.
- No eliminar los workflows de n8n — pausarlos.
- No dar de baja la service account.

Todo eso se da de baja a los tres meses del corte, con el sistema nuevo
funcionando y conciliado.

---

## Estado

**NO INICIADA.** Faltan los cinco requisitos de la primera sección.
