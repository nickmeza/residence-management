"use client";

import { Copy, Pencil, Trash2 } from "lucide-react";

import { ConfirmButton } from "@/components/confirm-button";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { formatLongDate } from "@/lib/format";
import { isFilled } from "@/server/pension/menu-moves";
import { MEAL_LABEL } from "@/server/pension/rules";

import { DishList, MealIcon, VegBadge } from "./menu-parts";
import type { MenuBoard } from "./use-menu-board";

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Debajo de la semana: el día elegido con todos sus platos y sus acciones (editar, vaciar o copiar).
export function DayDetail({ board, date, onEdit }: { board: MenuBoard; date: string; onEdit: () => void }) {
  const { view } = board;
  const past = board.isPast(date);
  const service = board.isService(date);
  const hasMenu = board.dayHasMenu(date);
  return (
    <section
      aria-labelledby="dia-elegido"
      className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="dia-elegido" className="text-xl font-extrabold">
            {capital(formatLongDate(date))}
          </h2>
          {date === view.today ? <StatusBadge tone="primary">Hoy</StatusBadge> : null}
          {past ? <StatusBadge tone="neutral">Ya pasó</StatusBadge> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {board.isEditable(date) ? (
            <Button type="button" variant="outline" className="h-10" onClick={onEdit}>
              <Pencil aria-hidden="true" />
              Editar día
            </Button>
          ) : null}
          {board.isEditable(date) && hasMenu ? (
            <ConfirmButton
              trigger={
                <Button type="button" variant="outline" className="h-10 text-danger">
                  <Trash2 aria-hidden="true" />
                  Vaciar día
                </Button>
              }
              title="¿Vaciar este día?"
              description={`Se borran todas las comidas del ${formatLongDate(date)}. Se aplica cuando guardas o publicas.`}
              confirmLabel="Vaciar día"
              onConfirm={() => board.clearDay(date)}
            />
          ) : null}
          {past && hasMenu ? (
            <Button type="button" variant="outline" className="h-10" onClick={() => board.copy({ kind: "day", date })}>
              <Copy aria-hidden="true" />
              Copiar día
            </Button>
          ) : null}
        </div>
      </div>

      {!service ? (
        <p className="text-muted-foreground">Este día no cocinas. Lo cambias en Configuración › Comidas y planes.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          {view.meals.map((meal) => {
            const c = board.cell(date, meal);
            return (
              <div key={meal} className="flex flex-col overflow-hidden rounded-xl border">
                <div className="flex items-center justify-between gap-2 bg-chip px-4 py-3">
                  <span className="flex items-center gap-2 font-bold">
                    <MealIcon meal={meal} className="size-[18px]" />
                    {MEAL_LABEL[meal]}
                  </span>
                  <span className="text-xs text-muted-foreground">{view.mealTimes[meal]}</span>
                </div>
                <div className="flex flex-col gap-2 p-4 text-[15px]">
                  {isFilled(c) ? (
                    <>
                      <DishList dish={c.dish} />
                      {c.hasVegetarian ? <VegBadge long /> : null}
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">Sin menú.</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
