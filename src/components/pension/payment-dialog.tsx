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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerPensionPaymentAction } from "@/server/pension/actions";
import { METHOD_LABEL, PAYMENT_METHODS } from "@/server/payments/schemas";

const selectClass = "h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base md:text-sm";

export type PaymentSuggestion = { amount: string; from: string; to: string };

type Draft = {
  amount: string;
  method: (typeof PAYMENT_METHODS)[number];
  paidOn: string;
  coversFrom: string;
  coversTo: string;
  note: string;
};

// Registrar un pago por adelantado (decisión del dueño): cuánto pagó y qué días cubre. Llega llenado con el próximo
// pago sugerido (el siguiente tramo según cada cuánto paga, menos su saldo a favor).
export function PaymentDialog({
  subscriptionId,
  name,
  today,
  suggestion,
  trigger,
}: {
  subscriptionId: string;
  name: string;
  today: string;
  suggestion: PaymentSuggestion;
  trigger: (open: () => void) => React.ReactNode;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<{ message: string; fields: Record<string, string> }>();
  const [pending, startTransition] = useTransition();

  const open = () => {
    setError(undefined);
    setDraft({
      amount: String(Number(suggestion.amount) || ""),
      method: "yape",
      paidOn: today,
      coversFrom: suggestion.from,
      coversTo: suggestion.to,
      note: "",
    });
  };
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  const fieldError = (n: keyof Draft) =>
    error?.fields[n] ? <p className="text-sm text-danger">{error.fields[n]}</p> : null;

  const save = () =>
    draft &&
    startTransition(async () => {
      setError(undefined);
      const result = await registerPensionPaymentAction({ subscriptionId, ...draft });
      if (!result.ok) return setError({ message: result.message, fields: result.fieldErrors ?? {} });
      setDraft(null);
    });

  return (
    <>
      {trigger(open)}
      <Dialog open={draft !== null} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar pago · {name}</DialogTitle>
            <DialogDescription>
              La pensión se paga por adelantado. Anota cuánto pagó y qué días cubre ese pago.
            </DialogDescription>
          </DialogHeader>
          {draft ? (
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pp-amount">Monto</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                      S/
                    </span>
                    <Input
                      id="pp-amount"
                      className="h-11 pl-9"
                      inputMode="decimal"
                      value={draft.amount}
                      onChange={(e) => set("amount", e.target.value)}
                    />
                  </div>
                  {fieldError("amount")}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pp-method">Cómo pagó</Label>
                  <select
                    id="pp-method"
                    className={selectClass}
                    value={draft.method}
                    onChange={(e) => set("method", e.target.value as Draft["method"])}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {METHOD_LABEL[m]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pp-from">Cubre desde</Label>
                  <Input
                    id="pp-from"
                    className="h-11"
                    type="date"
                    value={draft.coversFrom}
                    onChange={(e) => set("coversFrom", e.target.value)}
                  />
                  {fieldError("coversFrom")}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pp-to">Hasta</Label>
                  <Input
                    id="pp-to"
                    className="h-11"
                    type="date"
                    value={draft.coversTo}
                    onChange={(e) => set("coversTo", e.target.value)}
                  />
                  {fieldError("coversTo")}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pp-paid">Fecha del pago</Label>
                  <Input
                    id="pp-paid"
                    className="h-11"
                    type="date"
                    value={draft.paidOn}
                    onChange={(e) => set("paidOn", e.target.value)}
                  />
                  {fieldError("paidOn")}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pp-note">Nota (opcional)</Label>
                  <Input
                    id="pp-note"
                    className="h-11"
                    value={draft.note}
                    onChange={(e) => set("note", e.target.value)}
                  />
                  {fieldError("note")}
                </div>
              </div>
              <FormMessage message={error?.message} />
              <DialogFooter>
                <Button type="button" variant="outline" className="h-11" onClick={() => setDraft(null)}>
                  Cancelar
                </Button>
                <Button type="submit" className="h-11 px-5" disabled={pending}>
                  {pending ? "Guardando…" : "Registrar pago"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
