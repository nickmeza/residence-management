"use client";

import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { es } from "react-day-picker/locale";
import { useController, type Control, type FieldValues, type Path } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Corto para que quepa en campos angostos: "20 nov 2026" (sin el punto de la abreviatura).
const shortDate = new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short", year: "numeric" });
const shown = (date: Date) => shortDate.format(date).replace(".", "");

// "2026-12-15" ↔ fecha local (sin hora ni zona: es un día del calendario).
function toDate(value: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : undefined;
}
function toValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Campo de fecha de la app: un botón que abre el calendario de shadcn, en lugar del de cada navegador.
// Trabaja con texto "AAAA-MM-DD" como <input type="date">; "" es "sin fecha".
export type DateFieldProps = {
  id?: string;
  // Nombre para lectores de pantalla cuando no hay etiqueta visible.
  ariaLabel?: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  // Muestra "Quitar fecha" (para campos opcionales).
  clearable?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  min?: string;
  max?: string;
  className?: string;
};

export function DateField({
  id,
  value,
  onValueChange,
  placeholder = "Elige una fecha",
  clearable,
  disabled,
  invalid,
  min,
  max,
  className,
  ariaLabel,
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = toDate(value);
  const from = min ? toDate(min) : undefined;
  const to = max ? toDate(max) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            aria-label={ariaLabel}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-invalid={invalid || undefined}
            className={cn(
              "h-11 w-full min-w-0 justify-between gap-2 px-2.5 text-base font-normal md:text-sm",
              !selected && "text-muted-foreground",
              className,
            )}
          />
        }
      >
        <span className="min-w-0 truncate">{selected ? shown(selected) : placeholder}</span>
        <CalendarIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={es}
          selected={selected}
          defaultMonth={selected ?? from}
          disabled={[...(from ? [{ before: from }] : []), ...(to ? [{ after: to }] : [])]}
          onSelect={(date) => {
            onValueChange(date ? toValue(date) : "");
            setOpen(false);
          }}
        />
        {clearable && selected ? (
          <div className="border-t p-2">
            <Button
              type="button"
              variant="ghost"
              className="h-9 w-full"
              onClick={() => {
                onValueChange("");
                setOpen(false);
              }}
            >
              Quitar fecha
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

// La misma pieza dentro de un formulario de React Hook Form: se conecta sola al campo "name" (con el control del
// formulario o el de su FormProvider) y marca el error del campo.
export function FormDateField<T extends FieldValues>({
  control,
  name,
  ...props
}: { control?: Control<T>; name: Path<T> } & Omit<DateFieldProps, "value" | "onValueChange">) {
  const { field, fieldState } = useController({ control, name });
  return (
    <DateField
      {...props}
      value={String(field.value ?? "")}
      onValueChange={field.onChange}
      invalid={props.invalid ?? Boolean(fieldState.error)}
    />
  );
}
