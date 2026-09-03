# Checklist de pase a producción

Cada ítem se marca **solo con evidencia verificable**: un test que corrió, un
número medido, una decisión escrita. Nada se marca por criterio.

Convención: `[x]` hecho con evidencia · `[~]` preparado pero sin ejecutar ·
`[ ]` sin empezar.

---

## Infraestructura y seguridad

- [~] **Esquema aplicado en Supabase real** — las 4 migraciones aplican en PostgreSQL 18 vía PGlite (`tests/db-paridad.test.ts`), pero nunca en un proyecto Supabase. El conector sigue sin autorizar.
- [~] **Auth probado punta a punta** — 9 casos escritos en `tests/supabase/auth.test.ts`. `NOT RUN`.
- [~] **RLS probado punta a punta, con casos negativos** — 17 casos en `tests/supabase/rls.test.ts`, con usuario A y usuario B en oficinas distintas. `NOT RUN`.
- [~] **`security_invoker` verificado en Supabase** — verificado en PGlite; el chequeo para el proyecto real está en `SUPABASE_VALIDATION.md` § 2.
- [~] **RPC atómicas probadas** — 14 casos con fallos forzados en `tests/supabase/rpc-atomicidad.test.ts`. `NOT RUN`.
- [~] **Auditoría probada, incluida su inmutabilidad** — 14 casos en `tests/supabase/auditoria.test.ts`. `NOT RUN`.
- [x] **Sin secretos en el repositorio** — historial completo revisado; el token de n8n no está en ningún commit.
- [x] **Perfiles fail-safe** — un perfil nuevo arranca en `lectura` y sin oficina: no ve nada hasta que un admin lo habilite.
- [ ] **Backup probado con una restauración real** — el plan Pro hace backup diario, pero nunca se restauró.

## Corrección financiera

- [x] **Paridad entre el dominio y Postgres** — 33 casos en `tests/db-paridad.test.ts` contra PostgreSQL 18 real: columnas generadas, saldo corrido y detección de cierre.
- [x] **Redondeo con la semántica de `numeric`** — mitad alejándose del cero, y suma antes de redondear. `tests/dinero.test.ts`.
- [x] **Bug 5 imposible de reproducir** — 1023 combinaciones de patas verificadas en `tests/bug5-regresion.test.ts`.
- [x] **Bug 6 imposible de reproducir** — detector y regresión en `tests/migracion.test.ts`.
- [x] **Cierres determinísticos** — 25 mezclas del historial dan la misma huella. `tests/cierres.test.ts`.
- [x] **Movimientos idénticos sobreviven** — el bug 2 del legacy no puede volver.
- [x] **Regla de afectación explícita** — `afecta_cta_cte` con CHECK; no depende de la posición de una fila.
- [x] **Monedas nunca sumadas entre sí** — verificado en `v_balance` y en los reportes.

## Migración del histórico

- [~] **Importador con dry-run** — implementado y probado con un archivo sintético. 34 casos en `tests/importador.test.ts`.
- [x] **Cero pérdida silenciosa** — la suma de los cinco estados más las vacías da el total del archivo, y hay un test que lo exige.
- [x] **Trazabilidad al origen** — sistema, archivo, hoja, fila y `legacy_id` en cada movimiento; índice único para idempotencia.
- [ ] **Export del histórico legacy recibido** — no lo tenemos. Es el bloqueante de todo lo que sigue.
- [ ] **100 % de filas legacy clasificadas** — `NOT YET MEASURABLE`.
- [ ] **Cero diferencias sin explicar sobre datos reales** — `NOT YET MEASURABLE`.
- [ ] **Bugs 5 y 6 cuantificados en dinero real** — el tooling está listo; falta el dato.

## Decisiones de negocio

