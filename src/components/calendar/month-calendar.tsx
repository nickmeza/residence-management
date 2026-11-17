import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  eventsByDay,
  KIND_LABEL,
  monthWeeks,
  shiftMonth,
  type CalendarEvent,
  type CalendarKind,
} from "@/server/calendar/rules";

// Cada tipo con su color de los tokens. Siempre lleva el nombre del tipo además del color (CLAUDE.md, sección 9).
const KIND_CLASS: Record<CalendarKind, string> = {
  check_in: "bg-ok-soft text-ok",
  check_out: "bg-warn-soft text-warn",
  receipt: "bg-primary-soft text-primary-text",
  maintenance: "bg-chip text-chip-foreground",
  cleaning: "bg-chip text-chip-foreground",
};

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const monthName = (month: string) =>
  new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${month}-01T00:00:00Z`),
  );
const dayName = (date: string) =>
  new Intl.DateTimeFormat("es-PE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));

function Chip({ e, compact }: { e: CalendarEvent; compact?: boolean }) {
  return (
    <Link
      href={e.href}
      className={cn(
        "block rounded-md px-1.5 py-1 text-xs leading-tight transition-opacity duration-200 hover:opacity-80",
        KIND_CLASS[e.kind],
        e.late && "ring-1 ring-danger",
      )}
    >
      <b>{KIND_LABEL[e.kind]}</b>
      {e.late ? " · atrasado" : ""}
      <span className={cn("block", compact && "truncate")}>{e.label}</span>
    </Link>
  );
}

// Calendario del mes (DB-04). En escritorio y tablet, la cuadrícula de lunes a domingo; en el celular, la lista de
// los días que tienen algo (una cuadrícula de 7 columnas no se lee en 390 px).
export function MonthCalendar({
  month,
  today,
  events,
}: {
  month: string;
  today: string;
  events: CalendarEvent[];
}) {
  const byDay = eventsByDay(events);
  const weeks = monthWeeks(month);
  const days = [...byDay.keys()].filter((d) => d.startsWith(month)).sort();

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/calendario?mes=${shiftMonth(month, -1)}`}
          aria-label="Mes anterior"
          className={buttonVariants({ variant: "outline", className: "size-11" })}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Link>
        <h2 className="min-w-44 text-center text-lg font-bold first-letter:uppercase">{monthName(month)}</h2>
        <Link
          href={`/calendario?mes=${shiftMonth(month, 1)}`}
          aria-label="Mes siguiente"
          className={buttonVariants({ variant: "outline", className: "size-11" })}
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
        {month !== today.slice(0, 7) ? (
          <Link href="/calendario" className={buttonVariants({ variant: "ghost", className: "h-11" })}>
            Hoy
          </Link>
        ) : null}
        <span className="hidden flex-1 sm:block" />
        <ul className="flex flex-wrap gap-1.5 text-xs" aria-label="Tipos">
          {(Object.keys(KIND_LABEL) as CalendarKind[]).map((k) => (
            <li key={k} className={cn("rounded-md px-2 py-1 font-semibold", KIND_CLASS[k])}>
              {KIND_LABEL[k]}
            </li>
          ))}
        </ul>
      </div>

      <section
        className="hidden overflow-hidden rounded-xl border bg-card shadow-card md:block"
        aria-label="Mes"
      >
        <div className="grid grid-cols-7 bg-background text-xs font-bold tracking-wide text-muted-foreground uppercase">
          {WEEKDAYS.map((d) => (
            <span key={d} className="px-2 py-2.5">
              {d}
            </span>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={week[0]} className="grid grid-cols-7 border-t">
            {week.map((d) => {
              const list = byDay.get(d) ?? [];
              const outside = !d.startsWith(month);
              return (
                <div
                  key={d}
                  className={cn(
                    "flex min-h-28 flex-col gap-1 border-l p-1.5 first:border-l-0",
                    outside && "bg-muted/40",
                  )}
                >
                  <span
                    className={cn(
                      "self-start rounded-full px-1.5 text-xs font-semibold",
                      d === today
                        ? "bg-primary text-primary-foreground"
                        : outside
                          ? "text-muted-foreground"
                          : "",
                    )}
                  >
                    {Number(d.slice(8))}
                    {d === today ? <span className="sr-only"> (hoy)</span> : null}
                  </span>
                  {outside ? null : list.slice(0, 3).map((e) => <Chip key={e.key} e={e} compact />)}
                  {!outside && list.length > 3 ? (
                    <span className="px-1 text-xs text-muted-foreground">y {list.length - 3} más</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3 md:hidden" aria-label="Días con algo">
        {days.length
          ? days.map((d) => (
              <div key={d} className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-card">
                <h3 className="font-bold first-letter:uppercase">
                  {dayName(d)}
                  {d === today ? " · Hoy" : ""}
                </h3>
                {(byDay.get(d) ?? []).map((e) => (
                  <Chip key={e.key} e={e} />
                ))}
              </div>
            ))
          : null}
      </section>

      {!events.length ? (
        <section className="rounded-xl border bg-card p-6 shadow-card">
          <h2 className="text-lg font-bold">No hay nada este mes</h2>
          <p className="mt-1 text-muted-foreground">
            Aquí verás los ingresos y salidas, los cobros por vencer y las tareas de mantenimiento y limpieza.
          </p>
        </section>
      ) : null}
    </>
  );
}
