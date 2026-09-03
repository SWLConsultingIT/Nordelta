-- ═══════════════════════════════════════════════════════════════
-- Seguridad por fila.
--
-- El sistema legacy no tiene ninguna noción de usuario: nada registra quién
-- cargó, editó o borró, y el semáforo de concurrencia **falla en abierto**
-- (ante cualquier problema sigue como si estuviera libre). Todo lo de acá
-- está diseñado al revés: ante la duda, no se ve y no se escribe.
--
-- El modelo de roles concreto queda pendiente de definición del cliente
-- (docs/OPEN_BUSINESS_DECISIONS.md · D9). Lo de abajo es el mínimo
-- razonable y es deliberadamente restrictivo.
-- ═══════════════════════════════════════════════════════════════

create type rol as enum ('admin','supervisor','operador','lectura');

create table perfiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  nombre             text not null default '',
  -- El rol más bajo por defecto: hace falta que un admin lo eleve.
  rol                rol  not null default 'lectura',
  -- Alcance por oficina. Un perfil recién creado tiene
  -- `todas_las_oficinas = false` y `oficina_id = null`, así que **no ve
  -- nada** hasta que un administrador lo habilite. Es a propósito: el
  -- default de un sistema financiero no puede ser «ve todo».
  todas_las_oficinas boolean not null default false,
  oficina_id         smallint references oficinas(id),
  created_at         timestamptz not null default now()
);

-- Un usuario de auth sin perfil no podría hacer nada, ni siquiera saber por
-- qué. El perfil se crea solo, con el alcance más bajo posible.
create or replace function fn_crear_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into perfiles (id, nombre)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', new.email, ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger trg_crear_perfil
  after insert on auth.users
  for each row execute function fn_crear_perfil();

-- ── Funciones de permiso ───────────────────────────────────────
-- `stable` y `security definer` para poder leer `perfiles` desde dentro de
-- las políticas sin caer en recursión de RLS.

create or replace function fn_rol() returns rol
language sql stable security definer set search_path = public as $$
  select rol from perfiles where id = auth.uid()
$$;

create or replace function fn_puede_escribir() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(fn_rol() in ('admin','supervisor','operador'), false)
$$;

create or replace function fn_puede_ver_oficina(oid smallint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from perfiles
    where id = auth.uid()
      and (todas_las_oficinas or oficina_id = oid)
  )
$$;

-- ── Activación ─────────────────────────────────────────────────

alter table perfiles       enable row level security;
alter table oficinas       enable row level security;
alter table contrapartes   enable row level security;
alter table movimientos    enable row level security;
alter table partidas       enable row level security;
alter table partida_cheque enable row level security;
alter table auditoria      enable row level security;

-- ── Perfiles ───────────────────────────────────────────────────

create policy perfiles_ver_propio on perfiles for select
  using (id = auth.uid() or fn_rol() = 'admin');

create policy perfiles_admin_escribe on perfiles for all
  using (fn_rol() = 'admin') with check (fn_rol() = 'admin');

-- ── Maestros ───────────────────────────────────────────────────

create policy oficinas_leer on oficinas for select
  using (auth.uid() is not null);

create policy contrapartes_leer on contrapartes for select
  using (auth.uid() is not null);

create policy contrapartes_escribir on contrapartes for insert
  with check (fn_puede_escribir());

create policy contrapartes_editar on contrapartes for update
  using (fn_rol() in ('admin','supervisor')) with check (fn_rol() in ('admin','supervisor'));

-- Una contraparte no se borra: se desactiva. Borrarla dejaría movimientos
-- históricos apuntando a la nada.
create policy contrapartes_no_borrar on contrapartes for delete
  using (false);

-- ── Movimientos ────────────────────────────────────────────────

create policy movimientos_leer on movimientos for select
  using (fn_puede_ver_oficina(oficina_id));

create policy movimientos_crear on movimientos for insert
  with check (fn_puede_escribir() and fn_puede_ver_oficina(oficina_id));

-- Editar un movimiento histórico mueve saldos y cierres posteriores, así
-- que queda arriba del rol de operador. Qué debe pasar exactamente al
-- editar historia es una decisión abierta (D8).
create policy movimientos_editar on movimientos for update
  using (fn_rol() in ('admin','supervisor') and fn_puede_ver_oficina(oficina_id))
  with check (fn_puede_ver_oficina(oficina_id));

-- En un libro contable la corrección normal es un asiento de ajuste, no un
-- delete. Queda reservado a administración.
create policy movimientos_borrar on movimientos for delete
  using (fn_rol() = 'admin' and fn_puede_ver_oficina(oficina_id));

-- ── Partidas ───────────────────────────────────────────────────
-- Heredan el permiso de su movimiento. Se separan lectura y escritura para
-- que un operador pueda crear pero no reescribir historia.

create policy partidas_leer on partidas for select
  using (exists (
    select 1 from movimientos m
    where m.id = movimiento_id and fn_puede_ver_oficina(m.oficina_id)));

create policy partidas_crear on partidas for insert
  with check (fn_puede_escribir() and exists (
    select 1 from movimientos m
    where m.id = movimiento_id and fn_puede_ver_oficina(m.oficina_id)));

create policy partidas_editar on partidas for update
  using (fn_rol() in ('admin','supervisor') and exists (
    select 1 from movimientos m
    where m.id = movimiento_id and fn_puede_ver_oficina(m.oficina_id)))
  with check (exists (
    select 1 from movimientos m
    where m.id = movimiento_id and fn_puede_ver_oficina(m.oficina_id)));

create policy partidas_borrar on partidas for delete
  using (fn_rol() in ('admin','supervisor') and exists (
    select 1 from movimientos m
    where m.id = movimiento_id and fn_puede_ver_oficina(m.oficina_id)));

create policy partida_cheque_todo on partida_cheque for all
  using (exists (
    select 1 from partidas p join movimientos m on m.id = p.movimiento_id
    where p.id = partida_id and fn_puede_ver_oficina(m.oficina_id)))
  with check (fn_puede_escribir() and exists (
    select 1 from partidas p join movimientos m on m.id = p.movimiento_id
    where p.id = partida_id and fn_puede_ver_oficina(m.oficina_id)));

-- ── Auditoría ──────────────────────────────────────────────────
-- Solo lectura, y solo para quien audita. La escritura la hace el trigger,
-- que corre como `security definer` y no pasa por estas políticas.
--
-- No hay política de INSERT, UPDATE ni DELETE: con RLS activo, la ausencia
-- de política **deniega**. Es append-only por construcción, no por
-- convención — ni un admin puede reescribir el historial desde la app.

create policy auditoria_leer on auditoria for select
  using (fn_rol() in ('admin','supervisor'));
