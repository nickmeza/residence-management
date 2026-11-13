"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { StatusBadge, type BadgeTone } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { initials } from "@/lib/greeting";
import { cn } from "@/lib/utils";
import { kitchenChangeAction } from "@/server/pension/actions";
import type { KitchenView } from "@/server/pension/queries";
import { ATTENDANCE_LABEL, MEAL_LABEL, type AttendanceState, type MealType } from "@/server/pension/rules";

const TONE: Record<AttendanceState, BadgeTone> = { coming: "ok", cancelled: "neutral", paused: "warn" };

const GRID = "grid grid-cols-[1.6fr_1fr_.9fr_.6fr_auto] items-center gap-3 px-5";

// Panel de cocina de un día (PN-06, PN-07, PN-08): porciones por comida, quién canceló o pausó, su dieta y la casilla
// "Comió". La cocina puede cancelar o volver a pedir aunque haya pasado la hora límite (la cancelación tardía se cobra).
export function KitchenBoard({ view, meal }: { view: KitchenView; meal: MealType }) {
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();
  const current = view.meals.find((m) => m.type === meal) ?? view.meals[0];
  const isFuture = view.date > view.today;

  const change = (residentId: string, kind: "cancel" | "restore" | "served" | "not_served") =>
    startTransition(async () => {
      const result = await kitchenChangeAction(view.businessId, {
        residentId,
        date: view.date,
        meal: current.type,
        change: kind,
      });
      setMessage(result.ok ? undefined : result.message);
    });

  // Dietas de quienes vienen (para la cocina, PN-08).
  const diets = new Map<string, number>();
  for (const d of current?.diners ?? []) {
    if (d.state === "coming" && d.dietNote) diets.set(d.dietNote, (diets.get(d.dietNote) ?? 0) + 1);
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        {view.meals.map((m) => (
          <Link
            key={m.type}
            href={`?fecha=${view.date}&comida=${m.type}`}
            aria-current={m.type === current?.type ? "true" : undefined}
            className={cn(
              "rounded-xl border bg-card p-5 shadow-card transition-colors duration-200 hover:bg-muted/40",
              m.type === current?.type && "border-primary",
            )}
          >
            <div className="text-sm text-muted-foreground">
              {MEAL_LABEL[m.type]} · {m.startTime}
            </div>
            <div className="mt-1 text-[28px] font-bold">{m.counts.portions}</div>
            <div className="text-sm text-muted-foreground">
              {m.counts.portions === 1 ? "porción" : "porciones"} de {m.diners.length}{" "}
              {m.diners.length === 1 ? "comensal" : "comensales"}
            </div>
          </Link>
        ))}
      </div>

      {current ? (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="overflow-hidden rounded-xl border bg-card shadow-card">
            <div className="flex flex-wrap items-center gap-2 px-5 py-4">
              <h2 className="text-lg font-bold">{MEAL_LABEL[current.type]}</h2>
              {current.menu ? (
                <p className="w-full text-sm whitespace-pre-line text-muted-foreground">
                  {current.menu.dish}
                  {current.menu.hasVegetarian ? "\n(hay opción vegetariana)" : ""}
                </p>
              ) : null}
            </div>
            {current.diners.length ? (
              <div className="overflow-x-auto">
                <div className="min-w-[640px]">
                  <div
                    className={cn(
                      GRID,
                      "border-t bg-background py-3 text-xs font-bold tracking-wide text-muted-foreground uppercase",
                    )}
                  >
                    <span>Comensal</span>
                    <span>Dieta</span>
                    <span>Estado</span>
                    <span>Comió</span>
                    <span className="sr-only">Acciones</span>
                  </div>
                  <ul>
                    {current.diners.map((d) => (
                      <li key={d.residentId} className={cn(GRID, "border-t py-3 text-sm")}>
                        <span className="flex min-w-0 items-center gap-3">
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary-text">
                            {initials(d.name)}
                          </span>
                          <Link
                            href={`/pension/comensales/${d.residentId}`}
                            className="truncate font-semibold underline-offset-4 hover:underline"
                          >
                            {d.name}
                          </Link>
                        </span>
                        <span>{d.dietNote ?? <span className="text-muted-foreground">—</span>}</span>
                        <span>
                          <StatusBadge tone={TONE[d.state]}>{ATTENDANCE_LABEL[d.state]}</StatusBadge>
                        </span>
                        <span>
                          {d.state === "coming" && !isFuture ? (
                            <Checkbox
                              aria-label={`Comió ${d.name}`}
                              checked={d.served}
                              disabled={pending}
                              onCheckedChange={(on) => change(d.residentId, on ? "served" : "not_served")}
                            />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </span>
                        <span>
                          {d.state === "coming" && !d.served ? (
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-11"
                              disabled={pending}
                              onClick={() => change(d.residentId, "cancel")}
                            >
                              Cancelar
                            </Button>
                          ) : d.state === "cancelled" ? (
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-11"
                              disabled={pending}
                              onClick={() => change(d.residentId, "restore")}
                            >
                              Volver a pedir
                            </Button>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="border-t px-5 py-8 text-center text-muted-foreground">
                Nadie tiene esta comida ese día. Agrega comensales en Clientes.
              </p>
            )}
          </section>

          <aside className="flex flex-col gap-5 lg:sticky lg:top-24">
            <section className="rounded-xl border bg-card p-5 shadow-card">
              <h2 className="text-lg font-bold">A preparar · {MEAL_LABEL[current.type]}</h2>
              <div className="mt-2 text-[44px] leading-none font-bold text-primary-text">
                {current.counts.portions}{" "}
                <span className="text-base font-medium text-muted-foreground">
                  {current.counts.portions === 1 ? "porción" : "porciones"}
                </span>
              </div>
              <dl className="mt-3 text-sm">
                <div className="flex justify-between border-t py-2.5">
                  <dt className="text-muted-foreground">Cancelaron</dt>
                  <dd className="font-bold">{current.counts.cancelled}</dd>
                </div>
                {[...diets].map(([diet, n]) => (
                  <div key={diet} className="flex justify-between border-t py-2.5">
                    <dt className="text-muted-foreground">{diet}</dt>
                    <dd className="font-bold">{n}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2 text-xs text-muted-foreground">
                Se podía cancelar hasta el {current.deadline.slice(8, 10)}/{current.deadline.slice(5, 7)} a
                las {current.deadline.slice(11)}. Si cancelas tú después de esa hora, se cobra.
              </p>
            </section>
            {!isFuture ? (
              <section className="rounded-xl border bg-card p-5 shadow-card">
                <h2 className="text-lg font-bold">Comieron</h2>
                <div className="mt-2 flex justify-between text-sm">
                  <b>
                    {current.counts.served} de {current.counts.portions}
                  </b>
                  <span className="text-muted-foreground">
                    {current.counts.portions
                      ? Math.round((current.counts.served / current.counts.portions) * 100)
                      : 0}
                    %
                  </span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-200"
                    style={{
                      width: `${current.counts.portions ? (current.counts.served / current.counts.portions) * 100 : 0}%`,
                    }}
                  />
                </div>
              </section>
            ) : null}
          </aside>
        </div>
      ) : (
        <p className="rounded-xl border bg-card p-6 text-muted-foreground shadow-card">
          {view.serviceDay
            ? "Todavía no configuraste tus comidas. Hazlo en Configuración."
            : "Este día no cocinas: no hay comidas ni se cobra. Puedes cambiar tus días en Configuración."}
        </p>
      )}
      {pending ? (
        <p role="status" className="text-sm text-muted-foreground">
          Guardando…
        </p>
      ) : null}
      <FormMessage message={message} />
    </>
  );
}
