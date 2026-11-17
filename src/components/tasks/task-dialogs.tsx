"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { Field, selectClass, textareaClass } from "@/components/form-controls";
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
import { createTaskAction, markTaskDoneAction, updateTaskAction } from "@/server/tasks/actions";
import type { Option, TaskRow } from "@/server/tasks/queries";
import { PERIOD_VALUES, type TaskKind, type TaskPeriod } from "@/server/tasks/rules";

const PERIOD_WORD: Record<TaskPeriod, string> = { day: "días", week: "semanas", month: "meses" };

// Crear o editar una tarea que se repite. Sin `task` = nueva.
export function TaskDialog({
  open,
  onOpenChange,
  businessId,
  kind,
  task,
  today,
  suppliers,
  properties,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  kind: TaskKind;
  task: TaskRow | null;
  today: string;
  suppliers: Option[];
  properties: Option[];
}) {
  const router = useRouter();
  const initial = {
    title: task?.title ?? "",
    place: task?.place ?? "",
    propertyId: task?.propertyId ?? "",
    every: String(task?.every ?? 1),
    period: task?.period ?? (kind === "cleaning" ? "week" : "month"),
    nextDue: task?.nextDue ?? today,
    supplierId: task?.supplierId ?? "",
    notes: task?.notes ?? "",
  };
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof typeof initial>(key: K, value: (typeof initial)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = () =>
    startTransition(async () => {
      const data = {
        ...form,
        kind,
        propertyId: form.propertyId || null,
        supplierId: form.supplierId || null,
      };
      const r = task ? await updateTaskAction(task.id, data) : await createTaskAction(businessId, data);
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        setMessage(r.message);
        return;
      }
      onOpenChange(false);
      if (!task) setForm(initial);
      router.refresh();
    });

  const examples =
    kind === "cleaning"
      ? { title: "Por ejemplo: barrer y trapear el pasillo", place: "Por ejemplo: pasillo del 2.º piso" }
      : { title: "Por ejemplo: revisar los extintores", place: "Por ejemplo: azotea" };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? "Editar tarea" : "Nueva tarea"}</DialogTitle>
          <DialogDescription>
            Se repite sola: cuando la marques hecha, se calcula la próxima fecha. Aparece en Pendientes una
            semana antes.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field id="tarea-titulo" label="Qué hay que hacer" error={errors.title}>
            <Input
              id="tarea-titulo"
              className="h-11"
              maxLength={120}
              placeholder={examples.title}
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="tarea-lugar" label="Dónde (opcional)" error={errors.place}>
              <Input
                id="tarea-lugar"
                className="h-11"
                maxLength={120}
                placeholder={examples.place}
                value={form.place}
                onChange={(e) => set("place", e.target.value)}
              />
            </Field>
            {properties.length > 1 ? (
              <Field id="tarea-edificio" label="Edificio">
                <select
                  id="tarea-edificio"
                  className={selectClass}
                  value={form.propertyId}
                  onChange={(e) => set("propertyId", e.target.value)}
                >
                  <option value="">Todos</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field id="tarea-cada" label="Cada" error={errors.every}>
              <Input
                id="tarea-cada"
                className="h-11"
                type="number"
                inputMode="numeric"
                min={1}
                max={365}
                value={form.every}
                onChange={(e) => set("every", e.target.value)}
              />
            </Field>
            <Field id="tarea-periodo" label="Unidad">
              <select
                id="tarea-periodo"
                className={selectClass}
                value={form.period}
                onChange={(e) => set("period", e.target.value as TaskPeriod)}
              >
                {PERIOD_VALUES.map((p) => (
                  <option key={p} value={p}>
                    {PERIOD_WORD[p]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="tarea-fecha" label={task ? "Próxima fecha" : "Primera fecha"} error={errors.nextDue}>
              <Input
                id="tarea-fecha"
                className="h-11"
                type="date"
                value={form.nextDue}
                onChange={(e) => set("nextDue", e.target.value)}
              />
            </Field>
            <Field id="tarea-proveedor" label="Quién la hace (opcional)">
              <select
                id="tarea-proveedor"
                className={selectClass}
                value={form.supplierId}
                onChange={(e) => set("supplierId", e.target.value)}
              >
                <option value="">Yo / sin proveedor</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field id="tarea-notas" label="Notas (opcional)" error={errors.notes}>
            <textarea
              id="tarea-notas"
              rows={2}
              maxLength={1000}
              className={textareaClass}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </Field>
          <FormMessage message={message} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="h-11" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" className="h-11" disabled={pending} onClick={save}>
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// "Hecho": cuándo se hizo, cuánto costó y quién la hizo.
export function DoneDialog({
  task,
  today,
  suppliers,
  trigger,
}: {
  task: TaskRow;
  today: string;
  suppliers: Option[];
  trigger: (open: () => void) => ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ doneOn: today, cost: "", supplierId: task.supplierId ?? "", note: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const r = await markTaskDoneAction(task.id, { ...form, supplierId: form.supplierId || null });
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        setMessage(r.message);
        return;
      }
      setOpen(false);
      router.refresh();
    });

  return (
    <>
      {trigger(() => setOpen(true))}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Marcar como hecha</DialogTitle>
            <DialogDescription>{task.title}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <Field id="hecho-fecha" label="Cuándo" error={errors.doneOn}>
                <Input
                  id="hecho-fecha"
                  className="h-11"
                  type="date"
                  max={today}
                  value={form.doneOn}
                  onChange={(e) => setForm((f) => ({ ...f, doneOn: e.target.value }))}
                />
              </Field>
              <Field id="hecho-costo" label="Costo S/ (opcional)" error={errors.cost}>
                <Input
                  id="hecho-costo"
                  className="h-11"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={form.cost}
                  onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
                />
              </Field>
            </div>
            <Field id="hecho-proveedor" label="Quién la hizo">
              <select
                id="hecho-proveedor"
                className={selectClass}
                value={form.supplierId}
                onChange={(e) => setForm((f) => ({ ...f, supplierId: e.target.value }))}
              >
                <option value="">Yo / sin proveedor</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="hecho-nota" label="Nota (opcional)" error={errors.note}>
              <Input
                id="hecho-nota"
                className="h-11"
                maxLength={500}
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              />
            </Field>
            <FormMessage message={message} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="h-11" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" className="h-11" disabled={pending} onClick={save}>
              {pending ? "Guardando…" : "Hecho"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
