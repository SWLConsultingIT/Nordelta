-- ═══════════════════════════════════════════════════════════════
-- Organizaciones.
--
-- Hoy existe una sola —NORD— y es tentador no modelarla. No hacerlo tiene
-- un costo concreto y conocido: cada consulta queda atada implícitamente a
-- un único inquilino, y el día que aparezca el segundo hay que tocar todas
-- las tablas, todas las políticas y todas las consultas a la vez.
--
-- Lo que se hace acá es lo mínimo que evita eso: la columna y el
-- aislamiento. **No** se construye administración de organizaciones, ni
-- invitaciones, ni facturación, ni cambio de contexto. Eso es un producto
-- distinto y todavía no hace falta.
--
-- Estas migraciones no se aplicaron a ningún entorno: se editan en el lugar
-- en vez de acumular parches. A partir del primer `supabase db push` eso
-- deja de valer.
-- ═══════════════════════════════════════════════════════════════

create table organizaciones (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  -- Identificador estable y legible, para rutas y para diagnóstico.
  slug       text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  activa     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table organizaciones is
  'Inquilino del sistema. Hoy solo existe NORD; la tabla evita que el día '
  'que haya dos haya que reescribir todas las políticas.';

insert into organizaciones (nombre, slug) values ('Nordelta', 'nordelta');

-- ── Pertenencia ────────────────────────────────────────────────

-- Un perfil pertenece a una organización. Se agrega como columna en lugar
-- de una tabla de pertenencia N:M porque hoy nadie pertenece a dos, y una
-- tabla intermedia que siempre tiene una fila es complejidad que hay que
-- leer en cada consulta. Si más adelante hace falta, la migración es
-- mecánica y el resto del esquema no cambia.
alter table perfiles
  add column organizacion_id uuid references organizaciones(id) on delete restrict;

-- Los perfiles que ya existan quedan en la organización única.
update perfiles set organizacion_id = (select id from organizaciones where slug = 'nordelta')
where organizacion_id is null;

create index on perfiles (organizacion_id);

-- El perfil que crea el trigger de alta también necesita organización. Sin
-- esto, un usuario nuevo entra sin inquilino y no ve absolutamente nada,
-- que es seguro pero indistinguible de un error.
create or replace function fn_crear_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into perfiles (id, nombre, organizacion_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', new.email, ''),
    -- Por invitación explícita en los metadatos; si no, la organización
    -- única. Cuando haya varias, esto pasa a exigir invitación.
    coalesce(
      (new.raw_user_meta_data->>'organizacion_id')::uuid,
      (select id from organizaciones where slug = 'nordelta')
    )
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- ── Organización del usuario actual ────────────────────────────

/**
 * La organización de quien consulta.
 *
 * `stable` y no `immutable`: depende de `auth.uid()`, que cambia entre
 * transacciones. Se usa en todas las políticas del dominio operativo, así
 * que el planner la evalúa una vez por consulta y no una vez por fila.
 *
 * `security definer` es necesario porque la política de `perfiles` se
 * apoya en esta función: sin él, consultarla desde dentro de una política
 * de la misma tabla entra en recursión.
 */
create or replace function fn_org()
returns uuid language sql stable security definer set search_path = public as $$
  select organizacion_id from perfiles where id = auth.uid()
$$;

comment on function fn_org() is
  'Organización del usuario autenticado. Base del aislamiento entre inquilinos.';

alter table organizaciones enable row level security;

-- Cada quien ve la suya y nada más. No hay política de escritura: las
-- organizaciones se crean por migración o por consola, nunca desde la
-- aplicación.
create policy organizaciones_ver_la_propia on organizaciones for select
  using (id = fn_org());
