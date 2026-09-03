-- ═══════════════════════════════════════════════════════════════
-- Operaciones atómicas.
--
-- Un movimiento y sus partidas se escriben o no se escriben: nunca puede
-- quedar una cabecera con la mitad de sus patas, porque eso es un saldo
-- incorrecto que además parece válido.
--
-- Todas las funciones son `security invoker` (el default) a propósito: se
-- ejecutan con los permisos del usuario, así que la seguridad por fila se
-- aplica igual que en un INSERT directo. Una función `security definer` acá
-- sería un agujero.
--
-- Una función de PL/pgSQL corre dentro de la transacción de quien la llama,
-- así que cualquier excepción revierte todo lo hecho adentro.
-- ═══════════════════════════════════════════════════════════════

-- ── Contrapartes ───────────────────────────────────────────────

/**
 * Resuelve una contraparte por nombre, creándola si no existe.
 *
 * Compara por `nombre_norm`, así que «Bonomi» y «bonomi» resuelven a la
 * misma fila en lugar de crear un duplicado. El nombre de display que queda
 * guardado es el de la primera carga.
 */
create or replace function obtener_o_crear_contraparte(p_nombre text)
returns bigint language plpgsql as $$
declare
  v_id   bigint;
  v_norm text;
begin
  if p_nombre is null or btrim(p_nombre) = '' then
    raise exception 'El nombre de la contraparte no puede estar vacío'
      using errcode = 'check_violation';
  end if;

  select lower(regexp_replace(btrim(regexp_replace(
           regexp_replace(normalize(p_nombre, NFC), E'[    　]', ' ', 'g'),
           '\s+', ' ', 'g')), '[.,]+$', '', 'g'))
    into v_norm;

  select id into v_id from contrapartes where nombre_norm = v_norm;
  if v_id is not null then
    return v_id;
  end if;

  insert into contrapartes (nombre) values (btrim(p_nombre))
  on conflict (nombre_norm) do nothing
  returning id into v_id;

  -- Si otra transacción la creó en el medio, se lee la que quedó.
  if v_id is null then
    select id into v_id from contrapartes where nombre_norm = v_norm;
  end if;

  if v_id is null then
    raise exception 'No se pudo resolver la contraparte %', p_nombre
      using errcode = 'internal_error';
  end if;
  return v_id;
end $$;

-- ── Movimientos ────────────────────────────────────────────────

/**
 * Crea un movimiento con todas sus partidas, de forma atómica.
 *
 * `p_partidas` es un arreglo jsonb de objetos:
 *   { medio_pago, moneda_nominal, monto_nominal,
 *     tipo_cambio?, comision_pct?, cheque?: { ... } }
 *
 * `afecta_cta_cte` se deriva de la categoría acá adentro y no se acepta
 * como parámetro: es la regla de ALLOWED_SECTIONS y no debe poder pasarse
 * por alto desde el cliente.
 *
 * `p_orden` en null toma el siguiente del día y la oficina, así el
 * desempate del saldo corrido queda estable sin que el cliente lo calcule.
 */
create or replace function crear_movimiento(
  p_fecha          date,
  p_oficina_id     smallint,
  p_contraparte_id bigint,
  p_concepto       text,
  p_categoria      categoria,
  p_partidas       jsonb,
  p_orden          integer default null,
  p_origen         jsonb   default null
) returns bigint language plpgsql as $$
declare
  v_id     bigint;
  v_orden  integer;
  v_pata   jsonb;
  v_pid    bigint;
  v_cuenta integer;
