"use client";

import { CalendarCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState, type RefObject } from "react";

import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { formatLongDate } from "@/lib/format";
import type { MenuCell } from "@/server/pension/menu-moves";
import { MEAL_LABEL, type MealType } from "@/server/pension/rules";

import { MealFields } from "./meal-fields";
import type { MenuBoard } from "./use-menu-board";

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
type Draft = Partial<Record<MealType, MenuCell>>;

// Al abrir, el foco va al cuadro de la comida elegida, con el cursor al final de lo escrito.
const focusAtEnd = (el: HTMLTextAreaElement | null) => {
  if (!el) return true;
  el.focus();
  el.setSelectionRange(el.value.length, el.value.length);
  return el;
};

// Escritorio: "Editar menú del día", todas las comidas del día juntas. Lo escrito se aplica al borrador del menú;
// se guarda con "Guardar borrador" o "Publicar". `focusMeal`: la comida que se tocó (si no, la primera).
export function EditDayDialog({
  board,
  date,
  focusMeal,
  onNavigate,
  onClose,
}: {
  board: MenuBoard;
  date: string | null;
  focusMeal?: MealType;
  onNavigate: (date: string) => void;
  onClose: () => void;
}) {
  const focusRef = useRef<HTMLTextAreaElement>(null);
  return (
    <Dialog open={date !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        initialFocus={() => focusAtEnd(focusRef.current)}
        className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-3xl"
      >
        {date ? (
          <DayForm
            key={date}
            board={board}
            date={date}
            focusMeal={focusMeal ?? board.view.meals[0]}
            focusRef={focusRef}
            onNavigate={onNavigate}
            onClose={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DayForm({
  board,
  date,
  focusMeal,
  focusRef,
  onNavigate,
  onClose,
}: {
  board: MenuBoard;
  date: string;
  focusMeal: MealType;
  focusRef: RefObject<HTMLTextAreaElement | null>;
  onNavigate: (date: string) => void;
  onClose: () => void;
}) {
  const { view } = board;
  const [draft, setDraft] = useState<Draft>(() =>
    Object.fromEntries(view.meals.map((m) => [m, board.cell(date, m)])),
  );
  const editable = view.days.filter((d) => board.isEditable(d));
  const at = editable.indexOf(date);
  const prev = at > 0 ? editable[at - 1] : null;
  const next = at >= 0 && at < editable.length - 1 ? editable[at + 1] : null;

  const apply = () => board.setDay(date, draft);
  const go = (d: string) => {
    apply();
    onNavigate(d);
  };

  return (
    <>
      <div className="flex flex-col gap-4 px-6 pt-5">
        <DialogTitle className="flex items-center gap-3 text-2xl font-extrabold">
          <CalendarCheck className="size-6 text-primary" aria-hidden="true" />
          Editar menú del día
        </DialogTitle>
        <DialogDescription className="sr-only">
          Escribe un plato por línea en cada comida. Los cambios se guardan con Guardar borrador o Publicar.
        </DialogDescription>
        <div className="flex items-center justify-between gap-2 rounded-xl bg-primary-soft p-2.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 bg-card"
            aria-label="Día anterior"
            disabled={!prev}
            onClick={() => prev && go(prev)}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <span className="flex flex-wrap items-center justify-center gap-2 text-center font-bold text-primary-text">
            {capital(formatLongDate(date))}
            {date === view.today ? <StatusBadge tone="primary">Hoy</StatusBadge> : null}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 bg-card"
            aria-label="Día siguiente"
            disabled={!next}
            onClick={() => next && go(next)}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </div>
      <div className="flex flex-col divide-y px-6">
        {view.meals.map((meal) => (
          <MealFields
            key={meal}
            meal={meal}
            time={view.mealTimes[meal]}
            textareaRef={meal === focusMeal ? focusRef : undefined}
            value={draft[meal] ?? { dish: "", hasVegetarian: false }}
            onChange={(v) => setDraft((d) => ({ ...d, [meal]: v }))}
            moveTargets={board.moveTargets(date)}
            onMove={(to) => {
              if (board.setDayAndMove(date, draft, meal, to)) onClose();
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-6 py-4">
        <p className="max-w-sm text-[13px] text-muted-foreground">
          Queda en el borrador. Tus comensales lo ven cuando guardas y publicas el menú.
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="h-11" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="h-11"
            onClick={() => {
              apply();
              onClose();
            }}
          >
            Aplicar cambios
          </Button>
        </div>
      </div>
    </>
  );
}

// Móvil: una sola comida, en una hoja que sube desde abajo.
export function EditMealSheet({
  board,
  slot,
  onClose,
}: {
  board: MenuBoard;
  slot: { date: string; meal: MealType } | null;
  onClose: () => void;
}) {
  const focusRef = useRef<HTMLTextAreaElement>(null);
  return (
    <Sheet open={slot !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        initialFocus={() => focusAtEnd(focusRef.current)}
        className="max-h-[90dvh] gap-0 overflow-y-auto rounded-t-xl"
      >
        {slot ? (
          <MealForm
            key={`${slot.date}|${slot.meal}`}
            board={board}
            slot={slot}
            focusRef={focusRef}
            onClose={onClose}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function MealForm({
  board,
  slot,
  focusRef,
  onClose,
}: {
  board: MenuBoard;
  slot: { date: string; meal: MealType };
  focusRef: RefObject<HTMLTextAreaElement | null>;
  onClose: () => void;
}) {
  const [value, setValue] = useState(() => board.cell(slot.date, slot.meal));
  const time = board.view.mealTimes[slot.meal];
  return (
    <>
      <div aria-hidden="true" className="mx-auto mt-2 h-1.5 w-11 rounded-full bg-border" />
      <div className="flex flex-col gap-1 px-4 pt-3 pb-3">
        <SheetTitle className="text-xl font-extrabold">{MEAL_LABEL[slot.meal]}</SheetTitle>
        <SheetDescription>
          {capital(formatLongDate(slot.date))}
          {time ? ` · ${time}` : ""}
        </SheetDescription>
      </div>
      <div className="px-4 pb-4">
        <MealFields
          compact
          textareaRef={focusRef}
          meal={slot.meal}
          value={value}
          onChange={setValue}
          moveTargets={board.moveTargets(slot.date)}
          onMove={(to) => {
            if (board.setDayAndMove(slot.date, { [slot.meal]: value }, slot.meal, to)) onClose();
          }}
        />
      </div>
      <div className="sticky bottom-0 grid grid-cols-2 gap-2.5 border-t bg-popover px-4 pt-3 pb-5">
        <Button type="button" variant="outline" className="h-12" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          type="button"
          className="h-12"
          onClick={() => {
            board.setDay(slot.date, { [slot.meal]: value });
            onClose();
          }}
        >
          Aplicar
        </Button>
      </div>
    </>
  );
}
