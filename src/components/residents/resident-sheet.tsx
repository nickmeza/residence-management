"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormProvider, useForm } from "react-hook-form";

import { FormMessage } from "@/components/auth/auth-field";
import { TextField } from "@/components/onboarding/form-field";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { createResidentAction, updateResidentAction } from "@/server/residents/actions";
import {
  IDENTITY_DOCUMENT_LABEL,
  IDENTITY_DOCUMENT_TYPES,
  type ResidentInput,
} from "@/server/residents/schemas";

import { InviteButton } from "./invite-button";

export const EMPTY_RESIDENT: ResidentInput = {
  fullName: "",
  phone: "",
  email: "",
  identityDocumentType: "",
  identityDocumentNumber: "",
  university: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  notes: "",
};

const selectClass = "h-11 rounded-lg border border-input bg-transparent px-2.5 text-base md:text-sm";

export function ResidentForm({
  residentId,
  initial,
  hasAccount,
  onCreated,
  onSaved,
}: {
  residentId: string | null;
  initial: ResidentInput;
  hasAccount: boolean;
  onCreated: (id: string, name: string) => void;
  onSaved: () => void;
}) {
  const methods = useForm<ResidentInput>({ defaultValues: initial });
  const { register, setError, handleSubmit, formState } = methods;
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  const save = handleSubmit((values) =>
    startTransition(async () => {
      const result = residentId
        ? await updateResidentAction(residentId, values)
        : await createResidentAction(values);
      if (result.ok) {
        if (residentId) onSaved();
        else onCreated(result.id, values.fullName);
        return;
      }
      setMessage(result.message);
      for (const [path, msg] of Object.entries(result.fieldErrors ?? {})) {
        setError(path as keyof ResidentInput, { type: "manual", message: msg });
      }
    }),
  );

  return (
    <FormProvider {...methods}>
      <form onSubmit={save} noValidate className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4">
        <fieldset disabled={hasAccount} className="flex flex-col gap-4 disabled:opacity-70">
          <legend className="mb-3 text-sm font-bold">Datos personales</legend>
          {hasAccount ? (
            <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
              Ya tiene cuenta: sus datos personales se editan desde su propia cuenta.
            </p>
          ) : null}
          <TextField name="fullName" label="Nombre completo" autoComplete="off" />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField name="phone" label="Teléfono (opcional)" inputMode="tel" placeholder="987 654 321" />
            <TextField name="email" label="Correo (opcional)" type="email" inputMode="email" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="identityDocumentType">Documento (opcional)</Label>
              <select id="identityDocumentType" className={selectClass} {...register("identityDocumentType")}>
                <option value="">Sin indicar</option>
                {IDENTITY_DOCUMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {IDENTITY_DOCUMENT_LABEL[t]}
                  </option>
                ))}
              </select>
              {formState.errors.identityDocumentType ? (
                <p className="text-sm text-danger">{formState.errors.identityDocumentType.message}</p>
              ) : null}
            </div>
            <TextField name="identityDocumentNumber" label="Número" autoComplete="off" />
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-4">
          <legend className="mb-3 text-sm font-bold">Datos de tu negocio</legend>
          <p className="-mt-2 text-sm text-muted-foreground">Solo los ves tú; otros negocios no.</p>
          <TextField name="university" label="Universidad o centro de estudios (opcional)" />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField name="emergencyContactName" label="Contacto de emergencia (opcional)" />
            <TextField name="emergencyContactPhone" label="Su teléfono" inputMode="tel" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <textarea
              id="notes"
              rows={3}
              className="rounded-lg border border-input bg-transparent p-3 text-base md:text-sm"
              {...register("notes")}
            />
          </div>
        </fieldset>

        <FormMessage message={message} />

        <div className="mt-auto flex justify-end border-t pt-4">
          <Button
            type="submit"
            className="h-11 px-5"
            disabled={pending || (residentId !== null && !formState.isDirty)}
          >
            {pending ? "Guardando…" : residentId ? "Guardar" : "Agregar residente"}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}

export type ResidentSheetTarget =
  { mode: "create" } | { mode: "edit"; residentId: string; initial: ResidentInput; hasAccount: boolean };

// Panel lateral para agregar o editar un residente (como el de las unidades). Al agregar, ofrece invitarlo.
export function ResidentSheet({
  target,
  onClose,
}: {
  target: ResidentSheetTarget | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null);

  const close = () => {
    setCreated(null);
    onClose();
  };

  return (
    <Sheet open={target !== null} onOpenChange={(open) => !open && close()}>
      <SheetContent side="right" className="flex w-full flex-col gap-4 sm:max-w-md">
        {created ? (
          <>
            <SheetHeader>
              <SheetTitle>{created.name} ya está en tu lista</SheetTitle>
              <SheetDescription>
                Mándale una invitación para que vea su contrato y sus documentos desde su celular. Puedes
                hacerlo después desde su perfil.
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-wrap gap-2 px-4">
              <InviteButton residentId={created.id} label="Invitar ahora" />
              <Link
                href={`/residentes/${created.id}`}
                onClick={close}
                className={buttonVariants({ variant: "outline", className: "h-11" })}
              >
                Ver perfil
              </Link>
            </div>
          </>
        ) : target ? (
          <>
            <SheetHeader>
              <SheetTitle>{target.mode === "create" ? "Agregar residente" : "Editar datos"}</SheetTitle>
              <SheetDescription>
                {target.mode === "create"
                  ? "Solo el nombre es obligatorio. Lo demás lo puedes completar después."
                  : "Los cambios se guardan al pulsar Guardar."}
              </SheetDescription>
            </SheetHeader>
            <ResidentForm
              key={target.mode === "edit" ? target.residentId : "nuevo"}
              residentId={target.mode === "edit" ? target.residentId : null}
              initial={target.mode === "edit" ? target.initial : EMPTY_RESIDENT}
              hasAccount={target.mode === "edit" && target.hasAccount}
              onCreated={(id, name) => {
                setCreated({ id, name });
                router.refresh();
              }}
              onSaved={() => {
                router.refresh();
                close();
              }}
            />
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
