"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { textareaClass } from "@/components/form-controls";
import { Button } from "@/components/ui/button";
import { formatTimeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { addCommentAction } from "@/server/maintenance/actions";
import type { RequestComment } from "@/server/maintenance/queries";

// Conversación de un pedido: lo que escriben el arrendador y el residente. Al otro le llega un aviso.
export function CommentThread({
  requestId,
  comments,
  now,
  closed,
}: {
  requestId: string;
  comments: RequestComment[];
  now: Date;
  closed: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const send = () =>
    startTransition(async () => {
      const r = await addCommentAction(requestId, { body });
      if (!r.ok) return setError(r.fieldErrors?.body ?? r.message);
      setBody("");
      setError(undefined);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-3">
      {comments.length ? (
        <ul className="flex flex-col gap-2.5">
          {comments.map((c) => (
            <li
              key={c.id}
              className={cn(
                "flex max-w-[85%] flex-col gap-0.5 rounded-xl px-3.5 py-2.5 text-sm",
                c.mine ? "self-end bg-primary-soft" : "self-start bg-muted",
              )}
            >
              <span className="text-xs font-semibold text-muted-foreground">
                {c.mine ? "Tú" : c.authorName} · {formatTimeAgo(c.createdAt, now)}
              </span>
              <span className="whitespace-pre-line">{c.body}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Todavía no hay mensajes.</p>
      )}
      {closed ? null : (
        <div className="flex flex-col gap-2">
          <label htmlFor={`comentario-${requestId}`} className="sr-only">
            Escribe un mensaje
          </label>
          <textarea
            id={`comentario-${requestId}`}
            rows={2}
            maxLength={1000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Escribe un mensaje (por ejemplo: pasamos el jueves en la tarde)"
            className={textareaClass}
          />
          <FormMessage message={error} />
          <Button type="button" className="h-11 self-end" disabled={pending || !body.trim()} onClick={send}>
            {pending ? "Enviando…" : "Enviar"}
          </Button>
        </div>
      )}
    </div>
  );
}
