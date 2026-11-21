import type { Metadata } from "next";
import { Suspense } from "react";

import { MonthCalendar } from "@/components/calendar/month-calendar";
import { CalendarSkeleton, Reveal } from "@/components/skeletons";
import { getShellData } from "@/server/business/current";
import { getCalendar } from "@/server/calendar/queries";
import { parseMonth } from "@/server/calendar/rules";
import { limaToday } from "@/server/contracts/dates";

export const metadata: Metadata = { title: "Calendario · Gestión de residencias" };

type Props = { searchParams: Promise<{ mes?: string }> };

async function Content({ searchParams }: Props) {
  const { current } = await getShellData();
  if (!current) return <p className="text-muted-foreground">Primero configura tu negocio.</p>;
  if (current.service !== "residence") {
    return <p className="text-muted-foreground">El calendario es de un negocio de Residencia.</p>;
  }
  const today = limaToday(new Date());
  const month = parseMonth((await searchParams).mes, today);
  const events = await getCalendar(current.id, month);
  if (!events) return <p className="text-muted-foreground">No encontramos tu negocio. Recarga la página.</p>;
  return <MonthCalendar month={month} today={today} events={events} />;
}

// Calendario general (DB-04): ingresos, salidas, cobros, mantenimiento y limpieza del mes.
export default function CalendarPage({ searchParams }: Props) {
  return (
    <>
      <h1 className="text-[34px] font-bold tracking-tight">Calendario</h1>
      <Suspense
        fallback={
          <CalendarSkeleton
            messages={[
              "Buscando ingresos y salidas…",
              "Agregando los cobros del mes…",
              "Poniendo tareas y limpiezas…",
            ]}
          />
        }
      >
        <Reveal>
          <Content searchParams={searchParams} />
        </Reveal>
      </Suspense>
    </>
  );
}
