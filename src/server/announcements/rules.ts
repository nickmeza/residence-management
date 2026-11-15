// Comunicados (CM-01): a quién le llega. Función pura: recibe los contratos, las unidades y a quién va dirigido.
import type { IsoDate } from "@/server/contracts/dates";
import { occupiesToday } from "@/server/contracts/rules";

export type Audience =
  | { kind: "all" }
  | { kind: "property"; propertyId: string }
  | { kind: "floor"; floorId: string }
  | { kind: "resident"; residentId: string };

export type RecipientContract = {
  residentId: string;
  unitId: string;
  startDate: IsoDate;
  endDate: IsoDate | null;
  status: "draft" | "pending_signature" | "confirmed" | "cancelled";
};

export type RecipientUnit = { id: string; floorId: string; propertyId: string };

// Residencia: quienes viven hoy (contrato que ocupa la unidad hoy) en lo elegido. A una persona le llega aunque no
// tenga contrato vigente (por ejemplo, alguien que todavía no entra). Sin repetidos.
export function residenceRecipients(
  audience: Audience,
  contracts: RecipientContract[],
  units: RecipientUnit[],
  today: IsoDate,
): string[] {
  if (audience.kind === "resident") return [audience.residentId];
  const unitById = new Map(units.map((u) => [u.id, u]));
  const living = contracts.filter((c) => occupiesToday({ ...c, id: "" }, today));
  const chosen = living.filter((c) => {
    const u = unitById.get(c.unitId);
    if (!u) return false;
    if (audience.kind === "property") return u.propertyId === audience.propertyId;
    if (audience.kind === "floor") return u.floorId === audience.floorId;
    return true;
  });
  return [...new Set(chosen.map((c) => c.residentId))];
}

// Pensión: los comensales con una afiliación vigente hoy (o que empieza después).
export function pensionRecipients(
  subscriptions: { residentId: string; endDate: IsoDate | null }[],
  today: IsoDate,
): string[] {
  return [
    ...new Set(
      subscriptions.filter((s) => s.endDate === null || s.endDate >= today).map((s) => s.residentId),
    ),
  ];
}

export const AUDIENCE_LABEL: Record<Audience["kind"], string> = {
  all: "Todos",
  property: "Un edificio",
  floor: "Un piso",
  resident: "Una persona",
};
