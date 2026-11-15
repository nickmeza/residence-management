import Link from "next/link";

import { formatSoles } from "@/lib/format";
import { formatLongDate } from "@/server/contracts/dates";
import type { Receipt } from "@/server/payments/queries";
import { METHOD_LABEL } from "@/server/payments/schemas";

// "Confirmados solos" (decisión del dueño, 2026-11-15): los comprobantes de residentes que coincidían exactamente con lo
// que faltaba del recibo y se confirmaron sin revisión. Están aquí para que el arrendador les eche un ojo; si la foto
// no sirve, entra al recibo y lo anula con un motivo.
export function AutoConfirmedList({ receipts }: { receipts: Receipt[] }) {
  const rows = receipts.flatMap((r) =>
    r.payments
      .filter((p) => p.autoConfirmed && p.status === "confirmed")
      .map((p) => ({ ...p, residentId: r.residentId, residentName: r.residentName })),
  );
  if (!rows.length) return null;
  return (
    <section className="rounded-xl border bg-card p-5 shadow-card" aria-labelledby="confirmados-solos">
      <h2 id="confirmados-solos" className="text-lg font-bold">
        Confirmados solos ({rows.length})
      </h2>
      <p className="text-sm text-muted-foreground">
        Comprobantes que coincidían con lo que faltaba y se confirmaron sin que los revises. Si alguno no está
        bien, ábrelo y anúlalo.
      </p>
      <ul className="mt-2 divide-y">
        {rows.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
            <span className="min-w-0 flex-1">
              <b>{p.residentName}</b> · {formatSoles(p.amount)} · {METHOD_LABEL[p.method]}
              <span className="block text-muted-foreground">
                Pagó el {formatLongDate(p.paidOn)}
                {p.operationCode ? ` · Op. ${p.operationCode}` : ""}
              </span>
            </span>
            <Link
              href={`/cobros/${p.residentId}/${p.period}`}
              className="inline-flex min-h-11 items-center font-semibold text-link underline-offset-4 hover:underline"
            >
              Ver recibo
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
