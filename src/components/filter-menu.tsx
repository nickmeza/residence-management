"use client";

import { SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type FilterOption<T extends string> = { id: T; label: string; count: number };

// Botón "Filtrar" de las listas (Cobros, Residentes, Contratos): abre casillas con cuántos hay de cada una, y lo
// marcado se ve al lado como etiquetas que se quitan con un clic. Sin nada marcado se ven todos.
export function FilterMenu<T extends string>({
  title = "Estado",
  options,
  selected,
  onChange,
}: {
  title?: string;
  options: FilterOption<T>[];
  selected: T[];
  onChange: (next: T[]) => void;
}) {
  const toggle = (id: T, on: boolean) => onChange(on ? [...selected, id] : selected.filter((s) => s !== id));
  const labelOf = (id: T) => options.find((o) => o.id === id)?.label ?? id;

  return (
    <>
      <Popover>
        <PopoverTrigger render={<Button type="button" variant="outline" className="h-11 gap-2 px-3.5" />}>
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          Filtrar
          {selected.length ? (
            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {selected.length}
            </span>
          ) : null}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 gap-1 p-3.5">
          <span className="pb-1.5 text-xs font-bold tracking-wider text-muted-foreground uppercase">
            {title}
          </span>
          {options.map((o) => (
            <label key={o.id} className="flex min-h-10 cursor-pointer items-center gap-3 text-sm">
              <Checkbox checked={selected.includes(o.id)} onCheckedChange={(on) => toggle(o.id, on)} />
              <span className="flex-1">{o.label}</span>
              <span className="text-xs text-muted-foreground">{o.count}</span>
            </label>
          ))}
          <div className="mt-1.5 flex justify-start border-t pt-2.5">
            <Button type="button" variant="ghost" className="h-9 px-2" onClick={() => onChange([])}>
              Limpiar filtros
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {selected.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => toggle(id, false)}
          aria-label={`Quitar filtro ${labelOf(id)}`}
          className="flex min-h-8 items-center gap-1.5 rounded-full bg-primary-soft px-2.5 text-sm font-semibold text-primary-text transition-colors duration-200 hover:bg-primary-soft/70"
        >
          {labelOf(id)}
          <X className="size-3.5" aria-hidden="true" />
        </button>
      ))}
    </>
  );
}
