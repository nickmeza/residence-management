import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { db } from "@/db";
import { deleteUnit } from "@/server/building/mutations";
import * as m from "@/server/contracts/mutations";
import * as docs from "@/server/documents/mutations";
import { contractSchema, termsSchema, type ContractFormInput } from "@/server/contracts/schemas";
import { insertSetup } from "@/server/onboarding/save";
import { setupSchema } from "@/server/onboarding/schema";
import { createResident } from "@/server/residents/mutations";
import { residentSchema } from "@/server/residents/schemas";

// Contratos contra la base real, como una cuenta con sesión (RLS activo). Cada prueba deshace todo al final.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const A = "00000000-0000-4000-8000-0000000000a1";

const unit = (over: Record<string, unknown>) => ({
  key: "u",
  type: "room",
  name: "Cuarto",
  monthlyPrice: "",
  areaM2: "",
  occupiesWholeFloor: false,
  rentalMode: "whole",
  rooms: [],
  ...over,
});
const setup = setupSchema.parse({
  services: { residence: true, mealPlan: false },
  residenceBusiness: {
    kind: "natural",
    tradeName: "Residencia C",
    legalName: "",
    ruc: "",
    phone: "",
    contactEmail: "",
    city: "",
    address: "",
    paymentMethods: ["yape"],
    billingDay: "5",
  },
  property: {
    type: "building",
    ownerLivesHere: "yes",
    name: "Edificio C",
    address: "Calle Ejemplo 1",
    districtCity: "Lima",
    floors: [
      {
        units: [
          unit({ key: "a", name: "Cuarto 101", monthlyPrice: "500" }),
          unit({
            key: "d",
            type: "apartment",
            name: "Departamento 102",
            monthlyPrice: "",
            rentalMode: "by_room",
            rooms: [{ key: "d1", name: "Dormitorio 1", monthlyPrice: "400", areaM2: "" }],
          }),
        ],
      },
    ],
  },
});

const actAs = (tx: Tx, uid: string) =>
  tx.execute(sql`select set_config('request.jwt.claims', ${JSON.stringify({ sub: uid, role: "authenticated" })}, true),
    set_config('role', 'authenticated', true)`);

const rows = async <T>(tx: Tx, query: ReturnType<typeof sql>) => (await tx.execute(query)) as unknown as T[];

class Rollback extends Error {}

type Ids = { residentId: string; businessId: string; unitId: (name: string) => Promise<string> };

async function withResident(fn: (tx: Tx, ids: Ids) => Promise<void>) {
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`insert into auth.users (id, email, raw_user_meta_data, aud, role) values
        (${A}, 'a1@prueba.test', '{"full_name":"A"}', 'authenticated', 'authenticated')`);
      await actAs(tx, A);
      const [me] = await rows<{ id: string }>(tx, sql`select id from public.person where user_id = ${A}`);
      await insertSetup(tx, me.id, setup);
      const [b] = await rows<{ id: string }>(tx, sql`select id from public.business`);
      const residentId = (await createResident(
        tx,
        b.id,
        residentSchema.parse({
          fullName: "Residente de Prueba",
          phone: "",
          email: "",
          identityDocumentType: "",
          identityDocumentNumber: "",
          university: "",
          emergencyContactName: "",
          emergencyContactPhone: "",
          notes: "",
        }),
      ))!;
      const unitId = async (name: string) =>
        (await rows<{ id: string }>(tx, sql`select id from public.unit where name = ${name}`))[0].id;
      await fn(tx, { residentId, businessId: b.id, unitId });
      throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
}

const data = (over: Partial<ContractFormInput> & { residentId: string; unitId: string }) =>
  contractSchema.parse({
    startDate: "2026-03-01",
    endDate: "2026-12-31",
    monthlyRent: "500",
    paymentDay: "5",
    paperwork: "none",
    templateId: "",
    depositRule: "",
    depositFixedAmount: "",
    depositDueDate: "",
    ...over,
  });

const statusOf = async (tx: Tx, id: string) =>
  (
    await rows<{ status: string; end_date: string | null }>(
      tx,
      sql`select status, end_date::text from public.contract where id = ${id}`,
    )
  )[0];

const errorOf = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
    return null;
  } catch (e) {
    if (e instanceof m.ContractError) return e.message;
    throw e;
  }
};

