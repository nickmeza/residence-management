"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { Field, selectClass } from "@/components/form-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestCleaningAction } from "@/server/cleaning/actions";
import type { MyCleaningPlace } from "@/server/cleaning/queries";

// "Pedir limpieza" del residente (MT-05). Solo aparece si su residencia lo prendió.
export function MyCleaningForm({ places, today }: { places: MyCleaningPlace[]; today: string }) {
  const router = useRouter();
  const [place, setPlace] = useState(0);
  const [preferredDate, setPreferredDate] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const p = places[place];
      const r = await requestCleaningAction({
        residentId: p.residentId,
        contractId: p.contractId,
        preferredDate,
        note,
      });
      if (!r.ok) return setMessage({ ok: false, text: r.message });
      setPreferredDate("");
      setNote("");
      setMessage({ ok: true, text: "Listo. Te avisaremos cuando le pongan fecha." });
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-4">
      {places.length > 1 ? (
        <Field id="limpieza-donde" label="Dónde">
          <select
            id="limpieza-donde"
            className={selectClass}
            value={place}
            onChange={(e) => setPlace(Number(e.target.value))}
          >
            {places.map((p, i) => (
              <option key={p.contractId} value={i}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="limpieza-fecha" label="Qué día te queda bien (opcional)">
          <Input
            id="limpieza-fecha"
            type="date"
            className="h-11"
            min={today}
            value={preferredDate}
            onChange={(e) => setPreferredDate(e.target.value)}
          />
        </Field>
        <Field id="limpieza-nota" label="Nota (opcional)">
          <Input
            id="limpieza-nota"
            className="h-11"
            maxLength={500}
            placeholder="Por ejemplo: en la tarde"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
      </div>
      {message ? (
        message.ok ? (
          <p role="status" className="rounded-lg bg-ok-soft px-3 py-2 text-sm text-ok">
            {message.text}
          </p>
        ) : (
          <FormMessage message={message.text} />
        )
      ) : null}
      <Button type="button" className="h-11 self-start" disabled={pending} onClick={save}>
        {pending ? "Enviando…" : "Pedir limpieza"}
      </Button>
    </div>
  );
}
