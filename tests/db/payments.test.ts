import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { db } from "@/db";
import * as contracts from "@/server/contracts/mutations";
import { contractSchema, termsSchema, type ContractFormInput } from "@/server/contracts/schemas";
import { limaToday } from "@/server/contracts/dates";
import * as deposits from "@/server/deposits/mutations";
import { insertSetup } from "@/server/onboarding/save";
import { setupSchema } from "@/server/onboarding/schema";
import * as payments from "@/server/payments/mutations";
import { createResident } from "@/server/residents/mutations";
import { residentSchema } from "@/server/residents/schemas";

// Cobros y garantía contra la base real (Fase 5), con RLS activo: un arrendador (A), otro arrendador (B) y el
// residente de A con su cuenta (R). Cada prueba deshace todo al final: la base queda como estaba.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const A = "00000000-0000-4000-8000-0000000005a1";
const B = "00000000-0000-4000-8000-0000000005b1";
const R = "00000000-0000-4000-8000-0000000005c1";

const setup = (name: string) =>
  setupSchema.parse({
    services: { residence: true, mealPlan: false },
    residenceBusiness: {
      kind: "natural",
      tradeName: name,
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
      name: `Edificio ${name}`,
      address: "Calle Ejemplo 1",
      districtCity: "Lima",
      floors: [
        {
          units: [
            {
              key: "a",
              type: "room",
              name: "Cuarto 101",
              monthlyPrice: "600",
              areaM2: "",
              occupiesWholeFloor: false,
              rentalMode: "whole",
              rooms: [],
            },
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

type Ctx = { residentId: string; businessId: string; unitId: string };

// A con su negocio y un residente (con cuenta R). La garantía configurada: 1 mes por cuarto.
async function scenario(fn: (tx: Tx, ctx: Ctx) => Promise<void>) {
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`insert into auth.users (id, email, raw_user_meta_data, aud, role) values
        (${A}, 'a5@prueba.test', '{"full_name":"A"}', 'authenticated', 'authenticated'),
        (${B}, 'b5@prueba.test', '{"full_name":"B"}', 'authenticated', 'authenticated'),
        (${R}, 'r5@prueba.test', '{"full_name":"R"}', 'authenticated', 'authenticated')`);
      await actAs(tx, B);
      const [pb] = await rows<{ id: string }>(tx, sql`select id from public.person where user_id = ${B}`);
      await insertSetup(tx, pb.id, setup("Residencia B"));
      await actAs(tx, A);
      const [me] = await rows<{ id: string }>(tx, sql`select id from public.person where user_id = ${A}`);
      await insertSetup(tx, me.id, setup("Residencia A"));
      const [b] = await rows<{ id: string }>(tx, sql`select id from public.business`);
      await tx.execute(
        sql`insert into public.deposit_settings (business_id, room_rule) values (${b.id}, 'one_month')`,
      );
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
      const [u] = await rows<{ id: string }>(tx, sql`select id from public.unit where name = 'Cuarto 101'`);
      // R acepta la invitación: su cuenta queda enlazada a la persona de la ficha.
      await tx.execute(sql`reset role`);
      await tx.execute(sql`delete from public.person where user_id = ${R}`);
      await tx.execute(sql`update public.person set user_id = ${R}
        where id = (select person_id from public.resident where id = ${residentId})`);
      await actAs(tx, A);
      await fn(tx, { residentId, businessId: b.id, unitId: u.id });
      throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
}

const contractData = (over: Partial<ContractFormInput> & { residentId: string; unitId: string }) =>
  contractSchema.parse({
    startDate: "2026-03-15",
    endDate: "2026-05-10",
    monthlyRent: "600",
    paymentDay: "5",
    paperwork: "none",
    templateId: "",
    depositRule: "",
    depositFixedAmount: "",
    depositDueDate: "",
    ...over,
  });

const chargesOf = (tx: Tx, contractId: string) =>
  rows<{ concept: string; period: string; amount: string; due_date: string }>(
    tx,
    sql`select concept, period, amount::text, due_date::text from public.charge
      where contract_id = ${contractId} order by concept::text, period`,
  );

const fails = async (tx: Tx, query: ReturnType<typeof sql>) => {
  try {
    await tx.transaction((s) => s.execute(query));
    return false;
  } catch {
    return true;
  }
};

describe("recibos y garantía al confirmar", () => {
  it("crea un recibo por mes (proporcional) y la garantía en el primero", async () => {
    await scenario(async (tx, { residentId, unitId }) => {
      const id = await contracts.createContract(tx, contractData({ residentId, unitId }), false);
      expect(await chargesOf(tx, id)).toEqual([
        { concept: "deposit", period: "2026-03", amount: "600.00", due_date: "2026-03-15" },
        { concept: "rent", period: "2026-03", amount: "329.03", due_date: "2026-03-15" },
        { concept: "rent", period: "2026-04", amount: "600.00", due_date: "2026-04-05" },
        { concept: "rent", period: "2026-05", amount: "193.55", due_date: "2026-05-05" },
      ]);
      const [d] = await rows<{ amount: string; status: string }>(
        tx,
        sql`select amount::text, status from public.deposit where contract_id = ${id}`,
      );
      expect(d).toEqual({ amount: "600.00", status: "held" });
    });
  });

  it("un borrador no crea recibos; a esta persona se le puede no pedir garantía", async () => {
    await scenario(async (tx, { residentId, unitId }) => {
      const draft = await contracts.createContract(tx, contractData({ residentId, unitId }), true);
      expect(await chargesOf(tx, draft)).toEqual([]);
      await contracts.cancelContract(tx, draft);
      const id = await contracts.createContract(
        tx,
        contractData({ residentId, unitId, depositRule: "none" }),
        false,
      );
      expect((await chargesOf(tx, id)).filter((c) => c.concept === "deposit")).toEqual([]);
      const [d] = await rows<{ status: string }>(
        tx,
        sql`select status from public.deposit where contract_id = ${id}`,
      );
      expect(d.status).toBe("none");
    });
  });

  it("al terminar antes se corrige el último mes y se quitan los que sobran", async () => {
    await scenario(async (tx, { residentId, unitId }) => {
      const id = await contracts.createContract(tx, contractData({ residentId, unitId }), false);
      await contracts.endContract(tx, id, "2026-04-10");
      const rent = (await chargesOf(tx, id)).filter((c) => c.concept === "rent");
      expect(rent.map((c) => [c.period, c.amount])).toEqual([
        ["2026-03", "329.03"],
        ["2026-04", "200.00"],
      ]);
    });
  });

  it("regla 9: al renovar, la garantía pasa al contrato nuevo y no se cobra otra", async () => {
    await scenario(async (tx, { residentId, unitId }) => {
      const id = await contracts.createContract(tx, contractData({ residentId, unitId }), false);
      const next = await contracts.changeTerms(
        tx,
        id,
        termsSchema.parse({
          unitId,
          startDate: "2026-05-11",
          endDate: "2026-08-31",
          monthlyRent: "650",
          paymentDay: "5",
          paperwork: "none",
          templateId: "",
        }),
      );
      const [d] = await rows<{ contract_id: string }>(tx, sql`select contract_id from public.deposit`);
      expect(d.contract_id).toBe(next);
      expect((await chargesOf(tx, next)).filter((c) => c.concept === "deposit")).toEqual([]);
    });
  });
});

describe("RLS de cobros con dos arrendadores y un residente", () => {
  it("B no ve nada de A; el residente ve lo suyo y solo manda comprobantes en revisión", async () => {
    await scenario(async (tx, { residentId, unitId, businessId }) => {
      const id = await contracts.createContract(tx, contractData({ residentId, unitId }), false);

      await actAs(tx, B);
      for (const table of ["charge", "deposit", "payment", "deposit_settings"]) {
        const [n] = await rows<{ n: number }>(
          tx,
          sql`select count(*)::int as n from ${sql.identifier(table)}`,
        );
        expect(n.n, table).toBe(0);
      }
      expect(
        await fails(
          tx,
          sql`insert into public.charge (contract_id, concept, period, amount, due_date)
          values (${id}, 'rent', '2026-09', 1, '2026-09-05')`,
        ),
      ).toBe(true);

      await actAs(tx, R);
      const [mine] = await rows<{ n: number }>(tx, sql`select count(*)::int as n from public.charge`);
      expect(mine.n).toBe(4);
      const [rp] = await rows<{ id: string }>(tx, sql`select id from public.person where user_id = ${R}`);
      // No puede confirmar su propio pago…
      expect(
        await fails(
          tx,
          sql`insert into public.payment (resident_id, period, amount, method, paid_on, status, submitted_by)
          values (${residentId}, '2026-03', 929.03, 'yape', '2026-03-15', 'confirmed', ${rp.id})`,
        ),
      ).toBe(true);
      // …ni crearse cargos ni tocar su garantía.
      expect(
        await fails(tx, sql`update public.deposit set amount = 0 where contract_id = ${id}`).then(
          async (f) => {
            const [d] = await rows<{ amount: string }>(tx, sql`select amount::text from public.deposit`);
            return f || d.amount === "600.00";
          },
        ),
      ).toBe(true);
      // Su comprobante sí, en revisión.
      const proof = await payments.submitProof(
        tx,
        {
          residentId,
          period: "2026-03",
          amount: "929.03",
          method: "yape",
          paidOn: "2026-03-15",
          operationCode: null,
          proofPath: `${businessId}/${residentId}/comprobantes/11111111-1111-4111-8111-111111111111.jpg`,
        },
        R,
      );
      const [p] = await rows<{ status: string }>(
        tx,
        sql`select status from public.payment where id = ${proof.id}`,
      );
      expect(p.status).toBe("in_review");

      // A lo confirma; la bitácora lo anota (solo la lee el administrador).
      await actAs(tx, A);
      await payments.reviewPayment(tx, proof.id, { status: "confirmed" }, A);
      const [hidden] = await rows<{ n: number }>(tx, sql`select count(*)::int as n from public.money_log`);
      expect(hidden.n).toBe(0);
      await tx.execute(sql`reset role`);
      const [log] = await rows<{ n: number }>(
        tx,
        sql`select count(*)::int as n from public.money_log where row_id = ${proof.id}`,
      );
      expect(log.n).toBe(2);
    });
  });
});

describe("liquidación de la garantía", () => {
  it("borrador oculto; lo disputado no se paga; la diferencia se cobra como cargo", async () => {
    await scenario(async (tx, { residentId, unitId }) => {
      const id = await contracts.createContract(tx, contractData({ residentId, unitId }), false);
      const [d] = await rows<{ id: string }>(
        tx,
        sql`select id from public.deposit where contract_id = ${id}`,
      );
      await deposits.startSettlement(tx, d.id);
      const discount = { note: "Huecos en la pared", photoPath: null, worseThanEntry: false };
      await deposits.addDiscount(tx, d.id, { ...discount, area: "walls", amount: "500" });
      await deposits.addDiscount(tx, d.id, { ...discount, area: "keys", amount: "200" });

      await actAs(tx, R);
      const [hidden] = await rows<{ n: number }>(tx, sql`select count(*)::int as n from public.settlement`);
      expect(hidden.n).toBe(0);

      await actAs(tx, A);
      await deposits.sendSettlement(tx, d.id);
      await actAs(tx, R);
      const [keys] = await rows<{ id: string }>(
        tx,
        sql`select id from public.settlement_discount where area = 'keys'`,
      );
      await deposits.disputeDiscount(tx, keys.id, "Devolví las dos llaves");

      await actAs(tx, A);
      // 600 − 500 vigentes − 200 en disputa → hoy no se puede pagar nada.
      expect(
        await deposits
          .registerRefund(
            tx,
            d.id,
            { amount: "100", method: "yape", paidOn: "2026-05-11", operationCode: null, proofPath: null },
            A,
          )
          .then(() => null)
          .catch((e: Error) => e.message),
      ).toMatch(/disputa/);
      await deposits.answerDispute(tx, keys.id, { action: "adjust", amount: "150" });
      // 500 + 150 = 650 > 600: se cobra la diferencia de 50 y se cierra (no queda nada por devolver).
      await deposits.chargeExcess(tx, d.id);
      const [damages] = await rows<{ amount: string }>(
        tx,
        sql`select amount::text from public.charge where concept = 'damages'`,
      );
      expect(damages.amount).toBe("50.00");
      const [closed] = await rows<{ status: string }>(
        tx,
        sql`select status from public.deposit where id = ${d.id}`,
      );
      expect(closed.status).toBe("returned");
    });
  });

  it("regla 8: lo reportado al ingresar solo se descuenta si está peor, con foto; el reporte tiene plazo", async () => {
    await scenario(async (tx, { residentId, unitId, businessId }) => {
      const today = limaToday(new Date());
      const id = await contracts.createContract(
        tx,
        contractData({ residentId, unitId, startDate: today, endDate: "" }),
        false,
      );
      await actAs(tx, R);
      await deposits.addEntryReport(
        tx,
        {
          contractId: id,
          area: "walls",
          note: "Rayón junto a la ventana",
          photoPath: `${businessId}/${residentId}/ingreso/22222222-2222-4222-8222-222222222222.jpg`,
        },
        R,
      );
      await actAs(tx, A);
      const [d] = await rows<{ id: string }>(
        tx,
        sql`select id from public.deposit where contract_id = ${id}`,
      );
      await deposits.startSettlement(tx, d.id);
      const add = (worseThanEntry: boolean, photoPath: string | null) =>
        deposits
          .addDiscount(tx, d.id, {
            area: "walls",
            note: "Pared rayada",
            amount: "50",
            worseThanEntry,
            photoPath,
          })
          .then(() => null)
          .catch((e: Error) => e.message);
      expect(await add(false, null)).toMatch(/peor/);
      expect(await add(true, null)).toMatch(/foto/);
      expect(
        await add(true, `${businessId}/${residentId}/liquidacion/33333333-3333-4333-8333-333333333333.jpg`),
      ).toBeNull();

      // Fuera de plazo, la base no deja reportar (aunque se salte el servidor).
      await tx.execute(sql`reset role`);
      await tx.execute(sql`update public.contract set start_date = '2020-01-01' where id = ${id}`);
      await actAs(tx, R);
      const [rp] = await rows<{ id: string }>(tx, sql`select id from public.person where user_id = ${R}`);
      expect(
        await fails(
          tx,
          sql`insert into public.entry_report (contract_id, area, note, photo_path, reported_by)
          values (${id}, 'door', 'Tarde', 'x/y/ingreso/z.jpg', ${rp.id})`,
        ),
      ).toBe(true);
    });
  });
});

describe("consultas de Cobros y de Mis pagos", () => {
  it("arma los recibos con pagos parciales y el residente ve cómo pagar", async () => {
    await scenario(async (tx, { residentId, unitId, businessId }) => {
      const { syncBusinessBilling } = await import("@/server/payments/billing");
      const { buildReceipts, coveredCharges, loadBusiness } = await import("@/server/payments/queries");
      const id = await contracts.createContract(tx, contractData({ residentId, unitId }), false);
      // Idempotente: correrlo otra vez no duplica nada.
      await syncBusinessBilling(tx, businessId);
      expect(await chargesOf(tx, id)).toHaveLength(4);
      await payments.registerPayment(
        tx,
        {
          residentId,
          period: "2026-03",
          amount: "700",
          method: "cash",
          paidOn: "2026-03-15",
          operationCode: null,
          proofPath: null,
        },
        A,
      );
      const data = await loadBusiness(tx, businessId);
      const [march] = buildReceipts(data.charges, data.payments, new Map(), "2026-03-20").filter(
        (r) => r.period === "2026-03",
      );
      expect(march).toMatchObject({ total: "929.03", paid: "700.00", balance: "229.03", status: "overdue" });
      // La garantía vence primero: ya quedó pagada aunque el recibo tenga saldo.
      const [dep] = await rows<{ charge_id: string }>(tx, sql`select charge_id from public.deposit`);
      expect(coveredCharges(data).has(dep.charge_id)).toBe(true);

      await actAs(tx, R);
      const info = await rows<{ trade_name: string; payment_methods: unknown }>(
        tx,
        sql`select * from public.my_payment_info()`,
      );
      expect(info.map((i) => i.trade_name)).toEqual(["Residencia A"]);
    });
  });
});

describe("contratos de antes de la Fase 5", () => {
  it("al abrir Cobros reciben sus recibos de renta, pero no una garantía retroactiva", async () => {
    await scenario(async (tx, { residentId, unitId, businessId }) => {
      const { syncBusinessBilling } = await import("@/server/payments/billing");
      const id = await contracts.createContract(tx, contractData({ residentId, unitId }), false);
      // Así quedaría un contrato confirmado antes de la Fase 5: sin recibos ni garantía.
      await tx.execute(sql`reset role`);
      await tx.execute(sql`delete from public.deposit`);
      await tx.execute(sql`delete from public.charge`);
      await actAs(tx, A);
      await syncBusinessBilling(tx, businessId);
      expect((await chargesOf(tx, id)).map((c) => c.concept)).toEqual(["rent", "rent", "rent"]);
      const [n] = await rows<{ n: number }>(tx, sql`select count(*)::int as n from public.deposit`);
      expect(n.n).toBe(0);
    });
  });
});
