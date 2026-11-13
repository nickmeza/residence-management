import "server-only";

import { desc, eq, inArray, sql } from "drizzle-orm";

import { withRls } from "@/db/rls";
import {
  contract,
  document,
  documentRequirement,
  documentRequirementExemption,
  person,
  resident,
} from "@/db/schema";
import { getSessionClaims } from "@/server/auth/session";
import { limaToday } from "@/server/contracts/dates";
import type { UploadedDocument } from "@/server/contracts/queries";
import { contractPhase, type ContractPaperwork, type ContractPhase } from "@/server/contracts/rules";
import { askedRequirements, type UnitType } from "@/server/documents/rules";

import { currentContract } from "./list";

// Lo que ve el residente: sus fichas (puede estar en residencias de dueños distintos), su contrato de ahora y los
// documentos que se le piden. Todo con su sesión (RLS); los nombres de la residencia y de la unidad salen de la
// función my_resident_places (migración 0009), porque él no puede leer las tablas del arrendador.

export type MyResidence = {
  residentId: string;
  businessId: string;
  businessName: string;
  contract: {
    id: string;
    unitName: string;
    propertyName: string;
    monthlyRent: string;
    paymentDay: number;
    startDate: string;
    endDate: string | null;
    paperwork: ContractPaperwork;
    hasTemplate: boolean;
    phase: ContractPhase;
    signedCopies: UploadedDocument[];
    // Foto de portada de su edificio (ruta en el espacio privado), si el arrendador subió una.
    coverPath: string | null;
  } | null;
  // Solo lo que se le pide: obligatorio, activo, de su lista (cuarto o departamento) y sin excepción.
  requirements: {
    id: string;
    name: string;
    description: string | null;
    acceptedFormats: ("pdf" | "image")[];
    maxSizeMb: number;
    latest: UploadedDocument | null;
  }[];
  missing: number;
};

type Place = {
  resident_id: string;
  business_id: string;
  business_name: string;
  contract_id: string | null;
  unit_name: string | null;
  unit_type: UnitType | null;
  property_name: string | null;
  property_cover_path: string | null;
};

