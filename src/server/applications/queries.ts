import "server-only";

import { desc, eq } from "drizzle-orm";

import { withRls } from "@/db/rls";
import { application, business } from "@/db/schema";
import { getSessionClaims } from "@/server/auth/session";
import { isUuid } from "@/server/business/queries";

export type ApplicationRow = typeof application.$inferSelect;

// Postulaciones de un negocio, las más nuevas primero, y si el enlace público está prendido. null si el negocio no
// es de quien inició sesión.
export async function listApplications(
  businessId: string,
): Promise<{ accepting: boolean; rows: ApplicationRow[] } | null> {
  if (!isUuid(businessId)) return null;
  const claims = await getSessionClaims();
  return withRls(claims, async (tx) => {
    const [b] = await tx
      .select({ accepting: business.acceptsApplications })
      .from(business)
      .where(eq(business.id, businessId))
      .limit(1);
    if (!b) return null;
    const rows = await tx
      .select()
      .from(application)
      .where(eq(application.businessId, businessId))
      .orderBy(desc(application.createdAt));
    return { accepting: b.accepting, rows };
  });
}

export async function getApplication(id: string): Promise<ApplicationRow | null> {
  if (!isUuid(id)) return null;
  const claims = await getSessionClaims();
  const [row] = await withRls(claims, (tx) =>
    tx.select().from(application).where(eq(application.id, id)).limit(1),
  );
  return row ?? null;
}
