"use client";

import { ImageIcon } from "lucide-react";
import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { SetupForm, StepId } from "@/server/onboarding/form";
import { PAYMENT_METHODS, type PaymentMethod } from "@/server/onboarding/schema";

import { BusinessSwitcher, type SwitcherOption } from "./business-switcher";
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

// Columna izquierda del prototipo: "Datos del negocio" (con el logo) y "Contacto".
function BusinessColumn({ prefix }: { prefix: BusinessPrefix }) {
  const { setValue } = useFormContext<SetupForm>();
  const kind = useWatch<SetupForm, `${BusinessPrefix}.kind`>({ name: `${prefix}.kind` });
  const isMealPlan = prefix === "mealPlanBusiness";
  return (
    <div className="flex flex-col gap-5">
      <FormSection title="Datos del negocio">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">¿Cómo operas?</span>
          <div role="radiogroup" aria-label="Cómo operas" className="grid gap-3 sm:grid-cols-2">
            <ChoiceCard
              selected={kind === "natural"}
              onSelect={() => setValue(`${prefix}.kind`, "natural", { shouldDirty: true })}
              title="Persona natural"
              description="Operas a tu nombre."
            />
            <ChoiceCard
              selected={kind === "company"}
              onSelect={() => setValue(`${prefix}.kind`, "company", { shouldDirty: true })}
              title="Empresa"
              description="Tienes razón social y RUC de empresa."
            />
          </div>
        </div>
        <TextField name={`${prefix}.tradeName`} label="Nombre comercial" autoComplete="organization" />
        <TextField
          name={`${prefix}.legalName`}
          label="Razón social (opcional)"
          placeholder="Como figura en SUNAT"
        />
        <TextField
          name={`${prefix}.ruc`}
          label="RUC (opcional)"
          inputMode="numeric"
          placeholder="11 dígitos"
          hint="Solo para emitir comprobantes."
        />
        {/* El logo necesita Supabase Storage: el bloque queda en su lugar y se activa más adelante. */}
        <div className="flex flex-wrap items-center gap-4 rounded-xl border-2 border-dashed p-4">
          <span className="flex size-14 items-center justify-center rounded-xl bg-primary-soft text-primary-text">
            <ImageIcon className="size-6" aria-hidden="true" />
          </span>
          <span className="min-w-40 flex-1">
            <span className="block text-sm font-semibold">Logo del negocio (opcional)</span>
            <span className="block text-sm text-muted-foreground">
              PNG o JPG, máximo 2 MB · Disponible pronto
            </span>
          </span>
          <Button type="button" variant="outline" className="h-11" disabled>
            Elegir archivo
          </Button>
        </div>
      </FormSection>
      <FormSection title="Contacto">
        <TextField
          name={`${prefix}.phone`}
          label="Teléfono o WhatsApp (opcional)"
          type="tel"
          autoComplete="tel"
          placeholder="+51 987 654 321"
          hint={
            isMealPlan
              ? "Tus clientes te escribirán a este número."
              : "Tus residentes te escribirán a este número."
          }
        />
        <TextField
          name={`${prefix}.contactEmail`}
          label="Correo de contacto (opcional)"
          type="email"
          autoComplete="email"
          placeholder="correo@ejemplo.com"
        />
        <TextField name={`${prefix}.city`} label="Ciudad (opcional)" autoComplete="address-level2" />
        {isMealPlan ? (
          <TextField name="mealPlanBusiness.address" label="Dirección del local (opcional)" />
        ) : null}
      </FormSection>
    </div>
  );
}

