"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { FileField } from "@/components/payments/file-field";
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
  addEntryReportAction,
  disputeDiscountAction,
  respondSettlementAction,
} from "@/server/deposits/actions";
import { AREA_LABEL, INSPECTION_AREAS, type InspectionArea } from "@/server/deposits/rules";
import { METHOD_LABEL } from "@/server/payments/schemas";

const selectClass = "h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base md:text-sm";

type Method = "yape" | "plin" | "transfer" | "cash" | "card";

// "Esto ya estaba así": el residente reporta lo que encontró mal al entrar, con una foto (regla 8).
export function EntryReportForm({
  businessId,
  residentId,
  contractId,
}: {
  businessId: string;
  residentId: string;
  contractId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [area, setArea] = useState<InspectionArea>("walls");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<{ path: string; name: string } | null>(null);
  const [error, setError] = useState<{ message: string; fields: Record<string, string> }>();
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      setError(undefined);
      if (!photo) return setError({ message: "Sube una foto: es tu prueba.", fields: {} });
      const result = await addEntryReportAction({ contractId, area, note, photoPath: photo.path });
      if (!result.ok) return setError({ message: result.message, fields: result.fieldErrors ?? {} });
      setOpen(false);
      setNote("");
      setPhoto(null);
      router.refresh();
    });

  return (
    <>
      <Button type="button" variant="outline" className="h-11" onClick={() => setOpen(true)}>
        Reportar algo que ya estaba así
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Esto ya estaba así</DialogTitle>
            <DialogDescription>
              Tu residencia lo verá. Al salir no se te descuenta, salvo que esté peor que ahora.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="report-area">Qué es</Label>
              <select
                id="report-area"
                className={selectClass}
                value={area}
                onChange={(e) => setArea(e.target.value as InspectionArea)}
              >
                {INSPECTION_AREAS.map((a) => (
                  <option key={a} value={a}>
                    {AREA_LABEL[a]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="report-note">Qué encontraste</Label>
              <Input
                id="report-note"
                className="h-11"
                placeholder="Por ejemplo, un rayón en la pared junto a la ventana"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              {error?.fields.note ? <p className="text-sm text-danger">{error.fields.note}</p> : null}
            </div>
            <FileField
              businessId={businessId}
              residentId={residentId}
              folder="ingreso"
              formats={["image"]}
              label="Tomar o subir una foto"
              value={photo}
              onChange={setPhoto}
            />
            <FormMessage message={error?.message} />
          </div>
          <DialogFooter>
            <Button type="button" className="h-11" disabled={pending} onClick={save}>
              {pending ? "Enviando…" : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Dónde recibe la devolución y "Estoy conforme" (GA-12, GA-14).
export function SettlementResponse({
  settlementId,
  methods,
  initial,
  accepted,
  canAccept,
}: {
  settlementId: string;
  methods: Method[];
  initial: { method: Method | null; account: string | null };
  accepted: boolean;
  canAccept: boolean;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<Method>(initial.method ?? methods[0] ?? "yape");
  const [account, setAccount] = useState(initial.account ?? "");
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const send = (accept: boolean) =>
    startTransition(async () => {
      setError(undefined);
      setSaved(false);
      const result = await respondSettlementAction(settlementId, { method, account, accept });
      if (!result.ok) return setError(result.fieldErrors?.account ?? result.message);
      setSaved(true);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="refund-method">Método</Label>
        <select
          id="refund-method"
          className={selectClass}
          value={method}
          onChange={(e) => setMethod(e.target.value as Method)}
        >
          {methods.map((m) => (
            <option key={m} value={m}>
              {METHOD_LABEL[m]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="refund-account">
          {method === "transfer" ? "Banco y número de cuenta" : "Número"}
        </Label>
        <Input
          id="refund-account"
          className="h-11"
          value={account}
          onChange={(e) => setAccount(e.target.value)}
        />
        <p className="text-sm text-muted-foreground">Verifica que sea correcto.</p>
      </div>
      <FormMessage message={error} />
      {saved ? (
        <p role="status" className="rounded-lg bg-ok-soft px-3 py-2 text-sm text-ok">
          Guardado. Tu residencia ya lo ve.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {!accepted && canAccept ? (
          <Button type="button" className="h-11" disabled={pending} onClick={() => send(true)}>
            Estoy conforme
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="h-11"
          disabled={pending}
          onClick={() => send(false)}
        >
          Guardar dónde recibo
        </Button>
      </div>
    </div>
  );
}

// Disputar un descuento (GA-13): deja de restarse y no se paga hasta que el arrendador lo ajuste o lo retire.
export function DisputeButton({ discountId, label }: { discountId: string; label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const send = () =>
    startTransition(async () => {
      setError(undefined);
      const result = await disputeDiscountAction(discountId, { reason });
      if (!result.ok) return setError(result.fieldErrors?.reason ?? result.message);
      setOpen(false);
      setReason("");
      router.refresh();
    });

  return (
    <>
      <Button type="button" variant="outline" className="h-11" onClick={() => setOpen(true)}>
        Disputar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Disputar: {label}</DialogTitle>
            <DialogDescription>
              Mientras lo revisan, este monto no se te descuenta ni se paga. Lo demás se te puede devolver ya.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`dispute-${discountId}`}>¿Por qué no estás de acuerdo?</Label>
            <Input
              id={`dispute-${discountId}`}
              className="h-11"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <FormMessage message={error} />
          <DialogFooter>
            <Button type="button" className="h-11" disabled={pending} onClick={send}>
              {pending ? "Enviando…" : "Enviar disputa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
