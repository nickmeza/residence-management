import "server-only";

import { and, asc, desc, eq, gt, inArray, isNull } from "drizzle-orm";

import { withRls } from "@/db/rls";
import {
  business,
  contract,
  document,
  documentRequirement,
  floor,
  person,
  resident,
  residentInvitation,
  unit,
} from "@/db/schema";
import { getSessionClaims } from "@/server/auth/session";
import { isUuid } from "@/server/business/queries";
import { endsInLabel, limaToday } from "@/server/contracts/dates";
import { contractPhase, type ContractPhase } from "@/server/contracts/rules";

import { currentContract, currentPhase, documentsSummary, type ResidentRow } from "./list";

type Tx = Parameters<Parameters<typeof withRls>[1]>[0];

// Contratos de varias fichas, con el nombre de la unidad y su propiedad.
function contractsOf(tx: Tx, residentIds: string[]) {
  if (!residentIds.length) return Promise.resolve([]);
  return tx
    .select({
      id: contract.id,
      residentId: contract.residentId,
      unitId: contract.unitId,
      unitName: unit.name,
      propertyId: floor.propertyId,
      startDate: contract.startDate,
      endDate: contract.endDate,
      monthlyRent: contract.monthlyRent,
      paymentDay: contract.paymentDay,
      paperwork: contract.paperwork,
      status: contract.status,
    })
    .from(contract)
    .innerJoin(unit, eq(unit.id, contract.unitId))
    .innerJoin(floor, eq(floor.id, unit.floorId))
    .where(inArray(contract.residentId, residentIds));
}

export type ResidentListRow = ResidentRow & {
  monthlyRent: string | null;
  endsIn: string | null;
  isStudent: boolean;
};

// Residentes de un negocio para la pantalla Residentes. Vacío si el negocio no es de quien inició sesión.
export async function listResidents(businessId: string): Promise<ResidentListRow[]> {
  if (!isUuid(businessId)) return [];
  const claims = await getSessionClaims();
  const today = limaToday(new Date());
  return withRls(claims, async (tx) => {
    const people = await tx
      .select({
        id: resident.id,
        fullName: person.fullName,
        university: resident.university,
      })
      .from(resident)
      .innerJoin(person, eq(person.id, resident.personId))
      .innerJoin(business, eq(business.id, resident.businessId))
      .where(eq(resident.businessId, businessId))
      .orderBy(asc(person.fullName));
    const ids = people.map((p) => p.id);
    const [contracts, requirements, documents] = await Promise.all([
      contractsOf(tx, ids),
      tx
        .select({
          id: documentRequirement.id,
          propertyId: documentRequirement.propertyId,
          required: documentRequirement.required,
        })
        .from(documentRequirement)
        .where(eq(documentRequirement.businessId, businessId)),
      ids.length
        ? tx
            .select({
              residentId: document.residentId,
              requirementId: document.requirementId,
              status: document.status,
            })
            .from(document)
            .where(inArray(document.residentId, ids))
        : Promise.resolve([]),
    ]);

    return people.map((p) => {
      const shown = currentContract(
        contracts.filter((c) => c.residentId === p.id),
        today,
      );
      return {
        id: p.id,
        fullName: p.fullName,
        isStudent: Boolean(p.university),
        phase: currentPhase(shown, today),
        unitName: shown?.unitName ?? null,
        monthlyRent: shown?.monthlyRent ?? null,
        endsIn: shown ? endsInLabel(shown.endDate, today) : null,
        searchText: `${p.fullName} ${shown?.unitName ?? ""}`,
        documents: documentsSummary({
          propertyId: shown?.propertyId ?? null,
          requirements,
          documents: documents.filter((d) => d.residentId === p.id),
        }),
      };
    });
  });
}

export type ResidentDetail = {
  id: string;
  businessName: string;
  hasAccount: boolean;
  person: {
    fullName: string;
    phone: string | null;
    email: string | null;
    identityDocumentType: "dni" | "foreign_id" | "passport" | null;
    identityDocumentNumber: string | null;
  };
  card: {
    university: string | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
    notes: string | null;
  };
  contract: {
    id: string;
    unitName: string;
    monthlyRent: string;
    paymentDay: number;
    startDate: string;
    endDate: string | null;
    paperwork: "none" | "paper" | "template";
    phase: ContractPhase;
  } | null;
  documents: { id: string; name: string; status: "in_review" | "verified" | "rejected" }[];
  // Invitación vigente sin aceptar (null si no hay).
  invitationExpiresAt: Date | null;
};

// Una ficha de residente para su perfil. null si no existe o no es de un negocio de quien inició sesión.
export async function getResident(id: string): Promise<ResidentDetail | null> {
  if (!isUuid(id)) return null;
  const claims = await getSessionClaims();
  const today = limaToday(new Date());
  return withRls(claims, async (tx) => {
    // El join con business deja fuera a un residente que mira su propia ficha: aquí solo entra el arrendador.
    const [row] = await tx
      .select({ resident, person, businessName: business.tradeName })
      .from(resident)
      .innerJoin(person, eq(person.id, resident.personId))
      .innerJoin(business, eq(business.id, resident.businessId))
      .where(eq(resident.id, id))
      .limit(1);
    if (!row) return null;

    const [contracts, documents, [invitation]] = await Promise.all([
      contractsOf(tx, [id]),
      tx
        .select({
          id: document.id,
          fileName: document.fileName,
          requirementName: documentRequirement.name,
          kind: document.kind,
          status: document.status,
        })
        .from(document)
        .leftJoin(documentRequirement, eq(documentRequirement.id, document.requirementId))
        .where(eq(document.residentId, id))
        .orderBy(desc(document.uploadedAt)),
      tx
        .select({ expiresAt: residentInvitation.expiresAt })
        .from(residentInvitation)
        .where(
          and(
            eq(residentInvitation.residentId, id),
            isNull(residentInvitation.acceptedAt),
            gt(residentInvitation.expiresAt, new Date()),
          ),
        )
        .orderBy(desc(residentInvitation.expiresAt))
        .limit(1),
    ]);

    const shown = currentContract(contracts, today);
    const p = row.person;
    const r = row.resident;
    return {
      id: r.id,
      businessName: row.businessName,
      hasAccount: p.userId !== null,
      person: {
        fullName: p.fullName,
        phone: p.phone,
        email: p.email,
        identityDocumentType: p.identityDocumentType,
        identityDocumentNumber: p.identityDocumentNumber,
      },
      card: {
        university: r.university,
        emergencyContactName: r.emergencyContactName,
        emergencyContactPhone: r.emergencyContactPhone,
        notes: r.notes,
      },
      contract: shown
        ? {
            id: shown.id,
            unitName: shown.unitName,
            monthlyRent: shown.monthlyRent,
            paymentDay: shown.paymentDay,
            startDate: shown.startDate,
            endDate: shown.endDate,
            paperwork: shown.paperwork,
            phase: contractPhase(shown, today),
          }
        : null,
      documents: documents.map((d) => ({
        id: d.id,
        name: d.requirementName ?? (d.kind === "signed_contract" ? "Contrato firmado" : d.fileName),
        status: d.status,
      })),
      invitationExpiresAt: invitation?.expiresAt ?? null,
    };
  });
}
