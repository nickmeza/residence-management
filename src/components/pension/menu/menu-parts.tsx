"use client";

import { Moon, Sun, UtensilsCrossed } from "lucide-react";

import { cn } from "@/lib/utils";
import { dishLines } from "@/server/pension/menu-moves";
import type { MealType } from "@/server/pension/rules";

// Piezas chicas que comparten la semana, el día, el detalle y las ventanas de edición del menú.

const ICON: Record<MealType, typeof Sun> = { breakfast: Sun, lunch: UtensilsCrossed, dinner: Moon };
const ICON_COLOR: Record<MealType, string> = {
  breakfast: "text-terracota",
  lunch: "text-primary",
  dinner: "text-bar",
};

export function MealIcon({ meal, className }: { meal: MealType; className?: string }) {
  const Icon = ICON[meal];
  return <Icon className={cn("size-4 shrink-0", ICON_COLOR[meal], className)} aria-hidden="true" />;
}

// Un plato por línea, como viñetas. `limit` corta la lista y agrega "+N más".
export function DishList({ dish, limit, muted }: { dish: string; limit?: number; muted?: boolean }) {
  const lines = dishLines(dish);
  const shown = limit ? lines.slice(0, limit) : lines;
  const extra = lines.length - shown.length;
  return (
    <>
      <ul className={cn("flex flex-col gap-1", muted && "text-muted-foreground")}>
        {shown.map((line, i) => (
          <li key={i} className="flex gap-2 leading-snug">
            <span aria-hidden="true" className="mt-[0.45em] size-1.5 shrink-0 rounded-full bg-bar" />
            <span className="min-w-0 break-words">{line}</span>
          </li>
        ))}
      </ul>
      {extra > 0 ? <span className="text-xs font-semibold text-primary-text">+{extra} más</span> : null}
    </>
  );
}

export function VegBadge({ long }: { long?: boolean }) {
  return (
    <span className="self-start rounded-full bg-ok-soft px-2 py-0.5 text-xs font-bold text-ok">
      {long ? "Hay opción vegetariana" : "Vegetariano"}
    </span>
  );
}

// Clases para que un elemento sirva de "agarradera" al arrastrar (sin selección de texto ni menú al mantener).
export const HANDLE_CLASS = "cursor-grab touch-manipulation select-none [-webkit-touch-callout:none]";