export async function getMyResidences(): Promise<{ firstName: string; residences: MyResidence[] }> {
  const claims = await getSessionClaims();
  const today = limaToday(new Date());
  return withRls(claims, async (tx) => {
    const [me] = await tx
      .select({ id: person.id, fullName: person.fullName })
      .from(person)
      .where(eq(person.userId, claims.sub))
      .limit(1);
    const firstName = me?.fullName.trim().split(/\s+/)[0] ?? "";
    if (!me) return { firstName, residences: [] };

    const cards = await tx
      .select({ id: resident.id, businessId: resident.businessId })
      .from(resident)
      .where(eq(resident.personId, me.id));
    if (!cards.length) return { firstName, residences: [] };
    const ids = cards.map((c) => c.id);

    const [places, contracts, requirements, exemptions, documents] = await Promise.all([
      tx.execute(sql`select * from public.my_resident_places()`) as unknown as Promise<Place[]>,
      tx
        .select({
          id: contract.id,
          residentId: contract.residentId,
          unitId: contract.unitId,
          startDate: contract.startDate,
          endDate: contract.endDate,
          status: contract.status,
          monthlyRent: contract.monthlyRent,
          paymentDay: contract.paymentDay,
          paperwork: contract.paperwork,
          templateId: contract.templateId,
        })
        .from(contract)
        .where(inArray(contract.residentId, ids)),
      // El RLS ya deja solo los obligatorios y activos.
      tx
        .select({
          id: documentRequirement.id,
          businessId: documentRequirement.businessId,
          name: documentRequirement.name,
          description: documentRequirement.description,
          unitType: documentRequirement.unitType,
          required: documentRequirement.required,
          active: documentRequirement.active,
          acceptedFormats: documentRequirement.acceptedFormats,
          maxSizeMb: documentRequirement.maxSizeMb,
        })
        .from(documentRequirement)
        .where(
          inArray(
            documentRequirement.businessId,
            cards.map((c) => c.businessId),
          ),
        )
        .orderBy(documentRequirement.name),
      tx
        .select({
          residentId: documentRequirementExemption.residentId,
          requirementId: documentRequirementExemption.requirementId,
        })
        .from(documentRequirementExemption)
        .where(inArray(documentRequirementExemption.residentId, ids)),
      tx
        .select({
          id: document.id,
          residentId: document.residentId,
          requirementId: document.requirementId,
          contractId: document.contractId,
          name: document.fileName,
          status: document.status,
          rejectionReason: document.rejectionReason,
          uploadedAt: document.uploadedAt,
        })
        .from(document)
        .where(inArray(document.residentId, ids))
        .orderBy(desc(document.uploadedAt)),
    ]);

    const residences = cards.map((card): MyResidence => {
      const cardPlaces = places.filter((p) => p.resident_id === card.id);
      // Un borrador todavía no es un acuerdo: el residente no lo ve.
      const shown = currentContract(
        contracts.filter((c) => c.residentId === card.id && c.status !== "draft"),
        today,
      );
      const place = shown ? cardPlaces.find((p) => p.contract_id === shown.id) : undefined;
      const exemptIds = exemptions.filter((e) => e.residentId === card.id).map((e) => e.requirementId);
      const own = documents.filter((d) => d.residentId === card.id);
      const asked = askedRequirements(
        requirements.filter((r) => r.businessId === card.businessId),
        place?.unit_type ?? null,
        exemptIds,
      ).map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        acceptedFormats: r.acceptedFormats,
        maxSizeMb: r.maxSizeMb,
        latest: own.find((d) => d.requirementId === r.id) ?? null,
      }));
      return {
        residentId: card.id,
        businessId: card.businessId,
        businessName: cardPlaces[0]?.business_name ?? "Tu residencia",
        contract:
          shown && shown.status !== "cancelled"
            ? {
                id: shown.id,
                unitName: place?.unit_name ?? "",
                propertyName: place?.property_name ?? "",
                monthlyRent: shown.monthlyRent,
                paymentDay: shown.paymentDay,
                startDate: shown.startDate,
                endDate: shown.endDate,
                paperwork: shown.paperwork,
                hasTemplate: shown.templateId !== null,
                phase: contractPhase(shown, today),
                signedCopies: own.filter((d) => d.contractId === shown.id),
                coverPath: place?.property_cover_path ?? null,
              }
            : null,
        requirements: asked,
        missing: asked.filter((r) => !r.latest || r.latest.status === "rejected").length,
      };
    });
    return { firstName, residences };
  });
}

// Para el menú del residente: su nombre y el contacto de cada negocio donde está inscrito.
export type MyShell = {
  fullName: string;
  contacts: { businessId: string; businessName: string; phone: string | null }[];
};

export async function getMyShell(): Promise<MyShell> {
  const claims = await getSessionClaims();
  return withRls(claims, async (tx) => {
    const [me] = await tx
      .select({ fullName: person.fullName })
      .from(person)
      .where(eq(person.userId, claims.sub))
      .limit(1);
    const info = (await tx.execute(
      sql`select business_id, trade_name, phone from public.my_payment_info()`,
    )) as unknown as {
      business_id: string;
      trade_name: string;
      phone: string | null;
    }[];
    return {
      fullName: me?.fullName ?? "",
      contacts: info.map((b) => ({ businessId: b.business_id, businessName: b.trade_name, phone: b.phone })),
    };
  });
}

// ¿Esta cuenta solo es residente (no administra ningún negocio)? Para mandarla a su inicio y no al panel.
export async function isResidentOnlyAccount(): Promise<boolean> {
  const claims = await getSessionClaims();
  const rows = await withRls(
    claims,
    (tx) =>
      tx.execute(sql`select
        exists (select 1 from public.resident r join public.person p on p.id = r.person_id
          where p.user_id = ${claims.sub}) as resident,
        exists (select 1 from public.business b join public.person p on p.id = b.owner_id
          where p.user_id = ${claims.sub}) as owner`) as unknown as Promise<
        { resident: boolean; owner: boolean }[]
      >,
  );
  return Boolean(rows[0]?.resident && !rows[0].owner);
}
