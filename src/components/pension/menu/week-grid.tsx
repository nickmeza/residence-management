"use client";

import { Copy, GripVertical } from "lucide-react";

import { ConfirmButton } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import { formatDayMonth, formatLongDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { isFilled } from "@/server/pension/menu-moves";
import { MEAL_LABEL, WEEKDAY_LABEL, isoWeekday, type MealType } from "@/server/pension/rules";

import { DishList, HANDLE_CLASS, MealIcon, VegBadge } from "./menu-parts";
import type { MenuBoard, MenuItemRef } from "./use-menu-board";
import type { DragState, useMenuDrag } from "./use-menu-drag";

type Handle = ReturnType<typeof useMenuDrag<MenuItemRef>>["handle"];

const dayNumber = formatDayMonth;

// Semana en 7 tarjetas (escritorio). Se arrastra un día desde su título y una comida desde el suyo.
export function WeekGrid({
  board,
  drag,
  handle,
  selected,
  onSelect,
  onEdit,
}: {
  board: MenuBoard;
  drag: DragState<MenuItemRef> | null;
  handle: Handle;
  selected: string;
  onSelect: (date: string) => void;
  onEdit: (date: string, meal?: MealType) => void;
}) {
  const { view } = board;
  // Solo los días que la pensión cocina (los demás no se muestran; decisión del dueño, 2026-11-13).
  const days = board.shownDays;
  return (
    <div className="overflow-x-auto pb-2">
      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
          minWidth: `${days.length * 148}px`,
        }}
      >
        {days.map((date) => {
          const label = `${WEEKDAY_LABEL[isoWeekday(date)]} ${dayNumber(date)}`;
          const past = board.isPast(date);
          const today = date === view.today;
          const dayDrag = drag?.item.kind === "day" ? drag.item : null;
          const dayTarget = dayDrag ? board.canDrop(dayDrag, date) : false;
          const dayOver = dayTarget && drag?.overDate === date;
          const daySource = dayDrag?.date === date;
          const canMoveDay = !past && board.dayHasMenu(date) && !board.clip;
          const dayClip = board.clip?.kind === "day" ? board.clip : null;
          return (
            <article
              key={date}
              data-drop-date={date}
              aria-label={label}
              className={cn(
                "flex flex-col overflow-hidden rounded-xl border bg-card shadow-card transition-[opacity,outline-color] duration-200",
                today && "border-2 border-primary",
                selected === date && !today && "border-primary/60",
                daySource && "border-2 border-dashed border-input opacity-45",
                dayDrag && !daySource && !dayTarget && "opacity-45",
                dayTarget && "outline-2 outline-offset-2 outline-primary outline-dashed",
                dayOver && "bg-primary-soft outline-3 outline-solid",
              )}
            >
              <div
                {...(canMoveDay ? handle({ kind: "day", date }) : {})}
                className={cn(
                  "flex items-start justify-between gap-1 py-2.5 pr-1.5 pl-3",
                  today ? "bg-primary text-primary-foreground" : past && "text-muted-foreground",
                  canMoveDay && HANDLE_CLASS,
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(date)}
                  aria-pressed={selected === date}
                  className="flex min-h-11 flex-col items-start rounded-md text-left"
                >
                  <span className="text-[17px] font-extrabold">{WEEKDAY_LABEL[isoWeekday(date)]}</span>
                  <span className={cn("text-[13px]", today ? "opacity-90" : "text-muted-foreground")}>
                    {dayNumber(date)}
                  </span>
                </button>
                <span className="flex items-center gap-0.5">
                  {today ? (
                    <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary-text">
                      Hoy
                    </span>
                  ) : null}
                  {past ? (
                    <span className="rounded-full bg-chip px-2 py-0.5 text-[11px] font-bold text-chip-foreground">
                      Pasó
                    </span>
                  ) : null}
                  {past && board.dayHasMenu(date) && !drag ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      data-no-drag
                      aria-label={`Copiar el ${formatLongDate(date)} completo`}
                      title="Copiar día"
                      onClick={() => board.copy({ kind: "day", date })}
                    >
                      <Copy aria-hidden="true" />
                    </Button>
                  ) : null}
                  {canMoveDay ? (
                    <GripVertical
                      className={cn("size-4", today ? "text-primary-foreground" : "text-muted-foreground")}
                      aria-hidden="true"
                    />
                  ) : null}
                </span>
              </div>

              {view.meals.map((meal) => (
                <MealSlot
                  key={meal}
                  board={board}
                  drag={drag}
                  handle={handle}
                  date={date}
                  meal={meal}
                  onEdit={onEdit}
                />
              ))}

              {dayDrag && dayTarget ? (
                <span
                  className={cn(
                    "m-2.5 mt-auto rounded-lg px-2 py-2 text-center text-xs font-bold",
                    dayOver ? "bg-primary text-primary-foreground" : "border border-primary bg-card text-primary-text",
                  )}
                >
                  {dayOver
                    ? board.dropSwaps(dayDrag, date)
                      ? "Suelta: se intercambian los días"
                      : "Suelta aquí"
                    : "Soltar aquí"}
                </span>
              ) : null}
              {dayClip && board.canPaste(date) ? (
                <div className="mt-auto p-2.5">
                  <PasteButton board={board} date={date} label="Pegar día aquí" />
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}

// Una comida dentro de la tarjeta del día.
function MealSlot({
  board,
  drag,
  handle,
  date,
  meal,
  onEdit,
}: {
  board: MenuBoard;
  drag: DragState<MenuItemRef> | null;
  handle: Handle;
  date: string;
  meal: MealType;
  onEdit: (date: string, meal?: MealType) => void;
}) {
  const c = board.cell(date, meal);
  const filled = isFilled(c);
  const past = board.isPast(date);
  const item = drag?.item.kind === "meal" ? drag.item : null;
  const clip = board.clip?.kind === "meal" ? board.clip : null;
  const isSource = item?.date === date && item.meal === meal;
  const sameMeal = (item ?? clip)?.meal === meal;
  const target = item && sameMeal ? board.canDrop(item, date) : false;
  const over = target && drag?.overDate === date;
  const pasteTarget = clip && sameMeal && board.canPaste(date);
  const copied = clip?.date === date && clip.meal === meal;
  const dim = (item || clip) && !isSource && !target && !pasteTarget && !copied;
  const canMove = filled && !past && !board.clip;

  return (
    <section
      className={cn(
        "flex flex-col gap-1.5 border-t px-3 pt-2 pb-3 text-sm transition-[opacity,background-color] duration-200",
        isSource && "bg-chip",
        target && "bg-primary-soft outline-2 -outline-offset-4 outline-primary outline-dashed",
        over && "outline-3 outline-solid",
        dim && "opacity-40",
      )}
    >
      <div
        {...(canMove ? handle({ kind: "meal", date, meal }) : {})}
        className={cn("flex min-h-7 flex-wrap items-center justify-between gap-1", canMove && HANDLE_CLASS)}
      >
        <h3 className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-muted-foreground uppercase">
          <MealIcon meal={meal} className="size-[15px]" />
          {MEAL_LABEL[meal]}
        </h3>
        {canMove ? (
          <GripVertical
            className="size-4 text-muted-foreground"
            aria-label={`Arrastra para mover el ${MEAL_LABEL[meal].toLowerCase()} del ${formatLongDate(date)}`}
          />
        ) : null}
        {past && filled && !drag && !board.clip ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            data-no-drag
            aria-label={`Copiar el ${MEAL_LABEL[meal].toLowerCase()} del ${formatLongDate(date)}`}
            title="Copiar"
            onClick={() => board.copy({ kind: "meal", date, meal })}
          >
            <Copy aria-hidden="true" />
          </Button>
        ) : null}
        {(item || clip) && sameMeal && past && !copied ? (
          <span className="text-[11px] font-bold whitespace-nowrap text-chip-foreground">Ya pasó</span>
        ) : null}
        {copied ? (
          <span className="rounded-full bg-ok-soft px-2 py-0.5 text-[11px] font-bold whitespace-nowrap text-ok">
            Copiado
          </span>
        ) : null}
      </div>

      {isSource ? (
        <span className="rounded-lg border-2 border-dashed border-input px-2 py-3 text-center text-[13px] font-semibold text-muted-foreground">
          Moviendo…
        </span>
      ) : filled ? (
        <>
          <DishList dish={c.dish} limit={4} muted={past} />
          {c.hasVegetarian ? <VegBadge /> : null}
        </>
      ) : past ? (
        <span className="text-[13px] text-muted-foreground">Sin menú</span>
      ) : !target && !pasteTarget ? (
        <button
          type="button"
          data-no-drag
          onClick={() => onEdit(date, meal)}
          className="min-h-9 self-start rounded-lg border border-dashed border-input px-2.5 text-[13px] font-semibold text-muted-foreground transition-colors duration-200 hover:bg-chip"
        >
          + Escribir
        </button>
      ) : null}

      {target && item ? (
        <span
          className={cn(
            "rounded-lg px-2 py-2 text-center text-xs font-bold",
            over ? "bg-primary text-primary-foreground" : "bg-card text-primary-text",
          )}
        >
          {over
            ? filled
              ? "Suelta: se intercambian"
              : "Suelta aquí"
            : filled
              ? "Soltar: se intercambian"
              : "Soltar aquí"}
        </span>
      ) : null}
      {pasteTarget ? <PasteButton board={board} date={date} label={filled ? "Pegar y reemplazar" : "Pegar aquí"} /> : null}
    </section>
  );
}

// Pegar lo copiado. Si reemplaza algo escrito, pide confirmación antes.
export function PasteButton({
  board,
  date,
  label,
  className = "h-auto min-h-9 w-full px-2 py-1.5 text-xs whitespace-normal",
}: {
  board: MenuBoard;
  date: string;
  label: string;
  className?: string;
}) {
  if (!board.pasteWouldReplace(date)) {
    return (
      <Button type="button" className={className} data-no-drag onClick={() => board.paste(date)}>
        {label}
      </Button>
    );
  }
  return (
    <ConfirmButton
      trigger={
        <Button type="button" className={className} data-no-drag>
          {label}
        </Button>
      }
      title="¿Reemplazar el menú?"
      description={`Lo que está escrito el ${formatLongDate(date)} se reemplaza por lo que copiaste. Falta guardar después.`}
      confirmLabel="Reemplazar"
      onConfirm={() => board.paste(date)}
    />
  );
}
