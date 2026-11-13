"use client";

import { useMemo, useState, useTransition } from "react";

import { formatLongDate } from "@/lib/format";
import { copyPreviousWeekAction, saveWeekMenuAction, type PensionResult } from "@/server/pension/actions";
import {
  cellOf,
  isEditableDay,
  isFilled,
  isPastDay,
  menuKey,
  moveDay,
  moveDayProblem,
  moveMeal,
  moveMealProblem,
  pasteDay,
  pasteDayProblem,
  pasteDayReplaces,
  pasteMeal,
  pasteMealProblem,
  pasteReplaces,
  type MenuCell,
  type MenuCells,
} from "@/server/pension/menu-moves";
import type { WeekMenuView } from "@/server/pension/queries";
import { isServiceDay, MEAL_LABEL, type MealType } from "@/server/pension/rules";

// Estado del menú en pantalla. Todo cambio (escribir, mover, intercambiar, pegar, vaciar) queda en borrador aquí y se
// guarda junto con "Guardar borrador" o "Publicar" (una sola operación en el servidor). Las reglas son las de
// src/server/pension/menu-moves.ts; este archivo solo las aplica al estado.

export type MenuItemRef = { kind: "meal"; date: string; meal: MealType } | { kind: "day"; date: string };
export type Notice = { text: string; ok: boolean };

const mealName = (m: MealType) => MEAL_LABEL[m].toLowerCase();

