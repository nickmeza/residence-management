import type { Metadata } from "next";
import { Suspense } from "react";

import { ConversationList } from "@/components/messages/conversation-list";
import { getShellData } from "@/server/business/current";
import { listConversations } from "@/server/messages/queries";

export const metadata: Metadata = { title: "Mensajes · Gestión de residencias" };

async function Content() {
  const { current } = await getShellData();
  if (!current) return <p className="text-muted-foreground">Primero configura tu negocio.</p>;
  const data = await listConversations(current.id);
  if (!data) return <p className="text-muted-foreground">No encontramos tu negocio. Recarga la página.</p>;
  return <ConversationList conversations={data.conversations} people={data.people} now={new Date()} />;
}

// Mensajes (CM-03): conversaciones con residentes o comensales del negocio elegido arriba.
export default function MessagesPage() {
  return (
    <>
      <h1 className="text-[34px] font-bold tracking-tight">Mensajes</h1>
      <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
        <Content />
      </Suspense>
    </>
  );
}
