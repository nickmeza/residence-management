"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { Field, textareaClass } from "@/components/form-controls";
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
import { createSupplierAction, updateSupplierAction } from "@/server/tasks/actions";

type SupplierForm = { name: string; trade: string; phone: string; note: string };

// Crear (con businessId) o editar (con supplierId) un proveedor del directorio (MT-06).
export function SupplierDialog({
  open,
  onOpenChange,
  businessId,
  supplierId,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId?: string;
  supplierId?: string;
  initial?: Partial<SupplierForm>;
}) {
  const router = useRouter();
  const start: SupplierForm = { name: "", trade: "", phone: "", note: "", ...initial };
  const [form, setForm] = useState(start);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();
  const set = (key: keyof SupplierForm, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const save = () =>
    startTransition(async () => {
      const r = supplierId
        ? await updateSupplierAction(supplierId, form)
        : await createSupplierAction(businessId ?? "", form);
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        setMessage(r.message);
        return;
      }
      onOpenChange(false);
      if (!supplierId) setForm(start);
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{supplierId ? "Editar proveedor" : "Nuevo proveedor"}</DialogTitle>
          <DialogDescription>
            Gasfitero, electricista, limpieza… Para elegirlo en pedidos y tareas.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field id="proveedor-nombre" label="Nombre" error={errors.name}>
            <Input
              id="proveedor-nombre"
              className="h-11"
              maxLength={120}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="proveedor-oficio" label="Oficio (opcional)" error={errors.trade}>
              <Input
                id="proveedor-oficio"
                className="h-11"
                maxLength={60}
                placeholder="Por ejemplo: gasfitero"
                value={form.trade}
                onChange={(e) => set("trade", e.target.value)}
              />
            </Field>
            <Field id="proveedor-celular" label="Celular (opcional)" error={errors.phone}>
              <Input
                id="proveedor-celular"
                className="h-11"
                type="tel"
                maxLength={30}
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </Field>
          </div>
          <Field id="proveedor-nota" label="Nota (opcional)" error={errors.note}>
            <textarea
              id="proveedor-nota"
              rows={2}
              maxLength={500}
              className={textareaClass}
              value={form.note}
              onChange={(e) => set("note", e.target.value)}
            />
          </Field>
          <FormMessage message={message} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="h-11" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" className="h-11" disabled={pending} onClick={save}>
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
