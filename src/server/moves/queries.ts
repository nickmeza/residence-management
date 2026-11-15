import "server-only";

import { and, eq } from "drizzle-orm";

import { withRls } from "@/db/rls";
import { contract, deposit, moveEvent, person, resident, unit } from "@/db/schema";
import { getSessionClaims } from "@/server/auth/session";
import { limaToday } from "@/server/contracts/dates";
import { isUuid } from "@/server/business/queries";

import { upcomingMoves, type MoveKind, type UpcomingMove } from "./rules";

type Tx = Parameters<Parameters<typeof withRls>[1]>[0];

// Contratos de un negocio con lo necesario para ingresos y salidas.
function businessContracts(tx: Tx, businessId: string) {
  return tx
    .select({
      id: contract.id,
      residentId: contract.residentId,
      residentName: person.fullName,
      unitName: unit.name,
      startDate: contract.startDate,
      endDate: contract.endDate,
      status: contract.status,
    })
    .from(contract)
    .innerJoin(resident, eq(resident.id, contract.residentId))
    .innerJoin(person, eq(person.id, resident.personId))
    .innerJoin(unit, eq(unit.id, contract.unitId))
    .where(eq(resident.businessId, businessId));
}

// Ingresos y salidas cercanos de un negocio (DB-02). Dentro de la transacción de quien llama, en un punto de guardado:
// sin la migración 0024 no hay citas guardadas, pero las fechas de los contratos igual se muestran.
export async function movesIn(tx: Tx, businessId: string, days = 30): Promise<UpcomingMove[]> {
  const contracts = await businessContracts(tx, businessId);
  let events: { contractId: string; kind: MoveKind; scheduledAt: Date | null; doneAt: Date | null }[] = [];
  try {
    events = await tx.transaction((sp) =>
      sp
        .select({
          contractId: moveEvent.contractId,
          kind: moveEvent.kind,
          scheduledAt: moveEvent.scheduledAt,
          doneAt: moveEvent.doneAt,
        })
        .from(moveEvent)
        .innerJoin(contract, eq(contract.id, moveEvent.contractId))
        .innerJoin(resident, eq(resident.id, contract.residentId))
        .where(eq(resident.businessId, businessId)),
    );
  } catch (e) {
    console.error("No se pudieron leer los ingresos y salidas", e);
  }
  return upcomingMoves(contracts, events, limaToday(new Date()), days);
}

export async function listMoves(businessId: string): Promise<UpcomingMove[] | null> {
  if (!isUuid(businessId)) return null;
  const claims = await getSessionClaims();
  return withRls(claims, (tx) => movesIn(tx, businessId));
}

export type MoveDetail = {
  contractId: string;
  kind: MoveKind;
  residentId: string;
  residentName: string;
  unitName: string;
  date: string | null;
  depositId: string | null;
  scheduledAt: Date | null;
  doneAt: Date | null;
  keysCount: number | null;
  checklist: Record<string, boolean>;
  notes: string | null;
};

// Un ingreso o una salida con su checklist. null si el contrato no es de quien inició sesión.
export async function getMove(contractId: string, kind: MoveKind): Promise<MoveDetail | null> {
  if (!isUuid(contractId)) return null;
  const claims = await getSessionClaims();
  return withRls(claims, async (tx) => {
    const [c] = await tx
      .select({
        residentId: contract.residentId,
        residentName: person.fullName,
        unitName: unit.name,
        startDate: contract.startDate,
        endDate: contract.endDate,
        depositId: deposit.id,
      })
      .from(contract)
      .innerJoin(resident, eq(resident.id, contract.residentId))
      .innerJoin(person, eq(person.id, resident.personId))
      .innerJoin(unit, eq(unit.id, contract.unitId))
      .leftJoin(deposit, eq(deposit.contractId, contract.id))
      .where(eq(contract.id, contractId))
      .limit(1);
    if (!c) return null;
    const [e] = await tx
      .select()
      .from(moveEvent)
      .where(and(eq(moveEvent.contractId, contractId), eq(moveEvent.kind, kind)))
      .limit(1);
    return {
      contractId,
      kind,
      residentId: c.residentId,
      residentName: c.residentName,
      unitName: c.unitName,
      date: kind === "check_in" ? c.startDate : c.endDate,
      depositId: c.depositId,
      scheduledAt: e?.scheduledAt ?? null,
      doneAt: e?.doneAt ?? null,
      keysCount: e?.keysCount ?? null,
      checklist: e?.checklist ?? {},
      notes: e?.notes ?? null,
    };
  });
}
