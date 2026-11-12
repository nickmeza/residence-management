"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";

import { FormMessage } from "@/components/auth/auth-field";
import { FieldError, TextField } from "@/components/onboarding/form-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { changeTermsAction, createContractAction, type ContractResult } from "@/server/contracts/actions";
import { limaToday } from "@/server/contracts/dates";
import { DEPOSIT_RULE_LABEL, depositAmount } from "@/server/deposits/rules";
import { formatSoles } from "@/lib/format";
import type { ContractFormOptions } from "@/server/contracts/queries";
import {
  DEPOSIT_CHOICES,
  PAPERWORK_HINT,
  PAPERWORK_LABEL,
  PAPERWORK_OPTIONS,
  type ContractFormInput,
} from "@/server/contracts/schemas";

const selectClass = "h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base md:text-sm";
const PAYMENT_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

// Precio de la unidad sin decimales de más ("650.00" → "650").
const priceText = (price: string | null) => (price ? String(Number(price)) : "");

function ContractForm({
  options,
  initial,
  lockResident,
  submit,
  onDone,
  draftAllowed,
  showDeposit,
}: {
  showDeposit: boolean;
  options: ContractFormOptions;
  initial: ContractFormInput;
  lockResident: boolean;
  submit: (values: ContractFormInput, asDraft: boolean) => Promise<ContractResult>;
  onDone: (id: string) => void;
  draftAllowed: boolean;
}) {
  const methods = useForm<ContractFormInput>({ defaultValues: initial });
  const { register, setValue, setError, handleSubmit, formState } = methods;
  const paperwork = useWatch({ control: methods.control, name: "paperwork" });
  const [unitId, rent, depositRule] = useWatch({
    control: methods.control,
    name: ["unitId", "monthlyRent", "depositRule"],
  });
  const unitDeposit = options.units.find((u) => u.id === unitId)?.deposit ?? null;
  // "1 mes de renta · S/ 650" con la renta escrita (si todavía no es un monto válido, sin el monto).
  const defaultDeposit = (() => {
    if (!unitDeposit) return "Elige la unidad para ver cuánto le toca.";
    const label = unitDeposit.rule === "fixed" ? "Monto fijo" : DEPOSIT_RULE_LABEL[unitDeposit.rule];
    if (unitDeposit.rule === "none") return label;
    try {
      return `${label} · ${formatSoles(depositAmount(unitDeposit, rent || "0"))}`;
    } catch {
      return label;
    }
  })();
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  const save = (asDraft: boolean) =>
    handleSubmit((values) =>
      startTransition(async () => {
        setMessage(undefined);
        const result = await submit(values, asDraft);
        if (result.ok) return onDone(result.id);
        setMessage(result.message);
        for (const [path, msg] of Object.entries(result.fieldErrors ?? {})) {
          setError(path as keyof ContractFormInput, { type: "manual", message: msg });
        }
      }),
    );

  const unitField = register("unitId");

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={save(false)}
        noValidate
        className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="residentId">Residente</Label>
          <select id="residentId" className={selectClass} disabled={lockResident} {...register("residentId")}>
            <option value="">Elige al residente</option>
            {options.residents.map((r) => (
              <option key={r.id} value={r.id}>
                {r.fullName}
              </option>
            ))}
          </select>
          <FieldError name="residentId" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="unitId">Unidad</Label>
          <select
            id="unitId"
            className={selectClass}
            {...unitField}
            onChange={(e) => {
              void unitField.onChange(e);
              // Propone la renta con el precio de la unidad (el precio vive en lo que se alquila).
              const price = options.units.find((u) => u.id === e.target.value)?.monthlyPrice ?? null;
              if (price) setValue("monthlyRent", priceText(price), { shouldDirty: true });
            }}
          >
            <option value="">Elige la unidad</option>
            {options.units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
          <FieldError name="unitId" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="startDate" label="Desde" type="date" />
          <TextField name="endDate" label="Hasta (opcional)" type="date" hint="Vacío: mes a mes." />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="monthlyRent" label="Renta mensual" prefix="S/" inputMode="decimal" />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="paymentDay">Día de pago</Label>
            <select id="paymentDay" className={selectClass} {...register("paymentDay")}>
              {PAYMENT_DAYS.map((d) => (
                <option key={d} value={d}>
                  {d === 31 ? "Último día del mes" : `Día ${d}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">¿Hay contrato escrito?</legend>
          {PAPERWORK_OPTIONS.map((p) => {
            const disabled = p === "template" && options.templates.length === 0;
            return (
              <label
                key={p}
                className={cn(
                  "flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors duration-200",
                  paperwork === p && "border-primary bg-primary-soft",
                  disabled && "cursor-not-allowed opacity-60",
                )}
              >
                <input
                  type="radio"
                  value={p}
                  disabled={disabled}
                  className="mt-0.5 size-4 accent-primary"
                  {...register("paperwork")}
                />
                <span>
                  <span className="font-semibold">{PAPERWORK_LABEL[p]}</span>
                  <span className="block text-muted-foreground">
                    {disabled
                      ? "Primero crea una plantilla en Configuración › Plantillas."
                      : PAPERWORK_HINT[p]}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>

        {paperwork === "template" ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="templateId">Plantilla</Label>
            <select id="templateId" className={selectClass} {...register("templateId")}>
              <option value="">Elige la plantilla</option>
              {options.templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <FieldError name="templateId" />
          </div>
        ) : null}

        {showDeposit ? (
          <fieldset className="flex flex-col gap-3 rounded-lg border p-3">
            <legend className="px-1 text-sm font-semibold">Garantía</legend>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="depositRule">Para esta persona</Label>
              <select id="depositRule" className={selectClass} {...register("depositRule")}>
                {DEPOSIT_CHOICES.map((c) => (
                  <option key={c} value={c}>
                    {c === "" ? `La de siempre (${defaultDeposit})` : DEPOSIT_RULE_LABEL[c]}
                  </option>
                ))}
              </select>
              <p className="text-sm text-muted-foreground">
                La de siempre sale de la unidad o de Configuración › Garantía. Cámbiala solo si con esta
                persona es distinto, por ejemplo un familiar.
              </p>
            </div>
            {depositRule === "fixed" ? (
              <TextField
                name="depositFixedAmount"
                label="Monto de la garantía"
                prefix="S/"
                inputMode="decimal"
              />
            ) : null}
            {depositRule !== "none" ? (
              <TextField
                name="depositDueDate"
                label="Cobrarla el (opcional)"
                type="date"
                hint="Vacío: con el primer recibo. Si se la pides después, elige la fecha."
              />
            ) : null}
          </fieldset>
        ) : null}

        <FormMessage message={message} />

        <div className="mt-auto flex flex-wrap justify-end gap-2 border-t pt-4">
          {draftAllowed ? (
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={pending}
              onClick={() => void save(true)()}
            >
              Guardar como borrador
            </Button>
          ) : null}
          <Button
            type="submit"
            className="h-11 px-5"
            disabled={pending || (!draftAllowed && !formState.isDirty)}
          >
            {pending ? "Guardando…" : draftAllowed ? "Crear contrato" : "Crear contrato nuevo"}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}

export type ContractSheetTarget =
  | { mode: "create"; residentId?: string }
  // Cambiar condiciones: el actual termina el día anterior y empieza uno nuevo con estos datos.
  | { mode: "terms"; contractId: string; initial: ContractFormInput };

// Panel lateral para crear un contrato o cambiar sus condiciones.
export function ContractSheet({
  target,
  options,
  onClose,
}: {
  target: ContractSheetTarget | null;
  options: ContractFormOptions;
  onClose: () => void;
}) {
  const router = useRouter();
  const today = limaToday(new Date());
  const blank: ContractFormInput = {
    residentId: target?.mode === "create" ? (target.residentId ?? "") : "",
    unitId: "",
    startDate: today,
    endDate: "",
    monthlyRent: "",
    paymentDay: String(options.billingDay),
    paperwork: "none",
    templateId: "",
    depositRule: "",
    depositFixedAmount: "",
    depositDueDate: "",
  };

  return (
    <Sheet open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-4 sm:max-w-md">
        {target ? (
          <>
            <SheetHeader>
              <SheetTitle>{target.mode === "create" ? "Crear contrato" : "Cambiar condiciones"}</SheetTitle>
              <SheetDescription>
                {target.mode === "create"
                  ? "Como borrador no ocupa la unidad. Al crearlo, sin papel queda acordado; con papel, pendiente de la copia firmada."
                  : "El contrato actual termina el día anterior al nuevo inicio, y el nuevo queda enlazado a él."}
              </SheetDescription>
            </SheetHeader>
            {options.residents.length === 0 ? (
              <p className="px-4 text-sm text-muted-foreground">Primero agrega a un residente.</p>
            ) : (
              <ContractForm
                key={target.mode === "terms" ? target.contractId : (target.residentId ?? "nuevo")}
                options={options}
                initial={target.mode === "terms" ? target.initial : blank}
                lockResident={target.mode === "terms" || Boolean(target.residentId)}
                draftAllowed={target.mode === "create"}
                // Al cambiar condiciones la garantía no se toca: pasa al contrato nuevo (regla 9).
                showDeposit={target.mode === "create"}
                submit={(values, asDraft) =>
                  target.mode === "terms"
                    ? changeTermsAction(target.contractId, values)
                    : createContractAction(values, asDraft)
                }
                onDone={(id) => {
                  onClose();
                  router.push(`/contratos/${id}`);
                }}
              />
            )}
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
