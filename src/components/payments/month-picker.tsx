"use client";

import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { periodLabel } from "@/server/payments/rules";

const SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// Selector de mes y año de Cobros: un botón que abre el año y sus 12 meses. Cambia ?mes=AAAA-MM.
export function MonthPicker({ period, currentPeriod }: { period: string; currentPeriod: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number(period.slice(0, 4)));

  const go = (next: string) => {
    setOpen(false);
    router.push(next === currentPeriod ? "/cobros" : `/cobros?mes=${next}`);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setYear(Number(period.slice(0, 4)));
      }}
    >
      <PopoverTrigger
        render={<Button type="button" variant="outline" className="h-11 gap-2 px-4 text-base font-bold" />}
      >
        <CalendarDays className="size-4" aria-hidden="true" />
        <span className="first-letter:uppercase">{periodLabel(period)}</span>
        <ChevronDown className="size-4" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 gap-3 p-3.5">
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-10"
            aria-label="Año anterior"
            onClick={() => setYear(year - 1)}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>
          <b className="text-base">{year}</b>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-10"
            aria-label="Año siguiente"
            onClick={() => setYear(year + 1)}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {SHORT.map((label, i) => {
            const value = `${year}-${String(i + 1).padStart(2, "0")}`;
            const selected = value === period;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                aria-label={periodLabel(value)}
                onClick={() => go(value)}
                className={cn(
                  "min-h-10 rounded-lg text-sm font-semibold transition-colors duration-200",
                  selected ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-primary-soft",
                  value === currentPeriod && !selected && "ring-1 ring-primary",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
        {period !== currentPeriod ? (
          <button
            type="button"
            onClick={() => go(currentPeriod)}
            className="self-start py-1 text-sm font-semibold text-link underline-offset-4 hover:underline"
          >
            Volver a este mes
          </button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
