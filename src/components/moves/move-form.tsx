"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { Field, textareaClass } from "@/components/form-controls";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { saveMoveAction } from "@/server/moves/actions";
import { CHECKLIST, type MoveKind } from "@/server/moves/rules";

// Cita, llaves, checklist y notas de un ingreso o una salida. "scheduledAt" llega como "AAAA-MM-DDTHH:MM" en hora de
// Lima (lo arma la página en el servidor).
export function MoveForm({
  contractId,
  kind,
  initial,
}: {
  contractId: string;
  kind: MoveKind;
  initial: {
    scheduledAt: string;
    keysCount: string;
    checklist: Record<string, boolean>;
    notes: string;
    done: boolean;
  };
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const [pending, startTransition] = useTransition();
  const items = CHECKLIST[kind];
  const allChecked = items.every((i) => form.checklist[i.key]);

  const save = (done: boolean) =>
    startTransition(async () => {
      const r = await saveMoveAction(contractId, { kind, ...form, done });
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        setMessage({ ok: false, text: r.message });
        return;
      }
      setForm((f) => ({ ...f, done }));
      setErrors({});
      setMessage({ ok: true, text: done ? "Listo: quedó marcado como hecho." : "Guardado." });
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="cita"
          label="Cita (día y hora)"
          hint="Al guardarla, le llega un aviso al residente."
          error={errors.scheduledAt}
        >
          <Input
            id="cita"
            type="datetime-local"
            className="h-11"
            value={form.scheduledAt}
            onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
          />
        </Field>
        <Field
          id="llaves"
          label={kind === "check_in" ? "Llaves entregadas" : "Llaves recibidas"}
          error={errors.keysCount}
        >
          <Input
            id="llaves"
            className="h-11"
            inputMode="numeric"
            value={form.keysCount}
            placeholder="Por ejemplo: 2"
            onChange={(e) => setForm({ ...form, keysCount: e.target.value })}
          />
        </Field>
      </div>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1.5 text-sm font-medium">Checklist</legend>
        {items.map((i) => (
          <label key={i.key} className="flex min-h-11 items-center gap-3 text-sm">
            <Checkbox
              checked={form.checklist[i.key] === true}
              onCheckedChange={(v) =>
                setForm({ ...form, checklist: { ...form.checklist, [i.key]: v === true } })
              }
            />
            {i.label}
          </label>
        ))}
      </fieldset>
      <Field id="notas" label="Notas (opcional)" error={errors.notes}>
        <textarea
          id="notas"
          rows={3}
          maxLength={1000}
          className={textareaClass}
          value={form.notes}
          placeholder="Por ejemplo: se le dio el control del portón."
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </Field>
      {message ? (
        message.ok ? (
          <p role="status" className="rounded-lg bg-ok-soft px-3 py-2 text-sm text-ok">
            {message.text}
          </p>
        ) : (
          <FormMessage message={message.text} />
        )
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11"
          disabled={pending}
          onClick={() => save(form.done)}
        >
          Guardar
        </Button>
        {form.done ? (
          <Button
            type="button"
            variant="outline"
            className="h-11"
            disabled={pending}
            onClick={() => save(false)}
          >
            Marcar como pendiente
          </Button>
        ) : (
          <Button type="button" className="h-11" disabled={pending} onClick={() => save(true)}>
            {allChecked ? "Marcar como hecho" : "Marcar como hecho (faltan casillas)"}
          </Button>
        )}
      </div>
    </div>
  );
}
