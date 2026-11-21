import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import type { withRls } from "@/db/rls";
import { maintenanceRequest } from "@/db/schema";

// Unidades con un pedido activo que las deja fuera de servicio (para el estado "Mantenimiento" del edificio). Corre
// dentro de la transacción de quien la llama, en un punto de guardado: sin la migración 0021 todavía no hay
// mantenimiento y ninguna unidad está bloqueada (no rompe la pantalla Edificio).
export async function blockedUnitIds(
  tx: Parameters<Parameters<typeof withRls>[1]>[0],
  unitIds: string[],
): Promise<Set<string>> {
  if (!unitIds.length) return new Set();
  try {
    const rows = await tx.transaction((sp) =>
      sp
        .select({ unitId: maintenanceRequest.unitId })
        .from(maintenanceRequest)
        .where(
          and(
            inArray(maintenanceRequest.unitId, unitIds),
            eq(maintenanceRequest.blocksUnit, true),
            inArray(maintenanceRequest.status, ["open", "in_progress"]),
          ),
        ),
    );
    return new Set(rows.map((r) => r.unitId).filter((id): id is string => id !== null));
  } catch (e) {
    console.error("No se pudo leer el mantenimiento", e);
    return new Set();
  }
}
