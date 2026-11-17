"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { ConfirmButton } from "@/components/confirm-button";
import { StatusBadge, type BadgeTone } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { formatShortDate } from "@/lib/format";
import { deleteTaskAction, setTaskActiveAction } from "@/server/tasks/actions";
import type { Option, TaskRow } from "@/server/tasks/queries";
import { everyLabel, STATE_LABEL, taskState, type TaskKind, type TaskState } from "@/server/tasks/rules";

import { DoneDialog, TaskDialog } from "./task-dialogs";

const TONE: Record<TaskState, BadgeTone> = {
  overdue: "danger",
  today: "warn",
  soon: "primary",
  later: "neutral",
};

// Tareas que se repiten (MT-04 y limpieza de áreas comunes): las que tocan primero arriba. "Hecho" calcula la
// próxima fecha; "Pausar" la saca de Pendientes y del calendario sin borrar su historial.
export function TaskBoard({
  businessId,
  kind,
  rows,
  suppliers,
  properties,
  today,
}: {
  businessId: string;
  kind: TaskKind;
  rows: TaskRow[];
  suppliers: Option[];
  properties: Option[];
  today: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<TaskRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  const act = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) return setMessage(r.message);
      setMessage(undefined);
      router.refresh();
    });

  const many = properties.length > 1;
  const dialogProps = { businessId, kind, today, suppliers, properties };
  const emptyText =
    kind === "cleaning"
      ? "Anota lo que se limpia cada cierto tiempo: el pasillo cada semana, las escaleras, la cocina común…"
      : "Anota lo que se revisa cada cierto tiempo: extintores, tanque de agua, bomba, ascensor…";

  return (
    <>
      <div className="flex justify-end">
        <Button type="button" className="h-11 gap-2" onClick={() => setCreating(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Nueva tarea
        </Button>
      </div>
      <FormMessage message={message} />
      {rows.length ? (
        <section className="overflow-hidden rounded-xl border bg-card shadow-card">
          <ul>
            {rows.map((t, i) => {
              const state = taskState(t.nextDue, today);
              return (
                <li
                  key={t.id}
                  className={`flex flex-wrap items-center gap-3 px-5 py-3.5 ${i ? "border-t" : ""} ${t.active ? "" : "opacity-70"}`}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <b>{t.title}</b>
                    <span className="text-sm text-muted-foreground">
                      {[
                        t.place,
                        many ? (t.propertyName ?? "Todos los edificios") : null,
                        everyLabel(t.every, t.period),
                        t.supplierName,
                        t.lastDone ? `Última vez: ${formatShortDate(t.lastDone)}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1 text-sm">
                    {t.active ? (
                      <>
                        <StatusBadge tone={TONE[state]}>{STATE_LABEL[state]}</StatusBadge>
                        <span className="text-xs text-muted-foreground">{formatShortDate(t.nextDue)}</span>
                      </>
                    ) : (
                      <StatusBadge tone="neutral">Pausada</StatusBadge>
                    )}
                  </span>
                  <span className="flex items-center gap-1">
                    {t.active ? (
                      <DoneDialog
                        task={t}
                        today={today}
                        suppliers={suppliers}
                        trigger={(open) => (
                          <Button type="button" className="h-11" onClick={open}>
                            Hecho
                          </Button>
                        )}
                      />
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11"
                      disabled={pending}
                      onClick={() => act(() => setTaskActiveAction(t.id, !t.active))}
                    >
                      {t.active ? "Pausar" : "Reactivar"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="size-11"
                      aria-label={`Editar ${t.title}`}
                      onClick={() => setEditing(t)}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                    </Button>
                    <ConfirmButton
                      trigger={
                        <Button
                          type="button"
                          variant="ghost"
                          className="size-11"
                          aria-label={`Borrar ${t.title}`}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      }
                      title="¿Borrar esta tarea?"
                      description="Se borra con todo su historial. Si solo quieres dejar de hacerla un tiempo, mejor pausarla."
                      confirmLabel="Borrar"
                      onConfirm={() => act(() => deleteTaskAction(t.id))}
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <section className="rounded-xl border bg-card p-6 shadow-card">
          <h2 className="text-lg font-bold">Todavía no hay tareas</h2>
          <p className="mt-1 text-muted-foreground">{emptyText}</p>
        </section>
      )}
      <TaskDialog {...dialogProps} task={null} open={creating} onOpenChange={setCreating} />
      {editing ? (
        <TaskDialog
          key={editing.id}
          {...dialogProps}
          task={editing}
          open
          onOpenChange={(open) => !open && setEditing(null)}
        />
      ) : null}
    </>
  );
}
