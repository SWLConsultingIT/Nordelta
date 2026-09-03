-- ═══════════════════════════════════════════════════════════════
-- Nordelta Operations Platform · esquema base
--
-- Cada regla codificada acá está verificada contra el sistema en
-- producción: las 4 queries de BigQuery del workflow
-- "Nordel - Big Query - Querys" y los 6 Apps Script de los Sheets.
-- ═══════════════════════════════════════════════════════════════

create type moneda      as enum ('ARS','USD','EUR','BRL');
create type medio_pago  as enum ('efectivo','pago_facil','transferencia','cheque','transf_movil');
create type categoria   as enum ('ingreso','pago_proveedor','full_pago','compra','venta','impuesto','ajuste_cierre');
create type estado_cheque as enum ('pendiente','cobrado','rechazado');

-- ── Maestros ───────────────────────────────────────────────────

create table oficinas (
  id     smallserial primary key,
  nombre text not null unique
);

insert into oficinas (nombre) values
  ('Nordelta'), ('Oficina Corrientes'), ('Puertos'), ('Remeros');

-- Clientes y proveedores comparten directorio, igual que hoy: en el
-- consolidado actual el proveedor de una transferencia termina siendo
-- un valor de la columna CLIENTE.
create table contrapartes (
  id           bigserial primary key,
  nombre       text not null,
  -- La unicidad sobre el nombre normalizado es lo que hace imposible
  -- volver a tener «Bonomi» y «bonomi» como dos clientes distintos.
  nombre_norm  text generated always as (lower(btrim(nombre))) stored,
  es_cliente   boolean not null default true,
  es_proveedor boolean not null default false,
  activo       boolean not null default true,
  created_at   timestamptz not null default now(),
  constraint contrapartes_nombre_norm_key unique (nombre_norm),
  constraint contrapartes_nombre_no_vacio check (btrim(nombre) <> '')
);

-- ── Libro mayor ────────────────────────────────────────────────

create table movimientos (
  id             bigserial primary key,
  fecha          date        not null,
  oficina_id     smallint    not null references oficinas(id),
  contraparte_id bigint      references contrapartes(id),
  concepto       text        not null default '',
  categoria      categoria   not null,

  -- La regla ALLOWED_SECTIONS del Apps Script, hecha explícita.
  -- Hoy es implícita: depende de entre qué encabezados cae la fila.
  afecta_cta_cte boolean     not null default true,

  -- Desempate estable del saldo corrido. El sistema actual ordena por
  -- fecha y concepto sin más criterio, así que dos movimientos del mismo
  -- día podían intercambiarse entre corridas y mover el cierre de cuenta.
  orden          integer     not null default 0,

  created_by     uuid        references auth.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint movimientos_contraparte_requerida
    check (categoria = 'impuesto' or contraparte_id is not null)
);

create index movimientos_fecha_oficina_idx on movimientos (fecha, oficina_id, orden);
create index movimientos_contraparte_idx    on movimientos (contraparte_id, fecha, orden)
  where afecta_cta_cte;

-- Una partida por pata monetaria. La planilla actual mete hasta nueve
-- en una sola fila, repartidas en dieciséis columnas.
create table partidas (
  id             bigserial primary key,
  movimiento_id  bigint     not null references movimientos(id) on delete cascade,
  medio_pago     medio_pago not null,
  moneda_nominal moneda     not null,
  monto_nominal  numeric(18,4) not null,
  tipo_cambio    numeric(18,6),
  -- Fracción, no porcentaje: 0.02 es 2 %.
  comision_pct   numeric(9,6),

  constraint partidas_tc_positivo check (tipo_cambio is null or tipo_cambio > 0),
  -- La comisión solo existe en las patas de transferencia. En el sistema
  -- actual eso es una convención; acá es una restricción.
  constraint partidas_comision_solo_transferencias check (
    comision_pct is null
    or comision_pct = 0
    or medio_pago in ('transferencia','transf_movil')
  ),

  -- ── Las dos columnas que resuelven la conversión ──
  -- Espejo exacto del consolidado de BigQuery:
  --   la comisión se aplica ANTES de dividir por el tipo de cambio.
  -- Al vivir en la base, ninguna pata puede perderse porque otra
  -- pata de la misma fila tenga tipo de cambio — que es exactamente
  -- lo que hoy pasa en el consolidado 2026.
  moneda_impacto moneda generated always as (
    case
      when tipo_cambio is not null and tipo_cambio > 0 and moneda_nominal <> 'USD'
      then 'USD'::moneda
      else moneda_nominal
    end
  ) stored,

  monto_impacto numeric(18,4) generated always as (
    case
      when tipo_cambio is not null and tipo_cambio > 0 and moneda_nominal <> 'USD'
      then round((monto_nominal * (1 + coalesce(comision_pct, 0))) / tipo_cambio, 4)
      else round(monto_nominal * (1 + coalesce(comision_pct, 0)), 4)
    end
  ) stored
);

create index partidas_movimiento_idx on partidas (movimiento_id);

-- Detalle solo para las patas que lo necesitan.
create table partida_cheque (
  partida_id      bigint primary key references partidas(id) on delete cascade,
  nro             text,
  cuit            text,
  banco           text,
  fecha_cobro     date not null,
  importe         numeric(18,4),
  tasa_descuento  numeric(9,6),
  descuento       numeric(18,4),
  -- El sistema actual no tiene este estado: un cheque entra a la cuenta
  -- corriente automáticamente al llegar su fecha de cobro, sin que nadie
  -- confirme que se cobró. Pendiente de confirmación del negocio.
  estado          estado_cheque not null default 'pendiente'
);

-- ── Auditoría ──────────────────────────────────────────────────

create table movimientos_audit (
  id            bigserial primary key,
  movimiento_id bigint,
  operacion     text not null,
  campo         text,
  valor_anterior text,
  valor_nuevo    text,
  motivo        text,
  actor         uuid,
  ocurrido_en   timestamptz not null default now()
);

create index movimientos_audit_mov_idx on movimientos_audit (movimiento_id, ocurrido_en desc);

create or replace function fn_audit_movimientos()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into movimientos_audit (movimiento_id, operacion, actor)
    values (new.id, 'INSERT', auth.uid());
    return new;
  elsif tg_op = 'UPDATE' then
    insert into movimientos_audit (movimiento_id, operacion, campo, valor_anterior, valor_nuevo, actor)
    select new.id, 'UPDATE', k, v_old, v_new, auth.uid()
    from jsonb_each_text(to_jsonb(old)) o(k, v_old)
    join jsonb_each_text(to_jsonb(new)) n(k2, v_new) on n.k2 = o.k
    where v_old is distinct from v_new and k <> 'updated_at';
    new.updated_at := now();
    return new;
  else
    insert into movimientos_audit (movimiento_id, operacion, valor_anterior, actor)
    values (old.id, 'DELETE', to_jsonb(old)::text, auth.uid());
    return old;
  end if;
end $$;

create trigger trg_audit_movimientos
  after insert or delete on movimientos
  for each row execute function fn_audit_movimientos();

create trigger trg_audit_movimientos_upd
  before update on movimientos
  for each row execute function fn_audit_movimientos();
