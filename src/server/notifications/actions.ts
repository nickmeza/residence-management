"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { withRls } from "@/db/rls";
import { notification } from "@/db/schema";
import { getSessionClaims } from "@/server/auth/session";
import { isUuid } from "@/server/business/queries";

// Marcar notificaciones como leídas. El RLS solo deja tocar las propias, así que no hace falta filtrar por persona.

export type NotificationResult = { ok: true } | { ok: false; message: string };

async function run(change: Parameters<typeof withRls<unknown>>[1]): Promise<NotificationResult> {
  const claims = await getSessionClaims();
  try {
    await withRls(claims, change);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "No pudimos marcarla. Vuelve a intentarlo." };
  }
}

export async function markNotificationReadAction(id: string): Promise<NotificationResult> {
  if (!isUuid(id)) return { ok: false, message: "No encontramos ese aviso." };
  return run((tx) =>
    tx
      .update(notification)
      .set({ readAt: new Date() })
      .where(and(eq(notification.id, id), isNull(notification.readAt))),
  );
}

export async function markAllNotificationsReadAction(): Promise<NotificationResult> {
  return run((tx) => tx.update(notification).set({ readAt: new Date() }).where(isNull(notification.readAt)));
}
