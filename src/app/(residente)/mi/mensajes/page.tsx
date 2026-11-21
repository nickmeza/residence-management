import type { Metadata } from "next";
import { Suspense } from "react";

import { ChatThread } from "@/components/messages/chat-thread";
import { ChatSkeleton } from "@/components/skeletons";
import { listMyThreads } from "@/server/messages/queries";

export const metadata: Metadata = { title: "Mensajes · Mi residencia" };

async function Content() {
  const threads = await listMyThreads();
  if (!threads.length) {
    return (
      <p className="rounded-xl border bg-card p-5 text-muted-foreground shadow-card">
        Cuando tu residencia o tu pensión te agregue, desde aquí podrás escribirles.
      </p>
    );
  }
  const now = new Date();
  return threads.map((t) => (
    <section
      key={t.residentId}
      className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-card"
      aria-label={t.businessName}
    >
      <h2 className="text-lg font-bold">{t.businessName}</h2>
      <ChatThread
        side="resident"
        residentId={t.residentId}
        otherName={t.businessName}
        messages={t.messages}
        now={now}
        unread={t.unread}
      />
    </section>
  ));
}

// Mensajes del residente (CM-03): escribir a su residencia (o pensión) y leer sus respuestas.
export default function MyMessagesPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Mensajes</h1>
      <Suspense fallback={<ChatSkeleton />}>
        <Content />
      </Suspense>
    </>
  );
}
