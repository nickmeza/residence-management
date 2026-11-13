"use client";

import { Copy, GripVertical } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { formatLongDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { isFilled } from "@/server/pension/menu-moves";
import { MEAL_LABEL, WEEKDAY_LABEL, isoWeekday, type MealType } from "@/server/pension/rules";

import { DishList, HANDLE_CLASS, MealIcon, VegBadge } from "./menu-parts";
import type { MenuBoard, MenuItemRef } from "./use-menu-board";
import type { DragState, useMenuDrag } from "./use-menu-drag";
import { PasteButton } from "./week-grid";

type Handle = ReturnType<typeof useMenuDrag<MenuItemRef>>["handle"];
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Vista por día (móvil, tablet o si se elige "Día"): arriba la tira de los 7 días, que también es donde se suelta;
// abajo las comidas del día elegido. Se mantiene presionado el título gris de una comida (o un día de la tira) y se
// arrastra a otro día de la tira.
export function DayView({
  board,
  drag,
  handle,
  selected,
  onSelect,
  onEditMeal,
}: {
  board: MenuBoard;
  drag: DragState<MenuItemRef> | null;
  handle: Handle;
  selected: string;
  onSelect: (date: string) => void;
  onEditMeal: (date: string, meal: MealType) => void;
}) {
  const { view } = board;
  const past = board.isPast(selected);
  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-16 z-[5] -mx-1 rounded-xl border bg-card p-2.5 shadow-card">
        {/* Solo los días que la pensión cocina. */}
        <div
          role="group"
          aria-label="Elegir día"
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${board.shownDays.length}, minmax(0, 1fr))` }}
        >
          {board.shownDays.map((date) => (
            <DayChip
              key={date}
              board={board}
              drag={drag}
              handle={handle}
              date={date}
              selected={date === selected}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>

      <h2 className="flex flex-wrap items-center gap-2 text-lg font-extrabold">
        {capital(formatLongDate(selected))}
        {selected === view.today ? <StatusBadge tone="primary">Hoy</StatusBadge> : null}
        {past ? <StatusBadge tone="neutral">Ya pasó</StatusBadge> : null}
      </h2>

      {!board.isService(selected) ? (
        <p className="rounded-xl border bg-card p-5 text-muted-foreground shadow-card">
          Este día no cocinas. Lo cambias en Configuración › Comidas y planes.
        </p>
      ) : (
        <>
          {!past && !board.clip ? (
            <p className="-mt-2 text-[13px] leading-snug text-muted-foreground">
              Mantén presionado el título gris de una comida y arrástralo a un día de arriba. Igual con un día para
              moverlo completo.
            </p>
          ) : null}
          {past && board.dayHasMenu(selected) && !board.clip ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 self-start"
              onClick={() => board.copy({ kind: "day", date: selected })}
            >
              <Copy aria-hidden="true" />
              Copiar el día completo
            </Button>
          ) : null}
          {view.meals.map((meal) => (
            <MealCard
              key={meal}
              board={board}
              drag={drag}
              handle={handle}
              date={selected}
              meal={meal}
              onEdit={() => onEditMeal(selected, meal)}
            />
          ))}
          {board.clip?.kind === "day" && board.canPaste(selected) ? (
            <PasteButton
              board={board}
              date={selected}
              label="Pegar aquí el día copiado"
              className="h-12 w-full"
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function DayChip({
  board,
  drag,
  handle,
  date,
  selected,
  onSelect,
}: {
  board: MenuBoard;
  drag: DragState<MenuItemRef> | null;
  handle: Handle;
  date: string;
  selected: boolean;
  onSelect: (date: string) => void;
}) {
  const { view } = board;
  const service = board.isService(date);
  const past = board.isPast(date);
  const item = drag?.item ?? null;
  const isSource = item?.date === date;
  const target = item ? board.canDrop(item, date) : false;
  const over = target && drag?.overDate === date;
  const clip = board.clip;
  const copied = clip?.date === date;
  const pasteTarget = clip ? board.canPaste(date) : false;
  const full = service && view.meals.every((m) => isFilled(board.cell(date, m)));
  const canMoveDay = !past && service && board.dayHasMenu(date) && !clip;

  let mark = !service ? "No" : past ? "Pasó" : date === view.today ? "Hoy" : full ? "Listo" : "Falta";
  if (item) mark = isSource ? "Aquí" : target ? (over ? (board.dropSwaps(item, date) ? "Cambiar" : "Soltar") : "Soltar") : mark;
  if (clip) mark = copied ? "Copiado" : pasteTarget ? "Pegar" : mark;
  const active = item || clip;

  return (
    <button
      type="button"
      data-drop-date={service ? date : undefined}
      aria-pressed={selected}
      aria-label={`${formatLongDate(date)}: ${mark}`}
      onClick={() => onSelect(date)}
      {...(canMoveDay ? handle({ kind: "day", date }) : {})}
      className={cn(
        "flex h-16 flex-col items-center justify-center gap-px rounded-lg border text-center transition-[transform,opacity,background-color] duration-200",
        canMoveDay && HANDLE_CLASS,
        !active && [
          selected
            ? "border-transparent bg-primary text-primary-foreground"
            : !service
              ? "border-dashed border-input bg-chip text-chip-foreground"
              : past
                ? "bg-chip text-chip-foreground"
                : full
                  ? "bg-card"
                  : "border-warn-soft bg-warn-soft text-warn",
        ],
        active && [
          isSource && "border-2 border-dashed border-input bg-card text-muted-foreground",
          copied && "border-ok-soft bg-ok-soft text-ok",
          (target || pasteTarget) && !over && "border-2 border-dashed border-primary bg-primary-soft text-primary-text",
          (target || pasteTarget) && selected && clip && "border-solid bg-primary text-primary-foreground",
          over && "scale-105 border-transparent bg-primary text-primary-foreground shadow-card",
          !isSource && !copied && !target && !pasteTarget && "bg-chip text-chip-foreground opacity-40",
        ],
      )}
    >
      <span className="text-[11px] font-semibold">{WEEKDAY_LABEL[isoWeekday(date)]}</span>
      <span className="text-base leading-none font-extrabold">{Number(date.slice(8, 10))}</span>
      <span className="text-[10px] font-bold">{mark}</span>
    </button>
  );
}

function MealCard({
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
  onEdit: () => void;
}) {
  const c = board.cell(date, meal);
  const filled = isFilled(c);
  const past = board.isPast(date);
  const item = drag?.item.kind === "meal" ? drag.item : null;
  const clip = board.clip?.kind === "meal" ? board.clip : null;
  const isSource = item?.date === date && item.meal === meal;
  const dim = (item && !isSource) || (clip && clip.meal !== meal) || (board.clip?.kind === "day");
  const pasteTarget = clip && clip.meal === meal && board.canPaste(date);
  const canMove = filled && !past && !board.clip;
  const time = board.view.mealTimes[meal];

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border bg-card shadow-card transition-opacity duration-200",
        dim && "opacity-40",
        pasteTarget && "outline-2 outline-offset-2 outline-primary outline-dashed",
      )}
    >
      <div
        {...(canMove ? handle({ kind: "meal", date, meal }) : {})}
        className={cn("flex min-h-12 items-center justify-between gap-2 bg-chip py-1.5 pr-2 pl-2.5", canMove && HANDLE_CLASS)}
      >
        <span className="flex items-center gap-1.5 font-bold">
          {canMove ? <GripVertical className="size-[18px] text-muted-foreground" aria-hidden="true" /> : null}
          <MealIcon meal={meal} className="size-[18px]" />
          {MEAL_LABEL[meal]}
          {time ? <span className="text-xs font-medium text-muted-foreground">{time.split(" ")[0]}</span> : null}
        </span>
        {!past && !board.clip ? (
          <Button type="button" variant="outline" className="h-9 bg-card" data-no-drag onClick={onEdit}>
            {filled ? "Editar" : "+ Escribir"}
          </Button>
        ) : null}
        {past && filled && !board.clip ? (
          <Button
            type="button"
            variant="outline"
            className="h-9 bg-card"
            data-no-drag
            onClick={() => board.copy({ kind: "meal", date, meal })}
          >
            <Copy aria-hidden="true" />
            Copiar
          </Button>
        ) : null}
        {clip?.date === date && clip.meal === meal ? (
          <span className="rounded-full bg-ok-soft px-2 py-0.5 text-xs font-bold text-ok">Copiado</span>
        ) : null}
      </div>
      {isSource ? (
        <p className="m-3.5 rounded-lg border-2 border-dashed border-input p-3.5 text-center text-sm font-semibold text-muted-foreground">
          Moviendo…
        </p>
      ) : filled ? (
        <div className="flex flex-col gap-2 px-3.5 py-3 text-[15px]">
          <DishList dish={c.dish} muted={past} />
          {c.hasVegetarian ? <VegBadge long /> : null}
        </div>
      ) : (
        <p className="p-3.5 text-sm text-muted-foreground">Sin menú todavía.</p>
      )}
      {pasteTarget ? (
        <div className="px-3.5 pb-3.5">
          <PasteButton
            board={board}
            date={date}
            label={filled ? "Pegar y reemplazar" : `Pegar aquí el ${MEAL_LABEL[meal].toLowerCase()} copiado`}
            className="h-12 w-full"
          />
        </div>
      ) : null}
    </section>
  );
}
