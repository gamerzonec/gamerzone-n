-- GAMERZONE · configuración del contador de "Más vistos" para la versión estática
-- en GitHub Pages
--
-- La página se sirve como archivos estáticos, así que no hay servidor que sume
-- las visitas: las suma el navegador llamando a esta función por la clave
-- publicable (rol `anon`). El contador NO está en una tabla aparte: cada tabla de
-- plataforma (`PS2`, `WII`, `SWITCH`…) tiene su propia columna `views`, y lo que
-- se incrementa es la fila de esa tabla cuyo `Nombre` coincide con el del juego.
-- La tabla `BANNER` queda fuera: no tiene columna `views` ni entra en el ranking.
--
-- Pega este script en Supabase → SQL Editor → New query → Run. Es idempotente:
-- puedes ejecutarlo las veces que quieras.
--
-- IMPORTANTE: sin esta función el ranking no sube. La app avisa en la consola
-- del navegador con "¿ejecutaste supabase-views-setup.sql?".

-- 1) Función que suma una vista.
--
-- Recibe el nombre de la tabla (la plataforma) y el nombre del juego, y hace
-- `views = views + 1` sobre la fila correspondiente. La suma se hace dentro de
-- la base de datos, no con un leer-y-escribir desde el navegador, para que dos
-- usuarios que abren el mismo juego a la vez no se pisen.
--
-- Se busca por `Nombre` y no por `id` porque el `id` de Supabase cambia si
-- borras y vuelves a subir un juego, y con él se perdería todo el contador
-- acumulado. El nombre es estable. El nombre de la tabla ya hace de plataforma:
-- "Resident Evil 4" está en PS2, PS3 y PS4, y son entradas distintas.
create or replace function public.increment_view(p_tabla text, p_nombre text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  permitidas constant text[] := array[
    '3ds', 'wii', 'wiiu', 'switch', 'ps1', 'ps2', 'psp', 'ps3',
    'psvita', 'ps4', 'ps5', 'xbox', 'xbox360', 'pc'
  ];
  v_total integer;
begin
  if p_nombre is null or btrim(p_nombre) = '' then
    return 0;
  end if;

  -- Lista blanca: esta función corre con permisos de postgres (`security
  -- definer`), así que sin esta comprobación el navegador podría pasarle el
  -- nombre de cualquier otra tabla y sumarle vistas.
  if p_tabla is null or lower(p_tabla) not in (select unnest(permitidas)) then
    raise exception 'Tabla no permitida: %', coalesce(p_tabla, 'null');
  end if;

  -- `format` con %I entrecomilla el identificador, y $1 impide que el nombre del
  -- juego se interprete como SQL. Se comparan los dos lados sin espacios de los
  -- extremos porque así es como los guarda y los muestra la web.
  execute format(
    'update public.%I set views = coalesce(views, 0) + 1 where btrim("Nombre") = $1',
    p_tabla
  )
    using btrim(p_nombre);

  execute format('select coalesce(sum(views), 0)::int from public.%I where btrim("Nombre") = $1', p_tabla)
    into v_total
    using btrim(p_nombre);

  return v_total;
end;
$$;

grant execute on function public.increment_view(text, text) to anon, authenticated;

-- 2) Comprobación: suma una vista de un juego real y devuelve el total. Debe
--    devolver un número (si falla, la web muestra un aviso en la consola).
select public.increment_view('PS2', 'Ico');

-- Si esa prueba te devuelve 1, la función está bien.
select "Nombre", views from public."PS2" where btrim("Nombre") = 'Ico';

-- Para dejarla como estaba, si no quieres que la prueba cuente:
-- update public."PS2" set views = 0 where btrim("Nombre") = 'Ico';
