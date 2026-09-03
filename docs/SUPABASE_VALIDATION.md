# Validación contra Supabase real

La suite de integración está escrita y **no se ejecutó nunca**: el conector de
Supabase sigue sin autorizar. Este documento es lo que hay que hacer para
correrla el día que se autorice.

> **READY TO TEST**, no `TESTED`. Mientras el resultado de esta suite no
> exista, la seguridad por fila está verificada de forma estructural —el SQL
> dice lo correcto y las vistas tienen `security_invoker`— pero **no** punta a
> punta.

---

## 1 · Crear el proyecto

Supabase Pro. El razonamiento del plan está en el documento de arquitectura:
por volumen entra en el gratuito, pero el gratuito **pausa el proyecto tras
una semana de inactividad y no tiene backups**.

Conviene crear **dos** proyectos: uno de pruebas y uno de producción. La suite
borra datos, así que nunca debe apuntar a producción.

## 2 · Aplicar las migraciones

```bash
supabase link --project-ref <ref-del-proyecto-de-pruebas>
supabase db push
```

Se aplican en orden: `0001_schema`, `0002_vistas`, `0003_rls`,
`0004_operaciones`.

**Verificación inmediata**, antes de cualquier test:

```sql
-- Las cuatro vistas tienen que tener security_invoker.
select c.relname, c.reloptions
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'v';

-- RLS activo en las siete tablas.
select relname, relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and relkind = 'r';
```

Si alguna vista sale sin `security_invoker=true`, **frenar**: corre con los
permisos del dueño y saltea la seguridad por fila.

## 3 · Configurar las variables

```bash
export SUPABASE_URL="https://<ref>.supabase.co"
export SUPABASE_ANON_KEY="<anon key>"
export SUPABASE_SERVICE_ROLE_KEY="<service role key>"
```

La `service_role` **solo** se usa para armar y limpiar el escenario: crear
usuarios y asignar perfiles. Ninguna prueba de aislamiento la usa, porque esa
clave saltea la seguridad por fila y haría pasar cualquier test.

**No poner estas variables en `.env.local`.** El repositorio ignora `.env*`,
pero la clave de servicio no debería tocar el disco: va en la sesión de la
terminal y se va con ella.

## 4 · Correr

```bash
npm run test:supabase
```

Sin las variables, la suite se omite con un aviso claro en lugar de fallar.

## 5 · Qué cubre

**54 casos, en cuatro archivos.**

| Archivo | Qué demuestra |
|---|---|
| `auth.test.ts` | Anónimo, autenticado, sin perfil, solo lectura, sesión cerrada, token corrupto. Que el trigger arme el perfil con el alcance más bajo |
| `rls.test.ts` | Usuario A (Nordelta) contra usuario B (Puertos). Cada positiva con su negativa, por tabla, por vista y por RPC |
| `rpc-atomicidad.test.ts` | Camino feliz y fallos forzados en la segunda y la tercera partida, y en el medio de un lote |
| `auditoria.test.ts` | Alta, cambio y baja con actor, antes y después. Que ni un admin pueda reescribir el historial |

El escenario de RLS es deliberado: **A y B están en oficinas distintas**, y
cada prueba de que «A ve lo suyo» va acompañada de «A NO ve lo de B». Una
prueba de seguridad que solo verifica el caso correcto no demuestra
aislamiento.

## 6 · Limpieza

La suite borra lo que crea. Todo dato de prueba lleva la marca
`nordelta-test`:

- los movimientos, en `origen->>'source_system'`;
- las contrapartes, en el nombre;
- los usuarios, que se eliminan de `auth.users`.

Si una corrida se interrumpe, la limpieza manual es:

```sql
delete from movimientos where origen->>'source_system' = 'nordelta-test';
delete from contrapartes where nombre like 'nordelta-test%';
-- Los usuarios, desde el panel de Auth: filtrar por «nordelta-test».
```

## 7 · Después de la suite: medir

Con datos cargados, medir las cuatro consultas del camino caliente. **No
agregar índices sin evidencia.**

```sql
explain (analyze, buffers) select * from v_cta_cte where contraparte_id = $1;
explain (analyze, buffers) select * from v_balance;
explain (analyze, buffers)
  select * from movimientos where fecha = $1 and oficina_id = $2 order by orden;
explain (analyze, buffers)
  select id, nombre from contrapartes where nombre_norm like $1 and activo;
```

Los índices que existen y para qué están:

| Índice | Para |
|---|---|
| `movimientos_dia_idx` | La carga del día |
| `movimientos_cta_cte_idx` | La cuenta corriente. Es parcial: solo lo que afecta el saldo |
| `partidas_movimiento_idx` | El join de partidas |
| `contrapartes_nombre_norm_key` | La búsqueda y la unicidad |

Si `v_cta_cte` sobre una contraparte con mucho historial no usa
`movimientos_cta_cte_idx`, ahí hay algo que mirar. Antes de eso, no.

## 8 · Resultado

| | |
|---|---|
| Fecha de ejecución | |
| Proyecto | |
| `auth.test.ts` | |
| `rls.test.ts` | |
| `rpc-atomicidad.test.ts` | |
| `auditoria.test.ts` | |
| Consultas medidas | |
| Índices agregados | ninguno, salvo evidencia |

**Estado actual: NOT RUN.**
