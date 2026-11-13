"use client";

import { useId, type Ref } from "react";

import { formatLongDate } from "@/lib/format";
import { isFilled, type MenuCell } from "@/server/pension/menu-moves";
import { MEAL_LABEL, type MealType } from "@/server/pension/rules";

import { DishList, MealIcon, VegBadge } from "./menu-parts";

// Mismo tope que el servidor (schemas.ts).
export const DISH_MAX = 600;

// Escribir una comida: un plato por línea, opción vegetariana, cómo lo verán los comensales y, como alternativa a
// arrastrar (teclado o pantallas donde arrastrar cuesta), "Mover a otro día".
export function MealFields({
  meal,
  time,
  value,
  onChange,
  moveTargets,
  onMove,
  compact,
  textareaRef,
}: {
  meal: MealType;
  time?: string;
  value: MenuCell;
  onChange: (value: MenuCell) => void;
  moveTargets: string[];
  onMove: (date: string) => void;
  compact?: boolean;
  // Para poner el foco aquí al abrir la ventana (la comida que se tocó).
  textareaRef?: Ref<HTMLTextAreaElement>;
}) {
  const id = useId();
  const filled = isFilled(value);
  return (
    <div className={compact ? "flex flex-col gap-3" : "grid gap-5 py-4 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]"}>
      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-dish`} className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-[17px] font-extrabold">
            <MealIcon meal={meal} className="size-5" />
            {compact ? "Platos (uno por línea)" : MEAL_LABEL[meal]}
          </span>
          {time && !compact ? <span className="text-sm text-muted-foreground">{time}</span> : null}
        </label>
        <textarea
          ref={textareaRef}
          id={`${id}-dish`}
          rows={compact ? 6 : 5}
          maxLength={DISH_MAX}
          value={value.dish}
          onChange={(e) => onChange({ ...value, dish: e.target.value })}
          placeholder={"Un plato por línea\nEntrada: sopa o causa\nSegundo: lomo saltado"}
          className="w-full resize-y rounded-lg border border-input bg-transparent px-3.5 py-3 text-base leading-relaxed transition-colors duration-200 md:text-[15px]"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-[18px] accent-primary"
              checked={value.hasVegetarian}
              onChange={(e) => onChange({ ...value, hasVegetarian: e.target.checked })}
            />
            Hay opción vegetariana
          </label>
          <span className="text-xs text-muted-foreground">
            {value.dish.length} de {DISH_MAX} letras
          </span>
        </div>
        {filled && moveTargets.length ? (
          <label className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Mover a otro día:</span>
            <select
              value=""
              onChange={(e) => e.target.value && onMove(e.target.value)}
              className="h-10 rounded-lg border border-input bg-card px-2 text-sm"
            >
              <option value="">Elegir día…</option>
              {moveTargets.map((d) => (
                <option key={d} value={d}>
                  {formatLongDate(d)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <div className="flex flex-col gap-2.5 rounded-xl bg-chip px-4 py-3.5">
        <span className="text-xs font-bold tracking-wide text-chip-foreground uppercase">
          Así lo verán tus comensales
        </span>
        {filled ? (
          <div className="flex flex-col gap-2 text-sm">
            <DishList dish={value.dish} />
            {value.hasVegetarian ? <VegBadge long /> : null}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">
            Sin menú. Si lo dejas vacío, tus comensales no verán menú para esta comida.
          </span>
        )}
      </div>
    </div>
  );
}
