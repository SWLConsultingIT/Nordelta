-- ═══════════════════════════════════════════════════════════════
-- Seguridad por fila del dominio operativo.
--
-- Una política mal escrita se ve exactamente igual que una bien escrita
-- hasta el día que filtra. Por eso acá todo sigue la misma forma y no hay
-- excepciones ingeniosas:
--
--   · **toda** tabla con `organizacion_id` se filtra por `fn_org()`;
--   · lo que se inserta lleva la organización de quien inserta, verificado
--     con `with check`, no confiado al cliente;
--   · nada se borra: en un sistema financiero el borrado es una pérdida de
--     evidencia. Se marca inactivo o se anula, y queda el rastro.
--
-- Vale el mismo principio que la migración de RLS del dominio financiero:
-- ante la duda, no se ve y no se escribe.
-- ═══════════════════════════════════════════════════════════════

alter table clientes               enable row level security;
alter table cliente_emails         enable row level security;
alter table planillas              enable row level security;
alter table informes_fullcarga     enable row level security;
alter table acreditaciones         enable row level security;
alter table transferencias         enable row level security;
alter table mapeos_identidad       enable row level security;
alter table resoluciones           enable row level security;
alter table conciliacion_corridas  enable row level security;
alter table transferencia_eventos  enable row level security;

-- ── Lectura: la organización propia, siempre ───────────────────

create policy clientes_leer on clientes for select
  using (organizacion_id = fn_org());
create policy cliente_emails_leer on cliente_emails for select
  using (organizacion_id = fn_org());
create policy planillas_leer on planillas for select
  using (organizacion_id = fn_org());
create policy informes_leer on informes_fullcarga for select
  using (organizacion_id = fn_org());
create policy acreditaciones_leer on acreditaciones for select
  using (organizacion_id = fn_org());
create policy transferencias_leer on transferencias for select
  using (organizacion_id = fn_org());
create policy mapeos_leer on mapeos_identidad for select
  using (organizacion_id = fn_org());
create policy resoluciones_leer on resoluciones for select
  using (organizacion_id = fn_org());
create policy corridas_leer on conciliacion_corridas for select
  using (organizacion_id = fn_org());
create policy eventos_leer on transferencia_eventos for select
  using (organizacion_id = fn_org());

-- ── Escritura ──────────────────────────────────────────────────
--
-- `fn_rol()` viene de 0003. Lectura no escribe nada; el resto de los roles
-- opera. La distinción fina entre operador y supervisor queda pendiente de
-- definición del cliente (D9) y por ahora se resuelve del lado del
-- producto, no de la base: es preferible una regla simple y correcta a una
-- compleja que nadie pueda verificar.

create policy clientes_escribir on clientes for insert
  with check (organizacion_id = fn_org() and fn_rol() <> 'lectura');
create policy clientes_editar on clientes for update
  using (organizacion_id = fn_org() and fn_rol() <> 'lectura')
  with check (organizacion_id = fn_org());

create policy cliente_emails_escribir on cliente_emails for insert
  with check (organizacion_id = fn_org() and fn_rol() <> 'lectura');
create policy cliente_emails_editar on cliente_emails for update
  using (organizacion_id = fn_org() and fn_rol() <> 'lectura')
  with check (organizacion_id = fn_org());

create policy planillas_escribir on planillas for insert
  with check (organizacion_id = fn_org() and fn_rol() <> 'lectura');
create policy planillas_editar on planillas for update
  using (organizacion_id = fn_org() and fn_rol() <> 'lectura')
  with check (organizacion_id = fn_org());

create policy informes_escribir on informes_fullcarga for insert
  with check (organizacion_id = fn_org() and fn_rol() <> 'lectura');

create policy acreditaciones_escribir on acreditaciones for insert
  with check (organizacion_id = fn_org() and fn_rol() <> 'lectura');

create policy transferencias_escribir on transferencias for insert
  with check (organizacion_id = fn_org() and fn_rol() <> 'lectura');
create policy transferencias_editar on transferencias for update
  using (organizacion_id = fn_org() and fn_rol() <> 'lectura')
  with check (organizacion_id = fn_org());

create policy mapeos_escribir on mapeos_identidad for insert
  with check (
    organizacion_id = fn_org()
    and fn_rol() <> 'lectura'
    -- Una identidad la confirma quien la está confirmando. Poder anotar a
    -- otra persona como autora de una decisión sobre plata sería un
    -- problema de auditoría, no una comodidad.
    and confirmado_por = auth.uid()
  );
create policy mapeos_editar on mapeos_identidad for update
  using (organizacion_id = fn_org() and fn_rol() <> 'lectura')
  with check (organizacion_id = fn_org());

create policy resoluciones_escribir on resoluciones for insert
  with check (
    organizacion_id = fn_org()
    and fn_rol() <> 'lectura'
    and actor = auth.uid()
  );

create policy corridas_escribir on conciliacion_corridas for insert
  with check (organizacion_id = fn_org() and fn_rol() <> 'lectura');

create policy eventos_escribir on transferencia_eventos for insert
  with check (organizacion_id = fn_org() and fn_rol() <> 'lectura');

-- ── Nada se borra ──────────────────────────────────────────────
--
-- Sin política de delete, `delete` no encuentra ninguna fila y no borra
-- nada. Es la forma más simple de que la regla sea real y no una promesa
-- del código: en este dominio, borrar es perder la evidencia de una
-- operación que involucró dinero.

-- Una resolución tampoco se edita. Si Mati cambia de opinión, se registra
-- una resolución nueva: la anterior es parte del historial y el motor ya
-- toma la última.
