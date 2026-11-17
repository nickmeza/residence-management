import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ChatThread } from "@/components/messages/chat-thread";
import { getConversation } from "@/server/messages/queries";

export const metadata: Metadata = { title: "Conversación · Gestión de residencias" };

async function Content({ params }: { params: Promise<{ residentId: string }> }) {
  const { residentId } = await params;
  const c = await getConversation(residentId);
  if (!c) notFound();
  const unread = c.messages.filter((m) => !m.mine && m.readAt === null).length;
  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          <Link href="/mensajes" className="hover:underline">
            Mensajes
          </Link>{" "}
          › <b className="text-foreground">{c.name}</b>
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[28px] font-bold tracking-tight">{c.name}</h1>
          <Link
            href={
              c.service === "residence"
                ? `/residentes/${c.residentId}`
                : `/pension/comensales/${c.residentId}`
            }
            className="inline-flex min-h-11 items-center text-sm font-semibold text-link underline-offset-4 hover:underline"
          >
            Ver ficha
          </Link>
        </div>
      </div>
      <section className="max-w-3xl rounded-xl border bg-card p-5 shadow-card">
        <ChatThread
          side="landlord"
          residentId={c.residentId}
          otherName={c.name}
          messages={c.messages}
          now={new Date()}
          unread={unread}
        />
      </section>
    </>
  );
}

// Una conversación con un residente o comensal.
export default function ConversationPage({ params }: { params: Promise<{ residentId: string }> }) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
      <Content params={params} />
    </Suspense>
  );
}
