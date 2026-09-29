import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CoverLightbox } from "@/components/CoverLightbox";
import { GameDetailsModal } from "@/components/GameDetailsModal";
import { GameGrid } from "@/components/GameGrid";
import { type Game, normalizeSearchTerm, trackGlobalView } from "@/lib/games-data";
import { catalogQueryOptions } from "@/lib/games-query";
import { PLATFORM_LABEL } from "@/lib/platform-art";

export const Route = createFileRoute("/plataforma/$platform")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(catalogQueryOptions);
  },
  head: ({ params }) => {
    const label = PLATFORM_LABEL[params.platform] ?? params.platform;
    return {
      meta: [
        { title: `Juegos de ${label} | Catálogo de Carátulas` },
        {
          name: "description",
          content: `Catálogo completo de carátulas de videojuegos de ${label} con sinopsis y tráiler.`,
        },
        { property: "og:title", content: `Juegos de ${label}` },
        {
          property: "og:description",
          content: `Explora todas las carátulas disponibles de ${label}.`,
        },
      ],
    };
  },
  component: PlatformPage,
});

function PlatformPage() {
  const { platform } = Route.useParams();
  const { data: catalog } = useSuspenseQuery(catalogQueryOptions);
  const games = catalog.games;
  const [selected, setSelected] = useState<Game | null>(null);
  const [lightboxGame, setLightboxGame] = useState<Game | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setQuery("");
  }, [platform]);

  const label = PLATFORM_LABEL[platform] ?? platform;

  const filtered = useMemo(() => {
    const term = normalizeSearchTerm(query.trim());
    return games
      .filter((game) => game.platform === platform)
      .filter((game) => (term ? normalizeSearchTerm(game.name).includes(term) : true))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [games, platform, query]);

  const openDetail = useCallback((game: Game) => {
    setSelected(game);
    void trackGlobalView(game);
  }, []);

  const openCover = useCallback((game: Game) => {
    setLightboxGame(game);
    void trackGlobalView(game);
  }, []);

  return (
    <main className="min-h-screen pb-20">
      <header className="hero-glow border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:text-sm"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Volver atrás
          </Link>
          <h1 className="mt-4 text-2xl font-bold leading-tight sm:text-4xl">Juegos de {label}</h1>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Buscar en ${label}…`}
            aria-label={`Buscar en ${label}`}
            className="mt-5 w-full max-w-md rounded-lg border border-border bg-card px-4 py-2.5 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus:glow-ring"
          />
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay resultados para esta búsqueda.</p>
        ) : (
          <GameGrid games={filtered} onOpenDetail={openDetail} onOpenCover={openCover} />
        )}
      </section>

      <GameDetailsModal game={selected} onClose={() => setSelected(null)} onOpenCover={openCover} />
      <CoverLightbox game={lightboxGame} onClose={() => setLightboxGame(null)} />
    </main>
  );
}
