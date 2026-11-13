"use client";

import { Check } from "lucide-react";
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
} from "@/components/ui/dialog";
import { formatShortDate, formatSoles } from "@/lib/format";
import { registerPensionPaymentAction } from "@/server/pension/actions";
import { METHOD_LABEL, PAYMENT_METHODS } from "@/server/payments/schemas";

import type { PaymentSuggestion } from "./payment-dialog";

// "Marcar pagado" (decisión del dueño, 2026-11-13): para la pensión que coordina por WhatsApp. Un toque y se
// confirma el próximo pago sugerido, sin comprobante: solo se elige cómo pagó. Para cambiar el monto o los días
// está "Registrar pago". Si fue un error, se quita desde la ficha del comensal (queda en la bitácora).
export function QuickPaidButton({
  subscriptionId,
  name,
  today,
  suggestion,
}: {
  subscriptionId: string;
  name: string;
  today: string;
  suggestion: PaymentSuggestion;
}) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<(typeof PAYMENT_METHODS)[number]>("yape");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  if (!(Number(suggestion.amount) > 0)) return null;

  const confirm = () =>
    startTransition(async () => {
      setError(undefined);
      const result = await registerPensionPaymentAction({
        subscriptionId,
        amount: suggestion.amount,
        method,
        paidOn: today,
        coversFrom: suggestion.from,
        coversTo: suggestion.to,
        note: "",
      });
      if (!result.ok) return setError(result.message);
      setOpen(false);
    });

  return (
    <>
      <Button
        type="button"
        className="h-11"
        onClick={() => {
          setError(undefined);
          setOpen(true);
        }}
      >
        <Check aria-hidden="true" />
        Marcar pagado
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿{name} ya pagó?</DialogTitle>
            <DialogDescription>
              {formatSoles(suggestion.amount)} · del {formatShortDate(suggestion.from)} al{" "}
              {formatShortDate(suggestion.to)}. Se registra como pagado hoy, sin comprobante.
            </DialogDescription>
          </DialogHeader>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold">¿Cómo pagó?</legend>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((m) => (
                <Button
                  key={m}
                  type="button"
                  variant={method === m ? "default" : "outline"}
                  aria-pressed={method === m}
                  className="h-10"
                  onClick={() => setMethod(m)}
                >
                  {METHOD_LABEL[m]}
                </Button>
              ))}
            </div>
          </fieldset>
          <FormMessage message={error} />
          <DialogFooter>
            <Button type="button" variant="outline" className="h-11" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" className="h-11" disabled={pending} onClick={confirm}>
              {pending ? "Guardando…" : "Sí, pagó"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
