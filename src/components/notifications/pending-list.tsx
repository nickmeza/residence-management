import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
import type { PendingItem } from "@/server/notifications/pending";

// Bloque "Pendientes": lo que espera una acción, calculado al abrir la pantalla. Sin nada pendiente, lo dice.
export function PendingList({ items, title = "Pendientes" }: { items: PendingItem[]; title?: string }) {
  return (
    <section
      className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card"
      aria-labelledby="pendientes"
    >
      <h2 id="pendientes" className="text-lg font-bold">
        {title}
      </h2>
      {items.length ? (
        <ul className="flex flex-col divide-y">
          {items.map((i) => (
            <li key={i.key}>
              <Link
                href={i.href}
                className="flex min-h-12 items-center gap-3 py-2 text-sm font-semibold transition-colors duration-200 hover:text-primary-text"
              >
                <span className="flex-1">{i.label}</span>
                {i.urgent ? <StatusBadge tone="warn">Urgente</StatusBadge> : null}
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">Estás al día: no hay nada pendiente.</p>
      )}
    </section>
  );
}
