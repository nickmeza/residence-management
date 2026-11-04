"use client";

import { useFormContext, useWatch } from "react-hook-form";

import { Label } from "@/components/ui/label";
import type { SetupForm } from "@/server/onboarding/form";
import { PAYMENT_METHODS, type PaymentMethod } from "@/server/onboarding/schema";

import { ChoiceCard, ToggleChip } from "./choice-card";
import { FieldError, FormSection, TextField } from "./form-field";

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  yape: "Yape",
  plin: "Plin",
  transfer: "Transferencia",
  cash: "Efectivo",
  card: "Tarjeta",
};

const BILLING_DAYS = [1, 5, 10, 15, 20, 25, 31];

type BusinessPrefix = "residenceBusiness" | "mealPlanBusiness";

// Datos de un negocio. Se repite por cada servicio elegido.
function BusinessFields({ prefix, withAddress }: { prefix: BusinessPrefix; withAddress: boolean }) {
  const { setValue, register, clearErrors } = useFormContext<SetupForm>();
  const kind = useWatch<SetupForm, `${BusinessPrefix}.kind`>({ name: `${prefix}.kind` });
  const methods = useWatch<SetupForm, `${BusinessPrefix}.paymentMethods`>({
    name: `${prefix}.paymentMethods`,
  });

  const toggleMethod = (method: PaymentMethod) => {
    const next = methods.includes(method) ? methods.filter((m) => m !== method) : [...methods, method];
    setValue(`${prefix}.paymentMethods`, next, { shouldDirty: true });
    clearErrors(`${prefix}.paymentMethods`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold">¿Cómo operas?</span>
        <div role="radiogroup" aria-label="Cómo operas" className="grid gap-3 sm:grid-cols-2">
          <ChoiceCard
            selected={kind === "natural"}
            onSelect={() => setValue(`${prefix}.kind`, "natural", { shouldDirty: true })}
            title="Persona natural"
            description="Alquilas o vendes a tu nombre."
          />
          <ChoiceCard
            selected={kind === "company"}
            onSelect={() => setValue(`${prefix}.kind`, "company", { shouldDirty: true })}
            title="Empresa"
            description="Tienes razón social y RUC de empresa."
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name={`${prefix}.tradeName`} label="Nombre comercial" autoComplete="organization" />
        <TextField
          name={`${prefix}.legalName`}
          label="Razón social (opcional)"
          hint="Como figura en SUNAT."
        />
        <TextField
          name={`${prefix}.ruc`}
          label="RUC (opcional)"
          inputMode="numeric"
          hint="11 dígitos. Para emitir comprobantes."
        />
        <TextField
          name={`${prefix}.phone`}
          label="Teléfono o WhatsApp (opcional)"
          type="tel"
          autoComplete="tel"
        />
        <TextField
          name={`${prefix}.contactEmail`}
          label="Correo de contacto (opcional)"
          type="email"
          autoComplete="email"
        />
        <TextField name={`${prefix}.city`} label="Ciudad (opcional)" autoComplete="address-level2" />
        {withAddress ? (
          <TextField
            name={`${prefix}.address`}
            label="Dirección del local (opcional)"
            className="sm:col-span-2"
          />
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold">Métodos de pago que aceptas</span>
        <div role="group" aria-label="Métodos de pago" className="flex flex-wrap gap-2">
          {PAYMENT_METHODS.map((m) => (
            <ToggleChip key={m} selected={methods.includes(m)} onToggle={() => toggleMethod(m)}>
              {PAYMENT_LABELS[m]}
            </ToggleChip>
          ))}
        </div>
        <FieldError name={`${prefix}.paymentMethods`} />
      </div>
      <div className="flex max-w-xs flex-col gap-1.5">
        <Label htmlFor={`${prefix}-billingDay`}>Día de cobro mensual</Label>
        <select
          id={`${prefix}-billingDay`}
          className="h-11 rounded-lg border border-input bg-transparent px-2.5 text-base md:text-sm"
          {...register(`${prefix}.billingDay`)}
        >
          {BILLING_DAYS.map((d) => (
            <option key={d} value={String(d)}>
              {d === 31 ? "Fin de mes" : `Día ${d} de cada mes`}
            </option>
          ))}
        </select>
        <FieldError name={`${prefix}.billingDay`} />
      </div>
      <p className="text-sm text-muted-foreground">Moneda: soles (S/).</p>
    </div>
  );
}

export function StepBusiness() {
  const { setValue } = useFormContext<SetupForm>();
  const services = useWatch<SetupForm, "services">({ name: "services" });
  const same = useWatch<SetupForm, "mealPlanBusiness.sameAsResidence">({
    name: "mealPlanBusiness.sameAsResidence",
  });
  const both = services.residence && services.mealPlan;

  return (
    <div className="flex flex-col gap-6">
      {services.residence ? (
        <FormSection
          title="Tu Residencia"
          description="Estos datos aparecerán en los contratos y recibos de la residencia."
        >
          <BusinessFields prefix="residenceBusiness" withAddress={false} />
        </FormSection>
      ) : null}
      {services.mealPlan ? (
        <FormSection
          title="Tu Pensión"
          description="La pensión es un negocio aparte: puede tener su propio RUC y su propio local."
        >
          {both ? (
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="size-5 accent-primary"
                checked={same}
                onChange={(e) =>
                  setValue("mealPlanBusiness.sameAsResidence", e.target.checked, { shouldDirty: true })
                }
              />
              Usar los mismos datos que la Residencia (RUC, contacto y cobros)
            </label>
          ) : null}
          {both && same ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField name="mealPlanBusiness.tradeName" label="Nombre comercial de la pensión" />
              <TextField name="mealPlanBusiness.address" label="Dirección del local (opcional)" />
            </div>
          ) : (
            <BusinessFields prefix="mealPlanBusiness" withAddress />
          )}
        </FormSection>
      ) : null}
    </div>
  );
}
