-- ═══════════════════════════════════════════════════════════════
-- Nordelta Operations Platform · esquema base
--
-- Cada regla codificada acá está verificada contra el sistema en
-- producción: las 4 queries de BigQuery del workflow
-- "Nordel - Big Query - Querys" y los 6 Apps Script de los Sheets.
--
-- Estas migraciones todavía no se aplicaron a ningún entorno, así que se
-- editan en el lugar en vez de acumular parches. A partir del primer
-- `supabase db push` eso deja de valer.
-- ═══════════════════════════════════════════════════════════════

create type moneda        as enum ('ARS','USD','EUR','BRL');
create type medio_pago    as enum ('efectivo','pago_facil','transferencia','cheque','transf_movil');
create type categoria     as enum ('ingreso','pago_proveedor','full_pago','compra','venta','impuesto','ajuste_cierre');
create type estado_cheque as enum ('pendiente','cobrado','rechazado','anulado');

-- Las tres categorías de ALLOWED_SECTIONS más los ajustes. Compras, ventas
-- e impuestos quedan afuera de la cuenta corriente.
create or replace function fn_categoria_puede_impactar(c categoria)
returns boolean language sql immutable parallel safe as $$
  select c in ('ingreso','pago_proveedor','full_pago','ajuste_cierre')
$$;

-- ── Maestros ───────────────────────────────────────────────────

create table oficinas (
  id     smallserial primary key,
  nombre text not null unique,
  activa boolean not null default true
);

insert into oficinas (nombre) values
  ('Nordelta'), ('Oficina Corrientes'), ('Puertos'), ('Remeros');

-- Clientes y proveedores comparten directorio, igual que hoy: en el
-- consolidado actual el proveedor de una transferencia termina siendo un
-- valor de la columna CLIENTE.
create table contrapartes (
  id           bigserial primary key,
  nombre       text not null,
  -- Espejo de `normalizarNombre()` en src/lib/domain/contrapartes.ts.
  -- La unicidad sobre esta columna es lo que hace imposible volver a tener
  -- «Bonomi», «bonomi» y «BONOMI» como tres clientes distintos.
  -- No plega acentos a propósito: «Peña» y «Pena» siguen siendo distintos.
  nombre_norm  text generated always as (
    lower(
      regexp_replace(
        btrim(
          regexp_replace(
            regexp_replace(normalize(nombre, NFC),
                           E'[    　]', ' ', 'g'),
            '\s+', ' ', 'g')
        ),
        '[.,]+$', '', 'g')
    )
  ) stored,
  es_cliente   boolean not null default true,
  es_proveedor boolean not null default false,
  activo       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint contrapartes_nombre_norm_key unique (nombre_norm),
  constraint contrapartes_nombre_no_vacio check (btrim(nombre) <> ''),
  constraint contrapartes_nombre_largo    check (length(nombre) <= 160),
  constraint contrapartes_sin_control     check (nombre !~ E'[\x01-\x1f\x7f]')
);

-- ── Libro mayor ────────────────────────────────────────────────

create table movimientos (
  id             bigserial primary key,
  fecha          date        not null,
  oficina_id     smallint    not null references oficinas(id),
  contraparte_id bigint      references contrapartes(id),
  concepto       text        not null default '',
  categoria      categoria   not null,

  -- La regla de ALLOWED_SECTIONS, explícita. Sin default a propósito: quien
  -- inserta tiene que decidirlo, y el CHECK impide la combinación imposible.
  -- En el sistema legacy esto es implícito y depende de entre qué encabezados
  -- de texto cae la fila dentro de la planilla.
  afecta_cta_cte boolean     not null,

  -- Desempate estable del saldo corrido. El legacy ordenaba solo hasta el
  -- concepto, así que dos movimientos iguales del mismo día podían
  -- intercambiarse entre corridas y mover cuál disparaba el cierre.
  orden          integer     not null default 0,

  -- Trazabilidad de origen para la migración desde el sistema legacy:
  -- {source_system, source_file, source_sheet, source_row, legacy_id}
  origen         jsonb,

  created_by     uuid        references auth.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint movimientos_afecta_coherente check (
    fn_categoria_puede_impactar(categoria) or afecta_cta_cte = false
  ),
  -- Todo lo que toca una cuenta corriente necesita saber de quién es.
  constraint movimientos_contraparte_requerida check (
    afecta_cta_cte = false or contraparte_id is not null
  ),
  constraint movimientos_fecha_razonable check (
    fecha between date '2000-01-01' and date '2100-01-01'
  ),
  constraint movimientos_orden_no_negativo check (orden >= 0)
);

