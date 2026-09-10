-- ═══════════════════════════════════════════════════════════════
-- Dominio operativo: acreditaciones y conciliación.
--
-- Es el flujo diario de Mati, hoy resuelto a mano en Excel sobre 300–600
-- transferencias por día. Todo lo que se modela acá está validado contra
-- datos reales: la descarga de Fullcarga, el parser del informe, la
-- extracción de CUIT y las dos reglas de emparejamiento automático.
--
-- Cuatro decisiones que gobiernan el esquema y conviene tener a mano:
--
--   1. **Una operación pendiente no es un resultado, es un estado abierto.**
--      Regla confirmada por NORD: una transferencia enviada y no acreditada
--      es un problema desde el día cero, sin período de gracia. Se midieron
--      atrasos de hasta 113 días, así que una fila puede quedar abierta
--      meses y volver a evaluarse con cada informe nuevo.
--
--   2. **Nada se corrige solo.** Un CUIT con el verificador mal se marca,
--      no se arregla: un dígito cambiado por el sistema manda plata a otra
--      persona. Se conserva siempre lo que mandó el cliente.
--
--   3. **Uno a uno.** Una acreditación de Fullcarga la cobra una sola
--      transferencia. Es una restricción de la base, no una convención.
--
--   4. **La planilla es la unidad contable.** Una transferencia suelta no
--      genera asiento; lo que llega a la cuenta corriente es el total de la
--      planilla una vez que acreditó todo.
--
-- No aplicada a ningún entorno todavía.
-- ═══════════════════════════════════════════════════════════════

-- ── Tipos ──────────────────────────────────────────────────────

-- Los trece estados del motor. Los once primeros los produce el matcher;
-- los dos últimos solo puede producirlos una persona.
create type estado_operacion as enum (
  'ACREDITADA_EXACTA_CUIT',
  'ACREDITADA_EXACTA_DNI',
  'ACREDITADA_MANUAL',
  'DESCARTADA_DUPLICADO',
  'PENDIENTE_NO_ENCONTRADA_EN_RANGO',
  'MATCH_AMBIGUO',
  'POSIBLE_MATCH',
  'IDENTITY_MAPPING_REQUIRED',
  'POSIBLE_DUPLICADO',
  'ERROR_CUIT',
  'ERROR_IDENTIFICACION',
  'COMPROBANTE_INVALIDO',
  'DATOS_INVALIDOS'
);

create type estado_planilla   as enum ('RECIBIDA','CON_ERRORES','LISTA','ENVIADA','PENDIENTE','ACREDITADA');
create type tipo_identificacion as enum ('CUIT_VALIDO','DNI_PROBABLE','IDENTIFICACION_INVALIDA','UNKNOWN');
create type origen_informe    as enum ('AUTOMATICO','MANUAL');
create type decision_resolucion as enum ('CONFIRMAR_MATCH','RECHAZAR_CANDIDATOS','MANTENER_PENDIENTE','MARCAR_DUPLICADO');
-- De dónde salió una resolución. Hoy todas son humanas —una resolución es,
-- por definición, alguien decidiendo—, pero el origen queda explícito
-- porque la regla que gobierna la re-evaluación depende de él: **una
-- decisión humana no la pisa una corrida automática.** Dejarlo implícito
-- en «tiene actor» obligaría a razonarlo cada vez.
create type origen_resolucion as enum ('HUMANA','AUTOMATICA');

-- De qué parte del flujo salió un cambio de estado.
create type origen_evento as enum ('IMPORTACION','CONCILIACION','RESOLUCION');

create type disparador_corrida as enum ('MANUAL','IMPORTACION_PLANILLA','IMPORTACION_INFORME','PROGRAMADA');

/** ¿El estado cuenta como plata efectivamente acreditada? */
create or replace function fn_estado_acredita(e estado_operacion)
returns boolean language sql immutable parallel safe as $$
  select e in ('ACREDITADA_EXACTA_CUIT','ACREDITADA_EXACTA_DNI','ACREDITADA_MANUAL')
$$;

/** ¿Requiere que una persona haga algo? Todo lo que no está cerrado. */
create or replace function fn_estado_requiere_atencion(e estado_operacion)
returns boolean language sql immutable parallel safe as $$
  select not (e in ('ACREDITADA_EXACTA_CUIT','ACREDITADA_EXACTA_DNI',
                    'ACREDITADA_MANUAL','DESCARTADA_DUPLICADO'))
