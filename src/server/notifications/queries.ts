import "server-only";

import { desc, isNull, sql } from "drizzle-orm";
import { cache } from "react";

import { withRls } from "@/db/rls";
import { notification } from "@/db/schema";
import { getSessionClaims } from "@/server/auth/session";

import type { NotificationType } from "./catalog";

export type MyNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  urgent: boolean;
  createdAt: Date;
  read: boolean;
};

export type MyNotifications = { unread: number; items: MyNotification[] };

const EMPTY: MyNotifications = { unread: 0, items: [] };

// Las notificaciones de quien inició sesión, las más nuevas primero (el RLS solo deja ver las propias). Si la tabla
// todavía no existe (migración 0020 sin aplicar), la campanita queda vacía en lugar de romper la pantalla.
export const getMyNotifications = cache(async (limit = 8): Promise<MyNotifications> => {
  const claims = await getSessionClaims();
  try {
    return await withRls(claims, async (tx) => {
      const [{ n }] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(notification)
        .where(isNull(notification.readAt));
      const rows = await tx.select().from(notification).orderBy(desc(notification.createdAt)).limit(limit);
      return {
        unread: n,
        items: rows.map((r) => ({
          id: r.id,
          type: r.type as NotificationType,
          title: r.title,
          body: r.body,
          link: r.link,
          urgent: r.urgent,
          createdAt: r.createdAt,
          read: r.readAt !== null,
        })),
      };
    });
  } catch (e) {
    console.error("No se pudieron leer las notificaciones", e);
    return EMPTY;
  }
});
