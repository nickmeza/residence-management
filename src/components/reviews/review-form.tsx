"use client";

import { Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { Field } from "@/components/form-controls";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { submitReviewAction } from "@/server/reviews/actions";
import { RUBRICS, type RubricKey } from "@/server/reviews/rules";

// Estrellas de 1 a 5 para un rubro. Cada estrella es un botón con su número (no solo color).
function Stars({
  label,
  value,
  onChange,
  optional,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  optional?: boolean;
}) {
  return (
    <fieldset className="flex flex-wrap items-center justify-between gap-2">
      <legend className="sr-only">{label}</legend>
      <span className="text-sm font-semibold" aria-hidden="true">
        {label}
        {optional ? <span className="font-normal text-muted-foreground"> (si comiste ahí)</span> : null}
      </span>
      <span className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${label}: ${n} de 5`}
            aria-pressed={value === n}
            onClick={() => onChange(optional && value === n ? null : n)}
            className="flex size-11 items-center justify-center rounded-lg transition-colors duration-200 hover:bg-muted"
          >
            <Star
              className={cn(
                "size-6",
                value !== null && n <= value ? "fill-warn text-warn" : "text-muted-foreground",
              )}
              aria-hidden="true"
            />
          </button>
        ))}
      </span>
    </fieldset>
  );
}

type Scores = Record<RubricKey, number | null>;
const EMPTY: Scores = { room: null, cleaning: null, treatment: null, coexistence: null, mealPlan: null };

// Calificar la estadía al terminar el contrato (CR-03, CR-04): rubros de 1 a 5, comentario, si recomienda y si la
// reseña es anónima. Una sola vez por contrato.
export function ReviewForm({ contractId }: { contractId: string }) {
  const router = useRouter();
  const [scores, setScores] = useState<Scores>(EMPTY);
  const [comment, setComment] = useState("");
  const [recommends, setRecommends] = useState<boolean | null>(null);
  const [anonymous, setAnonymous] = useState(false);
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  const missing = RUBRICS.some((r) => r.key !== "mealPlan" && scores[r.key] === null) || recommends === null;

  const save = () =>
    startTransition(async () => {
      const r = await submitReviewAction({ contractId, ...scores, comment, recommends, anonymous });
      if (!r.ok) return setMessage(r.message);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        {RUBRICS.map((r) => (
          <Stars
            key={r.key}
            label={r.label}
            value={scores[r.key]}
            optional={r.key === "mealPlan"}
            onChange={(v) => setScores((s) => ({ ...s, [r.key]: v }))}
          />
        ))}
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">¿Recomendarías esta residencia?</legend>
        <div className="flex gap-2">
          {[
            { v: true, label: "Sí" },
            { v: false, label: "No" },
          ].map((o) => (
            <Button
              key={o.label}
              type="button"
              variant={recommends === o.v ? "default" : "outline"}
              aria-pressed={recommends === o.v}
              className="h-11 min-w-20"
              onClick={() => setRecommends(o.v)}
            >
              {o.label}
            </Button>
          ))}
        </div>
      </fieldset>
      <Field id={`comentario-${contractId}`} label="Comentario (opcional)">
        <Textarea
          id={`comentario-${contractId}`}
          rows={3}
          maxLength={1000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="¿Qué te gustó y qué mejorarías?"
        />
      </Field>
      <label className="flex min-h-11 items-start gap-3 text-sm">
        <Checkbox checked={anonymous} onCheckedChange={(v) => setAnonymous(v === true)} className="mt-0.5" />
        <span>
          <b>Enviar sin mi nombre</b>
          <span className="block text-muted-foreground">
            Tu residencia verá las estrellas y el comentario, pero no quién lo escribió.
          </span>
        </span>
      </label>
      <FormMessage message={message} />
      <Button type="button" className="h-11 self-start" disabled={pending || missing} onClick={save}>
        {pending ? "Enviando…" : "Enviar reseña"}
      </Button>
    </div>
  );
}
