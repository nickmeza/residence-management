import "server-only";

import { and, asc, desc, eq, ne, or } from "drizzle-orm";

import { db } from "@/db";
import { withRls } from "@/db/rls";
import {
  business,
  contract,
  contractTemplate,
  document,
  floor,
  person,
  property,
  resident,
  unit,
} from "@/db/schema";
import { getSessionClaims } from "@/server/auth/session";
import { isRentable, type UnitInput } from "@/server/building/rules";
import { isUuid } from "@/server/business/queries";

import { endsInLabel, limaToday } from "./dates";
import { contractPhase, type ContractPaperwork, type ContractPhase, type ContractStatus } from "./rules";
import type { TemplateData } from "./template";

export type ContractListRow = {
  id: string;
  residentId: string;
  residentName: string;
  unitName: string;
  monthlyRent: string;
  endsIn: string;
  phase: ContractPhase;
  paperwork: ContractPaperwork;
  searchText: string;
};

// Contratos de un negocio para la pantalla Contratos, del más reciente al más antiguo.
export async function listContracts(businessId: string): Promise<ContractListRow[]> {
  if (!isUuid(businessId)) return [];
  const claims = await getSessionClaims();
  const today = limaToday(new Date());
  const rows = await withRls(claims, (tx) =>
    tx
      .select({
        id: contract.id,
        residentId: contract.residentId,
        residentName: person.fullName,
        unitName: unit.name,
        monthlyRent: contract.monthlyRent,
        startDate: contract.startDate,
        endDate: contract.endDate,
        status: contract.status,
        paperwork: contract.paperwork,
      })
      .from(contract)
      .innerJoin(resident, eq(resident.id, contract.residentId))
      .innerJoin(person, eq(person.id, resident.personId))
      .innerJoin(unit, eq(unit.id, contract.unitId))
      .where(eq(resident.businessId, businessId))
      .orderBy(desc(contract.startDate)),
  );
  return rows.map((r) => ({
    id: r.id,
    residentId: r.residentId,
    residentName: r.residentName,
    unitName: r.unitName,
    monthlyRent: r.monthlyRent,
    endsIn: endsInLabel(r.endDate, today),
    phase: contractPhase(r, today),
    paperwork: r.paperwork,
    searchText: `${r.residentName} ${r.unitName}`,
  }));
}

export type ContractFormOptions = {
  residents: { id: string; fullName: string }[];
  // Solo lo que se alquila: cuarto suelto, departamento completo o cuarto de un departamento por cuartos.
  units: { id: string; label: string; monthlyPrice: string | null }[];
  templates: { id: string; name: string }[];
  billingDay: number;
};

// Opciones del formulario de contrato para un negocio.
export async function getContractFormOptions(businessId: string): Promise<ContractFormOptions | null> {
  if (!isUuid(businessId)) return null;
  const claims = await getSessionClaims();
  return withRls(claims, async (tx) => {
    const [b] = await tx
      .select({ billingDay: business.billingDay })
      .from(business)
      .where(eq(business.id, businessId))
      .limit(1);
    if (!b) return null;
    const [residents, units, templates] = await Promise.all([
      tx
        .select({ id: resident.id, fullName: person.fullName })
        .from(resident)
        .innerJoin(person, eq(person.id, resident.personId))
        .where(eq(resident.businessId, businessId))
        .orderBy(asc(person.fullName)),
      tx
        .select({
          id: unit.id,
          parentId: unit.parentUnitId,
          type: unit.type,
          name: unit.name,
          rentalMode: unit.rentalMode,
          occupiesWholeFloor: unit.occupiesWholeFloor,
          monthlyPrice: unit.monthlyPrice,
          x: unit.posX,
          z: unit.posZ,
          width: unit.width,
          depth: unit.depth,
          propertyName: property.name,
        })
        .from(unit)
        .innerJoin(floor, eq(floor.id, unit.floorId))
        .innerJoin(property, eq(property.id, floor.propertyId))
        .where(eq(property.businessId, businessId))
        .orderBy(asc(property.name), asc(unit.name)),
      tx
        .select({ id: contractTemplate.id, name: contractTemplate.name })
        .from(contractTemplate)
        .where(eq(contractTemplate.businessId, businessId))
        .orderBy(asc(contractTemplate.name)),
    ]);
    const byId = new Map<string, UnitInput>(units.map((u) => [u.id, u]));
    const multipleProperties = new Set(units.map((u) => u.propertyName)).size > 1;
    return {
      residents,
      units: units
        .filter((u) => isRentable(u, byId))
        .map((u) => ({
          id: u.id,
          label: multipleProperties ? `${u.propertyName} · ${u.name}` : u.name,
          monthlyPrice: u.monthlyPrice,
        })),
      templates,
      billingDay: b.billingDay ?? 5,
    };
  });
}

