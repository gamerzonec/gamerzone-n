import { useRef } from "react";

import { useCoverAspect } from "@/hooks/use-cover-aspect";
import type { Game } from "@/lib/games-data";

import { GameCard } from "./GameCard";

export function GameCarousel({
  games,
  onOpenDetail,
  onOpenCover,
}: {
  games: Game[];
  onOpenDetail: (game: Game) => void;
  onOpenCover: (game: Game) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const aspect = useCoverAspect(games.find((game) => game.cover)?.cover);

  const scrollBy = (direction: 1 | -1) => {
    const row = rowRef.current;
    if (!row) return;
    row.scrollBy({ left: direction * row.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div
        ref={rowRef}
        className="scroll-row flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 sm:gap-4"
      >
        {games.map((game, index) => (
          <div
            key={game.key}
            className="w-[calc(50%-0.375rem)] shrink-0 snap-start sm:w-[30%] lg:w-[22%] xl:w-[18%]"
          >
            <GameCard
              game={game}
              onOpenDetail={onOpenDetail}
              onOpenCover={onOpenCover}
              aspect={aspect}
              index={index}
              priorityCount={5}
            />
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <CarouselButton label="Anterior" onClick={() => scrollBy(-1)}>
          ‹
        </CarouselButton>
        <CarouselButton label="Siguiente" onClick={() => scrollBy(1)}>
          ›
        </CarouselButton>
      </div>
    </div>
  );
}

function CarouselButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="h-9 w-9 rounded-full border border-border bg-card text-lg leading-none transition-colors hover:bg-secondary"
    >
      {children}
    </button>
  );
}
