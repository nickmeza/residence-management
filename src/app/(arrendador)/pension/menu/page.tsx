import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { currentPension, NotAPension, PensionHeader } from "@/components/pension/pension-page";
import { WeekMenuEditor } from "@/components/pension/week-menu-editor";
import { buttonVariants } from "@/components/ui/button";
import { formatShortDate } from "@/lib/format";
import { limaToday } from "@/server/contracts/dates";
import { getWeekMenu } from "@/server/pension/queries";
import { addDays, weekOf } from "@/server/pension/rules";

export const metadata: Metadata = { title: "Pensión · Menú · Gestión de residencias" };

type Props = PageProps<"/pension/menu">;

// Pensión › Menú: la semana de ?semana=AAAA-MM-DD (cualquier día de esa semana); por defecto, esta semana.
async function Content({ searchParams }: Pick<Props, "searchParams">) {
  const pension = await currentPension();
  if (!pension) return <NotAPension />;
  const query = await searchParams;
  const today = limaToday(new Date());
  const asked =
    typeof query.semana === "string" && /^\d{4}-\d{2}-\d{2}$/.test(query.semana) ? query.semana : today;
  const days = weekOf(asked);
  const view = await getWeekMenu(pension.id, days);
  if (!view) return <p className="text-muted-foreground">No encontramos tu pensión. Recarga la página.</p>;
  const thisWeek = days.includes(today);
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`?semana=${addDays(days[0], -7)}`}
          aria-label="Semana anterior"
          className={buttonVariants({ variant: "outline", size: "icon", className: "size-11" })}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Link>
        <h2 className="text-xl font-bold">
          {thisWeek ? "Esta semana · " : ""}
          {formatShortDate(days[0])} al {formatShortDate(days[6])}
        </h2>
        <Link
          href={`?semana=${addDays(days[0], 7)}`}
          aria-label="Semana siguiente"
          className={buttonVariants({ variant: "outline", size: "icon", className: "size-11" })}
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
        {!thisWeek ? (
          <Link href="/pension/menu" className={buttonVariants({ variant: "ghost", className: "h-11" })}>
            Volver a esta semana
          </Link>
        ) : null}
      </div>
      <WeekMenuEditor view={view} />
    </>
  );
}

export default function PensionMenuPage({ searchParams }: Props) {
  return (
    <>
      <PensionHeader
        tab="menu"
        description="Qué se sirve cada día. Tus comensales lo ven cuando lo publicas."
      />
      <Suspense fallback={<p className="text-muted-foreground">Cargando el menú…</p>}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  );
}