export type ContractDetail = {
  id: string;
  businessId: string;
  businessName: string;
  residentId: string;
  residentName: string;
  unitId: string;
  unitName: string;
  propertyName: string;
  startDate: string;
  endDate: string | null;
  monthlyRent: string;
  paymentDay: number;
  paperwork: ContractPaperwork;
  templateId: string | null;
  templateName: string | null;
  status: ContractStatus;
  phase: ContractPhase;
  renewedFrom: { id: string; startDate: string } | null;
  renewedTo: { id: string; startDate: string } | null;
  // Copias firmadas subidas para este contrato, la más reciente primero.
  signedCopies: UploadedDocument[];
};

export type UploadedDocument = {
  id: string;
  name: string;
  status: "in_review" | "verified" | "rejected";
  rejectionReason: string | null;
  uploadedAt: Date;
};

// Un contrato para su pantalla. null si no existe o no es de un negocio de quien inició sesión.
export async function getContract(id: string): Promise<ContractDetail | null> {
  if (!isUuid(id)) return null;
  const claims = await getSessionClaims();
  const today = limaToday(new Date());
  return withRls(claims, async (tx) => {
    const [c] = await tx
      .select({
        contract,
        businessId: business.id,
        businessName: business.tradeName,
        residentName: person.fullName,
        unitName: unit.name,
        propertyName: property.name,
        templateName: contractTemplate.name,
      })
      .from(contract)
      .innerJoin(resident, eq(resident.id, contract.residentId))
      .innerJoin(business, eq(business.id, resident.businessId))
      .innerJoin(person, eq(person.id, resident.personId))
      .innerJoin(unit, eq(unit.id, contract.unitId))
      .innerJoin(floor, eq(floor.id, unit.floorId))
      .innerJoin(property, eq(property.id, floor.propertyId))
      .leftJoin(contractTemplate, eq(contractTemplate.id, contract.templateId))
      .where(eq(contract.id, id))
      .limit(1);
    if (!c) return null;
    const k = c.contract;
    const linked = await tx
      .select({ id: contract.id, startDate: contract.startDate, renewedFromId: contract.renewedFromId })
      .from(contract)
      // El contrato al que reemplaza y el que lo reemplaza a él (si existen).
      .where(
        or(eq(contract.renewedFromId, k.id), k.renewedFromId ? eq(contract.id, k.renewedFromId) : undefined),
      );
    const signedCopies = await tx
      .select({
        id: document.id,
        name: document.fileName,
        status: document.status,
        rejectionReason: document.rejectionReason,
        uploadedAt: document.uploadedAt,
      })
      .from(document)
      .where(eq(document.contractId, k.id))
      .orderBy(desc(document.uploadedAt));
    const from = linked.find((l) => l.id === k.renewedFromId);
    const to = linked.find((l) => l.renewedFromId === k.id);
    return {
      id: k.id,
      businessId: c.businessId,
      businessName: c.businessName,
      residentId: k.residentId,
      residentName: c.residentName,
      unitId: k.unitId,
      unitName: c.unitName,
      propertyName: c.propertyName,
      startDate: k.startDate,
      endDate: k.endDate,
      monthlyRent: k.monthlyRent,
      paymentDay: k.paymentDay,
      paperwork: k.paperwork,
      templateId: k.templateId,
      templateName: c.templateName,
      status: k.status,
      phase: contractPhase(k, today),
      renewedFrom: from ? { id: from.id, startDate: from.startDate } : null,
      renewedTo: to ? { id: to.id, startDate: to.startDate } : null,
      signedCopies,
    };
  });
}

