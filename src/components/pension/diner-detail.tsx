"use client";

import { useState, useTransition, type ReactNode } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { ConfirmButton } from "@/components/confirm-button";
import { InviteButton } from "@/components/residents/invite-button";
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
import { formatShortDate, formatSoles } from "@/lib/format";
import {
  addPauseAction,
  deletePensionPaymentAction,
  removePauseAction,
  subscribeAction,
  updateDinerContactAction,
  updateSubscriptionAction,
  type PensionResult,
} from "@/server/pension/actions";
import type { DinerDetail } from "@/server/pension/queries";
import { BILLING_CYCLE_LABEL, pauseRemovable, type BillingCycle } from "@/server/pension/rules";
import { METHOD_LABEL } from "@/server/payments/schemas";

import { AccountSummary } from "./account-summary";
import { PaymentDialog } from "./payment-dialog";
import { SUBSCRIPTION_STATE } from "./subscription-state";

const selectClass = "h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base md:text-sm";
const card = "flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card";

type Fields = Record<string, string>;

// Un formulario en una ventana: guarda con la acción que recibe y muestra los errores junto a cada campo.
function FormDialog({
  title,
  description,
  submitLabel,
  trigger,
  onSubmit,
  children,
}: {
  title: string;
  description: string;
  submitLabel: string;
  trigger: (open: () => void) => ReactNode;
  onSubmit: () => Promise<PensionResult>;
  children: (errors: Fields) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<{ message: string; fields: Fields }>();
  const [pending, startTransition] = useTransition();
  const save = () =>
    startTransition(async () => {
      setError(undefined);
      const result = await onSubmit();
      if (!result.ok) return setError({ message: result.message, fields: result.fieldErrors ?? {} });
      setOpen(false);
    });
  return (
    <>
      {trigger(() => {
        setError(undefined);
        setOpen(true);
      })}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            {children(error?.fields ?? {})}
            <FormMessage message={error?.message} />
            <DialogFooter>
              <Button type="button" variant="outline" className="h-11" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="h-11 px-5" disabled={pending}>
                {pending ? "Guardando…" : submitLabel}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}

function ContactCard({ diner }: { diner: DinerDetail }) {
  const [v, setV] = useState({ fullName: diner.name, phone: diner.phone ?? "", email: diner.email ?? "" });
  return (
    <section className={card}>
      <h2 className="text-lg font-bold">Datos</h2>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Celular</dt>
          <dd className="font-semibold">{diner.phone ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Correo</dt>
          <dd className="font-semibold break-all">{diner.email ?? "—"}</dd>
        </div>
      </dl>
      <p className="text-sm text-muted-foreground">
        {diner.hasAccount
          ? "Ya tiene cuenta: cancela sus comidas, pausa y ve sus pagos desde su celular."
          : "Invítalo para que cancele sus comidas y vea sus pagos desde su celular. Si no, lo haces tú desde aquí."}
      </p>
      {!diner.hasAccount ? (
        <div className="flex flex-wrap gap-2">
          <InviteButton residentId={diner.residentId} />
          <FormDialog
            title="Editar datos"
            description="Nombre y celular o correo."
            submitLabel="Guardar"
            trigger={(open) => (
              <Button type="button" variant="outline" className="h-11" onClick={open}>
                Editar datos
              </Button>
            )}
            onSubmit={() => updateDinerContactAction(diner.businessId, diner.residentId, v)}
          >
            {(e) => (
              <>
                <Field id="c-name" label="Nombre y apellido" error={e.fullName}>
                  <Input
                    id="c-name"
                    className="h-11"
                    value={v.fullName}
                    onChange={(x) => setV({ ...v, fullName: x.target.value })}
                  />
                </Field>
                <Field id="c-phone" label="Celular" error={e.phone}>
                  <Input
                    id="c-phone"
                    className="h-11"
                    inputMode="tel"
                    value={v.phone}
                    onChange={(x) => setV({ ...v, phone: x.target.value })}
                  />
                </Field>
                <Field id="c-email" label="Correo (opcional)" error={e.email}>
                  <Input
                    id="c-email"
                    className="h-11"
                    type="email"
                    value={v.email}
                    onChange={(x) => setV({ ...v, email: x.target.value })}
                  />
                </Field>
              </>
            )}
          </FormDialog>
        </div>
      ) : null}
    </section>
  );
}

function PlanFields({
  diner,
  v,
  set,
  errors,
}: {
  diner: DinerDetail;
  v: { planId: string; billingCycle: BillingCycle; dietNote: string };
  set: (patch: Partial<{ planId: string; billingCycle: BillingCycle; dietNote: string }>) => void;
  errors: Fields;
}) {
  return (
    <>
      <Field id="s-plan" label="Plan" error={errors.planId}>
        <select
          id="s-plan"
          className={selectClass}
          value={v.planId}
          onChange={(e) => set({ planId: e.target.value })}
        >
          {diner.plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {formatSoles(p.dailyPrice)} al día{p.active ? "" : " (desactivado)"}
            </option>
          ))}
        </select>
      </Field>
      <Field id="s-cycle" label="Paga por adelantado" error={errors.billingCycle}>
        <select
          id="s-cycle"
          className={selectClass}
          value={v.billingCycle}
          onChange={(e) => set({ billingCycle: e.target.value as BillingCycle })}
        >
          {(Object.keys(BILLING_CYCLE_LABEL) as BillingCycle[]).map((c) => (
            <option key={c} value={c}>
              {BILLING_CYCLE_LABEL[c]}
            </option>
          ))}
        </select>
      </Field>
      <Field id="s-diet" label="Dieta o alergias (opcional)" error={errors.dietNote}>
        <Input
          id="s-diet"
          className="h-11"
          value={v.dietNote}
          onChange={(e) => set({ dietNote: e.target.value })}
        />
      </Field>
    </>
  );
}

function PlanCard({ diner }: { diner: DinerDetail }) {
  const s = diner.current;
  const [edit, setEdit] = useState({
    planId: s?.planId ?? diner.plans[0]?.id ?? "",
    billingCycle: (s?.billingCycle ?? "weekly") as BillingCycle,
    dietNote: s?.dietNote ?? "",
    endDate: s?.endDate ?? "",
  });
  const [fresh, setFresh] = useState({
    planId: diner.plans[0]?.id ?? "",
    billingCycle: "weekly" as BillingCycle,
    dietNote: s?.dietNote ?? "",
    startDate: diner.today,
  });
  const canSubscribe = !s || s.state === "ended";

  return (
    <section className={card}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex-1 text-lg font-bold">Su plan</h2>
        {s ? (
          <StatusBadge tone={SUBSCRIPTION_STATE[s.state].tone}>
            {SUBSCRIPTION_STATE[s.state].label}
          </StatusBadge>
        ) : null}
      </div>
      {s ? (
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Plan</dt>
            <dd className="font-semibold">
              {s.planName} · {formatSoles(s.dailyPrice)} al día
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Paga</dt>
            <dd className="font-semibold">{BILLING_CYCLE_LABEL[s.billingCycle]}, por adelantado</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Desde</dt>
            <dd className="font-semibold">{formatShortDate(s.startDate)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Hasta</dt>
            <dd className="font-semibold">{s.endDate ? formatShortDate(s.endDate) : "Sin fecha de fin"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Dieta o alergias</dt>
            <dd className="font-semibold">{s.dietNote ?? "—"}</dd>
          </div>
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">No tiene plan: no se le cocina ni se le cobra.</p>
      )}
      <div className="flex flex-wrap gap-2">
        {s && s.state !== "ended" ? (
          <FormDialog
            title="Cambiar su plan"
            description="Para que deje de venir, pon la fecha de su último día."
            submitLabel="Guardar"
            trigger={(open) => (
              <Button type="button" variant="outline" className="h-11" onClick={open}>
                Cambiar o terminar
              </Button>
            )}
            onSubmit={() => updateSubscriptionAction(s.id, edit)}
          >
            {(e) => (
              <>
                <PlanFields diner={diner} v={edit} set={(p) => setEdit({ ...edit, ...p })} errors={e} />
                <Field id="s-end" label="Último día (opcional)" error={e.endDate}>
                  <Input
                    id="s-end"
                    className="h-11"
                    type="date"
                    value={edit.endDate}
                    onChange={(x) => setEdit({ ...edit, endDate: x.target.value })}
                  />
                </Field>
              </>
            )}
          </FormDialog>
        ) : null}
        {canSubscribe && diner.plans.length ? (
          <FormDialog
            title="Afiliar a un plan"
            description="Desde ese día se le cocina por defecto y se le cobra por adelantado."
            submitLabel="Afiliar"
            trigger={(open) => (
              <Button type="button" className="h-11" onClick={open}>
                Afiliar a un plan
              </Button>
            )}
            onSubmit={() =>
              subscribeAction(diner.businessId, { ...fresh, residentId: diner.residentId, endDate: "" })
            }
          >
            {(e) => (
              <>
                <PlanFields diner={diner} v={fresh} set={(p) => setFresh({ ...fresh, ...p })} errors={e} />
                <Field id="s-start" label="Desde" error={e.startDate}>
                  <Input
                    id="s-start"
                    className="h-11"
                    type="date"
                    value={fresh.startDate}
                    onChange={(x) => setFresh({ ...fresh, startDate: x.target.value })}
                  />
                </Field>
              </>
            )}
          </FormDialog>
        ) : null}
      </div>
    </section>
  );
}

function PausesCard({ diner }: { diner: DinerDetail }) {
  const s = diner.current;
  const [range, setRange] = useState({ fromDate: diner.today, toDate: diner.today });
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();
  if (!s || s.state === "ended") return null;
  const act = (action: () => Promise<PensionResult>) =>
    startTransition(async () => {
      const result = await action();
      setMessage(result.ok ? undefined : result.message);
    });
  return (
    <section className={card}>
      <h2 className="text-lg font-bold">Pausas</h2>
      <p className="text-sm text-muted-foreground">¿Viaja? Los días en pausa no se cocinan ni se cobran.</p>
      {s.pauses.length ? (
        <ul className="divide-y rounded-lg border">
          {s.pauses.map((p) => (
            <li key={p.id} className="flex min-h-12 items-center gap-3 px-3 text-sm">
              <span className="flex-1">
                Del {formatShortDate(p.fromDate)} al {formatShortDate(p.toDate)}
              </span>
              {pauseRemovable(p, diner.today) ? (
                <ConfirmButton
                  trigger={
                    <Button type="button" variant="ghost" className="h-11" disabled={pending}>
                      Quitar
                    </Button>
                  }
                  title="¿Quitar esta pausa?"
                  description="Esos días se le volverá a cocinar y cobrar."
                  confirmLabel="Quitar pausa"
                  onConfirm={() => act(() => removePauseAction(p.id))}
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          act(() => addPauseAction(s.id, range));
        }}
      >
        <Field id="pa-from" label="Desde">
          <Input
            id="pa-from"
            className="h-11"
            type="date"
            value={range.fromDate}
            onChange={(e) => setRange({ ...range, fromDate: e.target.value })}
          />
        </Field>
        <Field id="pa-to" label="Hasta">
          <Input
            id="pa-to"
            className="h-11"
            type="date"
            value={range.toDate}
            onChange={(e) => setRange({ ...range, toDate: e.target.value })}
          />
        </Field>
        <Button type="submit" variant="outline" className="h-11" disabled={pending}>
          Pausar
        </Button>
      </form>
      <FormMessage message={message} />
    </section>
  );
}

function PaymentsCard({ diner }: { diner: DinerDetail }) {
  const s = diner.current;
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();
  if (!s) return null;
  const remove = (id: string) =>
    startTransition(async () => {
      const result = await deletePensionPaymentAction(id);
      setMessage(result.ok ? undefined : result.message);
    });
  return (
    <section className={card}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex-1 text-lg font-bold">Pagos</h2>
        <PaymentDialog
          subscriptionId={s.id}
          name={diner.name}
          today={diner.today}
          suggestion={s.account.next}
          trigger={(open) => (
            <Button type="button" className="h-11" onClick={open}>
              Registrar pago
            </Button>
          )}
        />
      </div>
      <AccountSummary account={s.account} />
      {s.account.payments.length ? (
        <ul className="divide-y rounded-lg border">
          {s.account.payments.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
              <span className="min-w-0 flex-1">
                <b>{formatSoles(p.amount)}</b> · {METHOD_LABEL[p.method]} · {formatShortDate(p.paidOn)}
                <span className="block text-muted-foreground">
                  Cubre del {formatShortDate(p.coversFrom)} al {formatShortDate(p.coversTo)}
                  {p.note ? ` · ${p.note}` : ""}
                </span>
              </span>
              <ConfirmButton
                trigger={
                  <Button type="button" variant="ghost" className="h-11" disabled={pending}>
                    Quitar
                  </Button>
                }
                title="¿Quitar este pago?"
                description="Úsalo solo si lo registraste por error. Queda anotado en la bitácora."
                confirmLabel="Quitar pago"
                onConfirm={() => remove(p.id)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Todavía no tiene pagos registrados.</p>
      )}
      <FormMessage message={message} />
    </section>
  );
}

// Página de un comensal: sus datos, su plan, sus pausas y sus pagos.
export function DinerDetailView({ diner }: { diner: DinerDetail }) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-6">
        <ContactCard diner={diner} />
        <PlanCard diner={diner} />
        <PausesCard diner={diner} />
      </div>
      <PaymentsCard diner={diner} />
    </div>
  );
}
