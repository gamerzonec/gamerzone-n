import type { Game } from "./games-data";

/**
 * Las vistas son globales (compartidas entre todos los usuarios y dispositivos)
 * y se guardan en la tabla `views` de Supabase. Ver `src/lib/games-data.ts`.
 */

export function formatTrailerSearchQuery(name: string, platform?: string | null): string {
  const cleanName = name.trim();
  const cleanPlatform = platform?.trim();
  if (cleanPlatform) {
    return `trailer oficial de ${cleanName} de ${cleanPlatform}`;
  }
  return `trailer oficial de ${cleanName}`;
}

export function youtubeSearchUrl(name: string, platform?: string | null): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(
    formatTrailerSearchQuery(name, platform),
  )}`;
}

/**
 * "Recién añadidos": lo último subido a Supabase, de más nuevo a más viejo.
 *
 * El orden es una sola lista global (no por plataforma): compara la fecha de
 * creación y, cuando dos empates, el `id` numérico descendente. Ese desempate es
 * imprescindible porque `created_at` se guarda POR TANDAS: al importar un lote
 * de juegos, todos comparten la misma marca de tiempo al microsegundo (los 95 de
 * 3DS tienen `2026-09-27T06:20:45.440429`). Sin desempatar por id, el orden caía
 * en el alfabético y el carrusel mostraba "7th Dragon III, Animal Crossing,
 * Asphalt 3D" en vez de lo último que se subió.
 *
 * Los juegos sin fecha (p. ej. la tabla BANNER, que no tiene `created_at`) van al
 * final para no mezclarse con los que sí la tienen.
 */
export function recentlyAdded(games: Game[], limit = 18): Game[] {
  return [...games]
    .sort(
      (a, b) =>
        Number(b.hasDate) - Number(a.hasDate) ||
        b.createdTime.localeCompare(a.createdTime) ||
        b.numericId - a.numericId ||
        a.name.localeCompare(b.name, "es"),
    )
    .slice(0, limit);
}

export function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function youtubeIdFromUrl(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?[^#]*v=)([A-Za-z0-9_-]{11})/,
    /(?:youtu\.be\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  if (/^[A-Za-z0-9_-]{11}$/.test(url.trim())) return url.trim();
  return null;
}
