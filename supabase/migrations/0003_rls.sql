-- ═══════════════════════════════════════════════════════════════
-- Seguridad por fila.
--
-- El sistema actual no tiene ninguna noción de usuario: nada registra
-- quién cargó, editó o borró. Este archivo es la política mínima
-- razonable, y queda pendiente definirla con el cliente: quién puede
-- ver qué oficina, quién puede borrar y quién puede cargar un ajuste.
-- ═══════════════════════════════════════════════════════════════

create type rol as enum ('admin','supervisor','operador','lectura');

create table perfiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nombre     text not null default '',
  rol        rol  not null default 'operador',
  -- Null significa acceso a todas las oficinas.
  oficina_id smallint references oficinas(id),
  created_at timestamptz not null default now()
);

alter table perfiles          enable row level security;
alter table oficinas          enable row level security;
alter table contrapartes      enable row level security;
alter table movimientos       enable row level security;
alter table partidas          enable row level security;
alter table partida_cheque    enable row level security;
alter table movimientos_audit enable row level security;

create or replace function fn_rol() returns rol
language sql stable security definer set search_path = public as $$
  select rol from perfiles where id = auth.uid()
$$;

create or replace function fn_puede_ver_oficina(oid smallint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from perfiles
    where id = auth.uid()
      and (oficina_id is null or oficina_id = oid)
  )
$$;

-- Cada quien ve su perfil; los admin ven todos.
create policy perfiles_select on perfiles for select
  using (id = auth.uid() or fn_rol() = 'admin');

-- Los maestros los lee cualquier usuario autenticado.
create policy oficinas_select     on oficinas     for select using (auth.uid() is not null);
create policy contrapartes_select on contrapartes for select using (auth.uid() is not null);

create policy contrapartes_write on contrapartes for all
  using (fn_rol() in ('admin','supervisor','operador'))
  with check (fn_rol() in ('admin','supervisor','operador'));

-- Los movimientos se filtran por oficina.
create policy movimientos_select on movimientos for select
  using (fn_puede_ver_oficina(oficina_id));

create policy movimientos_insert on movimientos for insert
  with check (fn_rol() in ('admin','supervisor','operador') and fn_puede_ver_oficina(oficina_id));

create policy movimientos_update on movimientos for update
  using (fn_rol() in ('admin','supervisor') and fn_puede_ver_oficina(oficina_id))
  with check (fn_puede_ver_oficina(oficina_id));

-- Borrar es privilegio de administración: en un libro contable la
-- corrección normal es un asiento de ajuste, no un delete.
create policy movimientos_delete on movimientos for delete
  using (fn_rol() = 'admin');

-- Las partidas heredan el permiso de su movimiento.
create policy partidas_all on partidas for all
  using (exists (select 1 from movimientos m where m.id = movimiento_id and fn_puede_ver_oficina(m.oficina_id)))
  with check (exists (select 1 from movimientos m where m.id = movimiento_id and fn_puede_ver_oficina(m.oficina_id)));

create policy partida_cheque_all on partida_cheque for all
  using (exists (
    select 1 from partidas p join movimientos m on m.id = p.movimiento_id
    where p.id = partida_id and fn_puede_ver_oficina(m.oficina_id)))
  with check (exists (
    select 1 from partidas p join movimientos m on m.id = p.movimiento_id
    where p.id = partida_id and fn_puede_ver_oficina(m.oficina_id)));

-- La auditoría se lee, nunca se escribe desde la aplicación.
create policy audit_select on movimientos_audit for select
  using (fn_rol() in ('admin','supervisor'));