- [ ] **D1 · asiento espejo del proveedor** — `OPEN`. Bloqueante del esquema. Matriz de decisión en `LUCHO_MEETING.md` § 1.
- [ ] **D2 · qué es un full pago** — `OPEN`. Bloqueante. `LUCHO_MEETING.md` § 2.
- [ ] **D3 · Egresos y Gastos** — `OPEN`. El importador marca esas filas como `BLOCKED_BUSINESS_RULE`.
- [ ] **D5 · origen y preservación del tipo de cambio** — `OPEN`. Decide si hace falta una tabla de cotizaciones.
- [ ] **D7 · cuándo impacta un cheque, y el rechazo** — `OPEN`. El campo `estado` existe; la regla no está definida.
- [ ] **D8 · edición de movimientos históricos** — `OPEN`. La infraestructura está lista.
- [ ] **D9 · usuarios y permisos** — `OPEN`. El modelo actual es el mínimo restrictivo, no el definitivo.
- [x] **D4 · préstamos** — cerrado por evidencia: no hay entidad de préstamo en las 4 queries ni en los 6 Apps Script. Falta confirmación verbal, no cambia el esquema.

Las catorce, con su prioridad, en `OPEN_BUSINESS_DECISIONS.md`.

## Experiencia de carga

- [~] **Protocolo de medición** — cinco tests definidos en `CARGA_USABILITY_TEST.md`. `NO EJECUTADO`.
- [~] **Instrumentación** — la grilla mide pegado y guardado en desarrollo.
- [ ] **La carga no es más lenta que el Excel** — sin ningún número medido. Es el criterio que decide el proyecto y **no tiene evidencia**.
- [x] **Pegado desde Excel funciona con formato argentino** — `2.400.000,00` entra bien; 50 casos en `tests/dinero.test.ts`.
- [x] **Pegado normaliza valores del dominio** — «Ingresos» y «Dólares» se interpretan; lo que no se puede interpretar queda marcado.
- [x] **Teclado** — Tab, Enter, Supr y ⌘Z con pila de 50 pasos.

## Operación

- [x] **Capa de datos única** — cero acceso a Supabase fuera de ella, verificado por grep.
- [x] **Observabilidad mínima** — correlación, usuario, acción, momento, clase de error y duración, con lista de campos prohibidos. 9 casos en `tests/observabilidad.test.ts`.
- [x] **Export compatible con Excel argentino** — punto y coma y BOM UTF-8. 11 casos en `tests/export.test.ts`.
- [x] **Runbook de marcha en paralelo** — `PARALLEL_RUN.md`.
- [x] **Rollback documentado** — `PARALLEL_RUN.md` § Rollback, con su costo real.
- [ ] **Marcha en paralelo conciliada** — `NO INICIADA`.
- [ ] **Los seis defectos informados al cliente** — pendiente. Conviene llevar el número en dinero, no solo el hallazgo.

## Calidad

- [x] `npm test` — 246 pasan, 0 fallan.
- [x] `npm run build` — sin errores.
- [x] `npx tsc --noEmit` — sin errores.
- [x] `npx eslint` — sin warnings.
- [x] Verificación de runtime — 9 rutas y 3 exports en 200, sin errores en el log.
- [~] `npm run test:supabase` — 54 casos escritos, `NOT RUN`.

---

## Cómputo

| | Con evidencia | Preparado | Sin empezar | Total |
|---|---:|---:|---:|---:|
| Infraestructura y seguridad | 2 | 6 | 1 | 9 |
| Corrección financiera | 8 | 0 | 0 | 8 |
| Migración del histórico | 2 | 1 | 4 | 7 |
| Decisiones de negocio | 1 | 0 | 7 | 8 |
| Experiencia de carga | 3 | 2 | 1 | 6 |
| Operación | 5 | 0 | 2 | 7 |
| Calidad | 5 | 1 | 0 | 6 |
| **Total** | **26** | **10** | **15** | **51** |

**26 de 51 ítems con evidencia: 51 %.**

El porcentaje sale de contar este checklist, nada más. No es una estimación de
cuánto falta en tiempo, y conviene no leerlo así: los quince ítems sin empezar
incluyen dos que dependen de una sola reunión y cuatro que dependen de un
archivo que todavía no tenemos.

## Los tres bloqueantes

Todo lo demás está preparado y esperando a estos tres:

1. **Autorizar el conector de Supabase** → habilita 6 ítems de infraestructura.
2. **Un export del histórico legacy** → habilita 4 ítems de migración y la
   cuantificación en dinero de los bugs 5 y 6.
3. **Una hora con Lucho** → habilita D1, D2, D3, D5, D7 y D8.

Ninguno de los tres es trabajo nuestro.