$$;

-- ── Clientes ───────────────────────────────────────────────────

-- El cliente de NORD es quien manda planillas. **No es la contraparte del
-- libro financiero**: la contraparte es una entidad contable y un mismo
-- cliente puede recibir de decenas de depositantes distintos. Se dejan
-- separadas y se vinculan con una FK opcional, poblada cuando NORD
-- confirme la relación. No se infiere.
create table clientes (
  id              uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null default fn_org() references organizaciones(id) on delete restrict,
  nombre          text not null check (length(btrim(nombre)) > 0),
  -- Identificador corto para columnas densas y para nombrar archivos.
  alias           text not null check (alias ~ '^[A-Z0-9][A-Z0-9-]{0,15}$'),
  activo          boolean not null default true,
  contraparte_id  bigint references contrapartes(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organizacion_id, alias)
);

-- Destino de las claves foráneas compuestas: obliga a que el hijo
-- pertenezca a la misma organización que el padre.
alter table clientes add constraint clientes_id_org unique (id, organizacion_id);

create index on clientes (organizacion_id) where activo;

-- Un cliente manda desde uno o varios correos. Existe ya para que la
-- ingesta por Gmail —que no se implementa en esta etapa— no obligue a
-- migrar datos después.
create table cliente_emails (
  id              uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null default fn_org() references organizaciones(id) on delete restrict,
  cliente_id      uuid not null,
  email           text not null check (position('@' in email) > 1),
  -- El correo desde el que se espera recibir por defecto.
  principal       boolean not null default false,
  created_at      timestamptz not null default now(),
  -- Un mismo correo no puede pertenecer a dos clientes de la misma
  -- organización: al llegar un adjunto habría que adivinar de quién es.
  unique (organizacion_id, email)
);

create index on cliente_emails (cliente_id);

-- ── Planillas ──────────────────────────────────────────────────

