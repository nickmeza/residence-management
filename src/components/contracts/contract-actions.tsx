"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { ConfirmButton } from "@/components/confirm-button";
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
import {
  cancelContractAction,
  changePaperworkAction,
  endContractAction,
  submitDraftAction,
  type ContractResult,
} from "@/server/contracts/actions";
import { limaToday } from "@/server/contracts/dates";
import type { ContractDetail, ContractFormOptions } from "@/server/contracts/queries";
import { PAPERWORK_HINT, PAPERWORK_LABEL, PAPERWORK_OPTIONS } from "@/server/contracts/schemas";

import { ContractSheet, type ContractSheetTarget } from "./contract-sheet";

const selectClass = "h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base md:text-sm";

// Diálogo pequeño con un formulario y su botón de guardar.
function ActionDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel,
  pending,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: React.ReactNode;
  confirmLabel: string;
  pending: boolean;
  error?: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {children}
          <FormMessage message={error} />
        </div>
        <DialogFooter>
          <Button type="button" className="h-11" disabled={pending} onClick={onConfirm}>
            {pending ? "Guardando…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Acciones de un contrato según su estado. Cada una explica qué pasa antes de hacerla.
export function ContractActions({ c, options }: { c: ContractDetail; options: ContractFormOptions }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [dialog, setDialog] = useState<"paperwork" | "end" | null>(null);
  const [sheet, setSheet] = useState<ContractSheetTarget | null>(null);
  const [paperwork, setPaperwork] = useState(c.paperwork);
  const [templateId, setTemplateId] = useState(c.templateId ?? "");
  const [endDate, setEndDate] = useState(c.endDate ?? limaToday(new Date()));

  const act = (action: () => Promise<ContractResult>, after?: () => void) =>
    startTransition(async () => {
      setError(undefined);
      const result = await action();
      if (!result.ok) return setError(result.message);
      setDialog(null);
      after?.();
      router.refresh();
    });

  const open = (d: "paperwork" | "end") => {
    setError(undefined);
    setDialog(d);
  };

  const active = c.status === "confirmed" || c.status === "pending_signature";
  const ended = c.phase === "ended";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2.5">
        {c.status === "draft" ? (
          <Button
            type="button"
            className="h-11"
            disabled={pending}
            onClick={() => act(() => submitDraftAction(c.id))}
          >
            {c.paperwork === "none" ? "Confirmar acuerdo" : "Pasar a pendiente de firma"}
          </Button>
        ) : null}
        {active && !ended && !c.renewedTo ? (
          <Button
            type="button"
            className="h-11"
            onClick={() =>
              setSheet({
                mode: "terms",
                contractId: c.id,
                initial: {
                  residentId: c.residentId,
                  unitId: c.unitId,
                  startDate: limaToday(new Date()),
                  endDate: c.endDate ?? "",
                  monthlyRent: String(Number(c.monthlyRent)),
                  paymentDay: String(c.paymentDay),
                  paperwork: c.paperwork,
                  templateId: c.templateId ?? "",
                  depositRule: "",
                  depositFixedAmount: "",
                  depositDueDate: "",
                },
              })
            }
          >
            Cambiar condiciones
          </Button>
        ) : null}
        {c.status !== "cancelled" && !ended ? (
          <Button type="button" variant="outline" className="h-11" onClick={() => open("paperwork")}>
            Cambiar modalidad
          </Button>
        ) : null}
        {active && !ended && !c.renewedTo ? (
          <Button type="button" variant="outline" className="h-11" onClick={() => open("end")}>
            Terminar contrato
          </Button>
        ) : null}
        {c.status === "draft" || c.status === "pending_signature" ? (
          <ConfirmButton
            trigger={
              <Button type="button" variant="destructive" className="h-11" disabled={pending}>
                Cancelar contrato
              </Button>
            }
            title="¿Cancelar este contrato?"
            description="Queda como cancelado y deja libre la unidad. No se puede deshacer."
            confirmLabel="Cancelar contrato"
            onConfirm={() => act(() => cancelContractAction(c.id))}
          />
        ) : null}
      </div>
      {dialog === null ? <FormMessage message={error} /> : null}

      <ActionDialog
        open={dialog === "paperwork"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Cambiar modalidad"
        description="Es el mismo alquiler, solo cambia el papel. Si pasa a tener papel, queda pendiente hasta subir la copia firmada; el residente sigue en su unidad."
        confirmLabel="Guardar"
        pending={pending}
        error={error}
        onConfirm={() =>
          act(() =>
            changePaperworkAction(c.id, {
              paperwork,
              templateId: paperwork === "template" ? templateId : "",
            }),
          )
        }
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Modalidad</legend>
          {PAPERWORK_OPTIONS.map((p) => {
            const disabled = p === "template" && options.templates.length === 0;
            return (
              <label key={p} className="flex min-h-11 items-start gap-3 rounded-lg border p-3 text-sm">
                <input
                  type="radio"
                  name="paperwork"
                  value={p}
                  checked={paperwork === p}
                  disabled={disabled}
                  onChange={() => setPaperwork(p)}
                  className="mt-0.5 size-4 accent-primary"
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
            <Label htmlFor="template">Plantilla</Label>
            <select
              id="template"
              className={selectClass}
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              <option value="">Elige la plantilla</option>
              {options.templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </ActionDialog>

      <ActionDialog
        open={dialog === "end"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Terminar contrato"
        description="Elige el último día. Desde el día siguiente la unidad queda libre."
        confirmLabel="Terminar"
        pending={pending}
        error={error}
        onConfirm={() => act(() => endContractAction(c.id, endDate))}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="endDate">Último día</Label>
          <Input
            id="endDate"
            type="date"
            className="h-11"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </ActionDialog>

      <ContractSheet target={sheet} options={options} onClose={() => setSheet(null)} />
    </div>
  );
}
