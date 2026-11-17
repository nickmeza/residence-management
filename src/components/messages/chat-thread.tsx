"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { textareaClass } from "@/components/form-controls";
import { Button } from "@/components/ui/button";
import { formatTimeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  markReadAsLandlordAction,
  markReadAsResidentAction,
  sendToLandlordAction,
  sendToResidentAction,
} from "@/server/messages/actions";
import type { ChatMessage } from "@/server/messages/queries";

// Una conversación entre el residente y su residencia (CM-03). Al abrirla se marcan como leídos los mensajes del
// otro lado; al enviar, al otro le llega un aviso a la campanita.
export function ChatThread({
  side,
  residentId,
  otherName,
  messages,
  now,
  unread,
}: {
  side: "landlord" | "resident";
  residentId: string;
  otherName: string;
  messages: ChatMessage[];
  now: Date;
  unread: number;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!unread) return;
    const mark = side === "landlord" ? markReadAsLandlordAction : markReadAsResidentAction;
    void mark(residentId).then(() => router.refresh());
  }, [side, residentId, unread, router]);

  const send = () =>
    startTransition(async () => {
      const action = side === "landlord" ? sendToResidentAction : sendToLandlordAction;
      const r = await action(residentId, body);
      if (!r.ok) return setError(r.message);
      setBody("");
      setError(undefined);
      router.refresh();
    });

  const inputId = `mensaje-${residentId}`;
  return (
    <div className="flex flex-col gap-3">
      {messages.length ? (
        <ul className="flex flex-col gap-2.5">
          {messages.map((m) => (
            <li
              key={m.id}
              className={cn(
                "flex max-w-[85%] flex-col gap-0.5 rounded-xl px-3.5 py-2.5 text-sm",
                m.mine ? "self-end bg-primary-soft" : "self-start bg-muted",
              )}
            >
              <span className="text-xs font-semibold text-muted-foreground">
                {m.mine ? "Tú" : otherName} · {formatTimeAgo(m.createdAt, now)}
                {m.mine && m.readAt ? " · Leído" : ""}
              </span>
              <span className="whitespace-pre-line">{m.body}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          {side === "landlord"
            ? "Todavía no se han escrito. Lo que envíes le llegará como aviso."
            : "Todavía no hay mensajes. Escribe tu consulta y te responderán aquí."}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <label htmlFor={inputId} className="sr-only">
          Escribe un mensaje
        </label>
        <textarea
          id={inputId}
          rows={3}
          maxLength={2000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escribe un mensaje"
          className={textareaClass}
        />
        <FormMessage message={error} />
        <Button type="button" className="h-11 self-end" disabled={pending || !body.trim()} onClick={send}>
          {pending ? "Enviando…" : "Enviar"}
        </Button>
      </div>
    </div>
  );
}
