"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { Controller, FormProvider, useForm, useWatch } from "react-hook-form";

import { FormMessage } from "@/components/auth/auth-field";
import { FieldError, TextField } from "@/components/onboarding/form-field";
import { FormSelectField, SelectField } from "@/components/select-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatShortDate, formatSoles, priceText } from "@/lib/format";
import { cn } from "@/lib/utils";
import { changeTermsAction, createContractAction } from "@/server/contracts/actions";
import { limaToday } from "@/server/contracts/dates";
import { contractPreview } from "@/server/contracts/preview";
import type { ContractFormOptions } from "@/server/contracts/queries";
import {
  DEPOSIT_CHOICES,
  PAPERWORK_HINT,
  PAPERWORK_LABEL,
  PAPERWORK_OPTIONS,
  type ContractFormInput,
} from "@/server/contracts/schemas";
import { DEPOSIT_RULE_LABEL } from "@/server/deposits/rules";
import { periodLabel } from "@/server/payments/rules";

const PAYMENT_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

export type ContractEditorMode =
  // Nuevo contrato. lockResident/lockUnit: llegan elegidos y no se cambian (desde la ficha o el edificio).
  | { kind: "create"; lockResident: boolean; lockUnit: boolean }
  // Cambiar condiciones: el actual termina el día anterior y empieza uno nuevo con estos datos.
  | { kind: "terms"; contractId: string };

// Un bloque numerado del formulario.
function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-card">
      <h2 className="flex items-center gap-2.5 text-lg font-bold">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary-soft text-sm text-primary-text">
          {n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  );
}

