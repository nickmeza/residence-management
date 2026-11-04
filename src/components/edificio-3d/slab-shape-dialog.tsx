"use client";

import { useState, useTransition } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OutlinePoint } from "@/db/schema";
import { cn } from "@/lib/utils";
import { setFloorShapeAction } from "@/server/building/actions";
import { outlineArea } from "@/server/building/geometry";
import { outlineFromShape, shapeFromOutline, shapeProblem, type SlabShape } from "@/server/building/drag";

const PROBLEM_TEXT = {
  too_small: "La losa debe medir al menos 1 m de ancho y de fondo.",
  cut_too_big: "El corte de la L debe ser más chico que la losa.",
  invalid: "Con esas medidas la losa no tiene una forma válida.",
} as const;

function NumberField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        step={0.1}
        min={0}
        className="h-11"
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

// "Forma de la losa": rectángulo (ancho × fondo) o L (un rectángulo al que le falta la esquina de arriba a la
// derecha). El servidor no deja guardar si alguna unidad quedaría fuera.
export function SlabShapeDialog({
  floorId,
  floorLabel,
  outline,
}: {
  floorId: string;
  floorLabel: string;
  outline: OutlinePoint[];
}) {
  const initial: SlabShape = shapeFromOutline(outline) ?? { kind: "rect", width: 8, depth: 6 };
  const [open, setOpen] = useState(false);
  const [shape, setShape] = useState<SlabShape>(initial);
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();
  const problem = shapeProblem(shape);
  const update = (patch: Partial<{ width: number; depth: number; cutWidth: number; cutDepth: number }>) =>
    setShape((s) => ({ ...s, ...patch }) as SlabShape);

  const setKind = (kind: SlabShape["kind"]) =>
    setShape((s) =>
      kind === "rect"
        ? { kind, width: s.width, depth: s.depth }
        : {
            kind,
            width: s.width,
            depth: s.depth,
            cutWidth: Math.round(s.width * 5) / 10,
            cutDepth: Math.round(s.depth * 5) / 10,
          },
    );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setShape(initial);
          setMessage(undefined);
        }
      }}
    >
      <DialogTrigger render={<Button type="button" variant="outline" className="h-11" />}>
        Forma de la losa
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Forma de la losa · {floorLabel}</DialogTitle>
          <DialogDescription>
            Medidas en metros. Las unidades deben quedar dentro de la losa.
          </DialogDescription>
        </DialogHeader>
        <div role="radiogroup" aria-label="Forma" className="flex rounded-lg border bg-card p-0.5">
          {(
            [
              ["rect", "Rectángulo"],
              ["L", "Forma de L"],
            ] as const
          ).map(([kind, label]) => (
            <button
              key={kind}
              type="button"
              role="radio"
              aria-checked={shape.kind === kind}
              onClick={() => setKind(kind)}
              className={cn(
                "min-h-10 flex-1 rounded-md px-3 text-sm font-semibold transition-colors duration-200",
                shape.kind === kind
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            id="slab-width"
            label="Ancho"
            value={shape.width}
            onChange={(width) => update({ width })}
          />
          <NumberField
            id="slab-depth"
            label="Fondo"
            value={shape.depth}
            onChange={(depth) => update({ depth })}
          />
          {shape.kind === "L" ? (
            <>
              <NumberField
                id="slab-cut-w"
                label="Corte: ancho"
                value={shape.cutWidth}
                onChange={(cutWidth) => update({ cutWidth })}
              />
              <NumberField
                id="slab-cut-d"
                label="Corte: fondo"
                value={shape.cutDepth}
                onChange={(cutDepth) => update({ cutDepth })}
              />
            </>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {problem ? PROBLEM_TEXT[problem] : `Área: ${outlineArea(outlineFromShape(shape)).toFixed(1)} m²`}
        </p>
        <FormMessage message={message} />
        <DialogFooter>
          <Button
            type="button"
            className="h-11 px-5"
            disabled={pending || Boolean(problem)}
            onClick={() =>
              startTransition(async () => {
                const result = await setFloorShapeAction(floorId, shape);
                if (result.ok) setOpen(false);
                else setMessage(result.message);
              })
            }
          >
            {pending ? "Guardando…" : "Guardar forma"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
