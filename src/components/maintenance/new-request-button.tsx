"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { Field } from "@/components/form-controls";
import { FileField } from "@/components/payments/file-field";
import { SelectField } from "@/components/select-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createRequestAction } from "@/server/maintenance/actions";
import {
  CATEGORY_LABEL,
  CATEGORY_VALUES,
  PRIORITY_LABEL,
  PRIORITY_VALUES,
  type MaintenanceCategory,
  type MaintenancePriority,
} from "@/server/maintenance/rules";

export type UnitOption = { id: string; label: string };

const EMPTY = {
  unitId: "",
  title: "",
  description: "",
  category: "other" as MaintenanceCategory,
  priority: "normal" as MaintenancePriority,
  blocksUnit: false,
  assignee: "",
};

// "Nuevo pedido" del arrendador: lo vio él o se lo dijeron por WhatsApp. Sin unidad = área común.
export function NewRequestButton({ businessId, units }: { businessId: string; units: UnitOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [photo, setPhoto] = useState<{ path: string; name: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = () =>
    startTransition(async () => {
      const r = await createRequestAction(businessId, {
        ...form,
        unitId: form.unitId || null,
        photoPath: photo?.path ?? null,
      });
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        setMessage(r.message);
        return;
      }
      setOpen(false);
      setForm(EMPTY);
      setPhoto(null);
      setErrors({});
      setMessage(undefined);
      router.push(r.id ? `/mantenimiento/${r.id}` : "/mantenimiento");
      router.refresh();
    });

  return (
    <>
      <Button type="button" className="h-11 gap-2" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden="true" />
        Nuevo pedido
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo pedido de mantenimiento</DialogTitle>
            <DialogDescription>
              Anota lo que hay que arreglar. Los residentes también pueden pedirlo desde su cuenta.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Field id="unidad" label="Dónde" hint="Déjalo en “Área común” si no es de una unidad.">
              <SelectField
                id="unidad"
                value={form.unitId}
                onValueChange={(v) => set("unitId", v)}
                options={[
                  { value: "", label: "Área común" },
                  ...units.map((u) => ({ value: u.id, label: u.label })),
                ]}
              />
            </Field>
            <Field id="titulo" label="Qué pasa" error={errors.title}>
              <Input
                id="titulo"
                className="h-11"
                maxLength={120}
                value={form.title}
                placeholder="Por ejemplo: la terma no calienta"
                onChange={(e) => set("title", e.target.value)}
              />
            </Field>
            <Field id="detalle" label="Detalle (opcional)" error={errors.description}>
              <Textarea
                id="detalle"
                rows={3}
                maxLength={2000}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="categoria" label="Tipo">
                <SelectField
                  id="categoria"
                  value={form.category}
                  onValueChange={(v) => set("category", v as MaintenanceCategory)}
                  options={CATEGORY_VALUES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))}
                />
              </Field>
              <Field id="prioridad" label="Prioridad">
                <SelectField
                  id="prioridad"
                  value={form.priority}
                  onValueChange={(v) => set("priority", v as MaintenancePriority)}
                  options={PRIORITY_VALUES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))}
                />
              </Field>
            </div>
            <Field id="responsable" label="Responsable (opcional)" error={errors.assignee}>
              <Input
                id="responsable"
                className="h-11"
                maxLength={80}
                value={form.assignee}
                placeholder="Por ejemplo: gasfitero Juan"
                onChange={(e) => set("assignee", e.target.value)}
              />
            </Field>
            {form.unitId ? (
              <label className="flex min-h-11 items-start gap-3 text-sm">
                <Checkbox
                  checked={form.blocksUnit}
                  onCheckedChange={(v) => set("blocksUnit", v === true)}
                  className="mt-0.5"
                />
                <span>
                  <b>La unidad no se puede usar mientras tanto</b>
                  <span className="block text-muted-foreground">
                    Se verá “Mantenimiento” en el edificio hasta que lo marques como resuelto.
                  </span>
                </span>
              </label>
            ) : null}
            <FileField
              businessId={businessId}
              residentId="general"
              folder="mantenimiento"
              label="Agregar una foto (opcional)"
              formats={["image"]}
              value={photo}
              onChange={setPhoto}
            />
            <FormMessage message={message} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="h-11" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" className="h-11" disabled={pending} onClick={save}>
              {pending ? "Guardando…" : "Guardar pedido"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
