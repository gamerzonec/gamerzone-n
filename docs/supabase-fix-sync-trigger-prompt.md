Al subir una imagen al bucket me da este error y necesito que lo arregles:

  Failed to upload Silt.jpg: unexpected response while creating upload,
  response code: 503, response text:
  There is a database schema mismatch in a trigger or RLS policy:
  PL/pgSQL function public.sync_platform_cover_from_storage() line 70 at EXECUTE

CONTEXTO
- Acabo de renombrar la columna de la imagen en las 15 tablas: `url` pasó a llamarse `Cover`. Ese es el motivo del error: hay un trigger sobre `storage.objects` que, al subir un archivo, llama a la función `public.sync_platform_cover_from_storage()`, y esa función sigue#line 70 citando la columna antigua `url`, que ya no existe. Postgres no puede ni validarla.
- Tablas de plataformas: "3DS", "WII", "WIIU", "SWITCH", "PS1", "PS2", "PSP", "PS3", "PSVITA", "PS4", "PS5", "XBOX", "XBOX360", "PC". Más la tabla "BANNER", que también tiene su columna `Cover` (en BANNER la imagen es el banner, no una portada).
- La columna se llama `Cover` con mayúscula, así que en SQL va SIEMPRE entrecomillada: `"Cover"`. Sin comillas se convertiría a `cover` en minúscula, que es otra columna.
- El flujo que necesito que siga funcionando: arrastro una imagen al bucket `bd-gamerzone` y el trigger se encarga de poner la URL de esa imagen en la columna `Cover` de la fila del juego correspondiente. No quiero que ese trigger deje de funcionar; quiero que vuelva a funcionar.
QUÉ TIENES QUE HACER (ejecutarlo de verdad, no solo mostrar el SQL)

1) Enséñame primero cómo están las dos cosas, antes de tocar nada:
   - La definición completa de `public.sync_platform_cover_from_storage()`:
     select prosrc from pg_proc where proname = 'sync_platform_cover_from_storage';
   - El/los triggers que la llaman sobre la tabla storage.objects:
     select tgname, pg_get_triggerdef(oid) from pg_trigger
     where tgrelid = 'storage.objects'::regclass and not tgisinternal;

2) Localiza en esa función todas las referencias a la columna antigua `url` y cámbialas por `"Cover"`. Ojo con las dos cosas que se confunden fácil:
   - `storage.objects.name` (el nombre del fichero) NO se toca: eso es otra cosa y sigue igual.
   - `new.name` o `old.name` del registro de storage tampoco se tocan.
   - Solo se cambian las referencias a la columna de la imagen de las tablas de juegos.
   Si la función construye el nombre de la tabla o de la columna con `format()`/`%I`, actualiza ahí el nombre de la columna; si usa `%I` con una cadena como 'url', cámbiala a 'Cover'. Y recuerda que, al pasar el nombre por `format()`, si lo pasas como `%I` queda correctamente entrecomillado; si lo concatenas a pelo, mete tú las comillas dobles.

3) Antes de dar por buena la función, busca si hay OTRAS cosas del proyecto que sigan citando la columna antigua `url` (otras funciones, vistas, políticas, índices, triggers). La lista completa está aquí:
   select n.nspname, c.relname, a.attname
   from pg_attribute a
   join pg_class c on c.oid = a.attrelid
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and a.attname = 'url' and not a.attisdropped;
   Y también revisa pg_proc:
   select proname from pg_proc
   where pronamespace = 'public'::regnamespace
     and prosrc ilike '%url%';
   Arréglalas también si hacen falta.

4) Comprueba que la función compila. En plpgsql los errores de compilación no salen hasta que se ejecuta, así que ejecútala con datos reales de prueba en lugar de fiarte solo de crearla. Por ejemplo, sobre un objeto de storage que ya exista en el bucket, o simulando lo que hace el trigger. Dime exactamente cómo lo has comprobado.

5) No cambies nada más: ni los valores de las tablas, ni los permisos, ni las políticas RLS, ni la función `public.increment_view`. Solo lo necesario para que la función volvió a ser válida.

6) Dime el resultado de cada paso y si algo falló. Si algo falla, corrígelo y repítelo: quiero las subidas funcionando de verdad, no solo el SQL escrito.
