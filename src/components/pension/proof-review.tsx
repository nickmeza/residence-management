"use client";

import { ExternalLink } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { formatShortDate, formatSoles } from "@/lib/format";
import { reviewPensionPaymentAction } from "@/server/pension/actions";
import type { PensionPaymentRow } from "@/server/pension/queries";
import { METHOD_LABEL } from "@/server/payments/schemas";

// Pensión › Pagos › Por revisar: los comprobantes que mandaron los comensales. Aprobar lo suma a su saldo;
// rechazar pide un motivo, que el comensal ve en "Mi pensión".
export function ProofReviewList({ pending }: { pending: PensionPaymentRow[] }) {
  if (!pending.length) return null;
  return (
    <section className="rounded-xl border border-warn-soft bg-card p-5 shadow-card" aria-labelledby="por-revisar">
      <h2 id="por-revisar" className="text-lg font-bold">
        Por revisar ({pending.length})
      </h2>
      <p className="text-sm text-muted-foreground">
        Comprobantes que te mandaron tus comensales. No cuentan hasta que los apruebes.
      </p>
      <ul className="mt-3 divide-y">
        {pending.map((p) => (
          <ProofRow key={p.id} p={p} />
        ))}
      </ul>
    </section>
  );
}

function ProofRow({ p }: { p: PensionPaymentRow }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const review = (input: { status: "confirmed" } | { status: "rejected"; reason: string }) =>
    startTransition(async () => {
      setError(undefined);
      const result = await reviewPensionPaymentAction(p.id, input);
      if (!result.ok) return setError(result.message);
      setRejecting(false);
    });

  return (
    <li className="flex flex-wrap items-center gap-3 py-3 text-sm">
      <span className="min-w-0 flex-1">
        <b>{p.name}</b> · {formatSoles(p.amount)} · {METHOD_LABEL[p.method]}
        {p.operationCode ? ` · Op. ${p.operationCode}` : ""}
        <span className="block text-muted-foreground">
          Pagó el {formatShortDate(p.paidOn)} · para del {formatShortDate(p.coversFrom)} al{" "}
          {formatShortDate(p.coversTo)}
        </span>
        <FormMessage message={error} />
      </span>
      {p.hasProof ? (
        <a
          href={`/archivos/comprobante-pension/${p.id}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-link underline-offset-4 hover:underline"
        >
          Ver comprobante
          <ExternalLink className="size-4" aria-hidden="true" />
        </a>
      ) : null}
      <Button
        type="button"
        variant="outline"
        className="h-11 text-danger"
        disabled={pending}
        onClick={() => {
          setReason("");
          setRejecting(true);
        }}
      >
        Rechazar
      </Button>
      <Button type="button" className="h-11" disabled={pending} onClick={() => review({ status: "confirmed" })}>
        Aprobar
      </Button>

      <Dialog open={rejecting} onOpenChange={setRejecting}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rechazar el pago de {p.name}</DialogTitle>
            <DialogDescription>
              {formatSoles(p.amount)} · {METHOD_LABEL[p.method]}. Tu comensal verá el motivo y podrá mandarlo de nuevo.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`motivo-${p.id}`}>Motivo</Label>
            <textarea
              id={`motivo-${p.id}`}
              rows={3}
              maxLength={200}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Por ejemplo: el monto no coincide con el Yape."
              className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base md:text-sm"
            />
          </div>
          <FormMessage message={error} />
          <DialogFooter>
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
              Rechazar pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}
