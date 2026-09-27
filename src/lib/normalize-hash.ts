/**
 * La app se publica en la raíz del dominio de GitHub Pages:
 *
 *   https://gamerzonec.github.io
 *
 * Antes vivía en un subdirectorio (/gamerzone-n/) y el plugin de TanStack
 * inyectaba ese prefijo como `basepath` del router, que con historial hash
 * duplicaba la ruta dentro del hash:
 *
 *   …/#/gamerzone-n/plataforma/PS2
 *
 * Con `base: "/"` en vite.config.ts el router deriva un basepath vacío, así que
 * ya no hay prefijo que quitar de la URL.
 *
 * Lo que sí hay que corregir es OTRO prefijo del mismo origen: al no haber
 * basepath, el router tampoco crea un rewrite de entrada, y el rewrite es lo
 * único que normaliza el `pathname` de la location. El historial hash, en
 * cambio, sí arrastra el pathname real del navegador:
 *
 *   createHashHistory → parseLocation()
 *     pathPart = location.hash.split("#")[1]   // "/plataforma/PS2"
 *     parseHref(`${pathPart}${location.search}${…}`)
 *
 * Por eso, si el sitio vive en un subdirectorio, el pathname del navegador se
 * cuela en la location del router y todo se rompe:
 *
 *   https://cuenta.github.io/mi-repo/#/plataforma/PS2
 *   → location del router: "/mi-repo/?/plataforma/PS2"  → no matchea ninguna ruta
 *
 *   https://cuenta.github.io/mi-repo/#/
 *   → location del router: "/mi-repo/" → 404 en la ruta raíz
 *
 * La corrección más simple y sin estados intermedios es publicar el sitio en la
 * RAÍZ del dominio (https://gamerzonec.github.io). Aun así se deja aquí el
 * saneo: si algún día el pathname del navegador no es el de la app (subdirectorio
 * nuevo, GitHub Pages sirviendo la app desde otra ruta), se reescribe la URL a la
 * raíz antes de montar el router.
 */
export function normalizeHashUrl(): void {
  if (typeof window === "undefined") return;

  const { location, history } = window;

  // En la raíz del dominio el pathname ya es "/" y no hay nada que hacer.
  if (location.pathname === "/") return;

  // El hash debe empezar por barra de ruta ("#/…") para ser una ruta de la app.
  if (!location.hash.startsWith("#/")) return;

  // replaceState no recarga la página ni deja una entrada extra en el historial.
  history.replaceState(history.state, "", `/${location.search}${location.hash}`);
}
