"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { selectClass } from "@/components/form-controls";
import { StatusBadge } from "@/components/status-badge";
import { Input } from "@/components/ui/input";
import { formatTimeAgo } from "@/lib/format";
import type { ConversationSummary } from "@/server/messages/rules";

// Lista de conversaciones del negocio (CM-03): las que tienen algo sin leer arriba. "Escribir a…" abre la
// conversación con cualquier residente o comensal.
export function ConversationList({
  conversations,
  people,
  now,
}: {
  conversations: ConversationSummary[];
  people: { id: string; name: string }[];
  now: Date;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = conversations.filter((c) => !q || c.name.toLowerCase().includes(q));

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative w-full sm:w-72">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            aria-label="Buscar"
            type="search"
            placeholder="Buscar por nombre"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 pl-9"
          />
        </div>
        <span className="hidden flex-1 sm:block" />
        {people.length ? (
          <select
            aria-label="Escribir a"
            className={`${selectClass} sm:w-64`}
            value=""
            onChange={(e) => e.target.value && router.push(`/mensajes/${e.target.value}`)}
          >
            <option value="">Escribir a…</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      {!conversations.length ? (
        <section className="rounded-xl border bg-card p-6 shadow-card">
          <h2 className="text-lg font-bold">Todavía no hay mensajes</h2>
          <p className="mt-1 text-muted-foreground">
            {people.length
              ? "Cuando alguien te escriba desde su cuenta, aparecerá aquí. También puedes escribirle tú con “Escribir a…”."
              : "Cuando tengas residentes o comensales, podrán escribirte desde su cuenta."}
          </p>
        </section>
      ) : (
        <section className="overflow-hidden rounded-xl border bg-card shadow-card">
          {shown.length ? (
            <ul>
              {shown.map((c, i) => (
                <li key={c.residentId} className={i ? "border-t" : undefined}>
                  <Link
                    href={`/mensajes/${c.residentId}`}
                    className="flex min-h-16 items-center gap-3 px-5 py-3 transition-colors duration-200 hover:bg-muted"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-semibold">{c.name}</span>
                      <span className="truncate text-sm text-muted-foreground">
                        {c.lastFromResident ? "" : "Tú: "}
                        {c.lastBody}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1 text-xs text-muted-foreground">
                      {c.lastAt ? formatTimeAgo(c.lastAt, now) : null}
                      {c.unread ? (
                        <StatusBadge tone="primary">
                          {c.unread === 1 ? "1 sin leer" : `${c.unread} sin leer`}
                        </StatusBadge>
                      ) : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-8 text-center text-muted-foreground">Nadie con ese nombre.</p>
          )}
        </section>
      )}
    </>
  );
}
