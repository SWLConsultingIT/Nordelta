-- ═══════════════════════════════════════════════════════════════
-- Vistas de saldo. Reemplazan la cadena de 4 queries de BigQuery
-- y el botón «Actualizar» que tardaba minutos: acá el saldo es el
-- resultado de una consulta, no de un proceso.
-- ═══════════════════════════════════════════════════════════════

-- ── Cuenta corriente con saldo corrido ─────────────────────────
-- Equivale a la función de ventana del consolidado global, con una
-- diferencia: el ORDER BY incluye `orden` e `id`, así que es estable
-- entre corridas. En producción el desempate llega solo hasta el
-- concepto y dos movimientos iguales pueden intercambiarse.
create or replace view v_cta_cte as
select
  m.id                as movimiento_id,
  m.fecha,
  m.orden,
  m.oficina_id,
  m.contraparte_id,
  m.concepto,
  m.categoria,
  p.id                as partida_id,
  p.medio_pago,
  p.moneda_nominal,
  p.monto_nominal,
  p.tipo_cambio,
  p.comision_pct,
  p.moneda_impacto,
  p.monto_impacto,
  sum(p.monto_impacto) over (
    partition by m.contraparte_id, p.moneda_impacto
    order by m.fecha,
             case when m.categoria = 'ajuste_cierre' then 1 else 0 end,
             m.orden, m.id, p.id
    rows unbounded preceding
  ) as saldo_corrido
from movimientos m
join partidas    p on p.movimiento_id = m.id
where m.afecta_cta_cte;

-- ── Balance por contraparte y moneda ───────────────────────────
create or replace view v_balance as
select
  m.contraparte_id,
  c.nombre        as contraparte,
  p.moneda_impacto as moneda,
  round(sum(p.monto_impacto), 2) as saldo
from movimientos m
join partidas     p on p.movimiento_id = m.id
join contrapartes c on c.id = m.contraparte_id
where m.afecta_cta_cte
group by m.contraparte_id, c.nombre, p.moneda_impacto;

-- ── Detección de cierre de cuenta ──────────────────────────────
-- Regla verificada en producción: las CUATRO monedas tienen que dar
-- cero al mismo tiempo (redondeadas a 2 decimales) y la posición
-- anterior tiene que haber tenido al menos una distinta de cero.
-- No es por moneda.
create or replace view v_cierres as
with posicion as (
  select
    m.contraparte_id,
    m.fecha,
    m.orden,
    m.id as movimiento_id,
    sum(case when p.moneda_impacto = 'ARS' then p.monto_impacto else 0 end) as d_ars,
    sum(case when p.moneda_impacto = 'USD' then p.monto_impacto else 0 end) as d_usd,
    sum(case when p.moneda_impacto = 'EUR' then p.monto_impacto else 0 end) as d_eur,
    sum(case when p.moneda_impacto = 'BRL' then p.monto_impacto else 0 end) as d_brl
  from movimientos m
  join partidas    p on p.movimiento_id = m.id
  where m.afecta_cta_cte
  group by m.contraparte_id, m.fecha, m.orden, m.id
),
corrido as (
  select
    posicion.*,
    round(sum(d_ars) over w, 2) as b_ars,
    round(sum(d_usd) over w, 2) as b_usd,
    round(sum(d_eur) over w, 2) as b_eur,
    round(sum(d_brl) over w, 2) as b_brl,
    round(sum(d_ars) over p_w, 2) as p_ars,
    round(sum(d_usd) over p_w, 2) as p_usd,
    round(sum(d_eur) over p_w, 2) as p_eur,
    round(sum(d_brl) over p_w, 2) as p_brl
  from posicion
  window
    w   as (partition by contraparte_id order by fecha, orden, movimiento_id
            rows unbounded preceding),
    p_w as (partition by contraparte_id order by fecha, orden, movimiento_id
            rows between unbounded preceding and 1 preceding)
)
select contraparte_id, fecha, movimiento_id
from corrido
where b_ars = 0 and b_usd = 0 and b_eur = 0 and b_brl = 0
  and p_ars is not null
  and (p_ars <> 0 or p_usd <> 0 or p_eur <> 0 or p_brl <> 0);