create table planillas (
  id              uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null default fn_org() references organizaciones(id) on delete restrict,
  cliente_id      uuid not null,
  archivo         text not null,
  -- Fecha que el cliente declara para la planilla.
  fecha           date not null,
  recibida_en     timestamptz not null default now(),
  estado          estado_planilla not null default 'RECIBIDA',
  -- Huella del archivo tal como llegó. Sirve para detectar el reenvío del
  -- mismo adjunto, que en el flujo por correo pasa todo el tiempo.
  sha256          char(64),
  filas           integer not null default 0 check (filas >= 0),
  -- En centavos: la coma flotante no entra en una tabla de dinero.
  total_centavos  bigint  not null default 0,
  -- Ruta en el almacenamiento. El archivo original se conserva porque es
  -- la única prueba de qué mandó el cliente si después lo discute.
  storage_path    text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Destino de las claves foráneas compuestas: obliga a que el hijo
-- pertenezca a la misma organización que el padre.
alter table planillas add constraint planillas_id_org unique (id, organizacion_id);

create index on planillas (organizacion_id, fecha desc);
create index on planillas (cliente_id, fecha desc);
-- El mismo archivo, del mismo cliente, no se importa dos veces.
create unique index on planillas (organizacion_id, cliente_id, sha256)
  where sha256 is not null;

-- ── Informes de Fullcarga ──────────────────────────────────────

-- Nunca se guarda JSESSIONID, ni el token de Struts, ni cookies. No hay
-- columna donde ponerlos, y es a propósito.
create table informes_fullcarga (
  id              uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null default fn_org() references organizaciones(id) on delete restrict,
  archivo         text not null,
  desde           date not null,
  hasta           date not null check (hasta >= desde),
  origen          origen_informe not null,
  descargado_en   timestamptz not null default now(),
  sha256          char(64),
  storage_path    text,
  -- Cuántas filas del archivo resultaron acreditaciones conciliables.
  acreditaciones  integer not null default 0 check (acreditaciones >= 0),
  created_at      timestamptz not null default now()
);

-- Destino de las claves foráneas compuestas: obliga a que el hijo
-- pertenezca a la misma organización que el padre.
alter table informes_fullcarga add constraint informes_fullcarga_id_org unique (id, organizacion_id);

create index on informes_fullcarga (organizacion_id, hasta desc);

-- ── Acreditaciones ─────────────────────────────────────────────

-- Identidad de origen: informe más fila. **No** se usa
-- CUIT + fecha + importe como clave, aunque sea tentador: dos personas
-- pueden transferir lo mismo el mismo día y son dos acreditaciones
-- legítimas. Colapsarlas perdería plata.
create table acreditaciones (
  id              uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null default fn_org() references organizaciones(id) on delete restrict,
  informe_id      uuid not null,
  fila_origen     integer not null check (fila_origen >= 0),
  cuit            char(11) not null check (cuit ~ '^[0-9]{11}$'),
  -- FECHA INGRESO del informe, que es contra la que cruza el matcher.
  -- Nunca FECHA, que es la de generación del reporte.
  fecha_ingreso   date not null,
  importe_centavos bigint not null check (importe_centavos > 0),
  banco           text,
  descripcion     text,
  created_at      timestamptz not null default now(),
  unique (informe_id, fila_origen)
);

-- Destino de las claves foráneas compuestas: obliga a que el hijo
-- pertenezca a la misma organización que el padre.
alter table acreditaciones add constraint acreditaciones_id_org unique (id, organizacion_id);

create index on acreditaciones (organizacion_id, cuit, fecha_ingreso);
create index on acreditaciones (organizacion_id, fecha_ingreso desc);

-- Huella natural, **solo para detectar reprocesos**, nunca como clave. Los
-- informes se superponen por diseño: el de un día sigue creciendo mientras
-- el día está abierto, así que el mismo registro llega varias veces.
create index on acreditaciones (organizacion_id, cuit, fecha_ingreso, importe_centavos);

-- ── Transferencias declaradas por el cliente ───────────────────

create table transferencias (
  id              uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null default fn_org() references organizaciones(id) on delete restrict,
  planilla_id     uuid not null,
  cliente_id      uuid not null,
  fila            integer not null check (fila > 0),

  -- Lo que mandó el cliente. Inmutable: es la prueba de qué declaró.
  fecha_deposito       date,
  banco                text,
  nombre_depositante   text,
  identificacion_original    text not null default '',
  identificacion_normalizada text not null default '',
  tipo_identificacion  tipo_identificacion not null default 'UNKNOWN',
  importe_centavos     bigint not null default 0,
  numero_deposito      text,

  -- Resultado de la última evaluación.
  estado          estado_operacion not null default 'PENDIENTE_NO_ENCONTRADA_EN_RANGO',
  motivo          text not null default '',
  acreditacion_id uuid,
  -- Verdadero solo cuando el sistema la cerró sin intervención.
  automatica      boolean not null default false,
  -- Acreditó gracias a una identidad que una persona confirmó antes.
  via_mapeo       boolean not null default false,
  acreditada_el   date,
  -- Candidatos que dejó la última corrida y filas de la misma planilla que
  -- se le parecen. Son resultado de la última evaluación, no hechos
  -- relacionales: se recalculan enteros en cada corrida y por eso van como
  -- arreglo en la fila y no en una tabla aparte.
  candidato_ids   uuid[] not null default '{}',
  duplicado_de    integer[] not null default '{}',
  evaluada_en     timestamptz not null default now(),
  intentos        integer not null default 0 check (intentos >= 0),

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (planilla_id, fila),

  -- Coherencia entre estado y acreditación: un estado acreditado sin
  -- registro asociado es plata dada por cobrada contra nada.
  constraint acreditada_tiene_registro
    check (not fn_estado_acredita(estado) or acreditacion_id is not null),
  constraint no_acreditada_no_tiene_registro
    check (fn_estado_acredita(estado) or acreditacion_id is null)
);

-- Destino de las claves foráneas compuestas: obliga a que el hijo
-- pertenezca a la misma organización que el padre.
alter table transferencias add constraint transferencias_id_org unique (id, organizacion_id);

-- **Uno a uno, garantizado por la base.** Dos transferencias no pueden
-- cobrar la misma acreditación, y eso no puede depender de que el código
-- se acuerde.
create unique index on transferencias (acreditacion_id)
  where acreditacion_id is not null;

-- La cola de trabajo: lo que sigue abierto, lo más viejo primero.
create index on transferencias (organizacion_id, fecha_deposito)
  where fn_estado_requiere_atencion(estado);
create index on transferencias (organizacion_id, estado);
create index on transferencias (cliente_id);
create index on transferencias (planilla_id);
-- Búsqueda por identificación, que es como Mati encuentra una fila.
create index on transferencias (organizacion_id, identificacion_normalizada);

-- ── Identidades confirmadas ────────────────────────────────────

-- **Nunca se deduce.** Es la afirmación «el depositante que este cliente
-- identifica así es el titular de este CUIT real», hecha por una persona
-- con nombre y fecha. El sistema la aplica; no la inventa.
--
-- El alcance es por cliente: es el más angosto posible y por eso el único
-- que no puede aplicar mal en otro lado.
-- TO VALIDATE — F-3: NORD tiene que decir si un mapeo confirmado vale para
-- todos los clientes o solo para el que lo originó.
create table mapeos_identidad (
  id              uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null default fn_org() references organizaciones(id) on delete restrict,
  cliente_id      uuid not null,
  -- Lo que escribe el cliente en su planilla, solo dígitos.
  identificacion  text not null check (identificacion ~ '^[0-9]{7,11}$'),
  -- El CUIT real que devolvió Fullcarga.
  cuit            char(11) not null check (cuit ~ '^[0-9]{11}$'),
  confirmado_por  uuid not null references auth.users(id),
  confirmado_en   timestamptz not null default now(),
  -- Cuántas veces se aplicó después. Mide si aprender sirvió.
  usos            integer not null default 0 check (usos >= 0),
  unique (cliente_id, identificacion)
);

-- Destino de las claves foráneas compuestas: obliga a que el hijo
-- pertenezca a la misma organización que el padre.
alter table mapeos_identidad add constraint mapeos_identidad_id_org unique (id, organizacion_id);

create index on mapeos_identidad (organizacion_id, identificacion);

-- ── Resoluciones ───────────────────────────────────────────────

-- No alcanza con `resuelto = true`. Hace falta saber quién, cuándo, qué
-- decidió, sobre qué registro y por qué: es lo que permite auditar una
-- acreditación que alguien discute seis meses después.
create table resoluciones (
  id               uuid primary key default gen_random_uuid(),
  organizacion_id  uuid not null references organizaciones(id) on delete restrict,
  transferencia_id uuid not null,
  decision         decision_resolucion not null,
  origen           origen_resolucion not null default 'HUMANA',
  acreditacion_id  uuid,
  -- Estado de la transferencia justo antes de la decisión.
  estado_previo    estado_operacion not null,
  motivo           text,
  -- El mapeo de identidad que dejó esta resolución, si dejó alguno.
  mapeo_id         uuid,
  actor            uuid not null references auth.users(id),
  decidido_en      timestamptz not null default now(),

  -- Confirmar exige elegir un registro. Sin eso no hay nada que confirmar.
  constraint confirmar_exige_acreditacion
    check (decision <> 'CONFIRMAR_MATCH' or acreditacion_id is not null)
);

create index on resoluciones (transferencia_id, decidido_en desc);
create index on resoluciones (organizacion_id, decidido_en desc);

-- ── Corridas ───────────────────────────────────────────────────

-- Cada re-evaluación deja rastro. Sirve para responder la pregunta que de
-- verdad importa sobre la cola: **si crece o si drena**.
create table conciliacion_corridas (
  id                 uuid primary key default gen_random_uuid(),
  organizacion_id    uuid not null references organizaciones(id) on delete restrict,
  disparador         disparador_corrida not null,
  informe_id         uuid,
  corrida_en         timestamptz not null default now(),
  evaluadas          integer not null default 0,
  nuevas_acreditadas integer not null default 0,
  -- Cuántas cerraron gracias a una identidad confirmada antes.
  por_mapeo          integer not null default 0,
  pendientes_al_cierre integer not null default 0,
  -- Cuánto tardó. Con 300–600 operaciones diarias y una cola de miles,
  -- saber si la corrida empieza a degradarse importa antes de que moleste.
  duracion_ms        integer
);

-- Destino de las claves foráneas compuestas: obliga a que el hijo
-- pertenezca a la misma organización que el padre.
alter table conciliacion_corridas add constraint conciliacion_corridas_id_org unique (id, organizacion_id);

create index on conciliacion_corridas (organizacion_id, corrida_en desc);

-- ── Historial ──────────────────────────────────────────────────

-- Cambios de estado de una transferencia: el «qué pasó, cuándo y por qué».
-- Se guarda aparte de `auditoria` porque esto es historia de negocio que se
-- le muestra a Mati, no traza técnica.
create table transferencia_eventos (
  id               bigserial primary key,
  organizacion_id  uuid not null references organizaciones(id) on delete restrict,
  transferencia_id uuid not null,
  ocurrido_en      timestamptz not null default now(),
  estado_previo    estado_operacion,
  estado_nuevo     estado_operacion not null,
  motivo           text not null default '',
  origen           origen_evento not null,
  -- Null cuando lo hizo el sistema.
  actor            uuid references auth.users(id),
  corrida_id       uuid
);

create index on transferencia_eventos (transferencia_id, ocurrido_en desc);
create index on transferencia_eventos (organizacion_id, ocurrido_en desc);

-- ── Mantenimiento de updated_at ────────────────────────────────

create or replace function fn_tocar_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger trg_clientes_updated   before update on clientes
  for each row execute function fn_tocar_updated_at();
create trigger trg_planillas_updated  before update on planillas
  for each row execute function fn_tocar_updated_at();
create trigger trg_transf_updated     before update on transferencias
  for each row execute function fn_tocar_updated_at();


-- ═══════════════════════════════════════════════════════════════
-- Claves foráneas compuestas.
--
-- Van al final porque cada una necesita que el padre ya exista con su
-- restricción `(id, organizacion_id)`.
--
-- **Por qué compuestas y no simples.** `organizacion_id` está repetido en
-- todas las tablas para que la seguridad por fila sea un filtro directo y
-- barato. El precio de esa desnormalización es que nada garantiza que el
-- valor coincida con el del padre, y las claves foráneas **no** pasan por
-- las políticas: se podía insertar una planilla con la organización propia
-- apuntando al cliente de otra organización, y después leerla —porque la
-- fila es «mía»—. Eso es exactamente el cruce entre inquilinos que la
-- seguridad por fila tenía que impedir.
--
-- Con la clave compuesta, la base rechaza la fila: el hijo solo puede
-- apuntar a un padre de su misma organización.
-- ═══════════════════════════════════════════════════════════════

alter table cliente_emails add constraint cliente_emails_cliente_fk
  foreign key (cliente_id, organizacion_id)
  references clientes (id, organizacion_id) on delete cascade;

alter table planillas add constraint planillas_cliente_fk
  foreign key (cliente_id, organizacion_id)
  references clientes (id, organizacion_id) on delete restrict;

alter table acreditaciones add constraint acreditaciones_informe_fk
  foreign key (informe_id, organizacion_id)
  references informes_fullcarga (id, organizacion_id) on delete cascade;

alter table transferencias add constraint transferencias_planilla_fk
  foreign key (planilla_id, organizacion_id)
  references planillas (id, organizacion_id) on delete cascade;

alter table transferencias add constraint transferencias_cliente_fk
  foreign key (cliente_id, organizacion_id)
  references clientes (id, organizacion_id) on delete restrict;

-- `restrict` y no `set null`: poner la acreditación en null dejaría una
-- transferencia en estado acreditado sin registro asociado, que es
-- justamente lo que prohíbe `acreditada_tiene_registro`. Mejor que la baja
-- falle de forma explícita.
alter table transferencias add constraint transferencias_acreditacion_fk
  foreign key (acreditacion_id, organizacion_id)
  references acreditaciones (id, organizacion_id) on delete restrict;

alter table mapeos_identidad add constraint mapeos_cliente_fk
  foreign key (cliente_id, organizacion_id)
  references clientes (id, organizacion_id) on delete cascade;

alter table resoluciones add constraint resoluciones_transferencia_fk
  foreign key (transferencia_id, organizacion_id)
  references transferencias (id, organizacion_id) on delete cascade;

alter table resoluciones add constraint resoluciones_acreditacion_fk
  foreign key (acreditacion_id, organizacion_id)
  references acreditaciones (id, organizacion_id) on delete restrict;

alter table resoluciones add constraint resoluciones_mapeo_fk
  foreign key (mapeo_id, organizacion_id)
  references mapeos_identidad (id, organizacion_id) on delete restrict;

alter table conciliacion_corridas add constraint corridas_informe_fk
  foreign key (informe_id, organizacion_id)
  references informes_fullcarga (id, organizacion_id) on delete restrict;

alter table transferencia_eventos add constraint eventos_transferencia_fk
  foreign key (transferencia_id, organizacion_id)
  references transferencias (id, organizacion_id) on delete cascade;

alter table transferencia_eventos add constraint eventos_corrida_fk
  foreign key (corrida_id, organizacion_id)
  references conciliacion_corridas (id, organizacion_id) on delete restrict;
