"use client";

import { CalendarDays, CalendarRange, Copy, Move } from "lucide-react";
import { useEffect, useState } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { formatLongDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { dishLines } from "@/server/pension/menu-moves";
import type { WeekMenuView } from "@/server/pension/queries";
import { isServiceDay, MEAL_LABEL } from "@/server/pension/rules";

import { DayDetail } from "./menu/day-detail";
import { DayView } from "./menu/day-view";
import { EditDayDialog, EditMealSheet } from "./menu/edit-day-dialog";
import { useMenuBoard, type MenuBoard, type MenuItemRef } from "./menu/use-menu-board";
import { useMenuDrag, type DragState } from "./menu/use-menu-drag";
import { WeekGrid } from "./menu/week-grid";

// Menú semanal (PN-03). Por día y comida, un texto con un plato por línea y si hay opción vegetariana. Se arrastra
// una comida a la misma comida de otro día, o un día completo a otro día (si el destino tiene platos, se
// intercambian). Lo que ya pasó no se mueve: se copia y se pega. Todo queda en borrador hasta "Guardar borrador" o
// "Publicar"; el comensal solo ve lo publicado. El menú es opcional.
type ViewMode = "auto" | "week" | "day";

export function WeekMenuEditor({ view }: { view: WeekMenuView }) {
  const board = useMenuBoard(view);
  const { drag, handle } = useMenuDrag<MenuItemRef>(board.drop);
  const [mode, setMode] = useState<ViewMode>("auto");
  const [selected, setSelected] = useState(() => defaultDay(view));
  const [editingDay, setEditingDay] = useState<string | null>(null);
  // Comida que recibe el foco al abrir "Editar día" (la que se tocó con "+ Escribir").
  const [focusMeal, setFocusMeal] = useState<(typeof view.meals)[number] | undefined>();
  const [editingMeal, setEditingMeal] = useState<{ date: string; meal: (typeof view.meals)[number] } | null>(null);

  // Si cambia la semana, se elige un día de la nueva semana.
  if (!view.days.includes(selected)) setSelected(defaultDay(view));

  // Avisar antes de salir con cambios sin guardar; Esc cancela lo copiado.
  const { dirty, clip, cancelClip } = board;
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    if (!clip) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && cancelClip();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clip, cancelClip]);

  if (!view.meals.length) {
    return (
      <p className="rounded-xl border bg-card p-6 text-muted-foreground shadow-card">
        Primero activa tus comidas en Configuración › Comidas y planes.
      </p>
    );
  }

  const actions = (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-11"
        disabled={board.pending || !!drag}
        onClick={() => board.save(false)}
      >
        Guardar borrador
      </Button>
      <Button type="button" className="h-11" disabled={board.pending || !!drag} onClick={() => board.save(true)}>
        Publicar menú
      </Button>
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Estado, vista y acciones */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge tone={board.status.tone}>{board.status.label}</StatusBadge>
          <div role="group" aria-label="Vista" className="flex rounded-xl border bg-card p-1">
            <ViewButton
              active={mode === "week"}
              autoActive={mode === "auto"}
              autoClass="xl:bg-primary-soft xl:text-primary-text xl:font-bold"
              onClick={() => setMode("week")}
            >
              <CalendarRange aria-hidden="true" />
              Semana
            </ViewButton>
            <ViewButton
              active={mode === "day"}
              autoActive={mode === "auto"}
              autoClass="max-xl:bg-primary-soft max-xl:text-primary-text max-xl:font-bold"
              onClick={() => setMode("day")}
            >
              <CalendarDays aria-hidden="true" />
              Día
            </ViewButton>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="h-11 text-primary-text"
            disabled={board.pending || board.dirty}
            title={board.dirty ? "Guarda primero tus cambios" : undefined}
            onClick={board.copyPreviousWeek}
          >
            <Copy aria-hidden="true" />
            Copiar la semana anterior
          </Button>
        </div>
        <div className="hidden gap-2 md:flex">{actions}</div>
      </div>

      <Banner board={board} drag={drag} />

      {board.notice ? (
        board.notice.ok ? (
          <p role="status" className="rounded-lg bg-ok-soft px-3 py-2 text-sm font-semibold text-ok">
            {board.notice.text}
          </p>
        ) : (
          <FormMessage message={board.notice.text} />
        )
      ) : null}

      {/* Semana (escritorio) */}
      <div className={cn("flex-col gap-5", mode === "week" ? "flex" : mode === "day" ? "hidden" : "hidden xl:flex")}>
        <WeekGrid
          board={board}
          drag={drag}
          handle={handle}
          selected={selected}
          onSelect={setSelected}
          onEdit={(d, meal) => {
            setFocusMeal(meal);
            setSelected(d);
            setEditingDay(d);
          }}
        />
        <DayDetail board={board} date={selected} onEdit={() => {
            setFocusMeal(undefined);
            setEditingDay(selected);
          }}
        />
      </div>

      {/* Día a día (móvil, tablet o "Día") */}
      <div className={cn(mode === "day" ? "block" : mode === "week" ? "hidden" : "xl:hidden")}>
        <DayView
          board={board}
          drag={drag}
          handle={handle}
          selected={selected}
          onSelect={setSelected}
          onEditMeal={(date, meal) => setEditingMeal({ date, meal })}
        />
      </div>

      {/* Guardar y publicar siempre a la mano en el celular */}
      <div className="sticky bottom-0 z-[5] -mx-4 grid grid-cols-2 gap-2.5 border-t bg-card px-4 pt-3 pb-5 md:hidden">
        {drag ? (
          <p className="col-span-2 flex min-h-12 flex-col items-center justify-center rounded-lg border-2 border-dashed border-danger bg-danger-soft px-2 text-center text-sm font-bold text-danger">
            Suéltalo en un día de arriba
            <span className="text-xs font-semibold">Si lo sueltas aquí, se cancela</span>
          </p>
        ) : board.clip ? (
          <Button type="button" variant="outline" className="col-span-2 h-12" onClick={board.cancelClip}>
            Cancelar copia
          </Button>
        ) : (
          actions
        )}
      </div>

      {drag ? <Ghost board={board} drag={drag} /> : null}

      <EditDayDialog
        board={board}
        date={editingDay}
        focusMeal={focusMeal}
        onNavigate={(d) => {
          setSelected(d);
          setEditingDay(d);
        }}
        onClose={() => setEditingDay(null)}
      />
      <EditMealSheet board={board} slot={editingMeal} onClose={() => setEditingMeal(null)} />
    </div>
  );
}

