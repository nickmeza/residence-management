"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { formSummary, type SetupForm, type StepId } from "@/server/onboarding/form";

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

function SummaryRow({
  label,
  value,
  detail,
  onEdit,
}: {
  label: string;
  value: string;
  detail?: string;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-start gap-3 border-t py-3">
      <div className="min-w-0 flex-1">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="font-semibold">{value}</div>
        {detail ? <div className="text-sm text-muted-foreground">{detail}</div> : null}
      </div>
      <Button type="button" variant="link" className="h-11 px-1 text-link" onClick={onEdit}>
        Editar
      </Button>
    </div>
  );
}

export function StepAccount({ goTo }: { goTo: (step: StepId) => void }) {
  const { register } = useFormContext<SetupForm>();
  const [show, setShow] = useState(false);
  const values = useWatch<SetupForm>() as SetupForm;
  const password = values.account?.password ?? "";
  const summary = formSummary(values.property.floors);
  const services = [values.services.residence && "Residencia", values.services.mealPlan && "Pensión"].filter(
    Boolean,
  );

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <FormSection title="Crea tu cuenta" description="Te enviaremos un correo para confirmarla.">
        <TextField name="account.fullName" label="Nombre completo" autoComplete="name" />
        <TextField name="account.email" label="Correo electrónico" type="email" autoComplete="email" />
        <div className="flex flex-col gap-2">
          <TextField
            name="account.password"
            label="Contraseña"
            type={show ? "text" : "password"}
            autoComplete="new-password"
          />
          <div>
            <Button
              type="button"
              variant="link"
              className="h-9 px-0 text-link"
              onClick={() => setShow((s) => !s)}
            >
              {show ? "Ocultar contraseña" : "Mostrar contraseña"}
            </Button>
          </div>
          <ul className="flex flex-col gap-1 text-sm" aria-label="Requisitos de la contraseña">
            {RULES.map((r) => {
              const ok = r.test(password);
              return (
                <li key={r.label} className={ok ? "text-ok" : "text-muted-foreground"}>
                  <span aria-hidden="true">{ok ? "✓ " : "○ "}</span>
                  {r.label}
                  <span className="sr-only">{ok ? " (cumplido)" : " (pendiente)"}</span>
                </li>
              );
            })}
          </ul>
        </div>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-5 accent-primary"
            {...register("account.acceptTerms")}
          />
          <span>
            Acepto los{" "}
            <Link href="/terminos" target="_blank" className="text-link underline-offset-4 hover:underline">
              Términos de uso
            </Link>{" "}
            y la{" "}
            <Link href="/privacidad" target="_blank" className="text-link underline-offset-4 hover:underline">
              Política de privacidad
            </Link>
            .
          </span>
        </label>
        <FieldError name="account.acceptTerms" />
      </FormSection>

      <aside
        className="rounded-xl border bg-card p-4 shadow-card sm:p-6"
        aria-label="Resumen de tu configuración"
      >
        <h2 className="text-base font-bold">Resumen de tu configuración</h2>
        <p className="mb-2 text-sm text-muted-foreground">
          Revisa que todo esté bien antes de crear tu cuenta.
        </p>
        <SummaryRow label="Servicios" value={services.join(" y ")} onEdit={() => goTo("services")} />
        {values.services.residence ? (
          <SummaryRow
            label="Residencia"
            value={values.residenceBusiness.tradeName || "Sin nombre"}
            detail={values.residenceBusiness.kind === "company" ? "Empresa" : "Persona natural"}
            onEdit={() => goTo("business")}
          />
        ) : null}
        {values.services.mealPlan ? (
          <SummaryRow
            label="Pensión"
            value={values.mealPlanBusiness.tradeName || "Sin nombre"}
            detail={
              values.mealPlanBusiness.sameAsResidence && values.services.residence
                ? "Mismos datos que la Residencia"
                : undefined
            }
            onEdit={() => goTo("business")}
          />
        ) : null}
        {values.services.residence ? (
          <SummaryRow
            label="Propiedad"
            value={values.property.name || OFFER_LABEL[values.property.type]}
            detail={`${OFFER_LABEL[values.property.type]} · ${summary.floors} ${summary.floors === 1 ? "piso" : "pisos"} · ${summary.rentable} que se alquilan`}
            onEdit={() => goTo("building")}
          />
        ) : null}
      </aside>
    </div>
  );
}
