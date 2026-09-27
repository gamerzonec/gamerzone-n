import { StartClient } from "@tanstack/react-start/client";
import { StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";

import { normalizeHashUrl } from "./lib/normalize-hash";

// Punto de entrada del cliente (`src/client.tsx`).
//
// La app se publica en la raíz de GitHub Pages (https://gamerzonec.github.io),
// así que el router no lleva prefijo de subdirectorio y la URL del hash queda
// limpia: /#/plataforma/PS2
normalizeHashUrl();

hydrateRoot(
  document,
  <StrictMode>
    <StartClient />
  </StrictMode>,
);
