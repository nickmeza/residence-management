"use client";

import { useState, useTransition } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatShortDate } from "@/lib/format";
import { copyPreviousWeekAction, saveWeekMenuAction, type PensionResult } from "@/server/pension/actions";
import type { WeekMenuView } from "@/server/pension/queries";
import { MEAL_LABEL, type MealType } from "@/server/pension/rules";

type Cell = { dish: string; hasVegetarian: boolean };
const keyOf = (date: string, meal: MealType) => `${date}|${meal}`;

// Menú semanal (PN-03): un plato por día y comida, con su opción vegetariana. Es opcional (los negocios chicos
// pueden no usarlo). Se guarda como borrador o se publica; el comensal solo ve lo publicado.
export function WeekMenuEditor({ view }: { view: WeekMenuView }) {
  const initial = () => {
    const cells: Record<string, Cell> = {};
    for (const d of view.days)
      for (const m of view.meals) {
        const e = view.entries.find((x) => x.date === d && x.meal === m);
        cells[keyOf(d, m)] = { dish: e?.dish ?? "", hasVegetarian: e?.hasVegetarian ?? false };
      }
    return cells;
  };
  const [cells, setCells] = useState(initial);
  const [saved, setSaved] = useState(view.entries);
  const [message, setMessage] = useState<{ text: string; ok: boolean }>();
  const [pending, startTransition] = useTransition();

  // Si llegan datos nuevos del servidor (otra semana o después de copiar), el editor empieza con ellos.
  if (saved !== view.entries) {
    setSaved(view.entries);
    setCells(initial());
  }

  const status = !view.entries.length
    ? { label: "Sin menú", tone: "neutral" as const }
    : view.entries.every((e) => e.published)
      ? { label: "Publicado", tone: "ok" as const }
      : { label: "Borrador", tone: "warn" as const };

  const run = (action: () => Promise<PensionResult>, ok: string) =>
    startTransition(async () => {
      const result = await action();
      setMessage(result.ok ? { text: ok, ok: true } : { text: result.message, ok: false });
    });

  const save = (publish: boolean) =>
    run(
      () =>
        saveWeekMenuAction(view.businessId, {
          publish,
          entries: Object.entries(cells).map(([key, c]) => {
            const [date, meal] = key.split("|");
            return { date, meal, dish: c.dish, hasVegetarian: c.hasVegetarian };
          }),
        }),
      publish ? "Menú publicado: tus comensales ya lo ven." : "Borrador guardado.",
    );

  const set = (key: string, patch: Partial<Cell>) =>
    setCells((c) => ({ ...c, [key]: { ...c[key], ...patch } }));

  if (!view.meals.length) {
    return (
      <p className="rounded-xl border bg-card p-6 text-muted-foreground shadow-card">
        Primero activa tus comidas en la pestaña Configuración.
      </p>
    );
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <section className="overflow-hidden rounded-xl border bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-background text-xs font-bold tracking-wide text-muted-foreground uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 text-left">
                  Día
                </th>
                {view.meals.map((m) => (
                  <th key={m} scope="col" className="px-4 py-3 text-left">
                    {MEAL_LABEL[m]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.days.map((d) => (
                <tr key={d} className="border-t align-top">
                  <th scope="row" className="px-4 py-3 text-left font-semibold whitespace-nowrap">
                    {formatShortDate(d)}
                  </th>
                  {view.meals.map((m) => {
                    const key = keyOf(d, m);
                    return (
                      <td key={m} className="px-4 py-2.5">
                        <Input
                          aria-label={`${MEAL_LABEL[m]} del ${formatShortDate(d)}`}
                          className="h-11"
                          placeholder="Sin plato"
                          value={cells[key].dish}
                          onChange={(e) => set(key, { dish: e.target.value })}
                        />
                        <label className="mt-1.5 flex min-h-8 items-center gap-2 text-xs text-muted-foreground">
                          <input
                            type="checkbox"
                            className="size-4 accent-primary"
                            checked={cells[key].hasVegetarian}
                            onChange={(e) => set(key, { hasVegetarian: e.target.checked })}
                          />
                          Opción vegetariana
                        </label>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <aside className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-card lg:sticky lg:top-24">
        <h2 className="text-lg font-bold">Publicación</h2>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Estado</span>
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
        </div>
        <Button type="button" className="h-11" disabled={pending} onClick={() => save(true)}>
          Publicar menú
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11"
          disabled={pending}
          onClick={() => save(false)}
        >
          Guardar borrador
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-11"
          disabled={pending}
          onClick={() =>
            run(
              () => copyPreviousWeekAction(view.businessId, view.days[0]),
              "Copiamos la semana anterior como borrador. Revísala y publícala.",
            )
          }
        >
          Copiar la semana anterior
        </Button>
        <p className="text-xs text-muted-foreground">
          Tus comensales solo ven el menú publicado. Un plato vacío se borra. El menú es opcional.
        </p>
        {message ? (
          message.ok ? (
            <p role="status" className="rounded-lg bg-ok-soft px-3 py-2 text-sm font-semibold text-ok">
              {message.text}
            </p>
          ) : (
            <FormMessage message={message.text} />
          )
        ) : null}
      </aside>
    </div>
  );
}
