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
import { reviewPaymentAction } from "@/server/payments/actions";

const REASONS = ["No llegó el pago", "El monto no coincide", "No se lee el comprobante", "Pago duplicado"];

// Confirmar o rechazar un comprobante en revisión (PG-09). En un pago ya confirmado solo aparece "Anular",
// por si se registró por error: queda rechazado con su motivo y en la bitácora.
export function PaymentReviewButtons({
  paymentId,
  confirmed = false,
}: {
  paymentId: string;
  confirmed?: boolean;
}) {
  const router = useRouter();
  const listId = useId();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const review = (input: { status: "confirmed" } | { status: "rejected"; reason: string }) =>
    startTransition(async () => {
      setError(undefined);
      const result = await reviewPaymentAction(paymentId, input);
      if (!result.ok) return setError(result.message);
      setRejecting(false);
      setReason("");
      router.refresh();
    });

  return (
    <span className="flex flex-wrap items-center gap-2">
      {confirmed ? null : (
        <Button
          type="button"
          className="h-11"
          disabled={pending}
          onClick={() => review({ status: "confirmed" })}
        >
          Confirmar
        </Button>
      )}
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
        {confirmed ? "Anular" : "Rechazar"}
      </Button>
      {error && !rejecting ? (
        <span role="alert" className="text-sm text-danger">
          {error}
        </span>
      ) : null}
      <Dialog open={rejecting} onOpenChange={setRejecting}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{confirmed ? "Anular este pago" : "Rechazar este comprobante"}</DialogTitle>
            <DialogDescription>
              {confirmed
                ? "Deja de contar para el recibo. El residente verá el motivo. No se puede deshacer."
                : "El residente verá el motivo y podrá mandar otro."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${listId}-reason`}>Motivo</Label>
            <Input
              id={`${listId}-reason`}
              className="h-11"
              list={listId}
              autoComplete="off"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <datalist id={listId}>
              {REASONS.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </div>
          <FormMessage message={error} />
          <DialogFooter>
            <Button
              type="button"
              variant="destructive"
              className="h-11"
              disabled={pending}
              onClick={() => review({ status: "rejected", reason })}
            >
              {confirmed ? "Anular pago" : "Rechazar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </span>
  );
}