describe("contratos", () => {
  it("sin papel queda acordado; con papel, pendiente de firma; como borrador, borrador", async () => {
    await withResident(async (tx, { residentId, unitId }) => {
      const room = await unitId("Cuarto 101");
      const none = await m.createContract(tx, data({ residentId, unitId: room }), false);
      expect((await statusOf(tx, none)).status).toBe("confirmed");

      const paper = await m.createContract(
        tx,
        data({ residentId, unitId: room, paperwork: "paper", startDate: "2027-01-01", endDate: "" }),
        false,
      );
      expect((await statusOf(tx, paper)).status).toBe("pending_signature");

      const draft = await m.createContract(
        tx,
        data({ residentId, unitId: room, startDate: "2026-06-01", endDate: "2026-06-30" }),
        true,
      );
      expect((await statusOf(tx, draft)).status).toBe("draft");
      // El borrador choca al querer confirmarlo.
      expect(await errorOf(() => m.submitDraft(tx, draft))).toMatch(/ya tiene un contrato/);
    });
  });

  it("no deja dos contratos en la misma unidad y fechas, ni alquilar lo que no se alquila", async () => {
    await withResident(async (tx, { residentId, unitId }) => {
      const room = await unitId("Cuarto 101");
      await m.createContract(tx, data({ residentId, unitId: room }), false);
      expect(
        await errorOf(() =>
          m.createContract(tx, data({ residentId, unitId: room, startDate: "2026-12-31" }), false),
        ),
      ).toMatch(/ya tiene un contrato/);
      // El departamento se alquila por cuartos: el departamento en sí no se alquila.
      const apartment = await unitId("Departamento 102");
      const bedroom = await unitId("Dormitorio 1");
      expect(
        await errorOf(() => m.createContract(tx, data({ residentId, unitId: apartment }), false)),
      ).toMatch(/por cuartos/);
      expect(
        await errorOf(() => m.createContract(tx, data({ residentId, unitId: bedroom }), false)),
      ).toBeNull();
    });
  });

  it("un requisito obligatorio sin verificar impide acordar, pero no guardar como borrador", async () => {
    await withResident(async (tx, { residentId, businessId, unitId }) => {
      await tx.execute(sql`insert into public.document_requirement (business_id, unit_type, name, required)
        values (${businessId}, 'room', 'DNI', true)`);
      const input = data({ residentId, unitId: await unitId("Cuarto 101") });
      expect(await errorOf(() => m.createContract(tx, input, false))).toMatch(/documentos obligatorios/);
      expect(await errorOf(() => m.createContract(tx, input, true))).toBeNull();
    });
  });

  it("cambiar el papel del mismo contrato: de sin papel a papel queda pendiente de firma", async () => {
    await withResident(async (tx, { residentId, unitId }) => {
      const id = await m.createContract(tx, data({ residentId, unitId: await unitId("Cuarto 101") }), false);
      await m.changePaperwork(tx, id, { paperwork: "paper", templateId: null });
      expect((await statusOf(tx, id)).status).toBe("pending_signature");
      await m.changePaperwork(tx, id, { paperwork: "none", templateId: null });
      expect((await statusOf(tx, id)).status).toBe("confirmed");
    });
  });

  it("cambiar condiciones: el actual termina el día anterior y el nuevo queda enlazado", async () => {
    await withResident(async (tx, { residentId, unitId }) => {
      const room = await unitId("Cuarto 101");
      const id = await m.createContract(tx, data({ residentId, unitId: room }), false);
      const next = await m.changeTerms(
        tx,
        id,
        termsSchema.parse({
          unitId: room,
          startDate: "2026-07-01",
          endDate: "2027-06-30",
          monthlyRent: "550",
          paymentDay: "5",
          paperwork: "none",
          templateId: "",
        }),
      );
      expect(await statusOf(tx, id)).toEqual({ status: "confirmed", end_date: "2026-06-30" });
      const [n] = await rows<{ renewed_from_id: string; monthly_rent: string }>(
        tx,
        sql`select renewed_from_id, monthly_rent::text from public.contract where id = ${next}`,
      );
      expect(n).toEqual({ renewed_from_id: id, monthly_rent: "550.00" });
    });
  });

  it("terminar cambia la fecha de fin; cancelar solo borradores o pendientes", async () => {
    await withResident(async (tx, { residentId, unitId }) => {
      const room = await unitId("Cuarto 101");
      const id = await m.createContract(tx, data({ residentId, unitId: room }), false);
      expect(await errorOf(() => m.cancelContract(tx, id))).toMatch(/no se cancela/);
      await m.endContract(tx, id, "2026-05-31");
      expect((await statusOf(tx, id)).end_date).toBe("2026-05-31");
      expect(await errorOf(() => m.endContract(tx, id, "2027-01-31"))).toMatch(/Cambiar condiciones/);

      const draft = await m.createContract(
        tx,
        data({ residentId, unitId: room, startDate: "2026-08-01" }),
        true,
      );
      await m.cancelContract(tx, draft);
      expect((await statusOf(tx, draft)).status).toBe("cancelled");
    });
  });

  it("una unidad con contratos no se puede quitar del edificio", async () => {
    await withResident(async (tx, { residentId, unitId }) => {
      const room = await unitId("Cuarto 101");
      await m.createContract(tx, data({ residentId, unitId: room }), false);
      await expect(deleteUnit(tx, room)).rejects.toThrow(/contratos registrados/);
      await expect(deleteUnit(tx, await unitId("Departamento 102"))).resolves.toBeTruthy();
    });
  });
});

