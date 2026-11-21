import "server-only";

import { eq, sql } from "drizzle-orm";

import type { withRls } from "@/db/rls";
import { payment, person, resident } from "@/db/schema";
import { isFolderPathOf } from "@/server/documents/files";
import { paymentProof, paymentReviewed } from "@/server/notifications/catalog";
import { residentInfo } from "@/server/notifications/context";
import { notifyOwner, notifyResident } from "@/server/notifications/notify";

import type { PaymentData } from "./schemas";

// Pagos dentro de una transacción con la sesión (RLS). Las acciones validan el formulario antes.

type Tx = Parameters<Parameters<typeof withRls>[1]>[0];

export class PaymentError extends Error {}

export async function myPersonId(tx: Tx, userId: string) {
  const [me] = await tx.select({ id: person.id }).from(person).where(eq(person.userId, userId)).limit(1);
  if (!me) throw new PaymentError("No encontramos tu cuenta. Vuelve a iniciar sesión.");
  return me.id;
}

// La ficha (y su negocio). El RLS decide si quien inició sesión la ve: el arrendador o el propio residente.
async function card(tx: Tx, residentId: string) {
  const [row] = await tx
    .select({ businessId: resident.businessId })
    .from(resident)
    .where(eq(resident.id, residentId))
    .limit(1);
  if (!row) throw new PaymentError("No encontramos a ese residente. Recarga la página.");
  return row;
}

// El arrendador registra un pago: queda confirmado. El comprobante es opcional (por ejemplo, en efectivo).
export async function registerPayment(tx: Tx, data: PaymentData, userId: string) {
  const { businessId } = await card(tx, data.residentId);
  if (data.proofPath && !isFolderPathOf(data.proofPath, businessId, data.residentId, "comprobantes")) {
    throw new PaymentError("No pudimos usar ese comprobante. Vuelve a subirlo.");
  }
  const me = await myPersonId(tx, userId);
  const [row] = await tx
    .insert(payment)
    .values({ ...data, status: "confirmed", submittedBy: me, reviewedBy: me, reviewedAt: new Date() })
    .returning({ id: payment.id });
  return { id: row.id, businessId };
}

// El residente manda su comprobante (PG-08): queda en revisión hasta que el arrendador lo vea.
export async function submitProof(tx: Tx, data: PaymentData, userId: string) {
  const { businessId } = await card(tx, data.residentId);
  if (!data.proofPath || !isFolderPathOf(data.proofPath, businessId, data.residentId, "comprobantes")) {
    throw new PaymentError("Sube la foto o el PDF de tu comprobante.");
  }
  const me = await myPersonId(tx, userId);
  const [row] = await tx
    .insert(payment)
    .values({ ...data, status: "in_review", submittedBy: me })
    .returning({ id: payment.id });
  // Si es exactamente lo que falta del recibo, la base lo confirma sola (decisión del dueño, 2026-11-15).
  const [check] = (await tx.execute(
    sql`select public.auto_confirm_my_payment(${row.id}::uuid) as confirmed`,
  )) as unknown as { confirmed: boolean }[];
  const autoConfirmed = Boolean(check?.confirmed);
  const who = await residentInfo(tx, data.residentId);
  if (who) {
    await notifyOwner(
      tx,
      businessId,
      paymentProof(who.name, data.amount, data.period, data.residentId, autoConfirmed),
    );
  }
  return { id: row.id, businessId, autoConfirmed };
}

// El arrendador confirma o rechaza un comprobante (PG-09). Uno ya revisado no se vuelve a revisar; un pago
// confirmado por error se rechaza con un motivo (queda en la bitácora).
export async function reviewPayment(
  tx: Tx,
  id: string,
  review: { status: "confirmed" } | { status: "rejected"; reason: string },
  userId: string,
) {
  const me = await myPersonId(tx, userId);
  const [current] = await tx
    .select({
      status: payment.status,
      residentId: payment.residentId,
      period: payment.period,
      amount: payment.amount,
    })
    .from(payment)
    .where(eq(payment.id, id))
    .limit(1);
  if (!current) throw new PaymentError("No encontramos ese pago. Recarga la página.");
  if (current.status === "rejected") throw new PaymentError("Ese pago ya fue rechazado.");
  if (current.status === "confirmed" && review.status === "confirmed") {
    throw new PaymentError("Ese pago ya está confirmado.");
  }
  await tx
    .update(payment)
    .set({
      status: review.status,
      rejectionReason: review.status === "rejected" ? review.reason : null,
      reviewedBy: me,
      reviewedAt: new Date(),
    })
    .where(eq(payment.id, id));
  await notifyResident(
    tx,
    current.residentId,
    paymentReviewed(
      current.amount,
      current.period,
      review.status,
      review.status === "rejected" ? review.reason : null,
      current.status === "confirmed",
    ),
  );
  return current;
}
