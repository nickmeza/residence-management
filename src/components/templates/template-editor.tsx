"use client";

import { FileDown, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { ConfirmButton } from "@/components/confirm-button";
import { StatusBadge } from "@/components/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { fillTemplate, TEMPLATE_FIELDS } from "@/server/contracts/template";
import { deleteTemplateAction, saveTemplateAction } from "@/server/templates/actions";
import type { TemplateRow } from "@/server/templates/queries";
import { EXAMPLE_BODY, EXAMPLE_VALUES, FIELD_NAMES } from "@/server/templates/schemas";

type Editing = { id: string | null; name: string; body: string };

// Configuración › Plantillas: lista a la izquierda y editor a la derecha, como el prototipo.
export function TemplateEditor({ businessId, templates }: { businessId: string; templates: TemplateRow[] }) {
  const router = useRouter();
  const first = templates[0];
  const [editing, setEditing] = useState<Editing | null>(
    first ? { id: first.id, name: first.name, body: first.body } : null,
  );
  const [message, setMessage] = useState<{ text: string; ok: boolean }>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const select = (next: Editing | null) => {
    setEditing(next);
    setMessage(undefined);
    setFieldErrors({});
  };

  // Inserta {dato} donde está el cursor.
  const insertField = (field: string) => {
    if (!editing) return;
    const el = bodyRef.current;
    const token = `{${field}}`;
    const start = el?.selectionStart ?? editing.body.length;
    const end = el?.selectionEnd ?? editing.body.length;
    setEditing({ ...editing, body: editing.body.slice(0, start) + token + editing.body.slice(end) });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const save = () =>
    editing &&
    startTransition(async () => {
      const result = await saveTemplateAction(
        { businessId, templateId: editing.id },
        { name: editing.name, body: editing.body },
      );
      if (result.ok) {
        setEditing({ ...editing, id: result.id });
        setFieldErrors({});
        setMessage({ text: "Plantilla guardada.", ok: true });
        router.refresh();
      } else {
        setFieldErrors(result.fieldErrors ?? {});
        setMessage({ text: result.message, ok: false });
      }
    });

  const remove = (id: string) =>
    startTransition(async () => {
      const result = await deleteTemplateAction(id);
      if (result.ok) {
        const next = templates.find((t) => t.id !== id);
        select(next ? { id: next.id, name: next.name, body: next.body } : null);
        router.refresh();
      } else setMessage({ text: result.message, ok: false });
    });

  const preview = editing ? fillTemplate(editing.body, EXAMPLE_VALUES) : null;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <section className="rounded-xl border bg-card p-5 shadow-card sm:p-6">
        <h2 className="mb-3 text-lg font-bold">Plantillas de contrato</h2>
        {templates.length ? (
          <ul>
            {templates.map((t) => (
              <li key={t.id} className="flex items-center gap-3 border-t py-3 first:border-t-0">
                <span className="min-w-0 flex-1">
                  <b className="block truncate">{t.name}</b>
                  <span className="text-sm text-muted-foreground">Se elige al crear un contrato.</span>
                </span>
                <Button
                  type="button"
                  variant={editing?.id === t.id ? "default" : "outline"}
                  className="h-11"
                  onClick={() => select({ id: t.id, name: t.name, body: t.body })}
                >
                  Editar
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Todavía no tienes plantillas. Con una, la app arma el PDF de cada contrato con los datos del
            residente.
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          className="mt-3 h-11 gap-2"
          onClick={() => select({ id: null, name: "Contrato de alquiler", body: EXAMPLE_BODY })}
        >
          <Plus className="size-4" aria-hidden="true" />
          Nueva plantilla
        </Button>
      </section>

      {editing ? (
        <section className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-card sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">{editing.id ? "Editar plantilla" : "Nueva plantilla"}</h2>
            {editing.id ? null : <StatusBadge tone="primary">Sin guardar</StatusBadge>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="template-name">Nombre</Label>
            <Input
              id="template-name"
              className="h-11"
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              aria-invalid={fieldErrors.name ? true : undefined}
            />
            {fieldErrors.name ? <p className="text-sm text-danger">{fieldErrors.name}</p> : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="template-body">Texto</Label>
            <p className="text-sm text-muted-foreground">
              Deja una línea en blanco entre párrafos. Toca un dato para ponerlo donde está el cursor.
            </p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Datos que se rellenan solos">
              {FIELD_NAMES.map((f) => (
                <button
                  key={f}
                  type="button"
                  title={TEMPLATE_FIELDS[f]}
                  onClick={() => insertField(f)}
                  className="min-h-9 rounded-full bg-primary-soft px-3 text-xs font-bold text-primary-text transition-colors duration-200 hover:bg-primary hover:text-primary-foreground"
                >
                  {`{${f}}`}
                </button>
              ))}
            </div>
            <textarea
              id="template-body"
              ref={bodyRef}
              rows={14}
              value={editing.body}
              onChange={(e) => setEditing({ ...editing, body: e.target.value })}
              aria-invalid={fieldErrors.body ? true : undefined}
              className={cn(
                "resize-y rounded-lg border border-input bg-transparent p-3 text-base leading-relaxed md:text-sm",
                fieldErrors.body && "border-danger",
              )}
            />
            {fieldErrors.body ? (
              <p className="text-sm text-danger">{fieldErrors.body}</p>
            ) : preview?.unknown.length ? (
              <p className="text-sm text-warn">
                No reconocemos: {preview.unknown.map((u) => `{${u}}`).join(", ")}.
              </p>
            ) : null}
          </div>
          <details className="rounded-lg border p-3 text-sm">
            <summary className="cursor-pointer font-semibold">Vista previa con datos de ejemplo</summary>
            <div className="mt-3 flex flex-col gap-2 whitespace-pre-line text-muted-foreground">
              {preview?.text}
            </div>
          </details>

          {message ? (
            message.ok ? (
              <p role="status" className="rounded-lg bg-ok-soft px-3 py-2 text-sm font-semibold text-ok">
                {message.text}
              </p>
            ) : (
              <FormMessage message={message.text} />
            )
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <div className="flex flex-wrap gap-2">
              {editing.id ? (
                <ConfirmButton
                  trigger={
                    <Button type="button" variant="destructive" className="h-11" disabled={pending}>
                      Borrar
                    </Button>
                  }
                  title={`¿Borrar "${editing.name}"?`}
                  description="No se puede deshacer. Si algún contrato la usa, no se borra."
                  confirmLabel="Borrar"
                  onConfirm={() => editing.id && remove(editing.id)}
                />
              ) : null}
              {editing.id ? (
                <a
                  href={`/negocio/${businessId}/plantillas/${editing.id}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ variant: "outline", className: "h-11 gap-2" })}
                >
                  <FileDown className="size-4" aria-hidden="true" />
                  Ver PDF de ejemplo
                </a>
              ) : null}
            </div>
            <Button type="button" className="h-11 px-5" disabled={pending} onClick={save}>
              {pending ? "Guardando…" : "Guardar plantilla"}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