// Hoy si cae en la semana y se cocina; si no, el primer día que se cocina; si no, el lunes.
function defaultDay(view: WeekMenuView) {
  const service = view.days.filter((d) => isServiceDay(d, view.serviceDays));
  if (service.includes(view.today)) return view.today;
  return service.find((d) => d >= view.today) ?? service[0] ?? view.days[0];
}

function ViewButton({
  active,
  autoActive,
  autoClass,
  onClick,
  children,
}: {
  active: boolean;
  autoActive: boolean;
  autoClass: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-9 items-center gap-2 rounded-lg px-3.5 text-sm font-semibold text-muted-foreground transition-colors duration-200 [&_svg]:size-4",
        active && "bg-primary-soft font-bold text-primary-text",
        autoActive && autoClass,
      )}
    >
      {children}
    </button>
  );
}

// Instrucción mientras se arrastra o hay algo copiado; ayuda corta el resto del tiempo.
function Banner({ board, drag }: { board: MenuBoard; drag: DragState<MenuItemRef> | null }) {
  const item = drag?.item ?? board.clip;
  if (!item) {
    return <Hint />;
  }
  const what =
    item.kind === "meal"
      ? `el ${MEAL_LABEL[item.meal].toLowerCase()} del ${formatLongDate(item.date)}`
      : `el ${formatLongDate(item.date)} completo`;
  const text = drag
    ? item.kind === "meal"
      ? `Moviendo ${what}. Suéltalo en el ${MEAL_LABEL[item.meal].toLowerCase()} de otro día; si ya tiene platos, se intercambian.`
      : `Moviendo ${what}. Suéltalo en otro día; si ya tiene menú, los dos días se intercambian.`
    : `Copiaste ${what}. Elige dónde pegarlo.`;
  return (
    <>
    {/* La ayuda se queda mientras se arrastra, para que la página no se mueva. */}
    {drag ? <Hint /> : null}
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground",
        // Mientras se arrastra, el aviso flota abajo: si empujara la página, los días se correrían bajo el puntero.
        drag && "fixed bottom-4 left-1/2 z-40 hidden w-[min(42rem,calc(100%-2rem))] -translate-x-1/2 shadow-card md:flex",
      )}
    >
      <span className="flex items-center gap-2.5">
        <Move className="size-[18px] shrink-0" aria-hidden="true" />
        {text}
      </span>
      {drag ? (
        <span className="hidden rounded-lg bg-primary-soft px-3 py-1.5 text-[13px] font-bold text-primary-text md:inline">
          Esc para cancelar
        </span>
      ) : (
        <Button type="button" variant="secondary" className="h-9" onClick={board.cancelClip}>
          Cancelar
        </Button>
      )}
    </div>
    </>
  );
}

function Hint() {
  return (
    <p className="hidden items-center gap-2 text-[13px] text-muted-foreground xl:flex">
      <Move className="size-4 shrink-0" aria-hidden="true" />
      Arrastra un día o una comida desde su título para moverlo. Una comida solo va a la misma comida de otro día. Lo
      que ya pasó se copia y se pega.
    </p>
  );
}

// Lo que se lleva en la mano mientras se arrastra.
function Ghost({ board, drag }: { board: MenuBoard; drag: DragState<MenuItemRef> }) {
  const { item } = drag;
  const lines =
    item.kind === "meal"
      ? dishLines(board.cell(item.date, item.meal).dish)
      : board.view.meals.map((m) => {
          const n = dishLines(board.cell(item.date, m).dish).length;
          return `${MEAL_LABEL[m]} · ${n ? `${n} plato${n === 1 ? "" : "s"}` : "sin menú"}`;
        });
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-50 w-48 -rotate-3 overflow-hidden rounded-xl border-2 border-primary bg-card text-sm shadow-card"
      style={
        drag.touch
          ? { left: Math.max(8, Math.min(drag.x - 96, window.innerWidth - 200)), top: drag.y + 56 }
          : { left: drag.x + 14, top: drag.y + 14 }
      }
    >
      <div className="bg-primary-soft px-3 py-2 text-xs font-extrabold tracking-wide text-primary-text uppercase">
        {item.kind === "meal" ? MEAL_LABEL[item.meal] : "Día completo"} · {formatLongDate(item.date).split(" de ")[0]}
      </div>
      <ul className="flex flex-col gap-0.5 px-3 py-2">
        {lines.slice(0, 3).map((l, i) => (
          <li key={i} className="truncate">
            {l}
          </li>
        ))}
        {lines.length > 3 ? <li className="text-muted-foreground">+{lines.length - 3} más</li> : null}
      </ul>
    </div>
  );
}
