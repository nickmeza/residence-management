"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { ConfirmButton } from "@/components/confirm-button";
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
import { deletePlanAction, savePlanAction } from "@/server/pension/actions";
import type { MealRow, PlanRow } from "@/server/pension/queries";
import { MEAL_LABEL, MEAL_TYPES, planPriceWarning, type MealType } from "@/server/pension/rules";

type Draft = { id: string | null; name: string; meals: MealType[]; dailyPrice: string; active: boolean };

// Planes de la pensión (PN-01): qué comidas incluye y su precio por día. Un plan con comensales no se borra: se
// desactiva para no ofrecerlo a nuevos.
export function PlansEditor({
  businessId,
  plans,
  meals,
}: {
  businessId: string;
  plans: PlanRow[];
  meals: MealRow[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<{ message: string; fields: Record<string, string> }>();
  const [pending, startTransition] = useTransition();
  const offered = meals.filter((m) => m.active).map((m) => m.type);

  const open = (d: Draft) => {
    setError(undefined);
    setDraft(d);
  };

  const save = () =>
    draft &&
    startTransition(async () => {
      setError(undefined);
      const result = await savePlanAction(businessId, draft.id, draft);
      if (!result.ok) return setError({ message: result.message, fields: result.fieldErrors ?? {} });
      setDraft(null);
      router.refresh();
    });

  const remove = (id: string) =>
    startTransition(async () => {
      const result = await deletePlanAction(businessId, id);
      if (!result.ok) return setError({ message: result.message, fields: {} });
      setDraft(null);
      router.refresh();
    });

  // Aviso en vivo mientras escribe (regla "Pensión": no bloquea).
  const warning =
    draft && /^\d+(\.\d{1,2})?$/.test(draft.dailyPrice.trim()) && draft.meals.length
      ? planPriceWarning({ meals: draft.meals, dailyPrice: draft.dailyPrice.trim() }, meals)
      : null;

  return (
    <section className="rounded-xl border bg-card p-5 shadow-card sm:p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Planes</h2>
          <p className="text-sm text-muted-foreground">
            Lo que ofreces a tus comensales, con su precio por día. Por ejemplo: “Almuerzo” o “Almuerzo y
            cena”.
          </p>
        </div>
        <Button
          type="button"
          className="h-11 gap-2"
          onClick={() =>
            open({ id: null, name: "", meals: offered.slice(0, 1), dailyPrice: "", active: true })
          }
        >
          <Plus className="size-4" aria-hidden="true" />
          Nuevo plan
        </Button>
      </div>
      {plans.length ? (
        <ul>
          {plans.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 border-t py-3.5 first:border-t-0">
              <span className="min-w-48 flex-1">
                <b className="block">{p.name}</b>
                <span className="text-sm text-muted-foreground">
                  {p.meals.map((m) => MEAL_LABEL[m]).join(" + ")} · {formatSoles(p.dailyPrice)} al día
                </span>
                {p.warning ? <span className="block text-sm text-warn">{p.warning}</span> : null}
              </span>
              <StatusBadge tone={p.active ? "ok" : "neutral"}>
                {p.active ? "Activo" : "Desactivado"}
              </StatusBadge>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() =>
                  open({
                    id: p.id,
                    name: p.name,
                    meals: p.meals,
                    dailyPrice: String(Number(p.dailyPrice)),
                    active: p.active,
                  })
                }
              >
                Editar
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Todavía no tienes planes. Crea uno para poder afiliar a tus comensales.
        </p>
      )}
      {!draft ? <FormMessage message={error?.message} /> : null}

      <Dialog open={draft !== null} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Editar plan" : "Nuevo plan"}</DialogTitle>
            <DialogDescription>
              El precio por día se cobra por adelantado. Los días pausados y las comidas canceladas a tiempo
              no se cobran.
            </DialogDescription>
          </DialogHeader>
          {draft ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="plan-name">Nombre</Label>
                <Input
                  id="plan-name"
                  className="h-11"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
                {error?.fields.name ? <p className="text-sm text-danger">{error.fields.name}</p> : null}
              </div>
              <fieldset>
                <legend className="mb-1 text-sm font-semibold">Incluye</legend>
                <div className="flex flex-wrap gap-x-5">
                  {MEAL_TYPES.map((m) => (
                    <label key={m} className="flex min-h-11 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-5 accent-primary"
                        disabled={!offered.includes(m) && !draft.meals.includes(m)}
                        checked={draft.meals.includes(m)}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            meals: e.target.checked
                              ? [...draft.meals, m]
                              : draft.meals.filter((x) => x !== m),
                          })
                        }
                      />
                      {MEAL_LABEL[m]}
                    </label>
                  ))}
                </div>
                {error?.fields.meals ? <p className="text-sm text-danger">{error.fields.meals}</p> : null}
              </fieldset>
              <div className="flex max-w-48 flex-col gap-1.5">
                <Label htmlFor="plan-price">Precio por día (S/)</Label>
                <Input
                  id="plan-price"
                  inputMode="decimal"
                  className="h-11"
                  value={draft.dailyPrice}
                  onChange={(e) => setDraft({ ...draft, dailyPrice: e.target.value })}
                />
                {error?.fields.dailyPrice ? (
                  <p className="text-sm text-danger">{error.fields.dailyPrice}</p>
                ) : null}
              </div>
              {warning ? (
                <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">{warning}</p>
              ) : null}
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-5 accent-primary"
                  checked={draft.active}
                  onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                />
                Activo (se puede ofrecer a comensales nuevos)
              </label>
              <FormMessage message={error?.message} />
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:justify-between">
            {draft?.id ? (
              <ConfirmButton
                trigger={
                  <Button type="button" variant="destructive" className="h-11" disabled={pending}>
                    Borrar plan
                  </Button>
                }
                title="¿Borrar este plan?"
                description="Solo se puede si nadie está afiliado. Si tiene comensales, desactívalo."
                confirmLabel="Borrar plan"
                onConfirm={() => draft.id && remove(draft.id)}
              />
            ) : (
              <span />
            )}
            <Button type="button" className="h-11" disabled={pending} onClick={save}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
