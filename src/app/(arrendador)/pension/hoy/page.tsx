import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { KitchenBoard } from "@/components/pension/kitchen-board";
import { currentPension, NotAPension, PensionHeader } from "@/components/pension/pension-page";
import { buttonVariants } from "@/components/ui/button";
import { limaToday, formatLongDate } from "@/server/contracts/dates";
import { getKitchenDay } from "@/server/pension/queries";
import { addDays, MEAL_TYPES, type MealType } from "@/server/pension/rules";

export const metadata: Metadata = { title: "Pensión · Hoy · Gestión de residencias" };

type Props = PageProps<"/pension/hoy">;

// Pensión › Hoy: el panel de cocina de un día (por defecto, hoy en Lima). ?fecha=AAAA-MM-DD&comida=lunch
async function Content({ searchParams }: Pick<Props, "searchParams">) {
  const pension = await currentPension();
  if (!pension) return <NotAPension />;
  const query = await searchParams;
  const today = limaToday(new Date());
  const date =
    typeof query.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(query.fecha) ? query.fecha : today;
  const view = await getKitchenDay(pension.id, date);
  if (!view) return <p className="text-muted-foreground">No encontramos tu pensión. Recarga la página.</p>;
  const asked = typeof query.comida === "string" ? query.comida : "";
  const meal = (MEAL_TYPES as string[]).includes(asked)
    ? (asked as MealType)
    : // Por defecto, la próxima comida del día que todavía tiene porciones.
      (view.meals.find((m) => m.counts.portions > 0)?.type ?? view.meals[0]?.type ?? "lunch");

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`?fecha=${addDays(date, -1)}`}
          aria-label="Día anterior"
          className={buttonVariants({ variant: "outline", size: "icon", className: "size-11" })}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Link>
        <h2 className="min-w-0 flex-1 text-xl font-bold sm:flex-none">
          {date === today ? "Hoy, " : ""}
          {formatLongDate(date)}
        </h2>
        <Link
          href={`?fecha=${addDays(date, 1)}`}
          aria-label="Día siguiente"
          className={buttonVariants({ variant: "outline", size: "icon", className: "size-11" })}
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
        {date !== today ? (
          <Link href="/pension/hoy" className={buttonVariants({ variant: "ghost", className: "h-11" })}>
            Volver a hoy
          </Link>
        ) : null}
        <span className="hidden flex-1 sm:block" />
        <Link href="/pension/menu" className={buttonVariants({ variant: "outline", className: "h-11" })}>
          Ver menú semanal
        </Link>
      </div>
      <KitchenBoard view={view} meal={meal} />
    </>
  );
}

export default function PensionTodayPage({ searchParams }: Props) {
  return (
    <>
      <PensionHeader
        tab="hoy"
        description="Cuántas porciones preparar y quién ya comió. Por defecto se cocina para todos; aquí ves quién canceló."
      />
      <Suspense fallback={<p className="text-muted-foreground">Cargando la cocina…</p>}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  );
}
