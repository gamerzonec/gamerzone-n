Necesito que ejecutes esto en mi base de datos pública (esquema `public`). Te doy el contexto para que no tengas que preguntar nada:

CONTEXTO
- Es una web estática en GitHub Pages, sin backend propio. El navegador (rol `anon`, con la clave publicable) llama a una función para registrar visitas.
- El contador de vistas NO está en una tabla aparte: cada tabla de plataforma ya tiene su propia columna `views` (tipo integer). No quiero ninguna tabla nueva.
- Las tablas de plataforma son exactamente estas 14, y están escritas en MAYÚSCULAS: "3DS", "WII", "WIIU", "SWITCH", "PS1", "PS2", "PSP", "PS3", "PSVITA", "PS4", "PS5", "XBOX", "XBOX360", "PC".
- Existe además una tabla "BANNER" que NO tiene columna `views` y no debe tocarse nunca.
- La columna con el título del juego se llama exactamente `Nombre` (con N mayúscula). En Postgres los identificadores sin comillas se pasan a minúscula, así que hay que escribirla entrecomillada: `"Nombre"`.

QUÉ TIENES QUE HACER (en este orden, y ejecutarlo de verdad, no solo mostrar el SQL)

1) Crear la función `public.increment_view(p_tabla text, p_nombre text)`, en plpgsql, que:
   - Devuelva integer: el total de vistas de ese juego después de sumar (0 si no encuentra el juego).
   - Si `p_nombre` es NULL o está en blanco, devuelva 0 sin tocar nada.
   - Valide `p_tabla` contra una lista blanca con esas 14 tablas (comparación sin distinguir mayúsculas/minúsculas, `lower(p_tabla)`). Si la tabla no está en la lista, lance una excepción con un mensaje claro. Esto es obligatorio por seguridad: la función corre con permisos de postgres (`security definer`), así que sin lista blanca el navegador podría pasarle el nombre de cualquier otra tabla.
   - Haga un UPDATE de la fila o filas cuya `"Nombre"` coincida con `p_nombre` en esa tabla: `views = coalesce(views, 0) + 1`.
   - Devuelva la suma de `views` de las filas que coincidan (por si algún día hay títulos repetidos en la misma tabla).
   - IMPORTANTE: la comparación debe hacerse sin espacios sobrantes en los dos lados, o sea `btrim("Nombre") = btrim($1)`, porque la web guarda y muestra los títulos recortados. Y el nombre del juego debe viajar como parámetro `$1`, NUNCA concatenado en el texto SQL, para que no se pueda inyectar SQL.

2) La función debe ser `security definer` con `set search_path = public`, y el nombre de la tabla debe construirse con `format('...%I...', p_tabla)` (el %I entrecomilla el identificador).

3) Dar permiso de ejecución al navegador:
   `grant execute on function public.increment_view(text, text) to anon, authenticated;`

4) No cambies los permisos ni las políticas RLS de las tablas de plataforma: ya están configuradas y la web lee bien de ellas.

5) Al final, poner todos los contadores a cero, porque empezamos de cero:
   `update public."3DS" set views = 0;` (y lo mismo con las otras 13 tablas: "WII", "WIIU", "SWITCH", "PS1", "PS2", "PSP", "PS3", "PSVITA", "PS4", "PS5", "XBOX", "XBOX360", "PC"). No toques la tabla "BANNER".

6) Comprobar que ha funcionado: ejecutar `select public.increment_view('PS2', 'Ico');` y dime qué valor devuelve (debe ser 1), y después ejecuta
   `update public."PS2" set views = 0 where btrim("Nombre") = 'Ico';`
   para que la prueba no deje un contador de más.

7) Por último, dime si te dio algún error en algún paso. Si algo falla, corrígelo y vuelve a ejecutarlo: quiero que la función quede creada y probada, no solo escrita.
