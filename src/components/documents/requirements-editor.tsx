"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { ConfirmButton } from "@/components/confirm-button";
import { StatusBadge } from "@/components/status-badge";
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
import { Label } from "@/components/ui/label";
import { deleteRequirementAction, saveRequirementAction } from "@/server/documents/actions";
import type { RequirementRow } from "@/server/documents/queries";
import {
  DOCUMENT_FORMATS,
  FORMAT_LABEL,
  formatsHint,
  type RequirementInput,
} from "@/server/documents/schemas";

const selectClass = "h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base md:text-sm";

type Editing = { id: string | null; values: RequirementInput };

const EMPTY: RequirementInput = {
  name: "",
  description: "",
  propertyId: "",
  required: false,
  acceptedFormats: ["pdf", "image"],
  maxSizeMb: "5",
};

const toInput = (r: RequirementRow): RequirementInput => ({
  name: r.name,
  description: r.description ?? "",
  propertyId: r.propertyId ?? "",
  required: r.required,
  acceptedFormats: r.acceptedFormats,
  maxSizeMb: String(r.maxSizeMb),
});

// Configuración › Documentos: qué documentos pides, si son obligatorios y para qué propiedad.
export function RequirementsEditor({
  businessId,
  requirements,
  properties,
}: {
  businessId: string;
  requirements: RequirementRow[];
  properties: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [error, setError] = useState<{ message: string; fields: Record<string, string> }>();
  const [pending, startTransition] = useTransition();
  const propertyName = (id: string | null) =>
    id ? (properties.find((p) => p.id === id)?.name ?? "Una propiedad") : "Todo el negocio";

  const open = (next: Editing) => {
    setError(undefined);
    setEditing(next);
  };

  const save = () =>
    editing &&
    startTransition(async () => {
      const result = await saveRequirementAction({ businessId, requirementId: editing.id }, editing.values);
      if (!result.ok) return setError({ message: result.message, fields: result.fieldErrors ?? {} });
      setEditing(null);
      router.refresh();
    });

  const remove = (id: string) =>
    startTransition(async () => {
      const result = await deleteRequirementAction(id);
      if (!result.ok) return setError({ message: result.message, fields: {} });
      setEditing(null);
      router.refresh();
    });

  const set = (patch: Partial<RequirementInput>) =>
    editing && setEditing({ ...editing, values: { ...editing.values, ...patch } });

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <section className="rounded-xl border bg-card p-5 shadow-card sm:p-6">
        <h2 className="mb-3 text-lg font-bold">Documentos que pides</h2>
        {requirements.length ? (
          <ul>
            {requirements.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 border-t py-3.5 first:border-t-0">
                <span className="min-w-48 flex-1">
                  <b className="block">{r.name}</b>
                  <span className="text-sm text-muted-foreground">
                    {r.description ? `${r.description} · ` : ""}
                    {formatsHint(r.acceptedFormats, r.maxSizeMb)}
                  </span>
                </span>
                <span className="text-sm text-muted-foreground">{propertyName(r.propertyId)}</span>
                <StatusBadge tone={r.required ? "primary" : "neutral"}>
                  {r.required ? "Obligatorio" : "Opcional"}
                </StatusBadge>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  onClick={() => open({ id: r.id, values: toInput(r) })}
                >
                  Editar
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No pides ningún documento. Está bien: puedes trabajar solo con el número de DNI. Si agregas uno y
            lo marcas obligatorio, el contrato no se confirma hasta que esté verificado.
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          className="mt-3 h-11 gap-2"
          onClick={() => open({ id: null, values: EMPTY })}
        >
          <Plus className="size-4" aria-hidden="true" />
          Agregar documento
        </Button>
      </section>

      <aside className="rounded-xl border bg-card p-5 shadow-card sm:p-6 lg:sticky lg:top-24">
        <h2 className="mb-3 text-lg font-bold">Así lo verá el residente</h2>
        {requirements.length ? (
          <ul className="flex flex-col gap-2">
            {requirements.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="size-4 shrink-0 rounded-full border-2 border-input" aria-hidden="true" />
                {r.name}
                {r.required ? <StatusBadge tone="primary">Obligatorio</StatusBadge> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No verá ningún documento por subir.</p>
        )}
        <p className="mt-4 text-sm text-muted-foreground">
          Los obligatorios deben estar verificados para confirmar el contrato. Los opcionales nunca lo
          bloquean.
        </p>
      </aside>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar documento" : "Agregar documento"}</DialogTitle>
            <DialogDescription>Los cambios valen desde ya para todos los residentes.</DialogDescription>
          </DialogHeader>
          {editing ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="req-name">Nombre</Label>
                <Input
                  id="req-name"
                  className="h-11"
                  placeholder="Por ejemplo, DNI (frente y reverso)"
                  value={editing.values.name}
                  onChange={(e) => set({ name: e.target.value })}
                />
                {error?.fields.name ? <p className="text-sm text-danger">{error.fields.name}</p> : null}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="req-desc">Indicaciones (opcional)</Label>
                <Input
                  id="req-desc"
                  className="h-11"
                  placeholder="Por ejemplo, del ciclo actual"
                  value={editing.values.description}
                  onChange={(e) => set({ description: e.target.value })}
                />
              </div>
              {properties.length > 1 ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="req-property">Para</Label>
                  <select
                    id="req-property"
                    className={selectClass}
                    value={editing.values.propertyId}
                    onChange={(e) => set({ propertyId: e.target.value })}
                  >
                    <option value="">Todo el negocio</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        Solo {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-semibold">Formatos</legend>
                <div className="flex flex-wrap gap-4">
                  {DOCUMENT_FORMATS.map((f) => (
                    <label key={f} className="flex min-h-11 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-5 accent-primary"
                        checked={editing.values.acceptedFormats.includes(f)}
                        onChange={(e) =>
                          set({
                            acceptedFormats: e.target.checked
                              ? [...editing.values.acceptedFormats, f]
                              : editing.values.acceptedFormats.filter((x) => x !== f),
                          })
                        }
                      />
                      {FORMAT_LABEL[f]}
                    </label>
                  ))}
                </div>
                {error?.fields.acceptedFormats ? (
                  <p className="text-sm text-danger">{error.fields.acceptedFormats}</p>
                ) : null}
              </fieldset>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="req-size">Tamaño máximo (MB)</Label>
                <Input
                  id="req-size"
                  className="h-11 w-28"
                  inputMode="numeric"
                  value={String(editing.values.maxSizeMb)}
                  onChange={(e) => set({ maxSizeMb: e.target.value })}
                />
                {error?.fields.maxSizeMb ? (
                  <p className="text-sm text-danger">{error.fields.maxSizeMb}</p>
                ) : null}
              </div>
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  role="switch"
                  className="size-5 accent-primary"
                  checked={editing.values.required}
                  onChange={(e) => set({ required: e.target.checked })}
                />
                <span>
                  <span className="font-semibold">Obligatorio</span>
                  <span className="block text-muted-foreground">
                    Sin él verificado, el contrato no se confirma.
                  </span>
                </span>
              </label>
              <FormMessage message={error?.message} />
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:justify-between">
            {editing?.id ? (
              <ConfirmButton
                trigger={
                  <Button type="button" variant="destructive" className="h-11" disabled={pending}>
                    Quitar
                  </Button>
                }
                title={`¿Quitar "${editing.values.name}"?`}
                description="Ya no se pedirá. Los archivos que ya subieron se conservan."
                confirmLabel="Quitar"
                onConfirm={() => editing.id && remove(editing.id)}
              />
            ) : (
              <span />
            )}
            <Button type="button" className="h-11" disabled={pending} onClick={save}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
