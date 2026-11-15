"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { ConfirmButton } from "@/components/confirm-button";
import { textareaClass } from "@/components/form-controls";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { reviewApplicationAction } from "@/server/applications/actions";
import { applicationMoves, type ApplicationStatus } from "@/server/applications/rules";

// Aprobar (crea su ficha de residente), dejar en lista de espera o rechazar (con confirmación). La nota es solo tuya.
export function ApplicationReview({
  id,
  status,
  note: savedNote,
}: {
  id: string;
  status: ApplicationStatus;
  note: string | null;
}) {
  const router = useRouter();
  const [note, setNote] = useState(savedNote ?? "");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const moves = applicationMoves(status);

  const review = (next: "waitlist" | "approved" | "rejected") =>
    startTransition(async () => {
      const r = await reviewApplicationAction(id, { status: next, note });
      if (!r.ok) return setError(r.message);
      setError(undefined);
      if (r.residentId) router.push(`/residentes/${r.residentId}`);
      router.refresh();
    });

  if (!moves.length) return null;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nota">Nota (solo la ves tú)</Label>
        <textarea
          id="nota"
          rows={2}
          maxLength={500}
          className={textareaClass}
          value={note}
          placeholder="Por ejemplo: le ofrecí el 302 desde marzo."
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <FormMessage message={error} />
      <div className="flex flex-wrap gap-2">
        {moves.includes("approved") ? (
          <Button type="button" className="h-11" disabled={pending} onClick={() => review("approved")}>
            Aprobar y crear su ficha
          </Button>
        ) : null}
        {moves.includes("waitlist") ? (
          <Button
            type="button"
            variant="outline"
            className="h-11"
            disabled={pending}
            onClick={() => review("waitlist")}
          >
            Pasar a lista de espera
          </Button>
        ) : null}
        {moves.includes("rejected") ? (
          <ConfirmButton
            trigger={
              <Button type="button" variant="outline" className="h-11 text-danger" disabled={pending}>
                Rechazar
              </Button>
            }
            title="¿Rechazar esta postulación?"
            description="Queda guardada como rechazada. Si cambias de idea, puedes pasarla a la lista de espera."
            confirmLabel="Sí, rechazar"
            onConfirm={() => review("rejected")}
          />
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">
        Al aprobar se crea su ficha de residente. Desde ahí le asignas una unidad con un contrato y lo invitas
        a su cuenta.
      </p>
    </div>
  );
}
