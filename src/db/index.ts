import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "Falta DATABASE_URL en .env.local (cadena de conexión del pooler de Supabase, puerto 6543).",
  );
}

// El pooler de Supabase en modo "transaction" no admite consultas preparadas: por eso prepare: false.
// Esta conexión entra como administrador y se salta el RLS; las consultas de usuarios irán dentro de una
// transacción que se identifica como el usuario con sesión (llega en el paso 2).
const client = postgres(url, { prepare: false });

export const db = drizzle(client, { schema });
