import { createClient } from "@supabase/supabase-js";

import { lookupWikipedia } from "./game-lookup.server";
import { youtubeIdFromUrl } from "./games";

/**
 * Capa de datos 100% cliente.
 *
 * Antes esto vivía en `createServerFn` (server functions de TanStack Start), lo
 * que obligaba a tener un servidor Node. GitHub Pages solo sirve archivos
 * estáticos, así que aquí se consulta Supabase directamente desde el navegador
 * con la clave publicable (que es pública por diseño) y la sinopsis se pide a la
 * API de Wikipedia, que expone CORS abierto.
 */

export type Game = {
  id: string;
  name: string;
  platform: string;
  cover: string | null;
  banner: string | null;
  heading: string | null;
  description: string | null;
  trailer: string | null;
  /** Fecha de creación si la tabla tiene columna de fecha; si no, la del build. */
  createdTime: string;
  /** true cuando `createdTime` es una fecha real y no el relleno del build. */
  hasDate: boolean;
  /**
   * Vistas acumuladas del juego, leídas de la columna `views` de su tabla.
   *
   * El contador vive en la propia fila del juego en Supabase (no hay una tabla
   * aparte de vistas), así que cada visita suma con `increment_view` sobre la
   * fila que coincide con el `Nombre` de la plataforma. Es global: lo ven
   * todos los usuarios y dispositivos.
   */
  views: number;
  /**
   * `id` numérico tal cual está en Supabase.
   *
   * El `id` es incremental: cada fila nueva que se sube a una tabla tiene un id
   * mayor que las anteriores. Sirve para desempatar cuando varias filas comparten
   * la misma `created_at` (se subieron en la misma tanda). Si el id no es
   * numérico se usa 0 y el desempate cae en el nombre.
   */
  numericId: number;
  /**
   * Identificador único en todo el catálogo, para usar como `key` de React.
   *
   * No vale el `id` a secas: cada tabla de Supabase numera sus filas desde 1,
   * así que el juego 52 de PS2 y el 52 de SWITCH comparten id. En el buscador
   * global, que mezcla las 15 tablas, eso producía miles de `key` repetidas
   * (buscar "a" daba 4446 resultados con 855 ids duplicados) y React reutilizaba
   * la tarjeta de un juego en otro, dejando carátulas en blanco. Con la
   * plataforma delante, cada fila del catálogo tiene su propia key.
   */
  key: string;
};

export type Catalog = {
  platforms: string[];
  games: Game[];
};

export type GameDetails = {
  extract: string | null;
  wikipediaUrl: string | null;
  videoId: string | null;
};

const SUPABASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.["VITE_SUPABASE_URL"]) ||
  "https://ulnomncbhccqrynzlqqf.supabase.co";

const SUPABASE_ANON_KEY =
  (typeof import.meta !== "undefined" && import.meta.env?.["VITE_SUPABASE_ANON_KEY"]) ||
  "sb_publishable_USfwfy2ONPItJiHlwecXZw_EF9x49Rp";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TABLES: Array<{ platform: string; table: string }> = [
  { platform: "3DS", table: "3DS" },
  { platform: "WII", table: "WII" },
  { platform: "WIIU", table: "WIIU" },
  { platform: "SWITCH", table: "SWITCH" },
  { platform: "PS1", table: "PS1" },
  { platform: "PS2", table: "PS2" },
  { platform: "PSP", table: "PSP" },
  { platform: "PS3", table: "PS3" },
  { platform: "PSVITA", table: "PSVITA" },
  { platform: "PS4", table: "PS4" },
  { platform: "PS5", table: "PS5" },
  { platform: "XBOX", table: "XBOX" },
  { platform: "XBOX360", table: "XBOX360" },
  { platform: "PC", table: "PC" },
  { platform: "NOTICIAS", table: "BANNER" },
];

const CATALOG_TTL_MS = 15 * 60_000;
let catalogCache: { data: Catalog; expiresAt: number } | null = null;
let catalogInFlight: Promise<Catalog> | null = null;

