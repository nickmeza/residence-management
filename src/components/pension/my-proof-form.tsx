"use client";

import { useState, useTransition } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { FileField } from "@/components/payments/file-field";
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
import { formatShortDate } from "@/lib/format";
import { submitPensionProofAction } from "@/server/pension/actions";
import { METHOD_LABEL, PAYMENT_METHODS } from "@/server/payments/schemas";

const selectClass = "h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base md:text-sm";

// "Avisar que pagué" (decisión del dueño, 2026-11-13): el comensal manda cuánto pagó, cómo y la foto del
// comprobante. Llega lleno con su próximo pago (o lo que falta de un pago por partes). Queda en revisión hasta
// que su pensión lo apruebe.
export function MyProofForm({
  businessId,
  residentId,
  subscriptionId,
  today,
  suggestion,
}: {
  businessId: string;
  residentId: string;
  subscriptionId: string;
  today: string;
  suggestion: { amount: string; from: string; to: string };
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<(typeof PAYMENT_METHODS)[number]>("yape");
  const [paidOn, setPaidOn] = useState(today);
  const [operationCode, setOperationCode] = useState("");
  const [file, setFile] = useState<{ path: string; name: string } | null>(null);
  const [error, setError] = useState<{ message: string; fields: Record<string, string> }>();
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const start = () => {
    setAmount(String(Number(suggestion.amount) || ""));
    setMethod("yape");
    setPaidOn(today);
    setOperationCode("");
    setFile(null);
    setError(undefined);
    setOpen(true);
  };

  const send = () =>
    startTransition(async () => {
      setError(undefined);
      const result = await submitPensionProofAction({
        subscriptionId,
        amount,
        method,
        paidOn,
        coversFrom: suggestion.from,
        coversTo: suggestion.to,
        operationCode,
        proofPath: file?.path ?? "",
      });
      if (!result.ok) return setError({ message: result.message, fields: result.fieldErrors ?? {} });
      setOpen(false);
      setDone(true);
    });
  const fieldError = (n: string) =>
    error?.fields[n] ? <p className="text-sm text-danger">{error.fields[n]}</p> : null;

  return (
    <>
      <Button type="button" className="h-11 self-start" onClick={start}>
        Avisar que pagué
      </Button>
      {done ? (
        <p role="status" className="rounded-lg bg-ok-soft px-3 py-2 text-sm font-semibold text-ok">
          Enviado. Tu pensión lo revisará y aquí verás cuando lo apruebe.
        </p>
      ) : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Avisar que pagué</DialogTitle>
            <DialogDescription>
              Para del {formatShortDate(suggestion.from)} al {formatShortDate(suggestion.to)}. Si pagaste una parte,
              escribe solo lo que pagaste.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="proof-amount">Cuánto pagaste (S/)</Label>
              <Input
                id="proof-amount"
                inputMode="decimal"
                className="h-11"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {fieldError("amount")}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="proof-method">Cómo pagaste</Label>
              <select
                id="proof-method"
                className={selectClass}
                value={method}
                onChange={(e) => setMethod(e.target.value as (typeof PAYMENT_METHODS)[number])}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {METHOD_LABEL[m]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="proof-date">Cuándo pagaste</Label>
              <Input
                id="proof-date"
                type="date"
                className="h-11"
                max={today}
                value={paidOn}
                onChange={(e) => setPaidOn(e.target.value)}
              />
              {fieldError("paidOn")}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="proof-op">N.º de operación (opcional)</Label>
              <Input
                id="proof-op"
                className="h-11"
                value={operationCode}
                onChange={(e) => setOperationCode(e.target.value)}
              />
            </div>
          </div>
          <FileField
            businessId={businessId}
            residentId={residentId}
            folder="comprobantes"
            label="Foto o PDF del comprobante"
            value={file}
            onChange={setFile}
          />
          {fieldError("proofPath")}
          <FormMessage message={error?.message} />
          <DialogFooter>
            <Button type="button" variant="outline" className="h-11" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" className="h-11" disabled={pending || !file} onClick={send}>
              {pending ? "Enviando…" : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
