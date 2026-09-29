Quiero renombrar una columna en todas mis tablas. Te doy el contexto para que no tengas que preguntar nada:

CONTEXTO
- La columna de la imagen de cada juego se llama ahora mismo `url` y quiero que se llame `Cover`.
- Las tablas de plataformas son exactamente estas 14, en MAYÚSCULAS: "3DS", "WII", "WIIU", "SWITCH", "PS1", "PS2", "PSP", "PS3", "PSVITA", "PS4", "PS5", "XBOX", "XBOX360", "PC".
- Existe además la tabla "BANNER" (3 filas), que también tiene su columna `url` (ahí es la imagen del banner, no una portada). RENAME ELLA TAMBIÉN a `Cover`, para que todas las tablas queden iguales.
- Solo quiero cambiar el nombre. Los datos, los tipos, los permisos y la función `public.increment_view` se quedan como están.

QUÉ TIENES QUE HACER (ejecutarlo de verdad, no solo mostrar el SQL)

1) Renombrar la columna `url` a `Cover` en las 15 tablas. Para cada tabla:
   alter table public."3DS" rename column "url" to "Cover";
   (los nombres de tabla van entrecomillas porque están en mayúsculas; en la columna usa comillas también, que así te aseguras de que el nombre queda exactamente `Cover` y no `cover` en minúscula).

2) Al terminar, comprobar que ya no queda ninguna columna `url` y que sí existe `Cover`. Puedes usar information_schema.columns:
   select table_name, column_name from information_schema.columns
   where table_schema = 'public' and lower(column_name) in ('url','cover') order by table_name;
   Deben salir 15 filas y todas deben decir `Cover`.

3) Comprobar que los datos siguen intactos: cuenta las filas de cada tabla antes y después y confirma que no ha cambiado ninguna, y que no se ha borrado ninguna columna por el camino.

4) Comprobación de datos: que las URLs siguen ahí, por ejemplo:
   select "Nombre", "Cover" from public."PS2" where "Nombre" = 'Ico';
   (debe devolver la URL de la imagen de Ico, que empieza por https://...supabase.co/storage/...)

5) No cambies NADA más: ni los tipos de datos, ni los valores, ni los permisos, ni las políticas RLS, ni la función `public.increment_view`. Solo el nombre de la columna.

6) Dime el resultado de cada comprobación y si algún paso dio error. Si algo falla, corrígelo y repítelo: quiero las 15 tablas renombradas de verdad, no solo el SQL escrito.
