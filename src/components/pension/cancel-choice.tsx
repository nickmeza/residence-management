"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// "Cancelar" en el panel de cocina (decisión del dueño, 2026-11-15): pregunta quién cancela.
// - El comensal avisó: si fue después de la hora límite, se cobra (y luego se le avisará que su comida está en táper).
// - La cocina, por su lado (una emergencia): no se cobra (y luego se le mandará una disculpa).
export function CancelChoice({
  name,
  late,
  disabled,
  onChoose,
}: {
  name: string;
  late: boolean;
  disabled: boolean;
  onChoose: (kind: "cancel" | "kitchen_cancel") => void;
}) {
  const [open, setOpen] = useState(false);
  const choose = (kind: "cancel" | "kitchen_cancel") => {
    setOpen(false);
    onChoose(kind);
  };
  const option = "h-auto min-h-12 flex-col items-start gap-0.5 py-2.5 text-left whitespace-normal";

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        className="h-11"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        Cancelar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Quién cancela la comida de {name}?</DialogTitle>
            <DialogDescription>Así sabemos si se cobra o no.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button type="button" variant="outline" className={option} onClick={() => choose("cancel")}>
              <span className="font-bold">{name} avisó que no viene</span>
              <span className="text-xs font-normal text-muted-foreground">
                {late ? "Avisó después de la hora límite: se cobra." : "Avisó a tiempo: no se cobra."}
              </span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className={option}
              onClick={() => choose("kitchen_cancel")}
            >
              <span className="font-bold">Cancelamos nosotros</span>
              <span className="text-xs font-normal text-muted-foreground">
                Una emergencia de la cocina: no se cobra.
              </span>
            </Button>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" className="h-11" onClick={() => setOpen(false)}>
              Volver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
