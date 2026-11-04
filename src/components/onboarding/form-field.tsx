"use client";

import type { ComponentProps, ReactNode } from "react";
import { useFormContext, useFormState, type FieldValues } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Busca un valor anidado por su ruta ("property.floors.0.name").
function getPath(source: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>((acc, key) => (acc as Record<string, unknown> | undefined)?.[key], source);
}

export function useFieldError(name: string): string | undefined {
  const { errors } = useFormState<FieldValues>({ name });
  const error = getPath(errors, name) as { message?: string } | undefined;
  return error?.message;
}

export function FieldError({ name, id }: { name: string; id?: string }) {
  const message = useFieldError(name);
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-danger">
      {message}
    </p>
  );
}

type TextFieldProps = {
  name: string;
  label: string;
  hint?: ReactNode;
  prefix?: string;
  // En filas compactas la etiqueta queda solo para lectores de pantalla.
  hideLabel?: boolean;
  className?: string;
} & Omit<ComponentProps<"input">, "name" | "prefix">;

// Campo de texto conectado al formulario: etiqueta, ayuda y error, enlazados para lectores de pantalla.
export function TextField({ name, label, hint, prefix, hideLabel, className, ...input }: TextFieldProps) {
  const { register } = useFormContext();
  const error = useFieldError(name);
  const id = name.replaceAll(".", "-");
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label htmlFor={id} className={hideLabel ? "sr-only" : undefined}>
        {label}
      </Label>
      <div className="flex items-center gap-2">
        {prefix ? <span className="text-sm text-muted-foreground">{prefix}</span> : null}
        <Input
          id={id}
          className="h-11"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          {...input}
          {...register(name)}
        />
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-card sm:p-6">
      <div>
        <h2 className="text-base font-bold">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
