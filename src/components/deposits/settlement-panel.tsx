"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { ConfirmButton } from "@/components/confirm-button";
import { FileField } from "@/components/payments/file-field";
import { StatusBadge } from "@/components/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { formatLongDate, limaToday } from "@/server/contracts/dates";
import {
  addDiscountAction,
  answerDisputeAction,
  chargeExcessAction,
  closeSettlementAction,
  deleteDiscountAction,
  registerRefundAction,
  sendSettlementAction,
  startSettlementAction,
  waiveExcessAction,
  type DepositResult,
} from "@/server/deposits/actions";
import type { DepositDetail, DiscountRow } from "@/server/deposits/queries";
import { AREA_LABEL, INSPECTION_AREAS, type InspectionArea } from "@/server/deposits/rules";
import { METHOD_LABEL, type DiscountInput, type RefundInput } from "@/server/payments/schemas";

const selectClass = "h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base md:text-sm";
const card = "rounded-xl border bg-card p-5 shadow-card sm:p-6";

const DISCOUNT_STATUS = {
  active: { tone: "neutral", label: "Vigente" },
  disputed: { tone: "danger", label: "En disputa" },
  adjusted: { tone: "primary", label: "Ajustado" },
  withdrawn: { tone: "ok", label: "Retirado" },
} as const;