/**
 * Catálogo recordado entre recargas de página (`sessionStorage`).
 *
 * Cada visita que abría la web tenía que esperar a que llegasen las 15 tablas
 * (~2-5 s medidos contra el Supabase real) antes de poder pintar el primer
 * juego. Guardando el resultado en el navegador, la siguiente búsqueda —y
 * cualquier navegación dentro de la app— arranca con las carátulas ya listas y
 * el catálogo se refresca por detrás.
 */
const CATALOG_STORAGE_KEY = "gamerzone:catalog:v1";
const CATALOG_STORAGE_MAX_MS = 24 * 60 * 60_000;

function readStoredCatalog(): Catalog | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CATALOG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt?: number; data?: Catalog };
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > CATALOG_STORAGE_MAX_MS) return null;
    if (!parsed.data?.games?.length) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeStoredCatalog(data: Catalog): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // Cuota llena o almacenamiento bloqueado: no es crítico, se trabaja en memoria.
  }
}

/**
 * Identificador de un juego para el contador de vistas en memoria.
 *
 * El contador real ya no necesita una clave: cada juego trae su `views` de la
 * columna de su tabla. Esta clave solo sirve para acumular los `+1` optimistas
 * de la sesión antes de que llegue el siguiente refresco del catálogo.
 *
 * Se elige el nombre y no el `id` por una razón práctica: el `id` cambia si
 * borras y vuelves a subir un juego, y con él se perdería todo el contador
 * acumulado. El nombre del juego, en cambio, es estable.
 *
 * Se añade la plataforma para separar las distintas versiones del mismo título:
 * "Resident Evil 4" está en PS2, PS3 y PS4, y son entradas distintas del
 * catálogo. Sin el sufijo, los ~510 juegos multiplataforma sumarían sus vistas
 * en un solo contador y "Más vistos" mostraría la misma carátula repetida.
 */
export function viewKey(game: Pick<Game, "name" | "platform">): string {
  return `${game.name.trim()}:${game.platform}`;
}

/**
 * Texto listo para comparar: minúsculas y sin tildes.
 *
 * El buscador comparaba `game.name.toLowerCase().includes(term)`, así que buscar
 * «pokemon» no encontraba «Pokémon» y «ico» no encontraba «Ico» si el término
 * llevaba tilde al revés. Se normaliza igual que en el resto de la app (NFD y
 * fuera los diacríticos) para que coincida siempre.
 */
