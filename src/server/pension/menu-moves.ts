// Menú semanal: mover, intercambiar, copiar y pegar comidas o días (decisión del dueño, 2026-11-13).
// Funciones puras: reciben el menú y devuelven uno nuevo; las usan la pantalla (para saber dónde se puede soltar) y
// el servidor (para validar). Reglas:
// - Una comida solo va a la MISMA comida de otro día (almuerzo → almuerzo, nunca almuerzo → cena).
// - También se mueve un día completo a otro día.
// - Si el destino ya tiene platos, se intercambian; si está vacío, se mueve y el origen queda vacío.
// - No se suelta en un día que ya pasó ni en uno sin servicio. Hoy cuenta como día que no pasó.
// - Lo que ya pasó no se mueve: se copia y se pega en un día que no pasó (pegar sobre algo escrito lo reemplaza).
import type { IsoDate } from "@/server/contracts/dates";

import { isServiceDay, MEAL_TYPES, type MealType } from "./rules";

export type MenuCell = { dish: string; hasVegetarian: boolean };
// Clave "AAAA-MM-DD|lunch". Una casilla sin entrada o con plato vacío = sin menú.
export type MenuCells = Record<string, MenuCell>;
export type MenuSlot = { date: IsoDate; meal: MealType };
export type MenuContext = { today: IsoDate; serviceDays: number[] };

export const EMPTY_CELL: MenuCell = { dish: "", hasVegetarian: false };

export const menuKey = (date: IsoDate, meal: MealType) => `${date}|${meal}`;

export const cellOf = (cells: MenuCells, date: IsoDate, meal: MealType): MenuCell =>
  cells[menuKey(date, meal)] ?? EMPTY_CELL;

export const isFilled = (cell: MenuCell) => cell.dish.trim().length > 0;

// Un plato por línea (las líneas vacías no cuentan).
export const dishLines = (dish: string) =>
  dish
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

export const isPastDay = (date: IsoDate, ctx: MenuContext) => date < ctx.today;

// ¿Se puede cambiar el menú de este día? (no pasó y la pensión cocina ese día)
export const isEditableDay = (date: IsoDate, ctx: MenuContext) =>
  !isPastDay(date, ctx) && isServiceDay(date, ctx.serviceDays);

// Motivo por el que un día no recibe nada, o null si sí recibe.
function targetProblem(date: IsoDate, ctx: MenuContext): string | null {
  if (isPastDay(date, ctx)) return "Ese día ya pasó.";
  if (!isServiceDay(date, ctx.serviceDays)) return "Ese día no cocinas.";
  return null;
}

// --- Mover (arrastrar y soltar) -------------------------------------------------------------------------------

export function moveMealProblem(cells: MenuCells, from: MenuSlot, to: MenuSlot, ctx: MenuContext): string | null {
  if (from.meal !== to.meal) return "Una comida solo se mueve a la misma comida de otro día.";
  if (from.date === to.date) return "Elige otro día.";
  if (isPastDay(from.date, ctx)) return "Lo que ya pasó no se mueve: cópialo y pégalo.";
  if (!isFilled(cellOf(cells, from.date, from.meal))) return "Esa comida no tiene menú.";
  return targetProblem(to.date, ctx);
}

// Mueve (o intercambia, si el destino tiene platos) una comida. Si no se puede, devuelve el motivo.
export function moveMeal(
  cells: MenuCells,
  from: MenuSlot,
  to: MenuSlot,
  ctx: MenuContext,
): { ok: true; cells: MenuCells } | { ok: false; problem: string } {
  const problem = moveMealProblem(cells, from, to, ctx);
  if (problem) return { ok: false, problem };
  const source = cellOf(cells, from.date, from.meal);
  const target = cellOf(cells, to.date, to.meal);
  return {
    ok: true,
    cells: { ...cells, [menuKey(to.date, to.meal)]: source, [menuKey(from.date, from.meal)]: target },
  };
}

const dayFilled = (cells: MenuCells, date: IsoDate, meals: MealType[]) =>
  meals.some((m) => isFilled(cellOf(cells, date, m)));