// Bloque "Cómo cobras" de la columna derecha.
function BillingSection({ prefix }: { prefix: BusinessPrefix }) {
  const { setValue, register, clearErrors } = useFormContext<SetupForm>();
  const methods = useWatch<SetupForm, `${BusinessPrefix}.paymentMethods`>({
    name: `${prefix}.paymentMethods`,
  });
  const toggle = (m: PaymentMethod) => {
    setValue(
      `${prefix}.paymentMethods`,
      methods.includes(m) ? methods.filter((x) => x !== m) : [...methods, m],
      {
        shouldDirty: true,
      },
    );
    clearErrors(`${prefix}.paymentMethods`);
  };
  return (
    <FormSection title="Cómo cobras">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold">Métodos de pago que aceptas</span>
        <div role="group" aria-label="Métodos de pago" className="flex flex-wrap gap-2">
          {PAYMENT_METHODS.map((m) => (
            <ToggleChip key={m} selected={methods.includes(m)} onToggle={() => toggle(m)}>
              {PAYMENT_LABELS[m]}
            </ToggleChip>
          ))}
        </div>
        <FieldError name={`${prefix}.paymentMethods`} />
      </div>
      <div className="flex flex-col gap-1.5">
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
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Moneda</span>
        <span className="flex items-center justify-between rounded-lg border bg-muted/50 px-3 py-3 text-sm">
          Soles (S/)<span className="text-muted-foreground">Predeterminada</span>
        </span>
      </div>
    </FormSection>
  );
}

export function StepBusiness({ goTo }: { goTo: (step: StepId) => void }) {
  const { setValue } = useFormContext<SetupForm>();
  const services = useWatch<SetupForm, "services">({ name: "services" });
  const residenceName = useWatch<SetupForm, "residenceBusiness.tradeName">({
    name: "residenceBusiness.tradeName",
  });
  const mealPlanName = useWatch<SetupForm, "mealPlanBusiness.tradeName">({
    name: "mealPlanBusiness.tradeName",
  });
  const same = useWatch<SetupForm, "mealPlanBusiness.sameAsResidence">({
    name: "mealPlanBusiness.sameAsResidence",
  });
  const both = services.residence && services.mealPlan;
  const [active, setActive] = useState<BusinessPrefix>(
    services.residence ? "residenceBusiness" : "mealPlanBusiness",
  );
  const prefix: BusinessPrefix = services.residence
    ? services.mealPlan
      ? active
      : "residenceBusiness"
    : "mealPlanBusiness";
  const sharing = both && prefix === "mealPlanBusiness" && same;

  const options: SwitcherOption[] = [
    ...(services.residence
      ? [{ id: "residenceBusiness", service: "residence" as const, name: residenceName }]
      : []),
    ...(services.mealPlan
      ? [{ id: "mealPlanBusiness", service: "meal_plan" as const, name: mealPlanName }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-5">
      {both ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">Estás completando:</span>
          <BusinessSwitcher
            options={options}
            value={prefix}
            onChange={(id) => setActive(id as BusinessPrefix)}
          />
        </div>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="flex flex-col gap-5">
          {both && prefix === "mealPlanBusiness" ? (
            <label className="flex min-h-11 items-center gap-3 rounded-xl border bg-card p-4 text-sm shadow-card">
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
          {sharing ? (
            <FormSection title="Datos de la pensión" description="El resto se toma de la Residencia.">
              <TextField name="mealPlanBusiness.tradeName" label="Nombre comercial de la pensión" />
              <TextField name="mealPlanBusiness.address" label="Dirección del local (opcional)" />
            </FormSection>
          ) : (
            <BusinessColumn key={prefix} prefix={prefix} />
          )}
        </div>

        <aside className="flex flex-col gap-5 lg:sticky lg:top-6">
          {sharing ? (
            <FormSection
              title="Cómo cobras"
              description="Usa los mismos métodos y el mismo día de cobro que la Residencia."
            />
          ) : (
            <BillingSection key={prefix} prefix={prefix} />
          )}
          <FormSection title="Servicios elegidos">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                {options.map((o) => (
                  <span
                    key={o.id}
                    className="rounded-full bg-primary-soft px-3 py-1.5 text-sm font-semibold text-primary-text"
                  >
                    {o.service === "residence" ? "Residencia" : "Pensión"}
                  </span>
                ))}
              </div>
              <Button
                type="button"
                variant="link"
                className="h-11 px-1 text-link"
                onClick={() => goTo("services")}
              >
                Cambiar
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Con esto armamos las vistas de tu sistema: edificio, residentes, contratos, planes de comida y
              cobros.
            </p>
          </FormSection>
        </aside>
      </div>
    </div>
  );
}
