import "server-only";

import { asc, desc, eq, or } from "drizzle-orm";

import { withRls } from "@/db/rls";
import { business, contract, contractTemplate, floor, person, property, resident, unit } from "@/db/schema";
import { getSessionClaims } from "@/server/auth/session";
import { isRentable, type UnitInput } from "@/server/building/rules";
import { isUuid } from "@/server/business/queries";

import { endsInLabel, limaToday } from "./dates";
import { contractPhase, type ContractPaperwork, type ContractPhase, type ContractStatus } from "./rules";

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
        or(
          eq(contract.renewedFromId, k.id),
          k.renewedFromId ? eq(contract.id, k.renewedFromId) : undefined,
        ),
      );
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
    };
  });
}