describe("documentos subidos y copia firmada", () => {
  const file = (
    businessId: string,
    residentId: string,
    over: Partial<docs.NewDocument> = {},
  ): docs.NewDocument => ({
    residentId,
    kind: "other",
    requirementId: null,
    contractId: null,
    storagePath: `${businessId}/${residentId}/${crypto.randomUUID()}.pdf`,
    fileName: "dni.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1000,
    ...over,
  });

  it("lo que sube el arrendador queda verificado; se rechaza una ruta ajena o un formato que el requisito no pide", async () => {
    await withResident(async (tx, { residentId, businessId }) => {
      const { id } = await docs.registerDocument(tx, file(businessId, residentId), A);
      expect(await rows(tx, sql`select status from public.document where id = ${id}`)).toEqual([
        { status: "verified" },
      ]);
      const other = "00000000-0000-4000-8000-0000000000ff";
      await expect(
        docs.registerDocument(
          tx,
          file(businessId, residentId, { storagePath: `${businessId}/${other}/x.pdf` }),
          A,
        ),
      ).rejects.toThrow(/No pudimos guardar/);
      const [req] = await rows<{ id: string }>(
        tx,
        sql`insert into public.document_requirement (business_id, unit_type, name, required, accepted_formats)
          values (${businessId}, 'room', 'DNI', true, '{image}') returning id`,
      );
      await expect(
        docs.registerDocument(
          tx,
          file(businessId, residentId, { kind: "requirement", requirementId: req.id }),
          A,
        ),
      ).rejects.toThrow(/foto/);
    });
  });

  it("verificar y rechazar con motivo", async () => {
    await withResident(async (tx, { residentId, businessId }) => {
      const { id } = await docs.registerDocument(tx, file(businessId, residentId), A);
      await docs.reviewDocument(tx, id, { status: "rejected", reason: "Está vencido" }, A);
      expect(
        await rows(tx, sql`select status, rejection_reason from public.document where id = ${id}`),
      ).toEqual([{ status: "rejected", rejection_reason: "Está vencido" }]);
      await docs.reviewDocument(tx, id, { status: "verified" }, A);
      expect(
        await rows(tx, sql`select status, rejection_reason from public.document where id = ${id}`),
      ).toEqual([{ status: "verified", rejection_reason: null }]);
    });
  });

  it("un contrato en papel se confirma con su copia firmada y los obligatorios (o su excepción)", async () => {
    await withResident(async (tx, { residentId, businessId, unitId }) => {
      const id = await m.createContract(
        tx,
        data({ residentId, unitId: await unitId("Cuarto 101"), paperwork: "paper" }),
        false,
      );
      expect((await statusOf(tx, id)).status).toBe("pending_signature");
      expect(await errorOf(() => m.confirmSigned(tx, id))).toMatch(/copia firmada/);

      await docs.registerDocument(
        tx,
        file(businessId, residentId, { kind: "signed_contract", contractId: id }),
        A,
      );
      const [req] = await rows<{ id: string }>(
        tx,
        sql`insert into public.document_requirement (business_id, unit_type, name, required)
          values (${businessId}, 'room', 'DNI', true) returning id`,
      );
      expect(await errorOf(() => m.confirmSigned(tx, id))).toMatch(/documentos obligatorios/);

      await docs.setAsked(tx, { residentId, requirementId: req.id, asked: false, userId: A });
      expect(await errorOf(() => m.confirmSigned(tx, id))).toBeNull();
      expect((await statusOf(tx, id)).status).toBe("confirmed");
    });
  });
});
