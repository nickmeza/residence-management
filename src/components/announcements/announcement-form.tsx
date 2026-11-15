"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { Field, selectClass, textareaClass } from "@/components/form-controls";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { sendAnnouncementAction } from "@/server/announcements/actions";
import type { AudienceOptions } from "@/server/announcements/queries";
import { AUDIENCE_LABEL } from "@/server/announcements/rules";

type Kind = "all" | "property" | "floor" | "resident";

// "Nuevo comunicado" (CM-01): a quién, título, mensaje y si es urgente. Le llega a cada uno en su campanita.
export function AnnouncementForm({ businessId, options }: { businessId: string; options: AudienceOptions }) {
  const router = useRouter();
  const kinds: Kind[] =
    options.service === "meal_plan" ? ["all", "resident"] : ["all", "property", "floor", "resident"];
  const [audience, setAudience] = useState<Kind>("all");
  const [targetId, setTargetId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const [pending, startTransition] = useTransition();

  const targets =
    audience === "property"
      ? options.properties.map((p) => ({ id: p.id, label: p.name }))
      : audience === "floor"
        ? options.floors
        : audience === "resident"
          ? options.residents.map((r) => ({ id: r.id, label: r.name }))
          : [];

  const send = () =>
    startTransition(async () => {
      const r = await sendAnnouncementAction(businessId, {
        audience,
        targetId: audience === "all" ? null : targetId || null,
        title,
        body,
        urgent,
      });
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        setMessage({ ok: false, text: r.message });
        return;
      }
      setTitle("");
      setBody("");
      setUrgent(false);
      setErrors({});
      setMessage({
        ok: true,
        text: `Enviado: le llegó a ${r.recipients} ${r.recipients === 1 ? "persona" : "personas"}.`,
      });
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">Para quién</legend>
        <div className="flex flex-wrap gap-2">
          {kinds.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={audience === k}
              onClick={() => {
                setAudience(k);
                setTargetId("");
              }}
              className={
                "min-h-11 rounded-lg border px-3.5 text-sm font-semibold transition-colors duration-200 " +
                (audience === k ? "border-primary bg-primary-soft text-primary-text" : "hover:bg-muted")
              }
            >
              {AUDIENCE_LABEL[k]}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          {options.service === "meal_plan"
            ? "“Todos” son tus comensales con plan vigente."
            : "“Todos”, un edificio o un piso: les llega a quienes viven ahí hoy."}
        </span>
      </fieldset>
      {audience !== "all" ? (
        <Field id="destino" label={AUDIENCE_LABEL[audience]} error={errors.targetId}>
          <select
            id="destino"
            className={selectClass}
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
          >
            <option value="">Elige…</option>
            {targets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <Field id="titulo" label="Título" error={errors.title}>
        <Input
          id="titulo"
          className="h-11"
          maxLength={120}
          value={title}
          placeholder="Por ejemplo: corte de agua el sábado"
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>
      <Field id="mensaje" label="Mensaje" error={errors.body}>
        <textarea
          id="mensaje"
          rows={5}
          maxLength={2000}
          className={textareaClass}
          value={body}
          placeholder="Cuéntales qué pasa, cuándo y qué tienen que hacer."
          onChange={(e) => setBody(e.target.value)}
        />
      </Field>
      <label className="flex min-h-11 items-start gap-3 text-sm">
        <Checkbox checked={urgent} onCheckedChange={(v) => setUrgent(v === true)} className="mt-0.5" />
        <span>
          <b>Es urgente</b>
          <span className="block text-muted-foreground">Se marca como urgente en la campanita.</span>
        </span>
      </label>
      {message ? (
        message.ok ? (
          <p role="status" className="rounded-lg bg-ok-soft px-3 py-2 text-sm text-ok">
            {message.text}
          </p>
        ) : (
          <FormMessage message={message.text} />
        )
      ) : null}
      <Button type="button" className="h-11 self-start" disabled={pending} onClick={send}>
        {pending ? "Enviando…" : "Enviar comunicado"}
      </Button>
    </div>
  );
}
