"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { reviewDocumentAction } from "@/server/documents/actions";
import { REJECTION_REASONS } from "@/server/documents/schemas";

// Verificar o rechazar un documento en revisión. El motivo del rechazo se escribe libre, con sugerencias
// (un <datalist>: el navegador las muestra mientras escribes) y el residente lo ve.
export function ReviewButtons({ documentId, title }: { documentId: string; title: string }) {
  const router = useRouter();
  const listId = useId();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const review = (input: { status: "verified" } | { status: "rejected"; reason: string }) =>
    startTransition(async () => {
      setError(undefined);
      const result = await reviewDocumentAction(documentId, input);
      if (!result.ok) return setError(result.message);
      setRejecting(false);
      setReason("");
      router.refresh();
    });

  return (
    <span className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        className="h-11"
        disabled={pending}
        onClick={() => review({ status: "verified" })}
      >
        Verificar
      </Button>
      <Button
        type="button"
        variant="outline"
        className="h-11"
        disabled={pending}
        onClick={() => {
          setError(undefined);
          setRejecting(true);
        }}
      >
        Rechazar
      </Button>
      {error && !rejecting ? (
        <span role="alert" className="text-sm text-danger">
          {error}
        </span>
      ) : null}
      <Dialog open={rejecting} onOpenChange={setRejecting}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rechazar {title}</DialogTitle>
            <DialogDescription>El residente verá este motivo y podrá subirlo de nuevo.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${listId}-reason`}>Motivo</Label>
            <Input
              id={`${listId}-reason`}
              className="h-11"
              list={listId}
              autoComplete="off"
              placeholder="Elige una sugerencia o escribe lo que quieras"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <datalist id={listId}>
              {REJECTION_REASONS.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </div>
          <FormMessage message={error} />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="h-11" onClick={() => setRejecting(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-11"
              disabled={pending}
              onClick={() => review({ status: "rejected", reason })}
            >
              {pending ? "Guardando…" : "Rechazar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </span>
  );
}
