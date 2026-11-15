"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { markAllNotificationsReadAction } from "@/server/notifications/actions";
import type { MyNotifications } from "@/server/notifications/queries";

import { NotificationItem } from "./notification-item";

type Filter = "all" | "unread";

// Página completa de notificaciones: todas o solo las sin leer, y "Marcar todas como leídas".
export function NotificationFeed({ data, now }: { data: MyNotifications; now: Date }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const items = filter === "unread" ? data.items.filter((n) => !n.read) : data.items;

  const tab = (value: Filter, label: string) => (
    <button
      type="button"
      onClick={() => setFilter(value)}
      aria-pressed={filter === value}
      className={
        "min-h-11 rounded-lg px-3 text-sm font-semibold transition-colors duration-200 " +
        (filter === value ? "bg-primary-soft text-primary-text" : "text-muted-foreground hover:bg-muted")
      }
    >
      {label}
    </button>
  );

  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1" role="group" aria-label="Filtrar notificaciones">
          {tab("all", "Todas")}
          {tab("unread", `Sin leer (${data.unread})`)}
        </div>
        {data.unread ? (
          <Button
            type="button"
            variant="outline"
            className="h-11"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await markAllNotificationsReadAction();
                setError(r.ok ? null : r.message);
                router.refresh();
              })
            }
          >
            {pending ? "Marcando…" : "Marcar todas como leídas"}
          </Button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {items.length ? (
        <ul className="flex flex-col divide-y">
          {items.map((n) => (
            <li key={n.id} className="py-1">
              <NotificationItem item={n} now={now} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-10 text-center text-muted-foreground">
          {filter === "unread" ? "Estás al día: no tienes avisos sin leer." : "Todavía no tienes avisos."}
        </p>
      )}
    </section>
  );
}