export function normalizeSearchTerm(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Catálogo completo: plataformas + juegos (con caché en memoria y en el navegador). */
export async function getCatalog(): Promise<Catalog> {
  const now = Date.now();
  if (catalogCache && catalogCache.expiresAt > now) return catalogCache.data;
  if (catalogInFlight) return catalogInFlight;

  // Hay una copia guardada de esta sesión: se devuelve al instante para que la
  // búsqueda no espere a la red, y se refresca en segundo plano. Esperar ~3 s a
  // las 15 tablas para luego ver casi lo mismo hace que la búsqueda parezca rota.
  const stored = readStoredCatalog();
  if (stored) {
    catalogCache = { data: stored, expiresAt: Date.now() + CATALOG_TTL_MS };
    void loadCatalog()
      .then((fresh) => {
        catalogCache = { data: fresh, expiresAt: Date.now() + CATALOG_TTL_MS };
        writeStoredCatalog(fresh);
      })
      .catch((error) => console.error("No se pudo refrescar el catálogo:", error));
    return stored;
  }

  catalogInFlight = loadCatalog()
    .then((catalog) => {
      catalogCache = { data: catalog, expiresAt: Date.now() + CATALOG_TTL_MS };
      writeStoredCatalog(catalog);
      return catalog;
    })
    .catch((error) => {
      console.error("No se pudo cargar el catálogo:", error);
      if (catalogCache) return catalogCache.data;
      throw error;
    })
    .finally(() => {
      catalogInFlight = null;
    });

  return catalogInFlight;
}

/**
 * Filas por petición al leer una tabla.
 *
 * PostgREST (el REST de Supabase) corta cada respuesta a 1000 filas: es el
 * `max-rows` por defecto del proyecto y no avisa por ningún lado, solo devuelve
 * menos filas de las que existen. Como aquí se pide la tabla entera sin
 * `range()`, PS2 (1121 filas) y XBOX360 (1049) se quedaban con las primeras
 * 1000 y 170 carátulas no llegaban nunca a la página.
 */
const PAGE_SIZE = 1000;

/**
 * Lee una tabla completa paginando, para no perder filas por el tope de 1000.
 *
 * Pide `*` en vez de una lista de columnas a propósito. Las tablas no son todas
 * iguales: BANNER no tiene `views` ni `created_at`, y pedir cualquiera de las
 * dos hace fallar la consulta entera ("column BANNER.views does not exist"),
 * que es lo que tumbaba la página entera. Con `*` cada tabla devuelve lo que
 * tenga y el código decide qué usar. No cuesta más: hoy las columnas de las
 * tablas de plataformas son exactamente las que ya se pedían.
 */
async function fetchAllRows(table: string): Promise<Record<string, unknown>[]> {
  const records: Record<string, unknown>[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const base = supabase.from(table).select("*");

    // Orden SOLO para el banner. Su rotación tiene que seguir siempre el mismo
    // orden de prioridad (id 1 = el aviso más importante, el último id = el menos
    // importante), y el orden en que Postgres devuelve las filas sin `order` no
    // es estable: cambia al editar una fila o con un `vacuum`, y se ha visto
    // devolver `1,3,2` y luego `2,1,3`.
    //
    // El resto de tablas NO se ordenan aquí: la app ya las ordena por plataforma y
    // por nombre, así que el orden de lectura no se ve en ninguna parte.
    const { data, error } = await (
      table === "BANNER" ? base.order("id", { ascending: true }) : base
    ).range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error(`Supabase request failed [${table}]: ${error.message}`);
      throw new Error(`No se pudo leer la tabla ${table}: ${error.message}`);
    }

    const page = (data as unknown as Record<string, unknown>[]) ?? [];
    records.push(...page);

    // Página incompleta: ya no queda nada por leer.
    if (page.length < PAGE_SIZE) return records;
  }
}

/**
 * URL de la imagen de una fila.
 *
 * La columna se llamó `url` y ahora se llama `Cover` (con mayúscula, que en
 * Postgres obliga a comillas dobles en cualquier consulta). Se aceptan las dos
 * para que el catálogo no se rompa durante el renombrado ni si se deshace: se
 * mira primero `Cover` y si no está, `url`. Se comparan también en minúsculas
 * por si en algún momento se crea como `cover`.
 */
function coverUrl(record: Record<string, unknown>): string | null {
  const candidates = [record["Cover"], record["cover"], record["url"], record["URL"]];
  for (const candidate of candidates) {
    const value = typeof candidate === "string" ? candidate.trim() : "";
    if (value) return value;
  }
  return null;
}

