"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { DateField } from "@/components/date-field";
import { Field } from "@/components/form-controls";
import { SelectField } from "@/components/select-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { submitApplicationAction } from "@/server/applications/actions";

const EMPTY = {
  fullName: "",
  phone: "",
  email: "",
  unitType: "",
  moveInDate: "",
  months: "",
  budget: "",
  occupation: "",
  message: "",
};

// Formulario público para postular a una residencia (RS-03). No pide DNI ni documentos: eso llega después, si la
// residencia aprueba la postulación y lo invita a su cuenta.
export function ApplicationForm({ businessId }: { businessId: string }) {
  const [form, setForm] = useState(EMPTY);
  const [accepts, setAccepts] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string>();
  const [sent, setSent] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (key: keyof typeof EMPTY) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const send = () =>
    startTransition(async () => {
      const r = await submitApplicationAction(businessId, { ...form, accepts });
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        setMessage(r.message);
        return;
      }
      setSent(r.tradeName ?? "La residencia");
    });

  if (sent) {
    return (
      <div role="status" className="flex flex-col gap-2 rounded-lg bg-ok-soft p-4 text-ok">
        <b>¡Listo! Enviamos tu postulación.</b>
        <span>{sent} la revisará y te escribirá a tu celular.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Field id="nombre" label="Nombre completo" error={errors.fullName}>
        <Input
          id="nombre"
          className="h-11"
          autoComplete="name"
          value={form.fullName}
          onChange={set("fullName")}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="celular" label="Celular" error={errors.phone}>
          <Input
            id="celular"
            className="h-11"
            inputMode="tel"
            autoComplete="tel"
            value={form.phone}
            placeholder="987 654 321"
            onChange={set("phone")}
          />
        </Field>
        <Field id="correo" label="Correo (opcional)" error={errors.email}>
          <Input
            id="correo"
            className="h-11"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={set("email")}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="tipo" label="Qué buscas">
          <SelectField
            id="tipo"
            value={form.unitType}
            onValueChange={(v) => setForm((f) => ({ ...f, unitType: v }))}
            options={[
              { value: "", label: "Cualquiera" },
              { value: "room", label: "Un cuarto" },
              { value: "apartment", label: "Un departamento" },
            ]}
          />
        </Field>
        <Field id="ingreso" label="Desde cuándo (opcional)" error={errors.moveInDate}>
          <DateField
            id="ingreso"
            value={form.moveInDate}
            onValueChange={(v) => setForm((f) => ({ ...f, moveInDate: v }))}
            invalid={Boolean(errors.moveInDate)}
            clearable
          />
        </Field>
        <Field id="meses" label="Por cuántos meses (opcional)" error={errors.months}>
          <Input
            id="meses"
            className="h-11"
            inputMode="numeric"
            value={form.months}
            onChange={set("months")}
          />
        </Field>
        <Field id="presupuesto" label="Presupuesto al mes, S/ (opcional)" error={errors.budget}>
          <Input
            id="presupuesto"
            className="h-11"
            inputMode="decimal"
            value={form.budget}
            onChange={set("budget")}
          />
        </Field>
      </div>
      <Field
        id="ocupacion"
        label="Qué te trae a la ciudad (opcional)"
        hint="Por ejemplo: estudio en la universidad, trabajo en el hospital."
        error={errors.occupation}
      >
        <Input id="ocupacion" className="h-11" value={form.occupation} onChange={set("occupation")} />
      </Field>
      <Field id="mensaje" label="Mensaje (opcional)" error={errors.message}>
        <Textarea id="mensaje" rows={3} maxLength={1000} value={form.message} onChange={set("message")} />
      </Field>
      <label className="flex min-h-11 items-start gap-3 text-sm">
        <Checkbox checked={accepts} onCheckedChange={(v) => setAccepts(v === true)} className="mt-0.5" />
        <span>
          Acepto que la residencia guarde estos datos para responder mi postulación (
          <Link href="/privacidad" className="text-link underline-offset-4 hover:underline">
            Política de privacidad
          </Link>
          ).
          {errors.accepts ? <span className="block text-danger">{errors.accepts}</span> : null}
        </span>
      </label>
      <FormMessage message={message} />
      <Button type="button" className="h-11" disabled={pending} onClick={send}>
        {pending ? "Enviando…" : "Enviar postulación"}
      </Button>
    </div>
  );
}
