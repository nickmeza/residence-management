"use client";

import { Check, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { ConfirmButton } from "@/components/confirm-button";
import { StatusBadge } from "@/components/status-badge";
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
import { Label } from "@/components/ui/label";
import { formatSoles } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  AREA_LABEL,
  DEPOSIT_RULE_LABEL,
  depositAmount,
  INSPECTION_AREAS,
  type DepositRule,
} from "@/server/deposits/rules";
import type { DepositSettingsView } from "@/server/deposits/settings";
import {
  deleteUnitExceptionAction,
  saveDepositSettingsAction,
  saveUnitExceptionAction,
} from "@/server/deposits/settings-actions";
import { METHOD_LABEL, PAYMENT_METHODS } from "@/server/payments/schemas";

const RULES: DepositRule[] = ["none", "one_month", "two_months", "fixed"];
const selectClass = "h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base md:text-sm";
const card = "rounded-xl border bg-card p-5 shadow-card sm:p-6";

type Values = DepositSettingsView["values"];

// Botones para elegir una opción (como en el prototipo): el elegido lleva el color principal y aria-pressed.
function Chips<T extends string>({
  options,
  value,
  label,
  onChange,
}: {
  options: readonly T[];
  value: T;
  label: (v: T) => string;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={o === value}
          onClick={() => onChange(o)}
          className={cn(
            "min-h-11 rounded-lg border px-3.5 text-sm font-semibold transition-colors duration-200",
            o === value ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
          )}
        >
          {label(o)}
        </button>
      ))}
    </div>
  );
}

// Ejemplo con la renta de la primera unidad de ese tipo: "renta S/ 650 → garantía S/ 650".
function example(rule: DepositRule, fixed: string, rent: string | null) {
  if (rule === "none") return "No se pide garantía.";
  if (!rent) return rule === "fixed" && fixed ? `Garantía ${formatSoles(fixed)}` : "";
  try {
    return `Ejemplo: renta ${formatSoles(rent)} → garantía ${formatSoles(depositAmount({ rule, fixedAmount: fixed || "0" }, rent))}`;
  } catch {
    return "";
  }
}

