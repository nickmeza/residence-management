"use client";

import { useController, type Control, type FieldValues, type Path } from "react-hook-form";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type SelectOption = { value: string; label: string; disabled?: boolean };

// Selector de la app (shadcn sobre Base UI) en lugar del <select> del navegador, que se ve distinto en cada equipo.
// Trabaja con texto como el <select>: "" es "ninguna opción" y muestra la opción con value "" (por ejemplo
// "Cualquiera") o, si no hay, el placeholder.
export type SelectFieldProps = {
  id?: string;
  // Nombre para lectores de pantalla cuando no hay etiqueta visible.
  ariaLabel?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  name?: string;
  className?: string;
};

export function SelectField({
  id,
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  invalid,
  name,
  className,
  ariaLabel,
}: SelectFieldProps) {
  // Base UI usa null para "sin elegir"; aquí se traduce desde y hacia "".
  const items = options.map((o) => ({ ...o, value: o.value === "" ? null : o.value }));
  return (
    <Select
      items={items}
      value={value === "" ? null : value}
      onValueChange={(v) => onValueChange(typeof v === "string" ? v : "")}
      disabled={disabled}
      name={name}
    >
      <SelectTrigger
        id={id}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        className={cn("w-full min-w-0 text-base data-[size=default]:h-11 md:text-sm", className)}
      >
        {/* El texto va en su propio <span> para que, si es largo, se corte con "…" en vez de ensanchar el campo. */}
        <SelectValue className="min-w-0">
          {(v: string | null) => (
            <span className="truncate">{items.find((o) => o.value === v)?.label ?? placeholder}</span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {items.map((o) => (
          <SelectItem key={o.value ?? ""} value={o.value} disabled={o.disabled}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// La misma pieza dentro de un formulario de React Hook Form: se conecta sola al campo "name" (con el control del
// formulario o el de su FormProvider) y marca el error del campo.
export function FormSelectField<T extends FieldValues>({
  control,
  name,
  ...props
}: { control?: Control<T>; name: Path<T> } & Omit<SelectFieldProps, "value" | "onValueChange">) {
  const { field, fieldState } = useController({ control, name });
  return (
    <SelectField
      {...props}
      value={String(field.value ?? "")}
      onValueChange={field.onChange}
      invalid={props.invalid ?? Boolean(fieldState.error)}
    />
  );
}
