import "server-only";

import { sql } from "drizzle-orm";

import { db } from "./index";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Datos del token de sesión verificado (supabase.auth.getClaims()). "sub" es el id de la cuenta.
export type SessionClaims = { sub: string } & Record<string, unknown>;

// Corre consultas como el usuario con sesión, para que el RLS de la base se aplique.
// Dentro de la transacción, Postgres pasa del rol administrador a "authenticated" y auth.uid()
// devuelve claims.sub. Al terminar la transacción, todo vuelve a como estaba.
export function withRls<T>(claims: SessionClaims, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('request.jwt.claims', ${JSON.stringify(claims)}, true), set_config('role', 'authenticated', true)`,
    );
    return fn(tx);
  });
}
