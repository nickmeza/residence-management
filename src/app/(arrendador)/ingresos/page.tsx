import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ListSkeleton } from "@/components/skeletons";
import { StatusBadge } from "@/components/status-badge";
import { formatLongDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getShellData } from "@/server/business/current";
import { limaToday } from "@/server/contracts/dates";
import { listMoves } from "@/server/moves/queries";
import { MOVE_LABEL, type UpcomingMove } from "@/server/moves/rules";

export const metadata: Metadata = { title: "Ingresos y salidas · Gestión de residencias" };

const GRID = "grid grid-cols-[1fr_1.4fr_1fr_1.2fr_1fr] items-center gap-3 px-5";
const hour = new Intl.DateTimeFormat("es-PE", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Lima",
});

function MoveState({ m, today }: { m: UpcomingMove; today: string }) {
  if (m.done) return <StatusBadge tone="ok">Hecho</StatusBadge>;
  if (m.date < today) return <StatusBadge tone="danger">Atrasado</StatusBadge>;
  if (m.scheduledAt) return <StatusBadge tone="primary">Cita a las {hour.format(m.scheduledAt)}</StatusBadge>;
  return <StatusBadge tone="warn">Sin cita</StatusBadge>;
}

async function Content() {
  const { current } = await getShellData();
  if (!current) return <p className="text-muted-foreground">Primero configura tu negocio.</p>;
  if (current.service !== "residence") {
    return <p className="text-muted-foreground">Ingresos y salidas es de un negocio de Residencia.</p>;
  }
  const moves = await listMoves(current.id);
  if (!moves) return <p className="text-muted-foreground">No encontramos tu negocio. Recarga la página.</p>;
  const today = limaToday(new Date());
  if (!moves.length) {
    return (
      <section className="rounded-xl border bg-card p-6 shadow-card">
        <h2 className="text-lg font-bold">No hay ingresos ni salidas en los próximos 30 días</h2>
        <p className="mt-1 text-muted-foreground">
          Salen solos de las fechas de inicio y fin de los contratos confirmados.
        </p>
      </section>
    );
  }
  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-card">
      {/* En móvil la tabla se desliza de lado. */}
      <div className="overflow-x-auto">
        <div className="min-w-[680px]">
          <div
            className={cn(
              GRID,
              "bg-background py-3 text-xs font-bold tracking-wide text-muted-foreground uppercase",
            )}
          >
            <span>Qué</span>
            <span>Residente</span>
            <span>Unidad</span>
            <span>Fecha</span>
            <span>Estado</span>
          </div>
          <ul>
            {moves.map((m) => (
              <li key={`${m.id}-${m.kind}`} className={cn(GRID, "border-t py-3.5 text-sm")}>
                <Link
                  href={`/ingresos/${m.id}?tipo=${m.kind === "check_in" ? "ingreso" : "salida"}`}
                  className="font-semibold text-link hover:underline"
                >
                  {MOVE_LABEL[m.kind]}
                </Link>
                <span className="truncate">{m.residentName}</span>
                <span className="truncate">{m.unitName}</span>
                <span>{m.date === today ? "Hoy" : formatLongDate(m.date)}</span>
                <span>
                  <MoveState m={m} today={today} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

// Ingresos y salidas (DB-02, CT-06, CT-07): quién entra y quién sale en los próximos 30 días (y lo atrasado).
export default function MovesPage() {
  return (
    <>
      <h1 className="text-[34px] font-bold tracking-tight">Ingresos y salidas</h1>
      <Suspense fallback={<ListSkeleton />}>
        <Content />
      </Suspense>
    </>
  );
}
