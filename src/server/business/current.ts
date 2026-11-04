import "server-only";

import { asc, eq, inArray } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";

import { withRls } from "@/db/rls";
import { business, person, property } from "@/db/schema";
import { getSessionClaims } from "@/server/auth/session";

// El negocio que se está viendo se recuerda en una cookie, como el proyecto elegido en GCP.
// Es solo una preferencia: igual se comprueba que el negocio sea de quien inició sesión.
export const CURRENT_BUSINESS_COOKIE = "negocio_actual";

export type ShellBusiness = {
  id: string;
  service: "residence" | "meal_plan";
  tradeName: string;
  // Solo Residencia: sus propiedades (para el enlace "Edificio").
  properties: { id: string; name: string }[];
};

export type ShellData = { fullName: string; businesses: ShellBusiness[]; current: ShellBusiness | null };

// Datos del menú lateral y del selector de negocio. cache(): se consulta una sola vez por visita,
// aunque lo pidan el menú y la página.
export const getShellData = cache(async (): Promise<ShellData> => {
  const claims = await getSessionClaims();
  const chosen = (await cookies()).get(CURRENT_BUSINESS_COOKIE)?.value;
  return withRls(claims, async (tx) => {
    const [me] = await tx
      .select({ fullName: person.fullName })
      .from(person)
      .where(eq(person.userId, claims.sub));
    const rows = await tx
      .select({ id: business.id, service: business.service, tradeName: business.tradeName })
      .from(business)
      .orderBy(asc(business.service), asc(business.tradeName));
    const props = rows.length
      ? await tx
          .select({ id: property.id, name: property.name, businessId: property.businessId })
          .from(property)
          .where(
            inArray(
              property.businessId,
              rows.map((r) => r.id),
            ),
          )
          .orderBy(asc(property.name))
      : [];
    const businesses = rows.map((r) => ({
      ...r,
      properties: props.filter((p) => p.businessId === r.id).map(({ id, name }) => ({ id, name })),
    }));
    const current = businesses.find((b) => b.id === chosen) ?? businesses[0] ?? null;
    return { fullName: me?.fullName ?? "", businesses, current };
  });
});
