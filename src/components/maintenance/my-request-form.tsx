"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { Field, selectClass, textareaClass } from "@/components/form-controls";
import { FileField } from "@/components/payments/file-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createMyRequestAction } from "@/server/maintenance/actions";
import { CATEGORY_LABEL, CATEGORY_VALUES, type MaintenanceCategory } from "@/server/maintenance/rules";

export type MyPlace = { residentId: string; businessId: string; contractId: string; label: string };

// "Pedir mantenimiento" (MT-01): qué pasa, el tipo, si es urgente y una foto. La unidad sale del contrato.
export function MyRequestForm({ places }: { places: MyPlace[] }) {
  const router = useRouter();
  const [placeIndex, setPlaceIndex] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<MaintenanceCategory>("other");
  const [urgent, setUrgent] = useState(false);
  const [photo, setPhoto] = useState<{ path: string; name: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const [pending, startTransition] = useTransition();
  const place = places[placeIndex];

  const send = () =>
    startTransition(async () => {
      const r = await createMyRequestAction({
        residentId: place.residentId,
        contractId: place.contractId,
        title,
        description,
        category,
        priority: urgent ? "urgent" : "normal",
        photoPath: photo?.path ?? null,
      });
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        setMessage({ ok: false, text: r.message });
        return;
      }
      setTitle("");
      setDescription("");
      setCategory("other");
      setUrgent(false);
      setPhoto(null);
      setErrors({});
      setMessage({
        ok: true,
        text: "¡Listo! Tu residencia ya recibió el pedido. Te avisaremos cuando avance.",
      });
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-4">
      {places.length > 1 ? (
        <Field id="lugar" label="Dónde">
          <select
            id="lugar"
            className={selectClass}
            value={placeIndex}
            onChange={(e) => {
              setPlaceIndex(Number(e.target.value));
              setPhoto(null);
            }}
          >
            {places.map((p, i) => (
              <option key={p.contractId} value={i}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <p className="text-sm text-muted-foreground">{place.label}</p>
      )}
      <Field id="titulo" label="Qué pasa" error={errors.title}>
        <Input
          id="titulo"
          className="h-11"
          maxLength={120}
          value={title}
          placeholder="Por ejemplo: la ducha no tiene agua caliente"
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>
      <Field id="detalle" label="Detalle (opcional)" error={errors.description}>
        <textarea
          id="detalle"
          rows={3}
          maxLength={2000}
          className={textareaClass}
          value={description}
          placeholder="Desde cuándo pasa, en qué parte…"
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      <Field id="categoria" label="Tipo">
        <select
          id="categoria"
          className={selectClass}
          value={category}
          onChange={(e) => setCategory(e.target.value as MaintenanceCategory)}
        >
          {CATEGORY_VALUES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium">¿Es urgente?</legend>
        <div className="flex gap-2">
          {[
            [false, "No, puede esperar"],
            [true, "Sí, es urgente"],
          ].map(([value, label]) => (
            <button
              key={String(value)}
              type="button"
              aria-pressed={urgent === value}
              onClick={() => setUrgent(value as boolean)}
              className={
                "min-h-11 flex-1 rounded-lg border px-3 text-sm font-semibold transition-colors duration-200 " +
                (urgent === value ? "border-primary bg-primary-soft text-primary-text" : "hover:bg-muted")
              }
            >
              {label as string}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          Urgente: una fuga, sin luz, una puerta que no cierra. Si hay peligro, llama también a tu residencia.
        </span>
      </fieldset>
      <FileField
        key={place.residentId}
        businessId={place.businessId}
        residentId={place.residentId}
        folder="mantenimiento"
        label="Agregar una foto (opcional)"
        formats={["image"]}
        value={photo}
        onChange={setPhoto}
      />
      {message ? (
        message.ok ? (
          <p role="status" className="rounded-lg bg-ok-soft px-3 py-2 text-sm text-ok">
            {message.text}
          </p>
        ) : (
          <FormMessage message={message.text} />
        )
      ) : null}
      <Button type="button" className="h-11" disabled={pending} onClick={send}>
        {pending ? "Enviando…" : "Enviar pedido"}
      </Button>
    </div>
  );
}
