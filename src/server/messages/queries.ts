import "server-only";

import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { withRls } from "@/db/rls";
import { business, message, person, resident } from "@/db/schema";
import { getSessionClaims } from "@/server/auth/session";
import { isUuid } from "@/server/business/queries";
import { getMyShell } from "@/server/residents/self";

import { sortConversations, type ConversationSummary } from "./rules";

export type ChatMessage = { id: string; mine: boolean; body: string; createdAt: Date; readAt: Date | null };

// Conversaciones de un negocio (Residencia o Pensión) y a quién se le puede escribir. null si no es de quien
// inició sesión.
export async function listConversations(businessId: string): Promise<{
  conversations: ConversationSummary[];
  people: { id: string; name: string }[];
} | null> {
  if (!isUuid(businessId)) return null;
  const claims = await getSessionClaims();
  return withRls(claims, async (tx) => {
    const [b] = await tx
      .select({ id: business.id })
      .from(business)
      .where(eq(business.id, businessId))
      .limit(1);
    if (!b) return null;
    const people = await tx
      .select({ id: resident.id, name: person.fullName })
      .from(resident)
      .innerJoin(person, eq(person.id, resident.personId))
      .where(eq(resident.businessId, businessId))
      .orderBy(asc(person.fullName));
    if (!people.length) return { conversations: [], people };
    const ids = people.map((p) => p.id);
    const [last, unread] = await Promise.all([
      tx
        .selectDistinctOn([message.residentId], {
          residentId: message.residentId,
          body: message.body,
          createdAt: message.createdAt,
          fromResident: message.fromResident,
        })
        .from(message)
        .where(inArray(message.residentId, ids))
        .orderBy(message.residentId, desc(message.createdAt)),
      tx
        .select({ residentId: message.residentId, n: sql<number>`count(*)::int` })
        .from(message)
        .where(and(inArray(message.residentId, ids), eq(message.fromResident, true), isNull(message.readAt)))
        .groupBy(message.residentId),
    ]);
    const lastBy = new Map(last.map((m) => [m.residentId, m]));
    const unreadBy = new Map(unread.map((u) => [u.residentId, u.n]));
    const conversations = sortConversations(
      people.map((p) => {
        const m = lastBy.get(p.id);
        return {
          residentId: p.id,
          name: p.name,
          lastBody: m?.body ?? null,
          lastAt: m?.createdAt ?? null,
          lastFromResident: m?.fromResident ?? false,
          unread: unreadBy.get(p.id) ?? 0,
        };
      }),
    );
    return { conversations, people };
  });
}

// Una conversación vista por el arrendador. null si la ficha no es de sus negocios.
export async function getConversation(residentId: string): Promise<{
  residentId: string;
  businessId: string;
  service: "residence" | "meal_plan";
  name: string;
  messages: ChatMessage[];
} | null> {
  if (!isUuid(residentId)) return null;
  const claims = await getSessionClaims();
  return withRls(claims, async (tx) => {
    const [r] = await tx
      .select({
        id: resident.id,
        businessId: resident.businessId,
        service: business.service,
        name: person.fullName,
      })
      .from(resident)
      .innerJoin(person, eq(person.id, resident.personId))
      .innerJoin(business, eq(business.id, resident.businessId))
      .where(eq(resident.id, residentId))
      .limit(1);
    if (!r) return null;
    const rows = await tx
      .select()
      .from(message)
      .where(eq(message.residentId, residentId))
      .orderBy(asc(message.createdAt));
    return {
      residentId: r.id,
      businessId: r.businessId,
      service: r.service,
      name: r.name,
      messages: rows.map((m) => ({
        id: m.id,
        mine: !m.fromResident,
        body: m.body,
        createdAt: m.createdAt,
        readAt: m.readAt,
      })),
    };
  });
}

export type MyThread = { residentId: string; businessName: string; messages: ChatMessage[]; unread: number };

// Las conversaciones del residente: una por cada residencia o pensión donde tiene ficha.
export async function listMyThreads(): Promise<MyThread[]> {
  const [shell, claims] = await Promise.all([getMyShell(), getSessionClaims()]);
  return withRls(claims, async (tx) => {
    const cards = await tx
      .select({ id: resident.id, businessId: resident.businessId })
      .from(resident)
      .innerJoin(person, eq(person.id, resident.personId))
      .where(eq(person.userId, claims.sub));
    if (!cards.length) return [];
    const rows = await tx
      .select()
      .from(message)
      .where(
        inArray(
          message.residentId,
          cards.map((c) => c.id),
        ),
      )
      .orderBy(asc(message.createdAt));
    const names = new Map(shell.contacts.map((c) => [c.businessId, c.businessName]));
    return cards.map((c) => {
      const mine = rows.filter((m) => m.residentId === c.id);
      return {
        residentId: c.id,
        businessName: names.get(c.businessId) ?? "Tu residencia",
        messages: mine.map((m) => ({
          id: m.id,
          mine: m.fromResident,
          body: m.body,
          createdAt: m.createdAt,
          readAt: m.readAt,
        })),
        unread: mine.filter((m) => !m.fromResident && m.readAt === null).length,
      };
    });
  });
}