begin
  if p_partidas is null or jsonb_typeof(p_partidas) <> 'array' then
    raise exception 'Las partidas tienen que venir como un arreglo'
      using errcode = 'invalid_parameter_value';
  end if;

  v_cuenta := jsonb_array_length(p_partidas);
  if v_cuenta = 0 then
    raise exception 'Un movimiento necesita al menos una partida'
      using errcode = 'check_violation';
  end if;

  v_orden := coalesce(
    p_orden,
    (select coalesce(max(orden), 0) + 1 from movimientos
      where fecha = p_fecha and oficina_id = p_oficina_id)
  );

  insert into movimientos (
    fecha, oficina_id, contraparte_id, concepto, categoria,
    afecta_cta_cte, orden, origen, created_by
  ) values (
    p_fecha, p_oficina_id, p_contraparte_id, coalesce(p_concepto, ''), p_categoria,
    fn_categoria_puede_impactar(p_categoria), v_orden, p_origen, auth.uid()
  ) returning id into v_id;

  for v_pata in select * from jsonb_array_elements(p_partidas) loop
    insert into partidas (
      movimiento_id, medio_pago, moneda_nominal, monto_nominal,
      tipo_cambio, comision_pct
    ) values (
      v_id,
      (v_pata->>'medio_pago')::medio_pago,
      (v_pata->>'moneda_nominal')::moneda,
      (v_pata->>'monto_nominal')::numeric,
      nullif(v_pata->>'tipo_cambio', '')::numeric,
      nullif(v_pata->>'comision_pct', '')::numeric
    ) returning id into v_pid;

    if v_pata ? 'cheque' and jsonb_typeof(v_pata->'cheque') = 'object' then
      insert into partida_cheque (
        partida_id, nro, cuit, banco, fecha_emision, fecha_cobro,
        importe, tasa_descuento, descuento, estado
      ) values (
        v_pid,
        v_pata->'cheque'->>'nro',
        v_pata->'cheque'->>'cuit',
        v_pata->'cheque'->>'banco',
        nullif(v_pata->'cheque'->>'fecha_emision', '')::date,
        (v_pata->'cheque'->>'fecha_cobro')::date,
        nullif(v_pata->'cheque'->>'importe', '')::numeric,
        nullif(v_pata->'cheque'->>'tasa_descuento', '')::numeric,
        nullif(v_pata->'cheque'->>'descuento', '')::numeric,
        coalesce(nullif(v_pata->'cheque'->>'estado', '')::estado_cheque, 'pendiente')
      );
    end if;
  end loop;

  return v_id;
end $$;

/**
 * Crea varios movimientos de una sola vez, atómicamente.
 *
 * Es lo que usa la pantalla de carga cuando alguien pega un bloque desde
 * Excel: o entran todas las filas o no entra ninguna. Un pegado a medias
 * deja el día en un estado que nadie sabe interpretar.
 *
 * `p_movimientos` es un arreglo de objetos con la misma forma que los
 * parámetros de `crear_movimiento`, más `partidas`.
 */
create or replace function crear_movimientos_lote(p_movimientos jsonb)
returns bigint[] language plpgsql as $$
declare
  v_mov  jsonb;
  v_ids  bigint[] := '{}';
  v_id   bigint;
  v_cp   bigint;
begin
  if p_movimientos is null or jsonb_typeof(p_movimientos) <> 'array' then
    raise exception 'Se esperaba un arreglo de movimientos'
      using errcode = 'invalid_parameter_value';
  end if;

  for v_mov in select * from jsonb_array_elements(p_movimientos) loop
    -- La contraparte puede venir por id o por nombre, para que un pegado
    -- desde Excel no necesite resolver ids antes de enviar.
    v_cp := nullif(v_mov->>'contraparte_id', '')::bigint;
    if v_cp is null and nullif(v_mov->>'contraparte', '') is not null then
      v_cp := obtener_o_crear_contraparte(v_mov->>'contraparte');
    end if;

    v_id := crear_movimiento(
      (v_mov->>'fecha')::date,
      (v_mov->>'oficina_id')::smallint,
      v_cp,
      v_mov->>'concepto',
      (v_mov->>'categoria')::categoria,
      v_mov->'partidas',
      nullif(v_mov->>'orden', '')::integer,
      case when v_mov ? 'origen' then v_mov->'origen' else null end
    );
    v_ids := v_ids || v_id;
  end loop;

  return v_ids;
end $$;

/**
 * Reemplaza la cabecera y TODAS las partidas de un movimiento, de una vez.
 *
 * Editar partidas de a una dejaría el movimiento en estados intermedios con
 * saldos que no corresponden a nada. Se borra el conjunto y se escribe el
 * nuevo dentro de la misma transacción; la auditoría queda con el detalle
 * de cada baja y cada alta.
 *
 * `p_motivo` se registra en la auditoría: editar historia debería tener una
 * razón escrita.
 */
create or replace function actualizar_movimiento(
  p_id             bigint,
  p_fecha          date,
  p_oficina_id     smallint,
  p_contraparte_id bigint,
  p_concepto       text,
  p_categoria      categoria,
  p_partidas       jsonb,
  p_motivo         text default null
) returns bigint language plpgsql as $$
declare
  v_pata jsonb;
  v_pid  bigint;
