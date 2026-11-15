"use client";

import { Copy } from "lucide-react";
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

import type { MenuBoard } from "./use-menu-board";

// "Copiar la semana anterior" (decisión del dueño, 2026-11-15): si esta semana todavía no tiene nada escrito, copia
// directo. Si ya hay días escritos, pregunta: reemplazar todo o solo llenar los días vacíos. Lo que ya pasó no se
// toca nunca.
export function CopyWeekButton({ board }: { board: MenuBoard }) {
  const [asking, setAsking] = useState(false);
  const copy = (mode: "fill" | "replace") => {
    setAsking(false);
    board.copyPreviousWeek(mode);
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        className="h-11 text-primary-text"
        disabled={board.pending || board.dirty}
        title={board.dirty ? "Guarda primero tus cambios" : undefined}
        onClick={() => (board.hasEditableMenu ? setAsking(true) : copy("fill"))}
      >
        <Copy aria-hidden="true" />
        Copiar la semana anterior
      </Button>
      <Dialog open={asking} onOpenChange={setAsking}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Esta semana ya tiene días escritos</DialogTitle>
            <DialogDescription>
              ¿Qué hacemos con lo que ya escribiste? Los días que ya pasaron no se tocan. Todo queda en
              borrador.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-auto min-h-12 flex-col items-start gap-0.5 py-2.5 text-left whitespace-normal"
              onClick={() => copy("fill")}
            >
              <span className="font-bold">Solo llenar los días vacíos</span>
              <span className="text-xs font-normal text-muted-foreground">
                Lo que escribiste se queda como está.
              </span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-auto min-h-12 flex-col items-start gap-0.5 py-2.5 text-left whitespace-normal"
              onClick={() => copy("replace")}
            >
              <span className="font-bold text-danger">Reemplazar todo</span>
              <span className="text-xs font-normal text-muted-foreground">
                Desde hoy, la semana queda igual a la anterior. Lo escrito se borra.
              </span>
            </Button>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" className="h-11" onClick={() => setAsking(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
