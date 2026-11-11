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
import {
  deleteRequirementAction,
  saveRequirementAction,
  setRequirementActiveAction,
} from "@/server/documents/actions";
import type { RequirementRow } from "@/server/documents/queries";
import {
  DOCUMENT_FORMATS,
  FORMAT_LABEL,
  formatsHint,
  UNIT_TYPE_LABEL,
  UNIT_TYPES,
  type RequirementInput,
} from "@/server/documents/schemas";

type UnitType = (typeof UNIT_TYPES)[number];

type Editing = { id: string | null; values: RequirementInput };

const TAB_HINT: Record<UnitType, string> = {
  room: "Se piden a quien alquila un cuarto, ya sea suelto o dentro de un departamento “por cuartos”.",
  apartment: "Se piden a quien alquila un departamento completo.",
};

const empty = (unitType: UnitType): RequirementInput => ({
  unitType,
  name: "",
  description: "",
  required: false,
  acceptedFormats: ["pdf", "image"],
  maxSizeMb: "5",
});

const toInput = (r: RequirementRow): RequirementInput => ({
  unitType: r.unitType,
  name: r.name,
  description: r.description ?? "",
  required: r.required,
  acceptedFormats: r.acceptedFormats,
  maxSizeMb: String(r.maxSizeMb),
});

// Configuración › Documentos: una lista para cuarto y otra para departamento. Cada documento es obligatorio u
// opcional (el residente no ve los opcionales) y se puede apagar sin borrarlo.
export function RequirementsEditor({
  businessId,
  requirements: all,
}: {
  businessId: string;
  requirements: RequirementRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<UnitType>("room");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [error, setError] = useState<{ message: string; fields: Record<string, string> }>();
  const [pending, startTransition] = useTransition();
  const requirements = all.filter((r) => r.unitType === tab);
  const shownToResident = requirements.filter((r) => r.required && r.active);

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

  const toggleActive = (r: RequirementRow) =>
    startTransition(async () => {
      setError(undefined);
      const result = await setRequirementActiveAction(r.id, !r.active);
      if (!result.ok) return setError({ message: result.message, fields: {} });
      router.refresh();
    });

  const set = (patch: Partial<RequirementInput>) =>
    editing && setEditing({ ...editing, values: { ...editing.values, ...patch } });

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <section className="rounded-xl border bg-card p-5 shadow-card sm:p-6">
        <h2 className="mb-3 text-lg font-bold">Documentos que pides</h2>
        <div role="tablist" aria-label="Qué se alquila" className="mb-3 flex flex-wrap gap-1 border-b">
          {UNIT_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={t === tab}
              onClick={() => setTab(t)}
              className={
                "-mb-px flex min-h-11 items-center gap-2 border-b-[3px] px-4 text-sm transition-colors duration-200 " +
                (t === tab
                  ? "border-primary font-bold text-primary-text"
                  : "border-transparent text-muted-foreground hover:text-foreground")
              }
            >
              {UNIT_TYPE_LABEL[t]}
              <StatusBadge tone={t === tab ? "primary" : "neutral"}>
                {all.filter((r) => r.unitType === t).length}
              </StatusBadge>
            </button>
          ))}
        </div>
        <p className="mb-3 text-sm text-muted-foreground">{TAB_HINT[tab]}</p>
        {error && !editing ? <FormMessage message={error.message} /> : null}
        {requirements.length ? (
          <ul>
            {requirements.map((r) => (
              <li
                key={r.id}
                className={
                  "flex flex-wrap items-center gap-3 border-t py-3.5 first:border-t-0 " +
                  (r.active ? "" : "opacity-60")
                }
              >
                <span className="min-w-48 flex-1">
                  <b className="block">{r.name}</b>
                  <span className="text-sm text-muted-foreground">
                    {r.description ? `${r.description} · ` : ""}
                    {formatsHint(r.acceptedFormats, r.maxSizeMb)}
                  </span>
                </span>
                <StatusBadge tone={r.required ? "primary" : "neutral"}>
                  {r.required ? "Obligatorio" : "Opcional"}
                </StatusBadge>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    role="switch"
                    className="size-5 accent-primary"
                    checked={r.active}
                    disabled={pending}
                    onChange={() => toggleActive(r)}
                  />
                  {r.active ? "Activo" : "Inactivo"}
                </label>
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
            No pides ningún documento para {tab === "room" ? "cuartos" : "departamentos"}. Está bien: puedes
            trabajar solo con el número de DNI. Si agregas uno y lo marcas obligatorio, el contrato no se
            confirma hasta que esté verificado.
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          className="mt-3 h-11 gap-2"
          onClick={() => open({ id: null, values: empty(tab) })}
        >
          <Plus className="size-4" aria-hidden="true" />
          Agregar documento
        </Button>
      </section>

      <aside className="rounded-xl border bg-card p-5 shadow-card sm:p-6 lg:sticky lg:top-24">
        <h2 className="mb-1 text-lg font-bold">Así lo verá el residente</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Quien alquila {tab === "room" ? "un cuarto" : "un departamento"}:
        </p>
        {shownToResident.length ? (
          <ul className="flex flex-col gap-2">
            {shownToResident.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="size-4 shrink-0 rounded-full border-2 border-input" aria-hidden="true" />
                {r.name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No verá ningún documento por subir.</p>
        )}
        <p className="mt-4 text-sm text-muted-foreground">
          Solo ve los obligatorios y activos, y deben estar verificados para confirmar su contrato. Los
          opcionales no los ve: los subes tú. Si a alguien no le quieres pedir uno, quítalo desde su perfil.
        </p>
      </aside>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar documento" : "Agregar documento"}</DialogTitle>
            <DialogDescription>
              Para quien alquila {editing?.values.unitType === "apartment" ? "un departamento" : "un cuarto"}.
              Los cambios valen desde ya.
            </DialogDescription>
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
                    El residente lo ve y, sin él verificado, el contrato no se confirma. Si es opcional, no lo
                    ve: lo subes tú.
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
                description="Ya no se pedirá. Los archivos que ya subieron se conservan. Si solo quieres dejar de pedirlo por un tiempo, apágalo."
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
