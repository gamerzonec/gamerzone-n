import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Gamepad2, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CoverLightbox } from "@/components/CoverLightbox";
import { GameCarousel } from "@/components/GameCarousel";
import { GameDetailsModal } from "@/components/GameDetailsModal";
import { GameGrid } from "@/components/GameGrid";
import { PlatformCard } from "@/components/PlatformCard";
import { type Game, getGlobalViews, trackGlobalView, viewKey } from "@/lib/games-data";
import { catalogQueryOptions } from "@/lib/games-query";
import { recentlyAdded } from "@/lib/games";

export const Route = createFileRoute("/")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(catalogQueryOptions);
  },
  head: () => ({
    meta: [
      { title: "Catálogos GAMERZONE Caibarien" },
      {
        name: "description",
        content:
          "Explora carátulas de videojuegos de 3DS, WII, WIIU, Switch, PlayStation, Xbox y PC con sinopsis y tráilers.",
      },
      { property: "og:title", content: "Catálogo GAMERZONE" },
      {
        property: "og:description",
        content: "Plataformas con sinopsis y tráilers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen items-center justify-center px-6 text-center">
      <div>
        <h1 className="text-xl font-bold">No pudimos cargar el catálogo</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </div>
  ),
  notFoundComponent: () => <div className="p-10 text-center">Catálogo no disponible.</div>,
  component: CatalogPage,
});

function CatalogPage() {
  const { data: catalog } = useSuspenseQuery(catalogQueryOptions);
  const games = catalog.games;
  const [selected, setSelected] = useState<Game | null>(null);
  const [lightboxGame, setLightboxGame] = useState<Game | null>(null);
  const [query, setQuery] = useState("");

  const queryClient = useQueryClient();

  // Ranking global de vistas (sincronizado cada 5s y al cambiar de pestaña).
  // Las claves son "NOMBRE:PLATAFORMA" (ver viewKey): el nombre es estable
  // aunque cambie el id, y la plataforma separa las distintas versiones.
  const { data: views = {}, isSuccess: viewsLoaded } = useQuery({
    queryKey: ["global-views"],
    queryFn: () => getGlobalViews(),
    staleTime: 3000,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  // Registra la vista tanto en la interfaz (optimista) como en Supabase.
  //
  // 1. Se ignora mientras el ranking aún no ha llegado: pintar un +1 sobre una
  //    lista vacía reordenaba el carrusel con ceros y desaparecía al llegar los
  //    datos reales.
  // 2. Si Supabase rechaza el incremento (p. ej. falta ejecutar el SQL de
  //    `increment_view`) se deshace el +1 en pantalla, para que nadie vea un
  //    contador que no es real.
  const recordView = useCallback(
    (game: Game) => {
      const key = viewKey(game);
      if (!viewsLoaded) return;

      queryClient.setQueryData<Record<string, number>>(["global-views"], (old = {}) => ({
        ...old,
        [key]: (old[key] ?? 0) + 1,
      }));

      void trackGlobalView(key).then((ok) => {
        if (ok) return;
        queryClient.setQueryData<Record<string, number>>(["global-views"], (old = {}) => ({
          ...old,
          [key]: Math.max(0, (old[key] ?? 1) - 1),
        }));
      });
    },
    [queryClient, viewsLoaded],
  );

  const openDetail = useCallback(
    (game: Game) => {
      setSelected(game);
      recordView(game);
    },
    [recordView],
  );

  const openCover = useCallback(
    (game: Game) => {
      setLightboxGame(game);
      recordView(game);
    },
    [recordView],
  );

  const catalogGames = useMemo(() => games.filter((game) => game.platform !== "NOTICIAS"), [games]);
  const recent = useMemo(() => recentlyAdded(catalogGames), [catalogGames]);
  const popular = useMemo(() => {
    return [...catalogGames]
      .sort((a, b) => {
        const diff = (views[viewKey(b)] ?? 0) - (views[viewKey(a)] ?? 0);
        if (diff !== 0) return diff;
        return a.name.localeCompare(b.name, "es");
      })
      .slice(0, 10);
  }, [catalogGames, views]);

  const newsGames = useMemo(() => {
    return games
      .filter((game) => game.platform === "NOTICIAS")
      .sort((a, b) => a.createdTime.localeCompare(b.createdTime));
  }, [games]);

  const term = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!term) return [];
    return games
      .filter((game) => game.name.toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [games, term]);

  return (
    <main className="min-h-screen pb-20">
      {!term && (
        <header className="bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-5 sm:px-6">
            <a
              href="/"
              className="flex min-w-0 items-center gap-3"
              aria-label="Gamer Zone Caibarién"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#15345b] text-white shadow-sm">
                <Gamepad2 className="h-5 w-5" />
              </span>
              <span className="truncate font-display text-lg font-bold tracking-tight sm:text-xl">
                Gamer Zone Caibarién
              </span>
            </a>
          </div>
        </header>
      )}

      {!term && <NewsBanner newsGames={newsGames} />}
      {term && (
        <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
          <button
            type="button"
            onClick={() => setQuery("")}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:text-sm"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Volver atrás
          </button>
        </div>
      )}
      <SearchBar query={query} totalGames={games.length} onQueryChange={setQuery} />

      {term ? (
        <>
          <Section title={`Resultados para “${query.trim()}”`}>
            {results.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay resultados para esta búsqueda.</p>
            ) : (
              <GameGrid games={results} onOpenDetail={openDetail} onOpenCover={openCover} />
            )}
          </Section>
        </>
      ) : (
        <>
          <Section title="Recién añadidos">
            <GameCarousel games={recent} onOpenDetail={openDetail} onOpenCover={openCover} />
          </Section>

          <Section title="Más vistos">
            <GameCarousel games={popular} onOpenDetail={openDetail} onOpenCover={openCover} />
          </Section>

          <Section title="Plataformas">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
              {catalog.platforms.map((item) => (
                <PlatformCard key={item} platform={item} />
              ))}
            </div>
          </Section>
        </>
      )}

      <GameDetailsModal game={selected} onClose={() => setSelected(null)} onOpenCover={openCover} />
      <CoverLightbox game={lightboxGame} onClose={() => setLightboxGame(null)} />
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6">
      <h2 className="mb-4 text-lg font-bold sm:text-2xl">{title}</h2>
      {children}
    </section>
  );
}

function SearchBar({
  query,
  totalGames,
  onQueryChange,
}: {
  query: string;
  totalGames: number;
  onQueryChange: (query: string) => void;
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-5 pt-7 sm:px-6 sm:pt-8">
      <div className="flex flex-wrap items-center justify-between gap-5">
        <label className="relative w-full sm:w-64">
          <span className="sr-only">Buscar un juego</span>
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Buscar"
            className="h-10 w-full border border-border bg-white pl-3 pr-11 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus:glow-ring"
          />
          <Search className="pointer-events-none absolute right-3 top-2.5 h-5 w-5 text-muted-foreground" />
        </label>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {totalGames} títulos sincronizados en tiempo real.
      </p>
    </section>
  );
}

function NewsBanner({ newsGames }: { newsGames: Game[] }) {
  const [activeNewsIndex, setActiveNewsIndex] = useState(0);

  useEffect(() => {
    setActiveNewsIndex(0);
    const interval = window.setInterval(() => {
      setActiveNewsIndex((currentIndex) => (currentIndex + 1) % newsGames.length);
    }, 14_000);

    return () => window.clearInterval(interval);
  }, [newsGames.length]);

  if (newsGames.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 pt-3 sm:px-6">
      <div className="relative aspect-[5/3] overflow-hidden rounded-xl bg-[#050811] shadow-lg sm:aspect-[3/1]">
        {newsGames.map((news, index) => {
          const description = news.description;
          return (
            <div
              key={news.id}
              className={`absolute inset-0 transition-opacity duration-700 ${activeNewsIndex === index ? "opacity-100" : "pointer-events-none opacity-0"}`}
            >
              {news.banner && (
                <img
                  src={news.banner}
                  alt=""
                  className="absolute inset-0 h-full w-full rounded-xl object-cover"
                />
              )}
              <div className="absolute inset-0 backdrop-blur-[3px]" />
              <div className="relative flex h-full items-center justify-start p-4 text-left sm:p-10 md:p-12">
                <div className="relative w-[78%] max-w-xl text-left text-white sm:w-auto">
                  <div className="absolute -inset-x-6 -inset-y-5 -z-10 backdrop-blur-[2px]" />
                  <p className="font-display text-[clamp(0.75rem,1.6vw,1.5rem)] font-bold uppercase tracking-[0.12em] text-white/90 drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)] sm:tracking-[0.16em]">
                    {news.heading}
                  </p>
                  <h2 className="mt-2 font-display text-[clamp(1.25rem,3.1vw,2.75rem)] font-extrabold leading-[1.08] tracking-[-0.01em] drop-shadow-[0_3px_4px_rgba(0,0,0,0.95)] sm:mt-5">
                    {news.name}
                  </h2>
                  <p className="mt-2 font-display text-[clamp(0.9rem,1.8vw,1.75rem)] font-medium leading-[1.3] text-white/90 drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)] sm:mt-5 sm:leading-[1.45]">
                    {description}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