begin
  if p_partidas is null or jsonb_typeof(p_partidas) <> 'array'
     or jsonb_array_length(p_partidas) = 0 then
    raise exception 'Un movimiento necesita al menos una partida'
      using errcode = 'check_violation';
  end if;

  update movimientos set
    fecha          = p_fecha,
    oficina_id     = p_oficina_id,
    contraparte_id = p_contraparte_id,
    concepto       = coalesce(p_concepto, ''),
    categoria      = p_categoria,
    afecta_cta_cte = fn_categoria_puede_impactar(p_categoria)
  where id = p_id;

  if not found then
    raise exception 'No existe el movimiento % o no tenés permiso para editarlo', p_id
      using errcode = 'no_data_found';
  end if;

  delete from partidas where movimiento_id = p_id;

  for v_pata in select * from jsonb_array_elements(p_partidas) loop
    insert into partidas (
      movimiento_id, medio_pago, moneda_nominal, monto_nominal,
      tipo_cambio, comision_pct
    ) values (
      p_id,
      (v_pata->>'medio_pago')::medio_pago,
      (v_pata->>'moneda_nominal')::moneda,
      (v_pata->>'monto_nominal')::numeric,
      nullif(v_pata->>'tipo_cambio', '')::numeric,
      nullif(v_pata->>'comision_pct', '')::numeric
    ) returning id into v_pid;

    if v_pata ? 'cheque' and jsonb_typeof(v_pata->'cheque') = 'object' then
      insert into partida_cheque (
        partida_id, nro, cuit, banco, fecha_emision, fecha_cobro,
        importe, tasa_descuento, descuento, estado
      ) values (
        v_pid,
        v_pata->'cheque'->>'nro',
        v_pata->'cheque'->>'cuit',
        v_pata->'cheque'->>'banco',
        nullif(v_pata->'cheque'->>'fecha_emision', '')::date,
        (v_pata->'cheque'->>'fecha_cobro')::date,
        nullif(v_pata->'cheque'->>'importe', '')::numeric,
        nullif(v_pata->'cheque'->>'tasa_descuento', '')::numeric,
        nullif(v_pata->'cheque'->>'descuento', '')::numeric,
        coalesce(nullif(v_pata->'cheque'->>'estado', '')::estado_cheque, 'pendiente')
      );
    end if;
  end loop;

  if p_motivo is not null and btrim(p_motivo) <> '' then
    update auditoria set motivo = p_motivo
    where movimiento_id = p_id and motivo is null
      and ocurrido_en >= now() - interval '1 second';
  end if;

  return p_id;
end $$;

/**
 * Ajuste que lleva la cuenta corriente de una contraparte a cero.
 *
 * No toca ningún saldo: **genera un movimiento contable explícito** con
 * categoría `ajuste_cierre`, una partida por moneda con saldo distinto de
 * cero, y el signo invertido. Después de aplicarlo, la vista detecta el
 * cierre por sí sola porque las cuatro monedas quedan en cero.
 *
 * Devuelve null si la cuenta ya estaba en cero: no se crea un movimiento
 * vacío para no ensuciar el libro.
 */
create or replace function ajustar_cuenta_a_cero(
  p_contraparte_id bigint,
  p_oficina_id     smallint,
  p_fecha          date default current_date,
  p_concepto       text default 'Cierre de cuenta corriente'
) returns bigint language plpgsql as $$
declare
  v_partidas jsonb;
begin
  select jsonb_agg(jsonb_build_object(
           'medio_pago',     'efectivo',
           'moneda_nominal', moneda,
           'monto_nominal',  (-saldo)::text
         ))
    into v_partidas
  from v_balance
  where contraparte_id = p_contraparte_id and saldo <> 0;

  if v_partidas is null then
    return null;
  end if;

  return crear_movimiento(
    p_fecha, p_oficina_id, p_contraparte_id, p_concepto,
    'ajuste_cierre'::categoria, v_partidas
  );
end $$;

-- El acceso queda gobernado por RLS dentro de cada función; acá solo se
-- habilita la ejecución para usuarios autenticados.
revoke all on function crear_movimiento(date, smallint, bigint, text, categoria, jsonb, integer, jsonb) from public;
revoke all on function crear_movimientos_lote(jsonb) from public;
revoke all on function actualizar_movimiento(bigint, date, smallint, bigint, text, categoria, jsonb, text) from public;
revoke all on function ajustar_cuenta_a_cero(bigint, smallint, date, text) from public;
revoke all on function obtener_o_crear_contraparte(text) from public;

grant execute on function crear_movimiento(date, smallint, bigint, text, categoria, jsonb, integer, jsonb) to authenticated;
grant execute on function crear_movimientos_lote(jsonb) to authenticated;
grant execute on function actualizar_movimiento(bigint, date, smallint, bigint, text, categoria, jsonb, text) to authenticated;
grant execute on function ajustar_cuenta_a_cero(bigint, smallint, date, text) to authenticated;
grant execute on function obtener_o_crear_contraparte(text) to authenticated;
