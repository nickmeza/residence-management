import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { db } from "@/db";
import { renderContractPdf } from "@/server/contracts/pdf";
import { fillTemplate } from "@/server/contracts/template";
import * as m from "@/server/templates/mutations";
import { EXAMPLE_BODY, EXAMPLE_VALUES, templateSchema } from "@/server/templates/schemas";

// Plantillas contra la base real (RLS activo) y el PDF que se arma con ellas. Cada prueba deshace todo.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const A = "00000000-0000-4000-8000-0000000000b1";
const B = "00000000-0000-4000-8000-0000000000b2";

const actAs = (tx: Tx, uid: string) =>
  tx.execute(sql`select set_config('request.jwt.claims', ${JSON.stringify({ sub: uid, role: "authenticated" })}, true),
    set_config('role', 'authenticated', true)`);

const rows = async <T>(tx: Tx, query: ReturnType<typeof sql>) => (await tx.execute(query)) as unknown as T[];

class Rollback extends Error {}

async function withBusiness(fn: (tx: Tx, businessId: string) => Promise<void>) {
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`insert into auth.users (id, email, raw_user_meta_data, aud, role) values
        (${A}, 'b1@prueba.test', '{"full_name":"A"}', 'authenticated', 'authenticated'),
        (${B}, 'b2@prueba.test', '{"full_name":"B"}', 'authenticated', 'authenticated')`);
      await actAs(tx, A);
      const [b] = await rows<{ id: string }>(
        tx,
        sql`insert into public.business (owner_id, service, kind, trade_name)
          select id, 'residence', 'natural', 'Residencia A' from public.person where user_id = ${A} returning id`,
      );
      await fn(tx, b.id);
      throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
}

const template = templateSchema.parse({ name: "Contrato de alquiler", body: EXAMPLE_BODY });

describe("plantillas", () => {
  it("A crea, edita y borra sus plantillas; B no puede tocarlas", async () => {
    await withBusiness(async (tx, businessId) => {
      const id = await m.createTemplate(tx, businessId, template);
      await m.updateTemplate(tx, id, { ...template, name: "Contrato 2026" });
      const [t] = await rows<{ name: string }>(tx, sql`select name from public.contract_template`);
      expect(t.name).toBe("Contrato 2026");

      await actAs(tx, B);
      await expect(m.updateTemplate(tx, id, template)).rejects.toThrow(/No encontramos/);
      await expect(m.deleteTemplate(tx, id)).rejects.toThrow(/No encontramos/);
      await expect(m.createTemplate(tx, businessId, template)).rejects.toThrow(/No encontramos/);

      await actAs(tx, A);
      await m.deleteTemplate(tx, id);
      expect(await rows(tx, sql`select id from public.contract_template`)).toEqual([]);
    });
  });
});

describe("PDF del contrato", () => {
  it("arma un PDF con tildes y ñ", async () => {
    const pdf = await renderContractPdf({
      title: "Contrato de alquiler",
      text: fillTemplate(EXAMPLE_BODY, { ...EXAMPLE_VALUES, nombre: "Señora Núñez" }).text,
      landlordName: "Residencia de ejemplo",
      residentName: "Señora Núñez",
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1000);
  });
});