async function loadCatalog(): Promise<Catalog> {
  const platforms: string[] = [];
  for (const source of TABLES) {
    if (source.platform === "NOTICIAS") continue;
    if (!platforms.includes(source.platform)) platforms.push(source.platform);
  }

  const rows = await Promise.all(
    TABLES.map(async ({ table }) => {
      const isNews = table === "BANNER";
      const records = await fetchAllRows(table);

      return { table, isNews, records };
    }),
  );

  const games: Game[] = [];

  for (const { table, isNews, records } of rows) {
    const platform = TABLES.find((source) => source.table === table)?.platform ?? table;

    for (const record of records) {
      const name = isNews
        ? (record["Texto 2"] as string | null)
        : (record["Nombre"] as string | null);
      if (!name?.trim()) continue;

      const rawCreated =
        (record["created_at"] as string | null) ?? (record["createdTime"] as string | null) ?? null;

      const createdTime = rawCreated ?? new Date().toISOString();
      const trailerUrl = (record["Tráiler"] as string | null)?.trim() ?? null;
      const numericId = Number(record["id"]);
      const views = Number(record["views"]);
      const image = coverUrl(record);

      games.push({
        id: String(record["id"]),
        numericId: Number.isFinite(numericId) ? numericId : 0,
        key: `${platform}:${record["id"]}`,
        name: name.trim(),
        platform,
        views: Number.isFinite(views) ? views : 0,
        cover: isNews ? null : image,
        banner: isNews ? image : null,
        heading: isNews ? ((record["Texto 1"] as string | null)?.trim() ?? null) : null,
        description: isNews
          ? ((record["Texto 3"] as string | null)?.trim() ?? null)
          : ((record["Descripción"] as string | null)?.trim() ?? null),
        // En la columna "Tráiler" se puede pegar la URL de YouTube o el ID suelto.
        trailer: youtubeIdFromUrl(trailerUrl ?? "") ?? trailerUrl,
        createdTime,
        // Sin columna de fecha en Supabase no hay forma de saber qué es nuevo:
        // `createdTime` sería la hora del build y mentiría en cada deploy.
        hasDate: Boolean(rawCreated),
      });
    }
  }

  // Los juegos se agrupan por plataforma y dentro de cada una van por nombre.
  // El banner es la excepción: se deja el orden de lectura de la tabla BANNER
  // (por `id`, ver `fetchAllRows`), que es el orden de prioridad de los avisos.
  // `sort` es estable, así que devolver 0 conserva ese orden.
  games.sort((a, b) => {
    if (a.platform === "NOTICIAS" || b.platform === "NOTICIAS") {
      if (a.platform === b.platform) return 0;
    }
    return (
      platforms.indexOf(a.platform) - platforms.indexOf(b.platform) ||
      a.name.localeCompare(b.name, "es")
    );
  });

  return { platforms, games };
}

/** Sinopsis desde la API abierta de Wikipedia (CORS permitido). */
export async function getGameDetails(name: string): Promise<GameDetails> {
  const cleanName = String(name ?? "")
    .trim()
    .slice(0, 200);
  if (!cleanName) return { extract: null, wikipediaUrl: null, videoId: null };

  try {
    const wiki = await lookupWikipedia(cleanName);
    return { extract: wiki.extract, wikipediaUrl: wiki.url, videoId: null };
  } catch (error) {
    console.error("Wikipedia lookup failed", error);
    return { extract: null, wikipediaUrl: null, videoId: null };
  }
}

/** Tabla de Supabase donde vive un juego (su plataforma y su contador de vistas). */
function tableForPlatform(platform: string): string | null {
  return TABLES.find((source) => source.platform === platform)?.table ?? null;
}

/**
 * Registra una vista en la columna `views` del propio juego.
 *
 * El contador NO está en una tabla aparte: cada plataforma tiene su tabla
 * (`PS2`, `WII`…) con una columna `views`, y lo que se suma es la fila que
 * coincide con el `Nombre` del juego dentro de la tabla de su plataforma. Por eso
 * se pasa el nombre y no el `id`: el `id` cambia si borras y vuelves a subir el
 * juego y con él se perdería todo el contador.
 *
 * La suma la hace dentro de la base de datos la función `increment_view`, que
 * hace `views = views + 1` de forma atómica: si dos usuarios abren el mismo
 * juego a la vez, las dos visitas se suman en vez de pisarse.
 *
 * Requiere ejecutar supabase-views-setup.sql una vez en Supabase.
 */
export async function trackGlobalView(game: Pick<Game, "name" | "platform">): Promise<boolean> {
  const table = tableForPlatform(game.platform);
  const name = game.name.trim().slice(0, 300);
  // El banner no lleva contador: no está en la configuración de vistas.
  if (!table || !name) return false;

  try {
    const { error } = await supabase.rpc("increment_view", { p_tabla: table, p_nombre: name });
    if (error) {
      console.warn(
        "[views] No se pudo incrementar el contador (¿ejecutaste supabase-views-setup.sql?):",
        error.message,
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[views] No se pudo registrar la vista:", error);
    return false;
  }
}
