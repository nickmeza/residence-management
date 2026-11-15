"use client";

import { useState, useTransition } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { StatusBadge } from "@/components/status-badge";
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
import { formatSoles } from "@/lib/format";
import { rescheduleDepositAction } from "@/server/deposits/actions";
import { depositInstallments, MAX_DEPOSIT_INSTALLMENTS } from "@/server/deposits/rules";
import { periodLabel } from "@/server/payments/rules";

type Installment = { period: string; dueDate: string; amount: string; paid: boolean };

// Cuándo se cobra la garantía (decisión del dueño, 2026-11-15): por defecto, entera en el primer recibo. Si el
// residente no puede pagarla ese mes, el arrendador la mueve a otro mes o la parte en cuotas, mientras no haya
// pagado ninguna cuota.
export function DepositSchedule({
  depositId,
  amount,
  startDate,
  installments,
  canChange,
}: {
  depositId: string;
  amount: string;
  startDate: string;
  installments: Installment[];
  canChange: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [firstDue, setFirstDue] = useState(installments[0]?.dueDate ?? startDate);
  const [count, setCount] = useState(Math.max(1, installments.length));
  const [error, setError] = useState<{ message: string; fields: Record<string, string> }>();
  const [pending, startTransition] = useTransition();
  if (!installments.length) return null;

  const preview = firstDue ? depositInstallments({ amount, firstDue, count }) : [];
  const save = () =>
    startTransition(async () => {
      setError(undefined);
      const result = await rescheduleDepositAction(depositId, { firstDue, installments: count });
      if (!result.ok) return setError({ message: result.message, fields: result.fieldErrors ?? {} });
      setOpen(false);
    });

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Cuándo se cobra</h2>
        {canChange ? (
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={() => {
              setFirstDue(installments[0]?.dueDate ?? startDate);
              setCount(Math.max(1, installments.length));
              setError(undefined);
              setOpen(true);
            }}
          >
            Cambiar cuándo se cobra
          </Button>
        ) : null}
      </div>
      <ul className="divide-y rounded-lg border text-sm">
        {installments.map((x, i) => (
          <li key={x.dueDate + i} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
            <span className="min-w-0 flex-1">
              {installments.length > 1 ? `Cuota ${i + 1} · ` : ""}
              <span className="first-letter:uppercase">{periodLabel(x.period)}</span>
            </span>
            <b className="tabular-nums">{formatSoles(x.amount)}</b>
            {x.paid ? (
              <StatusBadge tone="ok">Pagada</StatusBadge>
            ) : (
              <StatusBadge tone="warn">Por cobrar</StatusBadge>
            )}
          </li>
        ))}
      </ul>
      {!canChange ? (
        <p className="text-xs text-muted-foreground">
          Ya no se puede cambiar: tiene alguna cuota pagada o la garantía está en liquidación.
        </p>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cambiar cuándo se cobra la garantía</DialogTitle>
            <DialogDescription>
              {formatSoles(amount)}. Muévela a otro mes o pártela en cuotas mensuales. Aparece en los recibos
              de esos meses.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="deposit-first-due">Vence la primera cuota</Label>
              <Input
                id="deposit-first-due"
                type="date"
                className="h-11"
                min={startDate}
                value={firstDue}
                onChange={(e) => setFirstDue(e.target.value)}
              />
              {error?.fields.firstDue ? <p className="text-sm text-danger">{error.fields.firstDue}</p> : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="deposit-count">Cuotas</Label>
              <select
                id="deposit-count"
                className="h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base md:text-sm"
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              >
                {Array.from({ length: MAX_DEPOSIT_INSTALLMENTS }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? "1 (entera)" : n}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {preview.length ? (
            <ul className="divide-y rounded-lg border text-sm">
              {preview.map((p, i) => (
                <li key={p.dueDate} className="flex justify-between gap-3 px-3 py-2">
                  <span className="first-letter:uppercase">
                    {preview.length > 1 ? `Cuota ${i + 1} · ` : ""}
                    {periodLabel(p.period)}
                  </span>
                  <b className="tabular-nums">{formatSoles(p.amount)}</b>
                </li>
              ))}
            </ul>
          ) : null}
          <FormMessage message={error?.message} />
          <DialogFooter>
            <Button type="button" variant="outline" className="h-11" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" className="h-11" disabled={pending || !firstDue} onClick={save}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
