"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { withRls } from "@/db/rls";
import { contract, person, resident, review } from "@/db/schema";
import { getSessionClaims } from "@/server/auth/session";
import { limaToday } from "@/server/contracts/dates";
import { reviewReceived } from "@/server/notifications/catalog";
import { residentInfo } from "@/server/notifications/context";
import { notifyOwner } from "@/server/notifications/notify";
import { issuesByPath } from "@/server/onboarding/schema";

import { canReview } from "./rules";

// Calificar la estadía (CR-03, CR-04). El RLS vuelve a comprobar que el contrato terminó y no se renovó.

export type ReviewResult =
  { ok: true } | { ok: false; message: string; fieldErrors?: Record<string, string> };

const score = z.number().int().min(1, "Elige de 1 a 5 estrellas.").max(5);

const reviewSchema = z.object({
  contractId: z.uuid(),
  room: score,
  cleaning: score,
  treatment: score,
  coexistence: score,
  mealPlan: score.nullable(),
  comment: z
    .string()
    .trim()
    .max(1000, "Máximo 1000 letras.")
    .transform((v) => v || null),
  recommends: z.boolean(),
  anonymous: z.boolean(),
});

export async function submitReviewAction(input: unknown): Promise<ReviewResult> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Revisa los campos marcados.", fieldErrors: issuesByPath(parsed.error) };
  }
  const data = parsed.data;
  const claims = await getSessionClaims();
  try {
    const result = await withRls(claims, async (tx): Promise<ReviewResult> => {
      const [c] = await tx
        .select({
          residentId: contract.residentId,
          businessId: resident.businessId,
          status: contract.status,
          endDate: contract.endDate,
        })
        .from(contract)
        .innerJoin(resident, eq(resident.id, contract.residentId))
        .innerJoin(person, eq(person.id, resident.personId))
        .where(and(eq(contract.id, data.contractId), eq(person.userId, claims.sub)))
        .limit(1);
      if (!c) return { ok: false, message: "No encontramos ese contrato. Recarga la página." };
      const [renewal] = await tx
        .select({ id: contract.id })
        .from(contract)
        .where(and(eq(contract.renewedFromId, data.contractId), ne(contract.status, "cancelled")))
        .limit(1);
      const [already] = await tx
        .select({ id: review.id })
        .from(review)
        .where(eq(review.contractId, data.contractId))
        .limit(1);
      const ok = canReview(
        { status: c.status, endDate: c.endDate, renewed: !!renewal, reviewed: !!already },
        limaToday(new Date()),
      );
      if (!ok) return { ok: false, message: "Esta estadía ya no se puede calificar." };
      await tx.insert(review).values({ ...data, residentId: c.residentId, businessId: c.businessId });
      const who = await residentInfo(tx, c.residentId);
      await notifyOwner(
        tx,
        c.businessId,
        reviewReceived(data.anonymous ? null : (who?.name ?? null), data.recommends),
      );
      return { ok: true };
    });
    if (result.ok) {
      revalidatePath("/mi", "layout");
      revalidatePath("/reportes/resenas");
    }
    return result;
  } catch (e) {
    console.error(e);
    return { ok: false, message: "No pudimos guardar tu reseña. Vuelve a intentarlo." };
  }
}
