import { useEffect, useRef, useState } from "react";

import type { Game } from "@/lib/games-data";

type Props = {
  game: Game;
  onOpenDetail: (game: Game) => void;
  onOpenCover: (game: Game) => void;
  /** Proporción (ancho/alto) tomada de la primera carátula de la plataforma. */
  aspect?: number;
  /** Índice en la lista: las primeras carátulas se descargan con prioridad alta. */
  index?: number;
  /** Cuántas carátulas iniciales se consideran críticas (above the fold). */
  priorityCount?: number;
  /** Plataforma usada para pintar el botón con los colores oficiales. */
  platform?: string;
};

function buttonClasses(platform: string = ""): string {
  switch (platform) {
    case "3DS":
    case "PS5":
      return "bg-white text-black border border-gray-300 hover:bg-gray-100";
    case "WII":
      return "bg-white text-[#8A8A8A] border border-gray-300 hover:bg-gray-100";
    case "WIIU":
      return "!bg-[#00BBE4] !text-white hover:!bg-[#00A5C9]";
    case "SWITCH":
      return "bg-[#E60012] text-white hover:bg-[#E60012]/90";
    case "PS1":
    case "PS2":
    case "PSP":
    case "PS3":
      return "bg-[#1A1A1A] text-white hover:bg-[#1A1A1A]/90";
    case "PSVITA":
      return "!bg-[#0095DA] !text-white hover:!bg-[#007BB8]";
    case "PS4":
      return "!bg-[#0095DA] !text-white hover:!bg-[#007BB8]";
    case "XBOX":
      return "!bg-[#1A1A1A] !text-[#B8FF3C]";
    case "XBOX360":
      return "!bg-[#5CB811] !text-white hover:!bg-[#4A960E]";
    case "PC":
      return "bg-white text-[#001A4E] border border-gray-300 hover:bg-gray-100";
    default:
      return "bg-primary text-primary-foreground hover:bg-primary/90";
  }
}

export function GameCard({
  game,
  onOpenDetail,
  onOpenCover,
  aspect = 2 / 3,
  index = 0,
  priorityCount = 6,
  platform = game.platform,
}: Props) {
  const isPriority = index < priorityCount;
  const holderRef = useRef<HTMLDivElement>(null);

  // 🔥 CORRECCIÓN CLAVE: Todas las tarjetas empiezan en visible = false
  // para que usen estrictamente el mismo efecto gradual de aparición al cargar
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Efecto extra para asegurar que si el usuario cambia de consola/plataforma,
  // las tarjetas se reseteen y vuelvan a hacer la animación suave desde cero.
  // Se mira `key` y no `id` porque el id se repite entre plataformas y, con
  // GamesCards reutilizadas, la tarjeta se quedaba con el estado de carga del
  // juego anterior (carátula en blanco).
  useEffect(() => {
    setVisible(false);
    setLoaded(false);
  }, [game.key]);

  useEffect(() => {
    if (visible) return;
    const node = holderRef.current;
    if (!node) return;

    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <article className="group bg-card cover-shadow transition-transform duration-300 hover:-translate-y-1 p-2 sm:p-3">
      <div
        ref={holderRef}
        className="relative w-full overflow-hidden bg-muted"
        style={{ aspectRatio: String(aspect) }}
      >
        {game.cover ? (
          <>
            {!loaded && (
              <div
                aria-hidden="true"
                className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted via-secondary to-muted blur-[6px]"
              />
            )}
            {visible && (
              <img
                src={game.cover}
                alt={`Carátula de ${game.name}`}
                loading={isPriority ? "eager" : "lazy"}
                decoding="async"
                {...{ fetchpriority: isPriority ? "high" : "low" }}
                onLoad={() => setLoaded(true)}
                onError={() => setLoaded(true)}
                onClick={() => onOpenCover(game)}
                className={`relative h-full w-full cursor-zoom-in object-contain transition-opacity duration-300 group-hover:scale-105 ${
                  loaded ? "opacity-100" : "opacity-0"
                }`}
              />
            )}
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center px-2 text-center text-xs text-muted-foreground">
            Sin carátula
          </div>
        )}
      </div>
      <div className="pt-2 sm:pt-3">
        <button
          type="button"
          onClick={() => onOpenDetail(game)}
          className={`inline-flex w-full items-center justify-center rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors sm:text-xs ${buttonClasses(platform)}`}
          aria-label={`Ver detalles de ${game.name}`}
        >
          Más detalles
        </button>
      </div>
    </article>
  );
}
