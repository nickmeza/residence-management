"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { ConfirmButton } from "@/components/confirm-button";
import { selectClass } from "@/components/form-controls";
import { StatusBadge, type BadgeTone } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { formatShortDate, formatTimeAgo } from "@/lib/format";
import {
  setAcceptsCleaningAction,
  setUnitCleaningAction,
  updateCleaningRequestAction,
} from "@/server/cleaning/actions";
import type { CleaningRequestRow, CleaningUnit } from "@/server/cleaning/queries";
import {
  CLEANING_LABEL,
  CLEANING_VALUES,
  isOpenRequest,
  REQUEST_LABEL,
  type CleaningRequestStatus,
  type CleaningStatus,
} from "@/server/cleaning/rules";

const card = "flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-card";

const UNIT_TONE: Record<CleaningStatus, BadgeTone> = { dirty: "warn", clean: "ok", inspected: "primary" };
const REQUEST_TONE: Record<CleaningRequestStatus, BadgeTone> = {
  requested: "warn",
  scheduled: "primary",
  done: "ok",
  cancelled: "neutral",
};

type Result = { ok: boolean; message?: string };

// Un pedido abierto: ponerle fecha, marcarlo hecho o cancelarlo.
function OpenRequest({
  r,
  today,
  act,
}: {
  r: CleaningRequestRow;
  today: string;
  act: (fn: () => Promise<Result>) => void;
}) {
  const [date, setDate] = useState(r.scheduledFor ?? r.preferredDate ?? today);
  return (
    <li className="flex flex-col gap-2 border-t py-3 first:border-t-0">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex min-w-0 flex-1 flex-col">
          <b>
            {r.residentName}
            {r.unitName ? ` · ${r.unitName}` : ""}
          </b>
          <span className="text-sm text-muted-foreground">
            {[
              r.preferredDate ? `Prefiere el ${formatShortDate(r.preferredDate)}` : null,
              r.scheduledFor ? `Quedó para el ${formatShortDate(r.scheduledFor)}` : null,
              r.note,
            ]
              .filter(Boolean)
              .join(" · ") || "Sin nota"}
          </span>
        </span>
        <StatusBadge tone={REQUEST_TONE[r.status]}>{REQUEST_LABEL[r.status]}</StatusBadge>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="date"
          aria-label="Fecha de la limpieza"
          className="h-11 w-auto"
          min={today}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          className="h-11"
          onClick={() => act(() => updateCleaningRequestAction(r.id, { status: "scheduled", date }))}
        >
          {r.scheduledFor ? "Cambiar fecha" : "Poner fecha"}
        </Button>
        <Button
          type="button"
          className="h-11"
          onClick={() => act(() => updateCleaningRequestAction(r.id, { status: "done" }))}
        >
          Hecho
        </Button>
        <ConfirmButton
          trigger={
            <Button type="button" variant="ghost" className="h-11">
              Cancelar pedido
            </Button>
          }
          title="¿Cancelar este pedido de limpieza?"
          description="Al residente le llega un aviso de que se canceló."
          confirmLabel="Cancelar pedido"
          onConfirm={() => act(() => updateCleaningRequestAction(r.id, { status: "cancelled" }))}
        />
      </div>
    </li>
  );
}

// Limpieza (MT-05): pedidos de los residentes (con su interruptor) y el estado de cada unidad entre un residente y
// otro. Las tareas de las áreas comunes van aparte, con las tareas que se repiten.
export function CleaningBoard({
  businessId,
  acceptsRequests,
  requests,
  units,
  today,
  now,
}: {
  businessId: string;
  acceptsRequests: boolean;
  requests: CleaningRequestRow[];
  units: CleaningUnit[];
  today: string;
  now: Date;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();
  const act = (fn: () => Promise<Result>) =>
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) return setMessage(r.message);
      setMessage(undefined);
      router.refresh();
    });

  const open = requests.filter((r) => isOpenRequest(r.status));
  const closed = requests.filter((r) => !isOpenRequest(r.status));
  const dirty = units.filter((u) => u.status === "dirty").length;

  return (
    <>
      <FormMessage message={message} />
      <section className={card} aria-labelledby="pedidos-limpieza">
        <h2 id="pedidos-limpieza" className="text-lg font-bold">
          Pedidos de los residentes
        </h2>
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <Checkbox
            checked={acceptsRequests}
            disabled={pending}
            onCheckedChange={(v) => act(() => setAcceptsCleaningAction(businessId, v === true))}
            className="mt-0.5"
          />
          <span>
            <b>Mis residentes pueden pedir limpieza de su cuarto</b>
            <span className="block text-muted-foreground">
              {acceptsRequests
                ? "Prendido: ven “Pedir limpieza” en Mantenimiento, desde su cuenta."
                : "Apagado: no les aparece nada."}
            </span>
          </span>
        </label>
        {open.length ? (
          <ul className="flex flex-col">
            {open.map((r) => (
              <OpenRequest key={r.id} r={r} today={today} act={act} />
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">No hay pedidos de limpieza por atender.</p>
        )}
        {closed.length ? (
          <details className="text-sm">
            <summary className="flex min-h-11 cursor-pointer items-center font-semibold">
              Cerrados (últimos 30 días)
            </summary>
            <ul className="flex flex-col">
              {closed.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 border-t py-2.5">
                  <span className="flex-1">
                    {r.residentName}
                    {r.unitName ? ` · ${r.unitName}` : ""} · {formatTimeAgo(r.createdAt, now)}
                  </span>
                  <StatusBadge tone={REQUEST_TONE[r.status]}>{REQUEST_LABEL[r.status]}</StatusBadge>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>
      <section className={card} aria-labelledby="unidades-limpieza">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="unidades-limpieza" className="text-lg font-bold">
            Cuartos y departamentos
          </h2>
          <span className="text-sm text-muted-foreground">
            {dirty === 0 ? "Todo limpio" : dirty === 1 ? "1 por limpiar" : `${dirty} por limpiar`}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Al marcar una salida como hecha, la unidad pasa sola a “Por limpiar”. Cámbiala cuando esté lista
          para el siguiente residente.
        </p>
        {units.length ? (
          <ul className="flex flex-col">
            {units.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 border-t py-2.5 first:border-t-0">
                <span className="min-w-0 flex-1 font-semibold">{u.label}</span>
                <StatusBadge tone={UNIT_TONE[u.status]}>{CLEANING_LABEL[u.status]}</StatusBadge>
                <select
                  aria-label={`Estado de limpieza de ${u.label}`}
                  className={`${selectClass} w-40`}
                  value={u.status}
                  disabled={pending}
                  onChange={(e) => act(() => setUnitCleaningAction(u.id, e.target.value))}
                >
                  {CLEANING_VALUES.map((s) => (
                    <option key={s} value={s}>
                      {CLEANING_LABEL[s]}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">Todavía no tienes unidades. Agrégalas en Edificio.</p>
        )}
      </section>
    </>
  );
}