export function useMenuBoard(view: WeekMenuView) {
  const ctx = useMemo(() => ({ today: view.today, serviceDays: view.serviceDays }), [view.today, view.serviceDays]);
  const fromView = () => {
    const cells: MenuCells = {};
    for (const e of view.entries) cells[menuKey(e.date, e.meal)] = { dish: e.dish, hasVegetarian: e.hasVegetarian };
    return cells;
  };
  const [cells, setCells] = useState(fromView);
  const [saved, setSaved] = useState(view.entries);
  const [dirty, setDirty] = useState(false);
  const [clip, setClip] = useState<MenuItemRef | null>(null);
  const [notice, setNotice] = useState<Notice>();
  const [pending, startTransition] = useTransition();

  // Llegaron datos nuevos del servidor (otra semana, después de guardar o de copiar): se empieza con ellos.
  if (saved !== view.entries) {
    setSaved(view.entries);
    setCells(fromView());
    setDirty(false);
    setClip(null);
  }

  const change = (next: MenuCells, text?: string) => {
    setCells(next);
    setDirty(true);
    setNotice(text ? { text, ok: true } : undefined);
  };
  const fail = (text: string) => setNotice({ text, ok: false });

  const isService = (date: string) => isServiceDay(date, view.serviceDays);
  // Días que se muestran: solo los que la pensión cocina (decisión del dueño, 2026-11-13).
  const shownDays = view.days.filter(isService);
  const isPast = (date: string) => isPastDay(date, ctx);
  const isEditable = (date: string) => isEditableDay(date, ctx);
  const cell = (date: string, meal: MealType) => cellOf(cells, date, meal);

  // --- Arrastrar y soltar -------------------------------------------------------------------------------------
  const dropProblem = (item: MenuItemRef, date: string) =>
    item.kind === "meal"
      ? moveMealProblem(cells, item, { date, meal: item.meal }, ctx)
      : moveDayProblem(cells, item.date, date, view.meals, ctx);
  const canDrop = (item: MenuItemRef, date: string) => dropProblem(item, date) === null;
  // ¿Soltar aquí intercambia (el destino tiene platos) o solo mueve?
  const dropSwaps = (item: MenuItemRef, date: string) =>
    item.kind === "meal"
      ? isFilled(cellOf(cells, date, item.meal))
      : view.meals.some((m) => isFilled(cellOf(cells, date, m)));

  function drop(item: MenuItemRef, date: string) {
    if (item.date === date) return;
    const swaps = dropSwaps(item, date);
    const r =
      item.kind === "meal"
        ? moveMeal(cells, item, { date, meal: item.meal }, ctx)
        : moveDay(cells, item.date, date, ctx, view.meals);
    if (!r.ok) return fail(r.problem);
    const what = item.kind === "meal" ? `el ${mealName(item.meal)} del ${formatLongDate(item.date)}` : `el ${formatLongDate(item.date)}`;
    change(
      r.cells,
      swaps
        ? `Intercambiamos ${what} con el del ${formatLongDate(date)}. Falta guardar.`
        : `Movimos ${what} al ${formatLongDate(date)}. Falta guardar.`,
    );
  }

  // --- Copiar y pegar -----------------------------------------------------------------------------------------
  const copy = (item: MenuItemRef) => {
    setClip(item);
    setNotice(undefined);
  };
  const cancelClip = () => setClip(null);
  const canPaste = (date: string) =>
    clip !== null &&
    (clip.kind === "meal"
      ? pasteMealProblem(cells, clip, { date, meal: clip.meal }, ctx) === null
      : pasteDayProblem(cells, clip.date, date, view.meals, ctx) === null);
  const pasteWouldReplace = (date: string) =>
    clip !== null &&
    (clip.kind === "meal" ? pasteReplaces(cells, { date, meal: clip.meal }) : pasteDayReplaces(cells, date, view.meals));

  function paste(date: string) {
    if (!clip) return;
    const r =
      clip.kind === "meal"
        ? pasteMeal(cells, clip, { date, meal: clip.meal }, ctx)
        : pasteDay(cells, clip.date, date, ctx, view.meals);
    if (!r.ok) return fail(r.problem);
    setClip(null);
    change(r.cells, `Pegamos el menú en el ${formatLongDate(date)}. Falta guardar.`);
  }

  // --- Escribir y vaciar --------------------------------------------------------------------------------------
  const setDay = (date: string, values: Partial<Record<MealType, MenuCell>>) => {
    const next = { ...cells };
    for (const [m, c] of Object.entries(values)) next[menuKey(date, m as MealType)] = c;
    change(next);
  };
  const clearDay = (date: string) => {
    const next = { ...cells };
    for (const m of view.meals) next[menuKey(date, m)] = { dish: "", hasVegetarian: false };
    change(next, `Vaciamos el ${formatLongDate(date)}. Falta guardar.`);
  };
  const dayHasMenu = (date: string) => view.meals.some((m) => isFilled(cellOf(cells, date, m)));
  // Días a los que se puede mover algo desde `date` (para "Mover a otro día", la alternativa a arrastrar).
  const moveTargets = (date: string) => view.days.filter((d) => d !== date && isEditableDay(d, ctx));

  // Desde las ventanas de edición: guarda lo escrito del día y luego mueve (o intercambia) una comida.
  function setDayAndMove(date: string, values: Partial<Record<MealType, MenuCell>>, meal: MealType, to: string) {
    const base = { ...cells };
    for (const [m, c] of Object.entries(values)) base[menuKey(date, m as MealType)] = c;
    const swaps = isFilled(cellOf(base, to, meal));
    const r = moveMeal(base, { date, meal }, { date: to, meal }, ctx);
    if (!r.ok) {
      fail(r.problem);
      return false;
    }
    const what = `el ${mealName(meal)} del ${formatLongDate(date)}`;
    change(
      r.cells,
      swaps
        ? `Intercambiamos ${what} con el del ${formatLongDate(to)}. Falta guardar.`
        : `Movimos ${what} al ${formatLongDate(to)}. Falta guardar.`,
    );
    return true;
  }

  // --- Guardar ------------------------------------------------------------------------------------------------
  const run = (action: () => Promise<PensionResult>, ok: string) =>
    startTransition(async () => {
      const result = await action();
      setNotice(result.ok ? { text: ok, ok: true } : { text: result.message, ok: false });
    });

  // Solo se envían los días que todavía se pueden cambiar (el servidor rechaza cambios en días pasados).
  const save = (publish: boolean) =>
    run(
      () =>
        saveWeekMenuAction(view.businessId, {
          publish,
          entries: view.days
            .filter((d) => isEditableDay(d, ctx))
            .flatMap((date) =>
              view.meals.map((meal) => {
                const c = cellOf(cells, date, meal);
                return { date, meal, dish: c.dish, hasVegetarian: isFilled(c) && c.hasVegetarian };
              }),
            ),
        }),
      publish ? "Menú publicado: tus comensales ya lo ven." : "Borrador guardado.",
    );
  const copyPreviousWeek = () =>
    run(
      () => copyPreviousWeekAction(view.businessId, view.weekStart),
      "Copiamos la semana anterior como borrador en los días que faltaban. Revísala y publícala.",
    );

  // Estado del menú de los días que todavía se pueden cambiar.
  const editableEntries = view.entries.filter((e) => e.date >= view.today);
  const status = dirty
    ? { label: "Cambios sin guardar", tone: "warn" as const }
    : !editableEntries.length
      ? { label: "Sin menú", tone: "neutral" as const }
      : editableEntries.every((e) => e.published)
        ? { label: "Publicado", tone: "ok" as const }
        : { label: "Borrador", tone: "warn" as const };

  return {
    view,
    cells,
    cell,
    dirty,
    pending,
    notice,
    setNotice,
    status,
    isService,
    shownDays,
    isPast,
    isEditable,
    dayHasMenu,
    canDrop,
    dropSwaps,
    drop,
    clip,
    copy,
    cancelClip,
    canPaste,
    pasteWouldReplace,
    paste,
    setDay,
    setDayAndMove,
    moveTargets,
    clearDay,
    save,
    copyPreviousWeek,
  };
}

export type MenuBoard = ReturnType<typeof useMenuBoard>;
