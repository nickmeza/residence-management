"use client";

import { useState, useTransition } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatShortDate, formatSoles } from "@/lib/format";
import { cancelMyMealAction, pauseMyPensionAction, type PensionResult } from "@/server/pension/actions";
import type { MyPension } from "@/server/pension/queries";
import { BILLING_CYCLE_LABEL, cancellationOpen, limaNow, MEAL_LABEL } from "@/server/pension/rules";
import { METHOD_LABEL } from "@/server/payments/schemas";

import { AccountSummary } from "./account-summary";

const card = "flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card";

// "AAAA-MM-DDTHH:MM" → "el 15/11 a las 20:00".
const deadlineText = (deadline: string) =>
  `el ${deadline.slice(8, 10)}/${deadline.slice(5, 7)} a las ${deadline.slice(11)}`;

function Pension({ p, today }: { p: MyPension; today: string }) {
  const [range, setRange] = useState({ fromDate: today, toDate: today });
  const [message, setMessage] = useState<{ text: string; ok: boolean }>();
  const [pending, startTransition] = useTransition();
  const now = limaNow(new Date());
  const s = p.subscription;

  const run = (action: () => Promise<PensionResult>, ok: string) =>
    startTransition(async () => {
      const result = await action();
      setMessage(result.ok ? { text: ok, ok: true } : { text: result.message, ok: false });
    });

  return (
    <div className="flex flex-col gap-5">
      <section className={card}>
        <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
          {p.businessName}
        </span>
        {s ? (
          <>
            <h2 className="text-lg font-bold">{s.planName}</h2>
            <p className="text-sm text-muted-foreground">
              {s.planMeals.map((m) => MEAL_LABEL[m]).join(", ")} · {formatSoles(s.dailyPrice)} al día · pagas{" "}
              {BILLING_CYCLE_LABEL[s.billingCycle].toLowerCase()}, por adelantado
            </p>
          </>
        ) : null}
        <p className="text-sm text-muted-foreground">
          Por defecto te cocinamos todos los días de tu plan. Si no vas a comer, cancela hasta la hora límite
          del día anterior: así no se te cobra.
        </p>
      </section>

      <section className={card} aria-labelledby={`dias-${p.residentId}`}>
        <h2 id={`dias-${p.residentId}`} className="text-lg font-bold">
          Próximos días
        </h2>
        {p.days.length ? (
          <ul className="flex flex-col gap-3">
            {p.days.map((d) => (
              <li key={d.date} className="rounded-lg border">
                <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
                  <b className="text-sm">
                    {d.date === today ? "Hoy · " : ""}
                    {formatShortDate(d.date)}
                  </b>
                  {d.paused ? <StatusBadge tone="warn">En pausa</StatusBadge> : null}
                </div>
                {d.paused ? (
                  <p className="px-3 py-2.5 text-sm text-muted-foreground">
                    Ese día no se cocina ni se cobra.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {d.meals.map((m) => {
                      const open = cancellationOpen(now, m.deadline);
                      return (
                        <li key={m.type} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
                          <span className="min-w-0 flex-1">
                            <b>{MEAL_LABEL[m.type]}</b>
                            {m.menu ? (
                              <span className="text-muted-foreground">
                                {" "}
                                · {m.menu.dish}
                                {m.menu.hasVegetarian ? " (hay opción vegetariana)" : ""}
                              </span>
                            ) : null}
                            <span className="block text-xs text-muted-foreground">
                              {open
                                ? `Puedes cancelar hasta ${deadlineText(m.deadline)}`
                                : "Ya cerró para cambios"}
                            </span>
                          </span>
                          {m.served ? (
                            <StatusBadge tone="ok">Comiste</StatusBadge>
                          ) : m.cancelled ? (
                            <StatusBadge tone="neutral">Cancelada</StatusBadge>
                          ) : (
                            <StatusBadge tone="primary">Te cocinamos</StatusBadge>
                          )}
                          {open && !m.served ? (
                            <Button
                              type="button"
                              variant={m.cancelled ? "outline" : "ghost"}
                              className="h-11"
                              disabled={pending}
                              onClick={() =>
                                run(
                                  () =>
                                    cancelMyMealAction({
                                      residentId: p.residentId,
                                      date: d.date,
                                      meal: m.type,
                                      cancel: !m.cancelled,
                                    }),
                                  m.cancelled
                                    ? "Listo: te cocinamos esa comida."
                                    : "Listo: cancelaste esa comida.",
                                )
                              }
                            >
                              {m.cancelled ? "Volver a pedir" : "Cancelar"}
                            </Button>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Tu plan no tiene días en esta semana.</p>
        )}
      </section>

      <section className={card}>
        <h2 className="text-lg font-bold">Mis pagos</h2>
        <AccountSummary account={p.account} />
        {p.account.payments.length ? (
          <ul className="divide-y rounded-lg border">
            {p.account.payments.map((x) => (
              <li key={x.id} className="px-3 py-2.5 text-sm">
                <b>{formatSoles(x.amount)}</b> · {METHOD_LABEL[x.method]} · {formatShortDate(x.paidOn)}
                <span className="block text-muted-foreground">
                  Cubre del {formatShortDate(x.coversFrom)} al {formatShortDate(x.coversTo)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Todavía no hay pagos registrados.</p>
        )}
        <p className="text-xs text-muted-foreground">
          Los pagos los registra tu pensión. Las comidas que cancelas a tiempo y los días en pausa quedan como
          saldo a favor.
        </p>
      </section>

      {s ? (
        <section className={card}>
          <h2 className="text-lg font-bold">Pausar mi pensión</h2>
          <p className="text-sm text-muted-foreground">
            ¿Viajas? Los días en pausa no se cocinan ni se cobran.
          </p>
          {s.pauses.length ? (
            <ul className="text-sm">
              {s.pauses.map((x) => (
                <li key={x.id}>
                  En pausa del {formatShortDate(x.fromDate)} al {formatShortDate(x.toDate)}
                </li>
              ))}
            </ul>
          ) : null}
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => pauseMyPensionAction(s.id, range), "Listo: pausamos tu pensión esos días.");
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`pf-${p.residentId}`}>Desde</Label>
              <Input
                id={`pf-${p.residentId}`}
                className="h-11"
                type="date"
                value={range.fromDate}
                onChange={(e) => setRange({ ...range, fromDate: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`pt-${p.residentId}`}>Hasta</Label>
              <Input
                id={`pt-${p.residentId}`}
                className="h-11"
                type="date"
                value={range.toDate}
                onChange={(e) => setRange({ ...range, toDate: e.target.value })}
              />
            </div>
            <Button type="submit" variant="outline" className="h-11" disabled={pending}>
              Pausar
            </Button>
          </form>
        </section>
      ) : null}

      {message ? (
        message.ok ? (
          <p role="status" className="rounded-lg bg-ok-soft px-3 py-2 text-sm font-semibold text-ok">
            {message.text}
          </p>
        ) : (
          <FormMessage message={message.text} />
        )
      ) : null}
    </div>
  );
}

// "Mi pensión" del comensal (PN-05, PN-15, PN-16). Una sección por cada pensión donde come (pueden ser de dueños
// distintos, regla 14).
export function MyPensionView({ pensions, today }: { pensions: MyPension[]; today: string }) {
  if (!pensions.length) {
    return (
      <p className="rounded-xl border bg-card p-6 text-muted-foreground shadow-card">
        Todavía no estás afiliado a ninguna pensión.
      </p>
    );
  }
  return (
    <>
      {pensions.map((p) => (
        <Pension key={p.residentId} p={p} today={today} />
      ))}
    </>
  );
}
