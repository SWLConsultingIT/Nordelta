# Despliegue

## Por qué existe `vercel.json`

Una sola línea: `"framework": "nextjs"`.

Vercel decide **cómo construir y cómo servir** un proyecto a partir del
framework detectado. Con el preset en `Other` no aplica el adaptador de
Next: corre el build, ignora la salida de `.next/`, no crea ninguna
función de servidor y busca archivos estáticos que no existen. El
resultado es que **todas las rutas devuelven 404**, incluida la portada,
aunque el build haya terminado bien.

Declararlo en el repositorio lo saca de la configuración del panel, donde
se elige una vez y nadie vuelve a mirar.

## Variables de entorno

| Variable | Requerida | Alcance |
|---|---|---|
| `DATA_MODE` | sí — `supabase` | servidor |
| `NEXT_PUBLIC_SUPABASE_URL` | sí | **navegador**, pública por diseño |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | sí | **navegador**, pública por diseño |
| `SUPABASE_URL` | sí | servidor |
| `SUPABASE_SECRET_KEY` | sí | **servidor**, nunca al navegador |
| `FULLCARGA_USERNAME` | no | servidor |
| `FULLCARGA_PASSWORD` | no | servidor |

`SUPABASE_DB_PASSWORD` **no va**: la aplicación no la usa. Solo sirve para
aplicar migraciones desde una máquina de desarrollo.

Sin las de Fullcarga la aplicación funciona igual: muestra la integración
como no conectada y sigue conciliando con lo que ya está en el pozo.

`DATA_MODE` no tiene valor por defecto en producción, y es a propósito: un
despliegue al que le falta configuración tiene que romperse ruidosamente,
no degradarse a algo que parece funcionar.

## Región

La base está en **us-west-2**. Conviene que las funciones corran cerca:
cada pantalla hace varias consultas seguidas, y con el servidor en São
Paulo y la base en Oregón cada una paga el viaje de ida y vuelta. En
Vercel: *Settings → Functions → Function Region* → una región de la costa
oeste de Estados Unidos.

No se fija acá porque depende de dónde quede la base, y eso puede cambiar.

## Verificación después de desplegar

1. `/` carga sin sesión.
2. `/inicio` sin sesión **redirige** a `/login?volver=%2Finicio`.
3. Se entra con el usuario de staging.
4. `/inicio` muestra el porcentaje automático y el contador de atención.
5. `/conciliacion` abre el panel de una excepción.
6. Confirmar un match, recargar, y la decisión sigue ahí.
7. `/fullcarga` dice «sin conexión configurada» y no rompe.
