-- ═══════════════════════════════════════════════════════════════
-- Archivos originales.
--
-- Se conservan la planilla que mandó el cliente y el informe que devolvió
-- Fullcarga. No es una comodidad: es la única prueba de qué llegó el día
-- que alguien discute un importe o una fecha. Lo parseado es una
-- interpretación; el archivo es el hecho.
--
-- El aislamiento **no puede depender del nombre del archivo**, que lo
-- elige quien sube. Depende de la ruta: el primer segmento es el
-- identificador de la organización, y las políticas lo comparan contra la
-- organización de quien consulta.
--
--     {organizacion_id}/planillas/{planilla_id}/{archivo}
--     {organizacion_id}/fullcarga/{informe_id}/{archivo}
--
-- El bucket es privado y se crea fuera de esta migración —la API de
-- almacenamiento no es SQL—. Acá van las políticas.
-- ═══════════════════════════════════════════════════════════════

-- Por si se vuelve a aplicar sobre un proyecto que ya las tiene.
drop policy if exists originales_leer      on storage.objects;
drop policy if exists originales_escribir  on storage.objects;
drop policy if exists originales_actualizar on storage.objects;

/**
 * El primer segmento de la ruta, que es la organización dueña.
 *
 * `storage.foldername` devuelve los segmentos de carpeta; el primero es
 * el que importa. Se compara como texto contra `fn_org()`.
 */
create policy originales_leer on storage.objects for select
  to authenticated
  using (
    bucket_id = 'originales'
    and (storage.foldername(name))[1] = fn_org()::text
  );

create policy originales_escribir on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'originales'
    and (storage.foldername(name))[1] = fn_org()::text
  );

-- Necesaria para que subir el mismo archivo dos veces no falle: la ruta
-- incluye la huella, así que reescribirlo es idempotente y no pisa nada
-- distinto.
create policy originales_actualizar on storage.objects for update
  to authenticated
  using (
    bucket_id = 'originales'
    and (storage.foldername(name))[1] = fn_org()::text
  )
  with check (
    bucket_id = 'originales'
    and (storage.foldername(name))[1] = fn_org()::text
  );

-- **Sin política de borrado.** Un original borrado es evidencia perdida.
-- Si algún día hace falta dar de baja un archivo, será una decisión
-- explícita con su propia política y su propio registro.
