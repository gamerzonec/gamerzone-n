/**
 * Esqueletos de carga de la portada.
 *
 * Antes la página no pintaba nada hasta que habían llegado las 5.500 filas del
 * catálogo desde Supabase: con la web abierta en Cuba eso son varios segundos de
 * pantalla en blanco. Ahora la estructura (cabecera, buscador, plataformas) se
 * pinta al instante y solo estas piezas esperan a los datos, con el mismo aspecto
 * que usa GameCard mientras llegan las imágenes, para que al rellenarse no dé un
 * salto de tamaño.
 */

/** Una tarjeta de carátula sin contenido, con la proporción 2/3 por defecto. */
export function GameCardSkeleton({ aspect = 2 / 3 }: { aspect?: number }) {
  return (
    <article className="bg-card cover-shadow p-2 sm:p-3">
      <div
        aria-hidden="true"
        className="w-full overflow-hidden bg-muted"
        style={{ aspectRatio: String(aspect) }}
      >
        <div className="h-full w-full animate-pulse bg-gradient-to-br from-muted via-secondary to-muted" />
      </div>
      <div className="px-2 pt-2 sm:px-3 sm:pt-3">
        <div className="h-7 w-full animate-pulse rounded-md bg-muted" />
      </div>
    </article>
  );
}

/** Fila de carrusel en carga: sin flechas, porque aún no hay a dónde ir. */
export function CarouselSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="scroll-row flex snap-x gap-3 overflow-hidden pb-2 sm:gap-4">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="w-[calc(50%-0.375rem)] shrink-0 snap-start sm:w-[30%] lg:w-[22%] xl:w-[18%]"
        >
          <GameCardSkeleton />
        </div>
      ))}
    </div>
  );
}

/** Hueco donde irá el banner rotatorio de avisos. */
export function BannerSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-3 sm:px-6">
      <div
        aria-hidden="true"
        className="aspect-[5/3] w-full animate-pulse rounded-xl bg-muted sm:aspect-[3/1]"
      />
    </div>
  );
}
