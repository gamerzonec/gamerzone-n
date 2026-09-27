import { defineConfig } from "@lovable.dev/vite-tanstack-config";

/**
 * El sitio vive en la raíz del dominio de GitHub Pages:
 *
 *   https://gamerzonec.github.io
 *
 * Antes se publicaba en un subdirectorio (/gamerzone-n/) y eso obligaba a
 * parchear el bundle para que el router no duplicara el prefijo dentro del hash
 * (…/#/gamerzone-n/plataforma/PS2). Con `base: "/"` el router deriva un
 * basepath vacío, así que ese parche ya no hace falta.
 */
export default defineConfig({
  tanstackStart: {
    spa: {
      enabled: true,
      maskPath: "/",
    },
    // `router.basepath` se deriva del `base` de Vite, que ahora es "/".
  },
  nitro: false,
  vite: {
    base: "/",
  },
});
