"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormProvider, useForm, useFormContext, useWatch } from "react-hook-form";

import { FormMessage } from "@/components/auth/auth-field";
import { ChoiceCard, ToggleChip } from "@/components/onboarding/choice-card";
import { FieldError, FormSection, TextField } from "@/components/onboarding/form-field";
import { buttonVariants, Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { updateBusiness } from "@/server/business/actions";
import type { BusinessForm } from "@/server/onboarding/form";
import { PAYMENT_METHODS, type PaymentMethod } from "@/server/onboarding/schema";

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  yape: "Yape",
  plin: "Plin",
  transfer: "Transferencia",
  cash: "Efectivo",
  card: "Tarjeta",
};
const BILLING_DAYS = [1, 5, 10, 15, 20, 25, 31];

function PaymentMethods() {
  const methods = useWatch<BusinessForm, "paymentMethods">({ name: "paymentMethods" });
  const { setValue, clearErrors } = useFormContext<BusinessForm>();
  return (
    <FormSection title="Métodos de pago">
      <div role="group" aria-label="Métodos de pago" className="flex flex-wrap gap-2">
        {PAYMENT_METHODS.map((m) => (
          <ToggleChip
            key={m}
            selected={methods.includes(m)}
            onToggle={() => {
              setValue(
                "paymentMethods",
                methods.includes(m) ? methods.filter((x) => x !== m) : [...methods, m],
                {
                  shouldDirty: true,
                },
              );
              clearErrors("paymentMethods");
            }}
          >
            {PAYMENT_LABELS[m]}
          </ToggleChip>
        ))}
      </div>
      <FieldError name="paymentMethods" />
    </FormSection>
  );
}

// Formulario de Configuración › Negocio. Valida en el servidor y guarda con la sesión (RLS).
export function BusinessEditForm({
  id,
  service,
  initial,
}: {
  id: string;
  service: "residence" | "meal_plan";
  initial: BusinessForm;
}) {
  const methods = useForm<BusinessForm>({ defaultValues: initial });
  const { register, setValue, setError, reset, handleSubmit, formState } = methods;
  const kind = useWatch({ control: methods.control, name: "kind" });
  const [message, setMessage] = useState<{ text: string; ok: boolean }>();
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const submit = handleSubmit((values) =>
    startTransition(async () => {
      const result = await updateBusiness(id, values);
      if (result.status === "saved") {
        reset(values);
        setMessage({ text: "Cambios guardados.", ok: true });
        router.refresh();
        return;
      }
      setMessage({ text: result.message, ok: false });
      for (const [path, msg] of Object.entries(result.fieldErrors ?? {})) {
        setError(path as keyof BusinessForm, { type: "manual", message: msg });
      }
    }),
  );

  return (
    <FormProvider {...methods}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-6">
        <div className="grid items-start gap-6 md:grid-cols-2">
          <FormSection title="Datos del negocio">
            <div role="radiogroup" aria-label="Cómo operas" className="grid gap-3 sm:grid-cols-2">
              <ChoiceCard
                selected={kind === "natural"}
                onSelect={() => setValue("kind", "natural", { shouldDirty: true })}
                title="Persona natural"
              />
              <ChoiceCard
                selected={kind === "company"}
                onSelect={() => setValue("kind", "company", { shouldDirty: true })}
                title="Empresa"
              />
            </div>
            <TextField name="tradeName" label="Nombre comercial" autoComplete="organization" />
            <TextField name="legalName" label="Razón social (opcional)" placeholder="Como figura en SUNAT" />
            <TextField name="ruc" label="RUC (opcional)" inputMode="numeric" placeholder="11 dígitos" />
            <TextField
              name="phone"
              label="Teléfono o WhatsApp (opcional)"
              type="tel"
              placeholder="+51 987 654 321"
            />
            <TextField
              name="contactEmail"
              label="Correo de contacto (opcional)"
              type="email"
              placeholder="correo@ejemplo.com"
            />
            <TextField name="city" label="Ciudad (opcional)" />
            {service === "meal_plan" ? (
              <TextField name="address" label="Dirección del local (opcional)" />
            ) : null}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="billingDay">Día de cobro mensual</Label>
              <select
                id="billingDay"
                className="h-11 rounded-lg border border-input bg-transparent px-2.5 text-base md:text-sm"
                {...register("billingDay")}
              >
                {BILLING_DAYS.map((d) => (
                  <option key={d} value={String(d)}>
                    {d === 31 ? "Fin de mes" : `Día ${d}`}
                  </option>
                ))}
              </select>
            </div>
          </FormSection>
          <PaymentMethods />
        </div>

        {message ? (
          message.ok ? (
            <p role="status" className="rounded-lg bg-ok-soft px-3 py-2 text-sm font-semibold text-ok">
              {message.text}
            </p>
          ) : (
            <FormMessage message={message.text} />
          )
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card px-4 py-4 shadow-card sm:px-6">
          <span className="text-sm text-muted-foreground">
            Los cambios aplican a recibos y contratos nuevos.
          </span>
          <div className="flex gap-3">
            <Link href="/panel" className={buttonVariants({ variant: "outline", className: "h-11 px-4" })}>
              Cancelar
            </Link>
            <Button type="submit" className="h-11 px-4" disabled={pending || !formState.isDirty}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </div>
      </form>
    </FormProvider>
  );
}