function Row({ label, value, strong }: { label: string; value: string | null; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-2", strong && "text-lg font-bold")}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

// Liquidar una garantía (GA-08 a GA-15): descuentos con nota y foto, enviar, responder disputas, registrar la
// devolución y decidir qué hacer si los descuentos pasan la garantía.
export function SettlementPanel({ detail }: { detail: DepositDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [adding, setAdding] = useState(false);
  const [answering, setAnswering] = useState<DiscountRow | null>(null);
  const s = detail.settlement;

  const act = (fn: () => Promise<DepositResult>, after?: () => void) =>
    startTransition(async () => {
      setError(undefined);
      const result = await fn();
      if (!result.ok) return setError(result.message);
      after?.();
      router.refresh();
    });

  const reportedAreas = new Set(detail.entryReports.map((r) => r.area));

  const reports = (
    <section className={card}>
      <h2 className="mb-1 text-lg font-bold">Lo que el residente reportó al ingresar</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Es la base: en estos rubros solo puedes descontar si al salir está peor, con una foto.
      </p>
      {detail.entryReports.length ? (
        <ul>
          {detail.entryReports.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 border-t py-3 first:border-t-0">
              <span className="min-w-48 flex-1 text-sm">
                <b className="block">{AREA_LABEL[r.area]}</b>
                <span className="text-muted-foreground">{r.note}</span>
              </span>
              <a
                href={`/archivos/ingreso/${r.id}`}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: "outline", className: "h-11" })}
              >
                Ver foto
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No reportó nada: el cuarto se tomó como en buen estado.
        </p>
      )}
    </section>
  );

  if (detail.phase === "none") {
    return (
      <section className={card}>
        <p className="text-muted-foreground">Este contrato no tiene garantía: no hay nada que liquidar.</p>
      </section>
    );
  }

  if (!s) {
    return (
      <div className="flex flex-col gap-6">
        <section className={card}>
          <h2 className="mb-1 text-lg font-bold">Liquidación</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Cuando el residente esté por salir, revisa el cuarto y registra los descuentos, si los hay. Se
            guarda como borrador: el residente no lo ve hasta que lo envíes.
          </p>
          <FormMessage message={error} />
          <Button
            type="button"
            className="h-11"
            disabled={pending}
            onClick={() => act(() => startSettlementAction(detail.id))}
          >
            Empezar liquidación
          </Button>
        </section>
        {reports}
      </div>
    );
  }

  const sum = s.summary;
  const draft = s.status === "draft";
  const excess = Number(sum.excess) > 0;
  const excessOpen = excess && !s.excessCharged && !s.excessWaived;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-6">
        <section className={card}>
          <h2 className="mb-1 text-lg font-bold">Revisión del cuarto al salir</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Lo que escribas, el residente lo ve en “Mi garantía”. Rubros sin descuento: sin daños.
          </p>
          {s.discounts.length ? (
            <ul>
              {s.discounts.map((x) => (
                <li key={x.id} className="flex flex-col gap-2 border-t py-3.5 first:border-t-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="min-w-48 flex-1">
                      <b className="block">{AREA_LABEL[x.area]}</b>
                      <span className="text-sm text-muted-foreground">{x.note}</span>
                      {x.worseThanEntry ? (
                        <span className="block text-sm text-muted-foreground">
                          Ya estaba reportado al ingresar: está peor.
                        </span>
                      ) : null}
                    </span>
                    <b className={cn(x.status === "withdrawn" && "line-through opacity-60")}>
                      − {formatSoles(x.amount)}
                    </b>
                    {x.originalAmount ? (
                      <span className="text-sm text-muted-foreground line-through">
                        {formatSoles(x.originalAmount)}
                      </span>
                    ) : null}
                    {!draft ? (
                      <StatusBadge tone={DISCOUNT_STATUS[x.status].tone}>
                        {DISCOUNT_STATUS[x.status].label}
                      </StatusBadge>
                    ) : null}
                    {x.hasPhoto ? (
                      <a
                        href={`/archivos/descuento/${x.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className={buttonVariants({ variant: "outline", className: "h-11" })}
                      >
                        Ver foto
                      </a>
                    ) : null}
                    {draft ? (
                      <ConfirmButton
                        trigger={
                          <Button type="button" variant="outline" className="h-11" disabled={pending}>
                            Quitar
                          </Button>
                        }
                        title="¿Quitar este descuento?"
                        description="Se borra del borrador. El residente nunca lo vio."
                        confirmLabel="Quitar"
                        onConfirm={() => act(() => deleteDiscountAction(detail.id, x.id))}
                      />
                    ) : null}
                    {x.status === "disputed" ? (
                      <Button type="button" className="h-11" onClick={() => setAnswering(x)}>
                        Responder
                      </Button>
                    ) : null}
                  </div>
                  {x.disputeReason ? (
                    <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
                      El residente dice: “{x.disputeReason}”
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Sin descuentos: se devuelve toda la garantía.</p>
          )}
          {draft ? (
            <Button
              type="button"
              variant="outline"
              className="mt-3 h-11 gap-2"
              onClick={() => setAdding(true)}
            >
              <Plus className="size-4" aria-hidden="true" />
              Agregar descuento
            </Button>
          ) : null}
        </section>
        {reports}
        {s.refunds.length ? (
          <section className={card}>
            <h2 className="mb-3 text-lg font-bold">Devoluciones registradas</h2>
            <ul>
              {s.refunds.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-3 border-t py-3 text-sm first:border-t-0"
                >
                  <span className="flex-1">
                    <b>{formatSoles(r.amount)}</b> · {METHOD_LABEL[r.method]} · {formatLongDate(r.paidOn)}
                    {r.operationCode ? ` · Op. ${r.operationCode}` : ""}
                  </span>
                  {r.hasProof ? (
                    <a
                      href={`/archivos/devolucion/${r.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className={buttonVariants({ variant: "outline", className: "h-11" })}
                    >
                      Ver comprobante
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <aside className="flex flex-col gap-6 lg:sticky lg:top-24">
        <section className={card}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold">Resumen</h2>
            <StatusBadge tone={draft ? "neutral" : s.status === "closed" ? "ok" : "primary"}>
              {draft ? "Borrador" : s.status === "closed" ? "Cerrada" : "Enviada"}
            </StatusBadge>
          </div>
          <div className="flex flex-col gap-1.5 text-sm">
            <Row label="Garantía" value={formatSoles(detail.amount)} />
            <Row label="Descuentos" value={`− ${formatSoles(sum.totalDiscounts)}`} />
            {sum.hasDisputes ? <Row label="En disputa (aparte)" value={formatSoles(sum.disputed)} /> : null}
            <div className="mt-2 rounded-lg bg-primary-soft p-3 text-primary-text">
              <Row
                label={`A devolver a ${detail.residentName.split(" ")[0]}`}
                value={formatSoles(sum.refund)}
                strong
              />
              {!draft ? <Row label="Ya se puede pagar" value={formatSoles(sum.payableNow)} /> : null}
            </div>
            {excess ? (
              <p className="mt-2 text-warn">
                Los descuentos pasan la garantía por {formatSoles(sum.excess)}.
                {s.excessCharged ? " Se cobró en un recibo." : s.excessWaived ? " Lo perdonaste." : ""}
              </p>
            ) : null}
          </div>
          <FormMessage message={error} />
          {draft ? (
            <div className="mt-4 flex flex-col gap-2">
              <ConfirmButton
                trigger={
                  <Button type="button" className="h-11 w-full" disabled={pending}>
                    Enviar liquidación al residente
                  </Button>
                }
                title="¿Enviar la liquidación?"
                description="El residente verá los montos, notas y fotos. Podrá aceptarla o disputar un descuento. Después ya no se agregan descuentos."
                confirmLabel="Enviar"
                onConfirm={() => act(() => sendSettlementAction(detail.id))}
              />
              <p className="text-sm text-muted-foreground">
                Mientras no la envíes es un borrador: se guarda sola con cada cambio.
              </p>
            </div>
          ) : null}
          {s.status === "sent" ? (
            <div className="mt-4 flex flex-col gap-3 border-t pt-4 text-sm">
              <p>
                {s.acceptedAt
                  ? "El residente aceptó la liquidación."
                  : sum.hasDisputes
                    ? "El residente disputó un descuento: respóndele para pagar esa parte."
                    : "Esperando la respuesta del residente."}
              </p>
              {s.refundMethod ? (
                <p>
                  Recibe por <b>{METHOD_LABEL[s.refundMethod]}</b>: {s.refundAccount}
                </p>
              ) : (
                <p className="text-muted-foreground">Todavía no eligió dónde recibir.</p>
              )}
              {excessOpen && !sum.hasDisputes ? (
                <div className="flex flex-wrap gap-2">
                  <ConfirmButton
                    trigger={
                      <Button type="button" className="h-11" disabled={pending}>
                        Cobrar {formatSoles(sum.excess)}
                      </Button>
                    }
                    title="¿Cobrar la diferencia?"
                    description="Se agrega un cargo en el recibo de este mes del residente."
                    confirmLabel="Cobrar"
                    onConfirm={() => act(() => chargeExcessAction(detail.id))}
                  />
                  <ConfirmButton
                    trigger={
                      <Button type="button" variant="outline" className="h-11" disabled={pending}>
                        Perdonar
                      </Button>
                    }
                    title="¿Perdonar la diferencia?"
                    description="No se le cobra. Queda anotado en la bitácora."
                    confirmLabel="Perdonar"
                    onConfirm={() => act(() => waiveExcessAction(detail.id))}
                  />
                </div>
              ) : null}
              {Number(sum.payableNow) === 0 && !sum.hasDisputes && !excessOpen ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  disabled={pending}
                  onClick={() => act(() => closeSettlementAction(detail.id))}
                >
                  Cerrar liquidación
                </Button>
              ) : null}
            </div>
          ) : null}
        </section>

        {s.status === "sent" && Number(sum.payableNow) > 0 ? (
          <section className={card}>
            <h2 className="mb-1 text-lg font-bold">Registrar devolución</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Plazo: {detail.refundDays} días hábiles. Puedes devolver ya lo que no está en disputa.
            </p>
            <RefundForm detail={detail} max={sum.payableNow} />
          </section>
        ) : null}
      </aside>

      <DiscountDialog
        open={adding}
        onClose={() => setAdding(false)}
        detail={detail}
        reportedAreas={reportedAreas}
      />
      <AnswerDialog depositId={detail.id} discount={answering} onClose={() => setAnswering(null)} />
    </div>
  );
}

function DiscountDialog({
  open,
  onClose,
  detail,
  reportedAreas,
}: {
  open: boolean;
  onClose: () => void;
  detail: DepositDetail;
  reportedAreas: Set<InspectionArea>;
}) {
  const router = useRouter();
  const empty: DiscountInput = { area: "walls", note: "", amount: "", photoPath: "", worseThanEntry: false };
  const [values, setValues] = useState<DiscountInput>(empty);
  const [photo, setPhoto] = useState<{ path: string; name: string } | null>(null);
  const [error, setError] = useState<{ message: string; fields: Record<string, string> }>();
  const [pending, startTransition] = useTransition();
  const reported = reportedAreas.has(values.area) && values.area !== "other";
  const set = (patch: Partial<DiscountInput>) => setValues((v) => ({ ...v, ...patch }));

  const save = () =>
    startTransition(async () => {
      setError(undefined);
      const result = await addDiscountAction(detail.id, { ...values, photoPath: photo?.path ?? "" });
      if (!result.ok) return setError({ message: result.message, fields: result.fieldErrors ?? {} });
      setValues(empty);
      setPhoto(null);
      onClose();
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar descuento</DialogTitle>
          <DialogDescription>El residente verá el rubro, la nota, el monto y la foto.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="discount-area">Rubro</Label>
            <select
              id="discount-area"
              className={selectClass}
              value={values.area}
              onChange={(e) => set({ area: e.target.value as InspectionArea, worseThanEntry: false })}
            >
              {INSPECTION_AREAS.map((a) => (
                <option key={a} value={a}>
                  {AREA_LABEL[a]}
                  {reportedAreas.has(a) && a !== "other" ? " (reportado al ingresar)" : ""}
                </option>
              ))}
            </select>
          </div>
          {reported ? (
            <label className="flex min-h-11 items-start gap-3 rounded-lg bg-warn-soft p-3 text-sm text-warn">
              <input
                type="checkbox"
                className="mt-0.5 size-5 accent-primary"
                checked={values.worseThanEntry}
                onChange={(e) => set({ worseThanEntry: e.target.checked })}
              />
              <span>
                El residente reportó este rubro al ingresar. Solo se descuenta si{" "}
                <b>está peor que al entrar</b>, con una foto de cómo está ahora.
              </span>
            </label>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="discount-note">Nota para el residente</Label>
            <Input
              id="discount-note"
              className="h-11"
              placeholder="Por ejemplo, huecos en la pared que no estaban al ingresar"
              value={values.note}
              onChange={(e) => set({ note: e.target.value })}
            />
            {error?.fields.note ? <p className="text-sm text-danger">{error.fields.note}</p> : null}
          </div>
          <div className="flex max-w-48 flex-col gap-1.5">
            <Label htmlFor="discount-amount">Monto (S/)</Label>
            <Input
              id="discount-amount"
              className="h-11"
              inputMode="decimal"
              value={values.amount}
              onChange={(e) => set({ amount: e.target.value })}
            />
            {error?.fields.amount ? <p className="text-sm text-danger">{error.fields.amount}</p> : null}
          </div>
          <FileField
            businessId={detail.businessId}
            residentId={detail.residentId}
            folder="liquidacion"
            formats={["image"]}
            label={reported ? "Agregar foto (obligatoria)" : "Agregar foto (opcional)"}
            value={photo}
            onChange={setPhoto}
          />
          <FormMessage message={error?.message} />
        </div>
        <DialogFooter>
          <Button type="button" className="h-11" disabled={pending} onClick={save}>
            {pending ? "Guardando…" : "Agregar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AnswerDialog({
  depositId,
  discount,
  onClose,
}: {
  depositId: string;
  discount: DiscountRow | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const answer = (input: { action: "adjust"; amount: string } | { action: "withdraw" }) =>
    discount &&
    startTransition(async () => {
      setError(undefined);
      const result = await answerDisputeAction(depositId, discount.id, input);
      if (!result.ok) return setError(result.fieldErrors?.amount ?? result.message);
      setAmount("");
      onClose();
      router.refresh();
    });

  return (
    <Dialog open={discount !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Responder la disputa</DialogTitle>
          <DialogDescription>
            {discount ? `${AREA_LABEL[discount.area]} · ${formatSoles(discount.amount)}. ` : ""}
            Ajusta el monto (puede ser el mismo, si lo mantienes) o retíralo.
          </DialogDescription>
        </DialogHeader>
        {discount?.disputeReason ? (
          <p className="rounded-lg bg-muted px-3 py-2 text-sm">“{discount.disputeReason}”</p>
        ) : null}
        <div className="flex max-w-48 flex-col gap-1.5">
          <Label htmlFor="answer-amount">Nuevo monto (S/)</Label>
          <Input
            id="answer-amount"
            className="h-11"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <FormMessage message={error} />
        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            className="h-11"
            disabled={pending}
            onClick={() => answer({ action: "withdraw" })}
          >
            Retirar descuento
          </Button>
          <Button
            type="button"
            className="h-11"
            disabled={pending}
            onClick={() => answer({ action: "adjust", amount })}
          >
            Guardar monto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RefundForm({ detail, max }: { detail: DepositDetail; max: string }) {
  const router = useRouter();
  const methods = detail.refundMethods.length
    ? detail.refundMethods
    : (["yape", "plin", "transfer"] as const);
  const blank = (): RefundInput => ({
    amount: String(Number(max)),
    method: detail.settlement?.refundMethod ?? methods[0],
    paidOn: limaToday(new Date()),
    operationCode: "",
    proofPath: "",
  });
  const [values, setValues] = useState<RefundInput>(blank);
  const [file, setFile] = useState<{ path: string; name: string } | null>(null);
  const [error, setError] = useState<{ message: string; fields: Record<string, string> }>();
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<RefundInput>) => setValues((v) => ({ ...v, ...patch }));

  const save = () =>
    startTransition(async () => {
      setError(undefined);
      const result = await registerRefundAction(detail.id, { ...values, proofPath: file?.path ?? "" });
      if (!result.ok) return setError({ message: result.message, fields: result.fieldErrors ?? {} });
      setFile(null);
      router.refresh();
    });

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="refund-amount">Monto (S/)</Label>
          <Input
            id="refund-amount"
            className="h-11"
            inputMode="decimal"
            value={values.amount}
            onChange={(e) => set({ amount: e.target.value })}
          />
          {error?.fields.amount ? <p className="text-sm text-danger">{error.fields.amount}</p> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="refund-method">Método</Label>
          <select
            id="refund-method"
            className={selectClass}
            value={values.method}
            onChange={(e) => set({ method: e.target.value as RefundInput["method"] })}
          >
            {(["yape", "plin", "transfer", "cash"] as const).map((m) => (
              <option key={m} value={m}>
                {METHOD_LABEL[m]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="refund-date">Fecha de devolución</Label>
          <Input
            id="refund-date"
            type="date"
            className="h-11"
            value={values.paidOn}
            onChange={(e) => set({ paidOn: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="refund-op">N.º de operación (opcional)</Label>
          <Input
            id="refund-op"
            className="h-11"
            value={values.operationCode ?? ""}
            onChange={(e) => set({ operationCode: e.target.value })}
          />
        </div>
      </div>
      <FileField
        businessId={detail.businessId}
        residentId={detail.residentId}
        folder="devoluciones"
        label="Adjuntar comprobante (opcional)"
        value={file}
        onChange={setFile}
      />
      <FormMessage message={error?.message} />
      <Button type="submit" className="h-11 w-full" disabled={pending}>
        {pending ? "Guardando…" : "Registrar devolución"}
      </Button>
    </form>
  );
}