export function moveDayProblem(
  cells: MenuCells,
  from: IsoDate,
  to: IsoDate,
  meals: MealType[],
  ctx: MenuContext,
): string | null {
  if (from === to) return "Elige otro día.";
  if (isPastDay(from, ctx)) return "Lo que ya pasó no se mueve: cópialo y pégalo.";
  if (!dayFilled(cells, from, meals)) return "Ese día no tiene menú.";
  return targetProblem(to, ctx);
}

// Mueve (o intercambia) todas las comidas de un día con las de otro.
export function moveDay(
  cells: MenuCells,
  from: IsoDate,
  to: IsoDate,
  ctx: MenuContext,
  meals: MealType[] = MEAL_TYPES,
): { ok: true; cells: MenuCells } | { ok: false; problem: string } {
  const problem = moveDayProblem(cells, from, to, meals, ctx);
  if (problem) return { ok: false, problem };
  const next = { ...cells };
  for (const m of meals) {
    next[menuKey(to, m)] = cellOf(cells, from, m);
    next[menuKey(from, m)] = cellOf(cells, to, m);
  }
  return { ok: true, cells: next };
}

// --- Copiar y pegar (sobre todo para lo que ya pasó) ------------------------------------------------------------

export function pasteMealProblem(cells: MenuCells, from: MenuSlot, to: MenuSlot, ctx: MenuContext): string | null {
  if (from.meal !== to.meal) return "Una comida solo se pega en la misma comida de otro día.";
  if (from.date === to.date) return "Elige otro día.";
  if (!isFilled(cellOf(cells, from.date, from.meal))) return "Esa comida no tiene menú.";
  return targetProblem(to.date, ctx);
}

// Copia una comida en otro día. Lo que hubiera en el destino se reemplaza (la pantalla pide confirmación).
export function pasteMeal(
  cells: MenuCells,
  from: MenuSlot,
  to: MenuSlot,
  ctx: MenuContext,
): { ok: true; cells: MenuCells } | { ok: false; problem: string } {
  const problem = pasteMealProblem(cells, from, to, ctx);
  if (problem) return { ok: false, problem };
  return { ok: true, cells: { ...cells, [menuKey(to.date, to.meal)]: { ...cellOf(cells, from.date, from.meal) } } };
}

export function pasteDayProblem(
  cells: MenuCells,
  from: IsoDate,
  to: IsoDate,
  meals: MealType[],
  ctx: MenuContext,
): string | null {
  if (from === to) return "Elige otro día.";
  if (!dayFilled(cells, from, meals)) return "Ese día no tiene menú.";
  return targetProblem(to, ctx);
}

// Copia todas las comidas de un día en otro (el destino queda igual al origen, también lo que estaba vacío).
export function pasteDay(
  cells: MenuCells,
  from: IsoDate,
  to: IsoDate,
  ctx: MenuContext,
  meals: MealType[] = MEAL_TYPES,
): { ok: true; cells: MenuCells } | { ok: false; problem: string } {
  const problem = pasteDayProblem(cells, from, to, meals, ctx);
  if (problem) return { ok: false, problem };
  const next = { ...cells };
  for (const m of meals) next[menuKey(to, m)] = { ...cellOf(cells, from, m) };
  return { ok: true, cells: next };
}

// ¿Pegar aquí reemplaza algo escrito? (para pedir confirmación)
export const pasteReplaces = (cells: MenuCells, to: MenuSlot) => isFilled(cellOf(cells, to.date, to.meal));
export const pasteDayReplaces = (cells: MenuCells, to: IsoDate, meals: MealType[]) => dayFilled(cells, to, meals);

// --- Validación del servidor -----------------------------------------------------------------------------------

// Al guardar: el menú de un día que ya pasó no se cambia ni se borra. Compara lo que llega con lo guardado.
export function pastMenuChanged(
  saved: { date: IsoDate; meal: MealType; dish: string; hasVegetarian: boolean }[],
  incoming: { date: IsoDate; meal: MealType; dish: string; hasVegetarian: boolean }[],
  today: IsoDate,
): boolean {
  return incoming.some((e) => {
    if (e.date >= today) return false;
    const s = saved.find((x) => x.date === e.date && x.meal === e.meal);
    const before = s ? { dish: s.dish.trim(), veg: s.hasVegetarian } : { dish: "", veg: false };
    const after = { dish: e.dish.trim(), veg: e.dish.trim() ? e.hasVegetarian : false };
    return before.dish !== after.dish || (before.dish !== "" && before.veg !== after.veg);
  });
}
