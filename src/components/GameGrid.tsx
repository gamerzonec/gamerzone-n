import { useEffect, useState } from "react";

import { useCoverAspect } from "@/hooks/use-cover-aspect";
import type { Game } from "@/lib/games-data";

import { GameCard } from "./GameCard";

/**
 * Cuántas carátulas se montan de entrada.
 *
 * Esto es lo que hacía que el buscador “se demorara en mostrar los covers”: al
 * escribir, React montaba de golpe TODAS las tarjetas del resultado (buscar «a»
 * devuelve 3689 juegos) y el navegador disparaba cientos de peticiones de imagen
 * a la vez contra el mismo host. Con 24 imágenes concurrentes medí ~4,6 s; con 6,
 * ~3,6 s. De pocas en pocas el pintado no se atasca y la rejilla aparece al
 * instante.
 *
 * En los carruseles (18 y 10 juegos) esto no cambia nada: se pintan todos.
 */
const INITIAL_BATCH = 16;
const BATCH_SIZE = 16;

export function GameGrid({
  games,
  onOpenDetail,
  onOpenCover,
}: {
  games: Game[];
  onOpenDetail: (game: Game) => void;
  onOpenCover: (game: Game) => void;
}) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_BATCH);

  // Nueva búsqueda o cambio de plataforma: se vuelve al primer lote.
  useEffect(() => {
    setVisibleCount(INITIAL_BATCH);
  }, [games]);

  const hasMore = visibleCount < games.length;

  // Cada lote se pinta cuando el navegador está libre, así el primero sale en el
  // mismo frame que el tecleo y los siguientes no bloquean el hilo.
  useEffect(() => {
    if (!hasMore) return;
    let cancelled = false;
    const schedule = () => {
      if (cancelled) return;
      setVisibleCount((count) => Math.min(count + BATCH_SIZE, games.length));
    };
    const requestIdle = (globalThis as { requestIdleCallback?: (cb: () => void) => number })
      .requestIdleCallback;
    if (typeof requestIdle === "function") requestIdle(schedule);
    else window.setTimeout(schedule, 120);
    return () => {
      cancelled = true;
    };
  }, [hasMore, visibleCount, games.length]);

  const shown = games.slice(0, visibleCount);
  const aspect = useCoverAspect(shown.find((game) => game.cover)?.cover);

  return (
    <>
      {hasMore && (
        <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
          Mostrando {shown.length} de {games.length} títulos…
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
        {shown.map((game, index) => (
          <GameCard
            key={game.key}
            game={game}
            onOpenDetail={onOpenDetail}
            onOpenCover={onOpenCover}
            aspect={aspect}
            index={index}
            priorityCount={10}
          />
        ))}
      </div>
      {hasMore && (
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleCount(games.length)}
            className="rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold transition-colors hover:bg-secondary"
          >
            Ver los {games.length} resultados
          </button>
        </div>
      )}
    </>
  );
}
