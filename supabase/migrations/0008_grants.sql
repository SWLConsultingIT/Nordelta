-- ═══════════════════════════════════════════════════════════════
-- Privilegios.
--
-- Faltaban, y el síntoma fue claro: `permission denied for table
-- organizaciones` incluso con la clave secreta. Postgres tiene **dos
-- puertas** y las dos tienen que estar abiertas:
--
--   · el **grant** decide si el rol puede tocar la tabla;
--   · la **seguridad por fila** decide qué filas ve.
--
-- Un proyecto de Supabase suele traer privilegios por defecto que
-- otorgan lo necesario a los roles estándar cuando se crea una tabla.
-- Depender de eso es frágil —cambia entre proyectos y entre versiones— y
-- deja el esquema incompleto: si mañana se aplica en otro entorno, vuelve
-- a fallar. Los privilegios se declaran acá, explícitos.
--
-- Criterio:
--
--   · `anon` no recibe **nada**. Sin sesión no hay nada que ver, y el
--     ingreso no necesita leer ninguna de estas tablas.
--   · `authenticated` recibe lo que la aplicación efectivamente hace, y
--     nada más. En particular **no recibe DELETE** donde la regla es que
--     nada se borra: sin el grant, la regla deja de depender de que
--     exista o no una política.
--   · `service_role` recibe todo: es la clave que usan las tareas de
--     administración, y salta la seguridad por fila por diseño.
-- ═══════════════════════════════════════════════════════════════

grant usage on schema public to anon, authenticated, service_role;

-- ── Administración ─────────────────────────────────────────────
-- Sembrar, migrar y crear usuarios. Nunca sirve una pantalla.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- ── Aplicación ─────────────────────────────────────────────────
grant execute on all functions in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Solo lectura: se administran fuera de la aplicación.
grant select on organizaciones to authenticated;
grant select on oficinas       to authenticated;
grant select on auditoria      to authenticated;

-- El perfil propio se lee; el nombre se puede editar. El rol y la
-- organización no: los cambia un administrador.
grant select, update on perfiles to authenticated;

-- ── Dominio operativo ──────────────────────────────────────────
-- Sin DELETE en ninguna: en un sistema financiero borrar es perder la
-- evidencia de una operación que involucró dinero.
grant select, insert, update on clientes              to authenticated;
grant select, insert, update on cliente_emails        to authenticated;
grant select, insert, update on planillas             to authenticated;
grant select, insert, update on transferencias        to authenticated;
grant select, insert, update on mapeos_identidad      to authenticated;
grant select, insert         on informes_fullcarga    to authenticated;
grant select, insert         on acreditaciones        to authenticated;
grant select, insert         on resoluciones          to authenticated;
grant select, insert         on conciliacion_corridas to authenticated;
grant select, insert         on transferencia_eventos to authenticated;

-- ── Dominio financiero ─────────────────────────────────────────
-- Acá sí hay baja: el libro admite corregir una carga del día, y hay
-- políticas que la acotan.
grant select, insert, update         on contrapartes   to authenticated;
grant select, insert, update, delete on movimientos    to authenticated;
grant select, insert, update, delete on partidas       to authenticated;
grant select, insert, update, delete on partida_cheque to authenticated;

-- ── Vistas ─────────────────────────────────────────────────────
grant select on v_cta_cte, v_balance, v_ultimo_cierre, v_partidas_detalle
  to authenticated;

-- ── Lo que se cree de ahora en más ─────────────────────────────
-- Para que una tabla nueva no repita este problema. No reemplaza a las
-- líneas de arriba: los privilegios por defecto solo afectan a lo que se
-- crea después de declararlos.
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant all on sequences to service_role;
alter default privileges in schema public
  grant select, insert, update on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