create index movimientos_dia_idx on movimientos (fecha, oficina_id, orden);
create index movimientos_cta_cte_idx on movimientos (contraparte_id, fecha, orden, id)
  where afecta_cta_cte;
create index movimientos_categoria_idx on movimientos (categoria);

-- Idempotencia de la migración: por identidad de origen, nunca por
-- contenido financiero. Dos pagos idénticos son dos pagos.
create unique index movimientos_origen_key on movimientos (
  (origen->>'source_system'), (origen->>'legacy_id')
) where origen ? 'legacy_id';

-- Una partida por pata monetaria. La planilla legacy mete hasta nueve en
-- una sola fila, repartidas en dieciséis columnas.
create table partidas (
  id             bigserial primary key,
  movimiento_id  bigint     not null references movimientos(id) on delete cascade,
  medio_pago     medio_pago not null,
  moneda_nominal moneda     not null,
  monto_nominal  numeric(18,4) not null,
  tipo_cambio    numeric(18,6),
  -- Fracción, no porcentaje: 0.02 es 2 %.
  comision_pct   numeric(9,6),

  -- Una pata en cero no es una pata.
  constraint partidas_monto_no_cero check (monto_nominal <> 0),
  -- Techo alineado con `MONTO_MAXIMO` de src/lib/domain/dinero.ts. Postgres
  -- podría guardar más, pero un `number` de JavaScript deja de ser exacto
  -- pasando 2^53 escalado, y un número en pantalla distinto al del libro es
  -- peor que un error. Se rechaza en las dos puntas.
  constraint partidas_monto_techo check (abs(monto_nominal) <= 100000000000),
  constraint partidas_tc_techo    check (tipo_cambio is null or tipo_cambio <= 100000000),
  constraint partidas_tc_positivo   check (tipo_cambio is null or tipo_cambio > 0),
  -- Una pata ya en dólares no lleva tipo de cambio: convertir USD a USD no
  -- significa nada y suele ser un error de carga.
  constraint partidas_tc_no_en_usd check (
    tipo_cambio is null or moneda_nominal <> 'USD'
  ),
  -- 15 en lugar de 0,15 es el error de carga más probable.
  constraint partidas_comision_rango check (
    comision_pct is null or (comision_pct >= 0 and comision_pct <= 1)
  ),
  -- La comisión solo existe en las patas de transferencia. En el legacy es
  -- una convención; acá es una restricción.
  constraint partidas_comision_solo_transferencias check (
    comision_pct is null
    or comision_pct = 0
    or medio_pago in ('transferencia','transf_movil')
  ),

  -- ── Las dos columnas que resuelven la conversión ──
  -- Espejo exacto de `calcularImpacto()` en src/lib/domain/fx.ts, y del
  -- consolidado de BigQuery: la comisión se aplica ANTES de dividir.
  --
  -- Que cada pata resuelva su moneda de impacto por separado es lo que hace
  -- estructuralmente imposible el bug 5 del legacy, donde una pata sin
  -- convertir desaparecía porque otra pata de la misma fila tenía TC.
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
create index partidas_moneda_idx     on partidas (moneda_impacto);

-- Detalle del instrumento, solo para las patas que lo necesitan.
create table partida_cheque (
  partida_id     bigint primary key references partidas(id) on delete cascade,
  nro            text,
  cuit           text,
  banco          text,
  fecha_emision  date,
  fecha_cobro    date not null,
  importe        numeric(18,4),
  tasa_descuento numeric(9,6),
  descuento      numeric(18,4),
  -- El legacy no tiene estado: un cheque entra a la cuenta corriente
  -- automáticamente al llegar su fecha de cobro, sin que nadie confirme el
  -- cobro y sin forma de registrar un rechazo.
  --
  -- El estado existe acá para poder soportar esa regla, pero CUÁNDO impacta
  -- contablemente un cheque es una decisión del negocio sin confirmar. Ver
  -- docs/OPEN_BUSINESS_DECISIONS.md · D7. Hasta que se defina, la vista de
  -- cuenta corriente replica el comportamiento legacy.
  estado         estado_cheque not null default 'pendiente',

  constraint partida_cheque_fechas check (
    fecha_emision is null or fecha_emision <= fecha_cobro
  ),
  constraint partida_cheque_tasa check (
    tasa_descuento is null or (tasa_descuento >= 0 and tasa_descuento <= 1)
  )
);

create index partida_cheque_cobro_idx on partida_cheque (fecha_cobro, estado);

-- ── Auditoría ──────────────────────────────────────────────────
-- Append-only y agnóstica de la entidad: cubre movimientos, partidas y
-- contrapartes. El legacy no registra absolutamente nada de esto.

create table auditoria (
  id             bigserial primary key,
  entidad        text not null,
  entidad_id     text not null,
  -- Ancla al movimiento, para poder reconstruir su historia completa
  -- incluyendo los cambios sobre sus partidas.
  movimiento_id  bigint,
  operacion      text not null check (operacion in ('INSERT','UPDATE','DELETE')),
  campo          text,
  valor_anterior text,
  valor_nuevo    text,
  motivo         text,
  actor          uuid,
  ocurrido_en    timestamptz not null default now()
);

create index auditoria_movimiento_idx on auditoria (movimiento_id, ocurrido_en desc);
create index auditoria_entidad_idx    on auditoria (entidad, entidad_id, ocurrido_en desc);
create index auditoria_actor_idx      on auditoria (actor, ocurrido_en desc);

-- Campos que no vale la pena auditar: ruido sin valor forense.
create or replace function fn_campo_auditable(campo text)
returns boolean language sql immutable parallel safe as $$
  select campo not in ('updated_at','created_at','nombre_norm',
                       'moneda_impacto','monto_impacto')
$$;

create or replace function fn_auditar()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_entidad text := tg_table_name;
  v_id      text;
  v_mov     bigint;
  v_actor   uuid := auth.uid();
begin
  if tg_op = 'DELETE' then
    v_id  := to_jsonb(old)->>'id';
    v_mov := case v_entidad
               when 'movimientos' then (to_jsonb(old)->>'id')::bigint
               when 'partidas'    then (to_jsonb(old)->>'movimiento_id')::bigint
               else null end;
    insert into auditoria (entidad, entidad_id, movimiento_id, operacion, valor_anterior, actor)
    values (v_entidad, v_id, v_mov, 'DELETE', to_jsonb(old)::text, v_actor);
    return old;
  end if;

  v_id  := to_jsonb(new)->>'id';
  v_mov := case v_entidad
             when 'movimientos' then (to_jsonb(new)->>'id')::bigint
             when 'partidas'    then (to_jsonb(new)->>'movimiento_id')::bigint
             else null end;

  if tg_op = 'INSERT' then
    insert into auditoria (entidad, entidad_id, movimiento_id, operacion, valor_nuevo, actor)
    values (v_entidad, v_id, v_mov, 'INSERT', to_jsonb(new)::text, v_actor);
    return new;
  end if;

  -- UPDATE: una fila de auditoría por campo que realmente cambió.
  insert into auditoria (entidad, entidad_id, movimiento_id, operacion,
                         campo, valor_anterior, valor_nuevo, actor)
  select v_entidad, v_id, v_mov, 'UPDATE', o.key, o.value, n.value, v_actor
  from jsonb_each_text(to_jsonb(old)) o
  join jsonb_each_text(to_jsonb(new)) n on n.key = o.key
  where o.value is distinct from n.value
    and fn_campo_auditable(o.key);

  return new;
end $$;

create or replace function fn_tocar_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger trg_auditar_movimientos
  after insert or update or delete on movimientos
  for each row execute function fn_auditar();

-- Las partidas SON el dinero: auditarlas no es opcional.
create trigger trg_auditar_partidas
  after insert or update or delete on partidas
  for each row execute function fn_auditar();

create trigger trg_auditar_contrapartes
  after insert or update or delete on contrapartes
  for each row execute function fn_auditar();

create trigger trg_updated_movimientos
  before update on movimientos
  for each row execute function fn_tocar_updated_at();

create trigger trg_updated_contrapartes
  before update on contrapartes
  for each row execute function fn_tocar_updated_at();