export type ContractPdfData = {
  templateName: string;
  templateBody: string;
  landlordName: string;
  template: TemplateData;
};

// Lo que necesita el PDF de un contrato desde plantilla. null si no es de quien inició sesión o no tiene plantilla.
export async function getContractPdfData(id: string): Promise<ContractPdfData | null> {
  if (!isUuid(id)) return null;
  const claims = await getSessionClaims();
  return withRls(claims, (tx) => loadContractPdfData(tx, id));
}

// El PDF de su propio contrato, para el residente. Él no puede leer las tablas del arrendador (negocio, propiedad,
// plantilla), así que: primero se comprueba con su sesión (RLS) que el contrato es suyo y no es un borrador, y
// recién entonces se leen los datos del PDF como administrador.
export async function getMyContractPdfData(id: string): Promise<ContractPdfData | null> {
  if (!isUuid(id)) return null;
  const claims = await getSessionClaims();
  const [own] = await withRls(claims, (tx) =>
    tx
      .select({ id: contract.id })
      .from(contract)
      .innerJoin(resident, eq(resident.id, contract.residentId))
      .innerJoin(person, eq(person.id, resident.personId))
      .where(and(eq(contract.id, id), eq(person.userId, claims.sub), ne(contract.status, "draft")))
      .limit(1),
  );
  if (!own) return null;
  return db.transaction((tx) => loadContractPdfData(tx, id));
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function loadContractPdfData(tx: Tx, id: string): Promise<ContractPdfData | null> {
  const [row] = await tx
    .select({
      contract,
      person,
      businessName: business.tradeName,
      legalName: business.legalName,
      ruc: business.ruc,
      unitName: unit.name,
      propertyName: property.name,
      propertyAddress: property.address,
      districtCity: property.districtCity,
      templateName: contractTemplate.name,
      templateBody: contractTemplate.body,
    })
    .from(contract)
    .innerJoin(resident, eq(resident.id, contract.residentId))
    .innerJoin(business, eq(business.id, resident.businessId))
    .innerJoin(person, eq(person.id, resident.personId))
    .innerJoin(unit, eq(unit.id, contract.unitId))
    .innerJoin(floor, eq(floor.id, unit.floorId))
    .innerJoin(property, eq(property.id, floor.propertyId))
    .innerJoin(contractTemplate, eq(contractTemplate.id, contract.templateId))
    .where(eq(contract.id, id))
    .limit(1);
  if (!row) return null;
  const k = row.contract;
  const p = row.person;
  return {
    templateName: row.templateName,
    templateBody: row.templateBody,
    landlordName: row.legalName ?? row.businessName,
    template: {
      residentName: p.fullName,
      identityDocument:
        p.identityDocumentType && p.identityDocumentNumber
          ? { type: p.identityDocumentType, number: p.identityDocumentNumber }
          : null,
      unitName: row.unitName,
      propertyName: row.propertyName,
      propertyAddress: `${row.propertyAddress}, ${row.districtCity}`,
      monthlyRent: k.monthlyRent,
      paymentDay: k.paymentDay,
      startDate: k.startDate,
      endDate: k.endDate,
      businessName: row.businessName,
      ruc: row.ruc,
      today: limaToday(new Date()),
    },
  };
}