// Página para crear un contrato o cambiar sus condiciones: el formulario en 4 bloques y, al lado, un resumen que se
// llena mientras se escribe (con las mismas reglas que Cobros). Las validaciones son las del servidor.
export function ContractEditor({
  options,
  initial,
  mode,
}: {
  options: ContractFormOptions;
  initial: ContractFormInput;
  mode: ContractEditorMode;
}) {
  const router = useRouter();
  const creating = mode.kind === "create";
  const methods = useForm<ContractFormInput>({ defaultValues: initial });
  const { setValue, setError, handleSubmit, formState } = methods;
  const values = useWatch({ control: methods.control }) as ContractFormInput;
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  const unit = options.units.find((u) => u.id === values.unitId);
  const resident = options.residents.find((r) => r.id === values.residentId);
  const today = limaToday(new Date());
  // Al cambiar condiciones la garantía no se toca: pasa al contrato nuevo (regla 9).
  const preview = contractPreview({
    ...values,
    paymentDay: String(values.paymentDay ?? ""),
    prorate: options.prorateRent,
    unitDeposit: creating ? (unit?.deposit ?? null) : null,
    today,
  });
  const unitDeposit = unit?.deposit ?? null;
  const defaultDeposit = unitDeposit
    ? unitDeposit.rule === "fixed"
      ? "Monto fijo"
      : DEPOSIT_RULE_LABEL[unitDeposit.rule]
    : "elige la unidad";

  const save = (asDraft: boolean) =>
    handleSubmit((v) =>
      startTransition(async () => {
        setMessage(undefined);
        const result =
          mode.kind === "terms"
            ? await changeTermsAction(mode.contractId, v)
            : await createContractAction(v, asDraft);
        if (result.ok) return router.push(`/contratos/${result.id}`);
        setMessage(result.message);
        for (const [path, msg] of Object.entries(result.fieldErrors ?? {})) {
          setError(path as keyof ContractFormInput, { type: "manual", message: msg });
        }
      }),
    );

  const actions = (
    <div className="flex flex-wrap justify-end gap-2">
      {creating ? (
        <Button
          type="button"
          variant="outline"
          className="h-11 flex-1 sm:flex-none"
          disabled={pending}
          onClick={() => void save(true)()}
        >
          Guardar borrador
        </Button>
      ) : null}
      <Button
        type="submit"
        className="h-11 flex-1 px-5 sm:flex-none"
        disabled={pending || (!creating && !formState.isDirty)}
      >
        {pending ? "Guardando…" : creating ? "Crear contrato" : "Crear contrato nuevo"}
      </Button>
    </div>
  );

  const receipt = preview.firstReceipt;

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={save(false)}
        noValidate
        className="grid items-start gap-5 pb-24 lg:grid-cols-[minmax(0,1fr)_320px] lg:pb-0"
      >
        <div className="flex min-w-0 flex-col gap-5">
          <Section n={1} title="Quién y dónde">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-1.5">
                <Label htmlFor="residentId">Residente</Label>
                <FormSelectField
                  id="residentId"
                  control={methods.control}
                  name="residentId"
                  disabled={!creating || mode.lockResident}
                  placeholder="Elige al residente"
                  options={options.residents.map((r) => ({ value: r.id, label: r.fullName }))}
                />
                <FieldError name="residentId" />
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <Label htmlFor="unitId">Unidad</Label>
                <Controller
                  control={methods.control}
                  name="unitId"
                  render={({ field, fieldState }) => (
                    <SelectField
                      id="unitId"
                      disabled={creating && mode.lockUnit}
                      invalid={Boolean(fieldState.error)}
                      value={field.value ?? ""}
                      placeholder="Elige la unidad"
                      options={options.units.map((u) => ({ value: u.id, label: u.label }))}
                      onValueChange={(unitId) => {
                        field.onChange(unitId);
                        // Propone la renta con el precio de la unidad (el precio vive en lo que se alquila).
                        const price = options.units.find((u) => u.id === unitId)?.monthlyPrice ?? null;
                        if (price) setValue("monthlyRent", priceText(price), { shouldDirty: true });
                      }}
                    />
                  )}
                />
                <FieldError name="unitId" />
              </div>
            </div>
          </Section>

          <Section n={2} title="Fechas y dinero">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField name="startDate" label="Desde" type="date" />
              <TextField name="endDate" label="Hasta (opcional)" type="date" hint="Vacío: mes a mes." />
              <TextField name="monthlyRent" label="Renta mensual" prefix="S/" inputMode="decimal" />
              <div className="flex min-w-0 flex-col gap-1.5">
                <Label htmlFor="paymentDay">Día de pago</Label>
                <FormSelectField
                  id="paymentDay"
                  control={methods.control}
                  name="paymentDay"
                  options={PAYMENT_DAYS.map((d) => ({
                    value: String(d),
                    label: d === 31 ? "Último día del mes" : `Día ${d}`,
                  }))}
                />
              </div>
            </div>
          </Section>

          <Section n={3} title="¿Hay contrato escrito?">
            <Controller
              control={methods.control}
              name="paperwork"
              render={({ field }) => (
                <RadioGroup value={field.value} onValueChange={field.onChange} className="sm:grid-cols-3">
                  {PAPERWORK_OPTIONS.map((p) => {
                    const disabled = p === "template" && options.templates.length === 0;
                    return (
                      <label
                        key={p}
                        className={cn(
                          "flex cursor-pointer flex-col gap-2 rounded-lg border p-3 text-sm transition-colors duration-200",
                          values.paperwork === p && "border-primary bg-primary-soft",
                          disabled && "cursor-not-allowed opacity-60",
                        )}
                      >
                        <span className="flex items-center gap-2 font-semibold">
                          <RadioGroupItem value={p} disabled={disabled} />
                          {PAPERWORK_LABEL[p]}
                        </span>
                        <span className="text-muted-foreground">
                          {disabled
                            ? "Primero crea una plantilla en Configuración › Plantillas."
                            : PAPERWORK_HINT[p]}
                        </span>
                      </label>
                    );
                  })}
                </RadioGroup>
              )}
            />
            {values.paperwork === "template" ? (
              <div className="flex min-w-0 flex-col gap-1.5">
                <Label htmlFor="templateId">Plantilla</Label>
                <FormSelectField
                  id="templateId"
                  control={methods.control}
                  name="templateId"
                  placeholder="Elige la plantilla"
                  options={options.templates.map((t) => ({ value: t.id, label: t.name }))}
                />
                <FieldError name="templateId" />
              </div>
            ) : null}
          </Section>

          {creating ? (
            <Section n={4} title="Garantía">
              <div className="flex min-w-0 flex-col gap-1.5">
                <Label htmlFor="depositRule">Para esta persona</Label>
                <FormSelectField
                  id="depositRule"
                  control={methods.control}
                  name="depositRule"
                  options={DEPOSIT_CHOICES.map((c) => ({
                    value: c,
                    label: c === "" ? `La de siempre (${defaultDeposit})` : DEPOSIT_RULE_LABEL[c],
                  }))}
                />
                <p className="text-sm text-muted-foreground">
                  La de siempre sale de la unidad o de Configuración › Garantía. Cámbiala solo si con esta
                  persona es distinto, por ejemplo un familiar.
                </p>
              </div>
              {values.depositRule !== "none" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {values.depositRule === "fixed" ? (
                    <TextField
                      name="depositFixedAmount"
                      label="Monto de la garantía"
                      prefix="S/"
                      inputMode="decimal"
                    />
                  ) : null}
                  <TextField
                    name="depositDueDate"
                    label="Cobrarla el (opcional)"
                    type="date"
                    hint="Vacío: con el primer recibo."
                  />
                </div>
              ) : null}
            </Section>
          ) : null}

          <FormMessage message={message} />
        </div>

        <aside className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-card lg:sticky lg:top-24">
          <h2 className="text-lg font-bold">Resumen</h2>
          <SummaryRow label="Residente">{resident?.fullName ?? "Elige al residente"}</SummaryRow>
          <SummaryRow label="Unidad">{unit?.label ?? "Elige la unidad"}</SummaryRow>
          <SummaryRow label="Fechas">
            {values.startDate ? `Desde el ${formatShortDate(values.startDate)}` : "Elige desde cuándo"}
            {values.endDate ? ` hasta el ${formatShortDate(values.endDate)}` : " · mes a mes"}
          </SummaryRow>
          <SummaryRow label="Renta">
            {formatSoles(values.monthlyRent)
              ? `${formatSoles(values.monthlyRent)} al mes`
              : "Escribe la renta"}
          </SummaryRow>
          <SummaryRow label="Garantía">
            {!creating
              ? "Pasa la del contrato actual."
              : preview.deposit
                ? Number(preview.deposit.amount) > 0
                  ? `${formatSoles(preview.deposit.amount)} · se cobra el ${formatShortDate(preview.deposit.dueDate)}`
                  : "Sin garantía"
                : "Elige la unidad y la renta"}
          </SummaryRow>
          <div className="flex flex-col gap-1.5 rounded-lg bg-primary-soft p-3 text-primary-text">
            <span className="text-xs font-bold tracking-wider uppercase">Primer recibo</span>
            {receipt ? (
              <>
                <span className="text-sm">
                  {periodLabel(receipt.period)} · vence el {formatShortDate(receipt.dueDate)}
                </span>
                <span className="text-sm">
                  Renta {formatSoles(receipt.rent)}
                  {receipt.days ? ` (${receipt.days} días)` : ""}
                  {receipt.deposit ? ` + garantía ${formatSoles(receipt.deposit)}` : ""}
                </span>
                <span className="text-xl font-bold">{formatSoles(receipt.total)}</span>
              </>
            ) : (
              <span className="text-sm">Se calcula con las fechas, la renta y el día de pago.</span>
            )}
          </div>
          <div className="hidden lg:block">{actions}</div>
        </aside>

        {/* En el celular y la tablet, los botones quedan fijos abajo. */}
        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-card px-4 py-3 shadow-card lg:hidden">
          {actions}
        </div>
      </form>
    </FormProvider>
  );
}
