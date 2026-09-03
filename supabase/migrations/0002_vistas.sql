-- ═══════════════════════════════════════════════════════════════
-- Vistas de saldo.
--
-- Reemplazan la cadena de 4 queries de BigQuery y el botón «Actualizar» que
-- tardaba minutos: acá el saldo es el resultado de una consulta, no de un
-- proceso que hay que disparar y esperar.
--
-- IMPORTANTE · `security_invoker = true` en todas.
-- Sin eso, una vista de Postgres se ejecuta con los permisos de su dueño y
-- **saltea la seguridad por fila** de las tablas que consulta: cualquier
-- usuario vería el libro mayor completo, sin importar su oficina.
-- ═══════════════════════════════════════════════════════════════

-- ── Orden canónico del libro mayor ─────────────────────────────
-- Tiene que ser idéntico al de `compararMovimientos()` en
-- src/lib/domain/saldos.ts:
--
--     fecha → ajustes de cierre al final del día → orden → id
--
-- El legacy desempataba solo hasta el concepto, así que dos movimientos
-- iguales del mismo día podían intercambiarse entre corridas y mover cuál
-- disparaba el cierre de cuenta. Ese era el bug 4.

-- ── Cuenta corriente ───────────────────────────────────────────
-- Una fila por movimiento, con el impacto de cada moneda, el saldo corrido
-- y la marca de cierre. Todo en la MISMA vista a propósito: cuando el saldo
-- corrido y la detección de cierre viven en vistas separadas, alcanza con
-- que una cambie de orden para que dejen de coincidir.
create or replace view v_cta_cte with (security_invoker = true) as
with por_movimiento as (
  select
    m.id             as movimiento_id,
    m.fecha,
    m.orden,
    m.oficina_id,
    m.contraparte_id,
    m.concepto,
    m.categoria,
    -- Suma a precisión completa: el redondeo va una sola vez, más abajo.
    sum(case when p.moneda_impacto = 'ARS' then p.monto_impacto else 0 end) as d_ars,
    sum(case when p.moneda_impacto = 'USD' then p.monto_impacto else 0 end) as d_usd,
    sum(case when p.moneda_impacto = 'EUR' then p.monto_impacto else 0 end) as d_eur,
    sum(case when p.moneda_impacto = 'BRL' then p.monto_impacto else 0 end) as d_brl,
    bool_or(p.tipo_cambio is not null and p.tipo_cambio > 0)                as hubo_conversion,
    count(p.id)                                                             as cantidad_partidas
  from movimientos m
  join partidas    p on p.movimiento_id = m.id
  where m.afecta_cta_cte
  group by m.id, m.fecha, m.orden, m.oficina_id, m.contraparte_id, m.concepto, m.categoria
),
corrido as (
  select
    pm.*,
    round(sum(d_ars) over w, 2) as saldo_ars,
    round(sum(d_usd) over w, 2) as saldo_usd,
    round(sum(d_eur) over w, 2) as saldo_eur,
    round(sum(d_brl) over w, 2) as saldo_brl,
    round(sum(d_ars) over w_previo, 2) as previo_ars,
    round(sum(d_usd) over w_previo, 2) as previo_usd,
    round(sum(d_eur) over w_previo, 2) as previo_eur,
    round(sum(d_brl) over w_previo, 2) as previo_brl
  from por_movimiento pm
  window
    w as (
      partition by contraparte_id
      order by fecha,
               case when categoria = 'ajuste_cierre' then 1 else 0 end,
               orden, movimiento_id
      rows unbounded preceding
    ),
    w_previo as (
      partition by contraparte_id
      order by fecha,
               case when categoria = 'ajuste_cierre' then 1 else 0 end,
               orden, movimiento_id
      rows between unbounded preceding and 1 preceding
    )
)
select
  movimiento_id, fecha, orden, oficina_id, contraparte_id, concepto, categoria,
  d_ars as impacto_ars, d_usd as impacto_usd, d_eur as impacto_eur, d_brl as impacto_brl,
  saldo_ars, saldo_usd, saldo_eur, saldo_brl,
  hubo_conversion, cantidad_partidas,
  -- Regla de cierre confirmada en producción: las CUATRO monedas en cero
  -- simultáneamente, y la posición anterior con al menos una distinta de
  -- cero. No hay cierre por moneda.
  (
        saldo_ars = 0 and saldo_usd = 0 and saldo_eur = 0 and saldo_brl = 0
    and previo_ars is not null
    and (previo_ars <> 0 or previo_usd <> 0 or previo_eur <> 0 or previo_brl <> 0)
  ) as es_cierre
from corrido;

-- ── Detalle por partida ────────────────────────────────────────
-- Para poder explicar de dónde sale cada número del libro. Todo saldo tiene
-- que poder rastrearse hasta las patas que lo componen.
create or replace view v_partidas_detalle with (security_invoker = true) as
select
  p.id            as partida_id,
  p.movimiento_id,
  m.fecha,
  m.oficina_id,
  m.contraparte_id,
  m.concepto,
  m.categoria,
  m.afecta_cta_cte,
  p.medio_pago,
  p.moneda_nominal,
  p.monto_nominal,
  p.tipo_cambio,
  p.comision_pct,
  p.moneda_impacto,
  p.monto_impacto,
  ch.nro          as cheque_nro,
  ch.fecha_cobro  as cheque_fecha_cobro,
  ch.estado       as cheque_estado
from partidas p
join movimientos m    on m.id = p.movimiento_id
left join partida_cheque ch on ch.partida_id = p.id;

-- ── Balance por contraparte ────────────────────────────────────
-- Nunca se suman monedas distintas entre sí: una fila por (contraparte,
-- moneda). El total mezclado de ARS + USD + EUR + BRL no significa nada.
create or replace view v_balance with (security_invoker = true) as
select
  m.contraparte_id,
  c.nombre                       as contraparte,
  p.moneda_impacto               as moneda,
  round(sum(p.monto_impacto), 2) as saldo,
  count(distinct m.id)           as movimientos,
  max(m.fecha)                   as ultimo_movimiento
from movimientos m
join partidas     p on p.movimiento_id = m.id
join contrapartes c on c.id = m.contraparte_id
where m.afecta_cta_cte
group by m.contraparte_id, c.nombre, p.moneda_impacto;
-- El join con contrapartes no descarta nada en silencio: el CHECK
-- `movimientos_contraparte_requerida` garantiza que todo movimiento que
-- afecta la cuenta corriente tiene contraparte.

-- ── Último cierre por contraparte ──────────────────────────────
create or replace view v_ultimo_cierre with (security_invoker = true) as
select contraparte_id, max(fecha) as fecha_ultimo_cierre
from v_cta_cte
where es_cierre
group by contraparte_id;
