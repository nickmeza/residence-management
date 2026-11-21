"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { DateField } from "@/components/date-field";
import { SelectField } from "@/components/select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { limaToday } from "@/server/contracts/dates";
import { registerPaymentAction, submitProofAction } from "@/server/payments/actions";
import { METHOD_LABEL, PAYMENT_METHODS, type PaymentInput } from "@/server/payments/schemas";

import { FileField } from "./file-field";

type Method = (typeof PAYMENT_METHODS)[number];

// Formulario de pago. "landlord": el arrendador registra un pago (queda confirmado; comprobante opcional).
// "resident": el residente manda su comprobante (obligatorio; queda en revisión).
export function PaymentForm({
  mode,
  businessId,
  period,
  residents,
  residentId: fixedResident,
  suggestedAmount = "",
  methods = PAYMENT_METHODS.filter((m) => m !== "card"),
  onDone,
}: {
  mode: "landlord" | "resident";
  businessId: string;
  period: string;
  // Para elegir al residente (Cobros); si se pasa residentId, ya está elegido.
  residents?: { id: string; label: string; balance: string }[];
  residentId?: string;
  suggestedAmount?: string;
  methods?: readonly Method[];
  onDone?: () => void;
}) {
  const router = useRouter();
  const blank = (): PaymentInput => ({
    residentId: fixedResident ?? "",
    period,
    amount: suggestedAmount,
    method: methods[0] ?? "yape",
    paidOn: limaToday(new Date()),
    operationCode: "",
    proofPath: "",
  });
  const [values, setValues] = useState<PaymentInput>(blank);
  const [file, setFile] = useState<{ path: string; name: string } | null>(null);
  const [error, setError] = useState<{ message: string; fields: Record<string, string> }>();
  const [done, setDone] = useState(false);
  // true = el comprobante coincidía con lo que faltaba y se confirmó solo.
  const [autoConfirmed, setAutoConfirmed] = useState(false);
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<PaymentInput>) => {
    setDone(false);
    setValues((v) => ({ ...v, ...patch }));
  };

  const submit = () =>
    startTransition(async () => {
      setError(undefined);
      if (mode === "resident" && !file) {
        return setError({ message: "Sube la foto o el PDF de tu comprobante.", fields: {} });
      }
      const input = { ...values, proofPath: file?.path ?? "" };
      const result =
        mode === "landlord" ? await registerPaymentAction(input) : await submitProofAction(input);
      if (!result.ok) return setError({ message: result.message, fields: result.fieldErrors ?? {} });
      setValues(blank());
      setFile(null);
      setAutoConfirmed(Boolean(result.autoConfirmed));
      setDone(true);
      onDone?.();
      router.refresh();
    });

  const field = (name: keyof PaymentInput) =>
    error?.fields[name] ? <p className="text-sm text-danger">{error.fields[name]}</p> : null;
  const id = (name: string) => `${mode}-${period}-${name}`;

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {residents ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("resident")}>Residente</Label>
          <SelectField
            id={id("resident")}
            value={values.residentId}
            placeholder="Elige al residente"
            options={residents.map((r) => ({ value: r.id, label: r.label }))}
            onValueChange={(residentId) => {
              const chosen = residents.find((r) => r.id === residentId);
              setFile(null);
              set({ residentId, amount: chosen?.balance ?? values.amount });
            }}
          />
          {field("residentId")}
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("amount")}>Monto (S/)</Label>
          <Input
            id={id("amount")}
            className="h-11"
            inputMode="decimal"
            value={values.amount}
            onChange={(e) => set({ amount: e.target.value })}
          />
          {field("amount")}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("method")}>Método</Label>
          <SelectField
            id={id("method")}
            value={values.method}
            onValueChange={(v) => set({ method: v as Method })}
            options={methods.map((m) => ({ value: m, label: METHOD_LABEL[m] }))}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("paidOn")}>Fecha de pago</Label>
          <DateField id={id("paidOn")} value={values.paidOn} onValueChange={(v) => set({ paidOn: v })} />
          {field("paidOn")}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("operation")}>N.º de operación (opcional)</Label>
          <Input
            id={id("operation")}
            className="h-11"
            value={values.operationCode ?? ""}
            onChange={(e) => set({ operationCode: e.target.value })}
          />
        </div>
      </div>
      {values.residentId ? (
        <FileField
          businessId={businessId}
          residentId={values.residentId}
          folder="comprobantes"
          label={mode === "landlord" ? "Adjuntar comprobante (opcional)" : "Subir comprobante"}
          value={file}
          onChange={setFile}
        />
      ) : null}
      <FormMessage message={error?.message} />
      {done ? (
        <p role="status" className="rounded-lg bg-ok-soft px-3 py-2 text-sm text-ok">
          {mode === "landlord"
            ? "Pago registrado."
            : autoConfirmed
              ? "¡Listo! Tu pago coincide con lo que debías y quedó confirmado."
              : "Comprobante enviado. Tu residencia lo revisará y verás aquí cuando lo confirme."}
        </p>
      ) : null}
      <Button type="submit" className="h-11 w-full" disabled={pending}>
        {pending ? "Guardando…" : mode === "landlord" ? "Registrar pago" : "Enviar comprobante"}
      </Button>
    </form>
  );
}