// Configuración › Garantía: cuánto se pide por tipo de unidad, excepciones por unidad, qué cubre y cómo se devuelve.
// Igual que con los documentos: esto es lo de siempre; a una persona puntual se le cambia en su contrato.
export function DepositSettingsEditor({
  businessId,
  view,
}: {
  businessId: string;
  view: DepositSettingsView;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(view.values);
  const [error, setError] = useState<{ message: string; fields: Record<string, string> }>();
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [exception, setException] = useState<{
    unitId: string;
    rule: DepositRule;
    fixedAmount: string;
  } | null>(null);
  const [exceptionError, setExceptionError] = useState<string>();

  const set = (patch: Partial<Values>) => {
    setSaved(false);
    setValues((v) => ({ ...v, ...patch }));
  };
  const sampleRent = (type: "room" | "apartment") =>
    view.units.find((u) => u.type === type && u.monthlyPrice)?.monthlyPrice ?? null;
  const unitLabel = (id: string) => view.units.find((u) => u.id === id)?.label ?? "Unidad";

  const save = () =>
    startTransition(async () => {
      setError(undefined);
      const result = await saveDepositSettingsAction(businessId, values);
      if (!result.ok) return setError({ message: result.message, fields: result.fieldErrors ?? {} });
      setSaved(true);
      router.refresh();
    });

  const saveException = () =>
    exception &&
    startTransition(async () => {
      setExceptionError(undefined);
      const result = await saveUnitExceptionAction(businessId, exception);
      if (!result.ok) return setExceptionError(result.fieldErrors?.fixedAmount ?? result.message);
      setException(null);
      router.refresh();
    });

  const removeException = (unitId: string) =>
    startTransition(async () => {
      const result = await deleteUnitExceptionAction(businessId, unitId);
      if (!result.ok) return setExceptionError(result.message);
      setException(null);
      router.refresh();
    });

  const policyBlock = (type: "room" | "apartment") => {
    const ruleKey = type === "room" ? "roomRule" : "apartmentRule";
    const amountKey = type === "room" ? "roomFixedAmount" : "apartmentFixedAmount";
    return (
      <div className="flex flex-col gap-2 border-t pt-4 first:border-t-0 first:pt-0">
        <b>{type === "room" ? "Cuartos" : "Departamentos completos"}</b>
        <Chips
          options={RULES}
          value={values[ruleKey]}
          label={(r) => DEPOSIT_RULE_LABEL[r]}
          onChange={(r) => set({ [ruleKey]: r })}
        />
        {values[ruleKey] === "fixed" ? (
          <div className="flex max-w-48 flex-col gap-1.5">
            <Label htmlFor={amountKey}>Monto (S/)</Label>
            <Input
              id={amountKey}
              className="h-11"
              inputMode="decimal"
              value={values[amountKey]}
              onChange={(e) => set({ [amountKey]: e.target.value })}
            />
            {error?.fields[amountKey] ? (
              <p className="text-sm text-danger">{error.fields[amountKey]}</p>
            ) : null}
          </div>
        ) : null}
        <p className="text-sm text-muted-foreground">
          {example(values[ruleKey], values[amountKey], sampleRent(type))}
        </p>
      </div>
    );
  };

  const previewRent = sampleRent("room") ?? sampleRent("apartment");
  const previewRule = sampleRent("room") ? values.roomRule : values.apartmentRule;
  const previewFixed = sampleRent("room") ? values.roomFixedAmount : values.apartmentFixedAmount;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-6">
        {!view.saved ? (
          <p className="rounded-lg bg-warn-soft px-3 py-2.5 text-sm text-warn">
            Todavía no pides garantía a nadie. Elige cuánto y guarda: valdrá para los contratos que confirmes
            desde ahora.
          </p>
        ) : null}

        <section className={card}>
          <h2 className="mb-1 text-lg font-bold">Cuánto se pide</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Por tipo de unidad. A una persona puntual (un familiar, un conocido) se lo cambias en su contrato.
          </p>
          <div className="flex flex-col gap-4">
            {policyBlock("room")}
            {policyBlock("apartment")}
          </div>
        </section>

        <section className={card}>
          <h2 className="mb-1 text-lg font-bold">Excepciones por unidad</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Si una unidad no lleva garantía o lleva otra cantidad. Gana sobre lo de arriba.
          </p>
          {view.exceptions.length ? (
            <ul>
              {view.exceptions.map((e) => (
                <li
                  key={e.unitId}
                  className="flex flex-wrap items-center gap-3 border-t py-3 first:border-t-0"
                >
                  <b className="min-w-40 flex-1">{unitLabel(e.unitId)}</b>
                  <StatusBadge tone={e.rule === "none" ? "neutral" : "primary"}>
                    {e.rule === "fixed"
                      ? `Monto fijo ${formatSoles(e.fixedAmount)}`
                      : DEPOSIT_RULE_LABEL[e.rule]}
                  </StatusBadge>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11"
                    onClick={() =>
                      setException({
                        unitId: e.unitId,
                        rule: e.rule,
                        fixedAmount: e.fixedAmount ? String(Number(e.fixedAmount)) : "",
                      })
                    }
                  >
                    Editar
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Ninguna unidad tiene una garantía distinta.</p>
          )}
          {exceptionError && !exception ? <FormMessage message={exceptionError} /> : null}
          <Button
            type="button"
            variant="outline"
            className="mt-3 h-11 gap-2"
            disabled={view.units.length === 0}
            onClick={() => {
              setExceptionError(undefined);
              setException({ unitId: "", rule: "none", fixedAmount: "" });
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
            Agregar excepción
          </Button>
        </section>

        <section className={card}>
          <h2 className="mb-4 text-lg font-bold">Qué cubre y cómo se devuelve</h2>
          <fieldset className="mb-5">
            <legend className="mb-2 text-sm font-semibold">Cubre daños en</legend>
            <div className="flex flex-wrap gap-x-5">
              {INSPECTION_AREAS.filter((a) => a !== "other").map((a) => (
                <label key={a} className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-5 accent-primary"
                    checked={values.covers.includes(a)}
                    onChange={(e) =>
                      set({
                        covers: e.target.checked
                          ? [...values.covers, a]
                          : values.covers.filter((x) => x !== a),
                      })
                    }
                  />
                  {AREA_LABEL[a]}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mb-5 flex flex-col gap-2">
            <span className="text-sm font-semibold">Plazo de devolución</span>
            <Chips
              options={["3", "7", "15"] as const}
              value={
                (["3", "7", "15"].includes(values.refundDays) ? values.refundDays : "7") as "3" | "7" | "15"
              }
              label={(d) => `${d} días hábiles`}
              onChange={(d) => set({ refundDays: d })}
            />
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Cómo devuelves</legend>
            <div className="flex flex-wrap gap-x-5">
              {PAYMENT_METHODS.filter((m) => m !== "card").map((m) => (
                <label key={m} className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-5 accent-primary"
                    checked={values.refundMethods.includes(m)}
                    onChange={(e) =>
                      set({
                        refundMethods: e.target.checked
                          ? [...values.refundMethods, m]
                          : values.refundMethods.filter((x) => x !== m),
                      })
                    }
                  />
                  {METHOD_LABEL[m]}
                </label>
              ))}
            </div>
            {error?.fields.refundMethods ? (
              <p className="text-sm text-danger">{error.fields.refundMethods}</p>
            ) : null}
          </fieldset>
        </section>

        <section className={card}>
          <h2 className="mb-1 text-lg font-bold">Lo que ya estaba mal al ingresar</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            El residente no tiene que revisar todo el cuarto. Si nota algo que ya estaba (un rayón, una manija
            floja), lo reporta con una foto, y eso no se le descuenta al salir salvo que esté peor.
          </p>
          <div className="flex max-w-56 flex-col gap-1.5">
            <Label htmlFor="entryReportDays">Puede reportarlo hasta (días desde que entra)</Label>
            <Input
              id="entryReportDays"
              className="h-11"
              inputMode="numeric"
              value={values.entryReportDays}
              onChange={(e) => set({ entryReportDays: e.target.value })}
            />
            {error?.fields.entryReportDays ? (
              <p className="text-sm text-danger">{error.fields.entryReportDays}</p>
            ) : null}
          </div>
        </section>

        <section className={card}>
          <h2 className="mb-1 text-lg font-bold">Cobro del mes incompleto</h2>
          <p className="mb-3 text-sm text-muted-foreground">Cuando alguien entra o sale a mitad de mes.</p>
          <Chips
            options={["prorate", "full"] as const}
            value={values.prorateRent ? "prorate" : "full"}
            label={(o) => (o === "prorate" ? "Solo los días que vive" : "El mes completo")}
            onChange={(o) => set({ prorateRent: o === "prorate" })}
          />
          <p className="mt-2 text-sm text-muted-foreground">
            Ejemplo: entra el 15 de un mes de 30 días con renta S/ 600 →{" "}
            {values.prorateRent ? "paga S/ 320 (16 días)" : "paga S/ 600"}.
          </p>
        </section>

        <div className="flex flex-col gap-2">
          <FormMessage message={error?.message} />
          <div className="flex flex-wrap items-center justify-end gap-3">
            {saved ? (
              <span className="flex items-center gap-1 text-sm text-ok">
                <Check className="size-4" aria-hidden="true" /> Guardado
              </span>
            ) : null}
            <Button type="button" className="h-11 px-6" disabled={pending} onClick={save}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </div>
          <p className="text-right text-sm text-muted-foreground">
            Los cambios valen para los contratos que confirmes desde ahora.
          </p>
        </div>
      </div>

      <aside className={cn(card, "lg:sticky lg:top-24")}>
        <h2 className="mb-3 text-lg font-bold">Así lo verá el residente</h2>
        <div className="rounded-lg bg-primary-soft p-4">
          <p className="text-sm text-primary-text">Garantía</p>
          <p className="text-2xl font-bold text-primary-text">
            {previewRule === "none"
              ? "Sin garantía"
              : previewRent || previewRule === "fixed"
                ? formatSoles(
                    depositAmount(
                      { rule: previewRule, fixedAmount: previewFixed || "0" },
                      previewRent ?? "0",
                    ),
                  )
                : DEPOSIT_RULE_LABEL[previewRule]}
          </p>
          {previewRule !== "none" ? (
            <p className="text-sm text-primary-text">
              {DEPOSIT_RULE_LABEL[previewRule]} · Se devuelve en {values.refundDays} días hábiles
            </p>
          ) : null}
        </div>
        {previewRule !== "none" ? (
          <ul className="mt-4 flex flex-col gap-2 text-sm">
            {values.covers.map((a) => (
              <li key={a} className="flex items-center gap-2">
                <Check className="size-4 text-primary" aria-hidden="true" />
                {AREA_LABEL[a]}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-4 text-sm text-muted-foreground">Lo ve en “Mi garantía”.</p>
      </aside>

      <Dialog open={exception !== null} onOpenChange={(o) => !o && setException(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excepción de garantía</DialogTitle>
            <DialogDescription>
              Vale para los contratos de esta unidad que confirmes desde ahora.
            </DialogDescription>
          </DialogHeader>
          {exception ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="exception-unit">Unidad</Label>
                <select
                  id="exception-unit"
                  className={selectClass}
                  value={exception.unitId}
                  onChange={(e) => setException({ ...exception, unitId: e.target.value })}
                >
                  <option value="">Elige la unidad</option>
                  {view.units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
              <Chips
                options={RULES}
                value={exception.rule}
                label={(r) => DEPOSIT_RULE_LABEL[r]}
                onChange={(rule) => setException({ ...exception, rule })}
              />
              {exception.rule === "fixed" ? (
                <div className="flex max-w-48 flex-col gap-1.5">
                  <Label htmlFor="exception-amount">Monto (S/)</Label>
                  <Input
                    id="exception-amount"
                    className="h-11"
                    inputMode="decimal"
                    value={exception.fixedAmount}
                    onChange={(e) => setException({ ...exception, fixedAmount: e.target.value })}
                  />
                </div>
              ) : null}
              <FormMessage message={exceptionError} />
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:justify-between">
            {exception && view.exceptions.some((e) => e.unitId === exception.unitId) ? (
              <ConfirmButton
                trigger={
                  <Button type="button" variant="destructive" className="h-11" disabled={pending}>
                    Quitar
                  </Button>
                }
                title="¿Quitar la excepción?"
                description="Esta unidad volverá a pedir la garantía de su tipo en los contratos nuevos."
                confirmLabel="Quitar"
                onConfirm={() => exception && removeException(exception.unitId)}
              />
            ) : (
              <span />
            )}
            <Button
              type="button"
              className="h-11"
              disabled={pending || !exception?.unitId}
              onClick={saveException}
            >
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
