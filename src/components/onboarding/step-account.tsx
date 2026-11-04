"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useFormContext, useFormState, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formSummary, type BusinessForm, type SetupForm, type StepId } from "@/server/onboarding/form";

import { FieldError, FormSection, TextField } from "./form-field";

const RULES = [
  { label: "Mínimo 8 caracteres", test: (p: string) => p.length >= 8 },
  { label: "Una letra mayúscula", test: (p: string) => /[A-ZÁÉÍÓÚÑ]/.test(p) },
  { label: "Un número", test: (p: string) => /[0-9]/.test(p) },
];

const OFFER_LABEL = {
  room: "Un cuarto",
  floor: "Un piso",
  building: "Un edificio",
  "": "Sin elegir",
} as const;
const PAYMENT_LABEL = {
  yape: "Yape",
  plin: "Plin",
  transfer: "transferencia",
  cash: "efectivo",
  card: "tarjeta",
} as const;

const listJoin = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} y ${items.at(-1)}`;

// "Empresa · Lima · Cobras con Yape, Plin y transferencia", como el resumen del prototipo.
function businessDetail(b: BusinessForm) {
  const parts = [b.kind === "company" ? "Empresa" : "Persona natural"];
  if (b.city) parts.push(b.city);
  if (b.paymentMethods.length)
    parts.push(`Cobras con ${listJoin(b.paymentMethods.map((m) => PAYMENT_LABEL[m]))}`);
  return parts.join(" · ");
}

function SummaryRow({
  label,
  value,
  detail,
  onEdit,
}: {
  label: string;
  value: string;
  detail?: string;
  onEdit?: () => void;
}) {
  return (
    <div className="flex items-start gap-3 border-t py-3.5">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-muted-foreground">{label}</div>
        <div className="mt-0.5 font-semibold">{value}</div>
        {detail ? <div className="mt-0.5 text-sm text-muted-foreground">{detail}</div> : null}
      </div>
      {onEdit ? (
        <Button type="button" variant="link" className="h-11 px-1 text-link" onClick={onEdit}>
          Editar
        </Button>
      ) : null}
    </div>
  );
}

// Contraseña con el botón "Mostrar" dentro del campo, como el prototipo.
function PasswordField() {
  const { register } = useFormContext<SetupForm>();
  const { errors } = useFormState<SetupForm>({ name: "account.password" });
  const [show, setShow] = useState(false);
  const error = errors.account?.password?.message;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="account-password">Contraseña</Label>
      <div className="relative">
        <Input
          id="account-password"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          className="h-11 pr-24"
          aria-invalid={error ? true : undefined}
          aria-describedby="account-password-rules"
          {...register("account.password")}
        />
        <Button
          type="button"
          variant="ghost"
          className="absolute top-1/2 right-1 h-9 -translate-y-1/2 px-2 text-link"
          onClick={() => setShow((s) => !s)}
          aria-pressed={show}
        >
          {show ? "Ocultar" : "Mostrar"}
        </Button>
      </div>
      <FieldError name="account.password" />
    </div>
  );
}

export function StepAccount({ goTo }: { goTo: (step: StepId) => void }) {
  const { register } = useFormContext<SetupForm>();
  const values = useWatch<SetupForm>() as SetupForm;
  const password = values.account?.password ?? "";
  const summary = formSummary(values.property.floors);
  const services = [values.services.residence && "Residencia", values.services.mealPlan && "Pensión"].filter(
    (s): s is string => Boolean(s),
  );
  const sharing = values.services.residence && values.mealPlanBusiness.sameAsResidence;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <FormSection title="Crea tu cuenta">
        <TextField
          name="account.fullName"
          label="Nombre completo"
          autoComplete="name"
          placeholder="Tu nombre y apellido"
        />
        <TextField
          name="account.email"
          label="Correo electrónico"
          type="email"
          autoComplete="email"
          placeholder="correo@ejemplo.com"
          hint="Te enviaremos un correo para confirmar tu cuenta."
        />
        <PasswordField />
        <ul
          id="account-password-rules"
          className="flex flex-col gap-2"
          aria-label="Requisitos de la contraseña"
        >
          {RULES.map((r) => {
            const ok = r.test(password);
            return (
              <li key={r.label} className="flex items-center gap-2.5 text-sm">
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full",
                    ok ? "bg-ok text-primary-foreground" : "border-2 border-border",
                  )}
                >
                  {ok ? <Check className="size-3" strokeWidth={3} /> : null}
                </span>
                <span className={ok ? "" : "text-muted-foreground"}>
                  {r.label}
                  {ok ? null : <span className="text-xs"> (pendiente)</span>}
                </span>
              </li>
            );
          })}
        </ul>
        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-5 accent-primary"
            {...register("account.acceptTerms")}
          />
          <span>
            Acepto los{" "}
            <Link
              href="/terminos"
              target="_blank"
              className="font-semibold text-link underline-offset-4 hover:underline"
            >
              Términos de uso
            </Link>{" "}
            y la{" "}
            <Link
              href="/privacidad"
              target="_blank"
              className="font-semibold text-link underline-offset-4 hover:underline"
            >
              Política de privacidad
            </Link>
            .
          </span>
        </label>
        <FieldError name="account.acceptTerms" />
      </FormSection>

      <aside
        className="rounded-xl border bg-card p-4 shadow-card sm:p-6 lg:sticky lg:top-6"
        aria-label="Resumen de tu configuración"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-bold">Resumen de tu configuración</h2>
          <span className="rounded-full bg-terracota px-2.5 py-1 text-xs font-bold text-terracota-foreground">
            Casi listo
          </span>
        </div>
        <p className="mt-1 mb-2 text-sm text-muted-foreground">
          Revisa que todo esté bien antes de crear tu cuenta.
        </p>
        <SummaryRow label="Servicios" value={listJoin(services)} onEdit={() => goTo("services")} />
        {values.services.residence ? (
          <SummaryRow
            label="Negocio · Residencia"
            value={values.residenceBusiness.tradeName || "Sin nombre"}
            detail={businessDetail(values.residenceBusiness)}
            onEdit={() => goTo("business")}
          />
        ) : null}
        {values.services.mealPlan ? (
          <SummaryRow
            label="Negocio · Pensión"
            value={values.mealPlanBusiness.tradeName || "Sin nombre"}
            detail={
              sharing ? "Mismos datos y cobros que la Residencia" : businessDetail(values.mealPlanBusiness)
            }
            onEdit={() => goTo("business")}
          />
        ) : null}
        {values.services.residence ? (
          <SummaryRow
            label={values.property.type === "building" ? "Edificio" : "Propiedad"}
            value={values.property.name || OFFER_LABEL[values.property.type]}
            detail={`${summary.floors} ${summary.floors === 1 ? "piso" : "pisos"} · ${summary.apartments} ${summary.apartments === 1 ? "departamento" : "departamentos"} · ${summary.rentable} unidades alquilables`}
            onEdit={() => goTo("building")}
          />
        ) : null}
        <SummaryRow
          label="Modo de vista"
          value="Simple"
          detail="Puedes cambiarlo con el interruptor de arriba."
        />
      </aside>
    </div>
  );
}
