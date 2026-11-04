import { defineConfig } from "drizzle-kit";

// drizzle-kit corre fuera de Next.js, así que no lee .env.local solo. Node 24 lo carga sin paquetes extra.
// En Vercel no hay .env.local: la variable ya viene del entorno.
try {
  process.loadEnvFile(".env.local");
} catch {}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "Falta DATABASE_URL en .env.local (cadena de conexión del pooler de Supabase, puerto 6543).",
  );
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // Columnas en snake_case en la base (owner_id), camelCase en TypeScript (ownerId).
  casing: "snake_case",
  dbCredentials: { url: process.env.DATABASE_URL },
  // Supabase ya trae sus roles (anon, authenticated…): drizzle-kit no debe intentar crearlos.
  entities: { roles: { provider: "supabase" } },
});
