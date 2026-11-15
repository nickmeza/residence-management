"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { ConfirmButton } from "@/components/confirm-button";
import { Field, selectClass } from "@/components/form-controls";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { updateRequestAction } from "@/server/maintenance/actions";
import type { RequestDetail } from "@/server/maintenance/queries";
import {
  isActive,
  PRIORITY_LABEL,
  PRIORITY_VALUES,
  STATUS_LABEL,
  STATUS_VALUES,
  type MaintenancePriority,
  type MaintenanceStatus,
} from "@/server/maintenance/rules";

// Estado, prioridad, responsable, costo y "fuera de servicio" de un pedido (MT-03). Un pedido cerrado (resuelto o
// cancelado) ya no cambia de estado: si vuelve a fallar, se crea uno nuevo.
export function RequestEditor({ r }: { r: RequestDetail }) {
  const router = useRouter();
  const [form, setForm] = useState({
    status: r.status,
    priority: r.priority,
    assignee: r.assignee ?? "",
    cost: r.cost ?? "",
    blocksUnit: r.blocksUnit,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const [pending, startTransition] = useTransition();
  const closed = !isActive(r.status);
  const statuses = closed ? [r.status] : STATUS_VALUES;

  const save = () =>
    startTransition(async () => {
      const result = await updateRequestAction(r.id, form);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setMessage({ ok: false, text: result.message });
        return;
      }
      setErrors({});
      setMessage({ ok: true, text: r.residentId ? "Guardado. Le avisamos al residente." : "Guardado." });
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="estado" label="Estado">
          <select
            id="estado"
            className={selectClass}
            value={form.status}
            disabled={closed}
            onChange={(e) => setForm({ ...form, status: e.target.value as MaintenanceStatus })}
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field id="prioridad" label="Prioridad">
          <select
            id="prioridad"
            className={selectClass}
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value as MaintenancePriority })}
          >
            {PRIORITY_VALUES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </Field>
        <Field id="responsable" label="Responsable" error={errors.assignee}>
          <Input
            id="responsable"
            className="h-11"
            maxLength={80}
            value={form.assignee}
            placeholder="Por ejemplo: gasfitero Juan"
            onChange={(e) => setForm({ ...form, assignee: e.target.value })}
          />
        </Field>
        <Field
          id="costo"
          label="Costo (S/)"
          hint="Lo que costó el arreglo, para tus reportes."
          error={errors.cost}
        >
          <Input
            id="costo"
            className="h-11"
            inputMode="decimal"
            value={form.cost}
            placeholder="0.00"
            onChange={(e) => setForm({ ...form, cost: e.target.value })}
          />
        </Field>
      </div>
      {r.unitName ? (
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <Checkbox
            checked={form.blocksUnit}
            onCheckedChange={(v) => setForm({ ...form, blocksUnit: v === true })}
            className="mt-0.5"
          />
          <span>
            <b>La unidad no se puede usar mientras tanto</b>
            <span className="block text-muted-foreground">
              Se ve “Mantenimiento” en el edificio hasta que el pedido se resuelva o se cancele.
            </span>
          </span>
        </label>
      ) : null}
      {message ? (
        message.ok ? (
          <p role="status" className="rounded-lg bg-ok-soft px-3 py-2 text-sm text-ok">
            {message.text}
          </p>
        ) : (
          <FormMessage message={message.text} />
        )
      ) : null}
      {form.status === "cancelled" && r.status !== "cancelled" ? (
        <ConfirmButton
          trigger={
            <Button type="button" variant="destructive" className="h-11 self-start" disabled={pending}>
              Cancelar el pedido
            </Button>
          }
          title="¿Cancelar este pedido?"
          description="Un pedido cancelado ya no se puede volver a abrir. Si vuelve a fallar, se crea uno nuevo."
          confirmLabel="Sí, cancelarlo"
          onConfirm={save}
        />
      ) : (
        <Button type="button" className="h-11 self-start" disabled={pending} onClick={save}>
          {pending ? "Guardando…" : "Guardar cambios"}
        </Button>
      )}
    </div>
  );
}
