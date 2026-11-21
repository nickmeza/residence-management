import "server-only";

import { eq } from "drizzle-orm";

import type { withRls } from "@/db/rls";
import { contract, deposit, person, resident, settlement, settlementDiscount } from "@/db/schema";

// Datos que hacen falta para escribir un aviso (el nombre de quien lo hizo, su negocio). Los leen tanto el arrendador
// como el propio residente: el RLS deja a ambos ver la ficha y la persona.

type Tx = Parameters<Parameters<typeof withRls>[1]>[0];

export async function residentInfo(tx: Tx, residentId: string) {
  const [row] = await tx
    .select({ businessId: resident.businessId, name: person.fullName })
    .from(resident)
    .innerJoin(person, eq(person.id, resident.personId))
    .where(eq(resident.id, residentId))
    .limit(1);
  return row ?? null;
}

// La garantía (y su ficha) de una liquidación o de uno de sus descuentos.
export async function depositOfSettlement(tx: Tx, settlementId: string) {
  const [row] = await tx
    .select({ depositId: deposit.id, residentId: contract.residentId })
    .from(settlement)
    .innerJoin(deposit, eq(deposit.id, settlement.depositId))
    .innerJoin(contract, eq(contract.id, deposit.contractId))
    .where(eq(settlement.id, settlementId))
    .limit(1);
  return row ?? null;
}

export async function settlementOfDiscount(tx: Tx, discountId: string) {
  const [row] = await tx
    .select({ settlementId: settlementDiscount.settlementId })
    .from(settlementDiscount)
    .where(eq(settlementDiscount.id, discountId))
    .limit(1);
  return row?.settlementId ?? null;
}
