import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Pruebas contra la base real (pnpm test:db). Van aparte de pnpm test porque necesitan
// DATABASE_URL y conexión. Cada prueba deshace sus cambios: no dejan nada en la base.
try {
  process.loadEnvFile(".env.local");
} catch {}

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // "server-only" solo tiene sentido dentro de Next.js; aquí se reemplaza por un módulo vacío.
      "server-only": fileURLToPath(new URL("./tests/db/empty-module.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/db/**/*.test.ts"],
    // La base está en la nube: cada consulta tarda más que una prueba normal.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
