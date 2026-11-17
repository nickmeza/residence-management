"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { ConfirmButton } from "@/components/confirm-button";
import { Field, selectClass } from "@/components/form-controls";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addParcelAction, deleteParcelAction, deliverParcelAction } from "@/server/reception/actions";
import type { ParcelRow } from "@/server/reception/queries";

const time = new Intl.DateTimeFormat("es-PE", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Lima",
});

const card = "flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-card";

// Un paquete por entregar: "Entregado" (y, si lo recoge otra persona, quién).
function Waiting({ row, onDone }: { row: ParcelRow; onDone: () => void }) {
  const [other, setOther] = useState("");
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();
  const deliver = () =>
    startTransition(async () => {
      const r = await deliverParcelAction(row.id, { deliveredTo: other });
      if (!r.ok) return setMessage(r.message);
      onDone();
    });
  return (
    <li className="flex flex-col gap-2 border-t py-3 first:border-t-0">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex min-w-0 flex-1 flex-col">
          <b>{row.description}</b>
          <span className="text-sm text-muted-foreground">
            Para {row.residentName} · llegó {time.format(row.receivedAt)}
          </span>
        </span>
        <StatusBadge tone="warn">Por entregar</StatusBadge>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="Lo recoge otra persona (opcional)"
          placeholder="Lo recoge otra persona (opcional)"
          className="h-11 sm:w-72"
          maxLength={120}
          value={other}
          onChange={(e) => setOther(e.target.value)}
        />
        <Button type="button" className="h-11" disabled={pending} onClick={deliver}>
          {pending ? "Guardando…" : "Entregado"}
        </Button>
      </div>
      <FormMessage message={message} />
    </li>
  );
}

// Paquetes (CM-06): anotar lo que llegó (al residente le llega un aviso) y marcarlo entregado.
export function ParcelBoard({
  businessId,
  rows,
  residents,
}: {
  businessId: string;
  rows: ParcelRow[];
  residents: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({ residentId: "", description: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const r = await addParcelAction(businessId, { ...form, residentId: form.residentId || null });
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        setMessage(r.message);
        return;
      }
      setForm({ residentId: "", description: "" });
      setErrors({});
      setMessage(undefined);
      router.refresh();
    });

  const remove = (id: string) =>
    startTransition(async () => {
      const r = await deleteParcelAction(id);
      if (!r.ok) return setMessage(r.message);
      router.refresh();
    });

  const waiting = rows.filter((r) => !r.deliveredAt);
  const delivered = rows.filter((r) => r.deliveredAt);

  return (
    <>
      <section className={card} aria-labelledby="nuevo-paquete">
        <h2 id="nuevo-paquete" className="text-lg font-bold">
          Llegó un paquete
        </h2>
        {residents.length ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="paquete-para" label="Para quién" error={errors.residentId}>
                <select
                  id="paquete-para"
                  className={selectClass}
                  value={form.residentId}
                  onChange={(e) => setForm((f) => ({ ...f, residentId: e.target.value }))}
                >
                  <option value="">Elige a la persona</option>
                  {residents.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="paquete-que" label="Qué es" error={errors.description}>
                <Input
                  id="paquete-que"
                  className="h-11"
                  maxLength={120}
                  placeholder="Por ejemplo: caja mediana de una tienda"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </Field>
            </div>
            <FormMessage message={message} />
            <Button type="button" className="h-11 self-start" disabled={pending} onClick={save}>
              {pending ? "Guardando…" : "Guardar y avisarle"}
            </Button>
          </>
        ) : (
          <p className="text-muted-foreground">Cuando tengas residentes, aquí anotarás sus paquetes.</p>
        )}
      </section>
      <section className={card} aria-labelledby="por-entregar">
        <h2 id="por-entregar" className="text-lg font-bold">
          Por entregar
        </h2>
        {waiting.length ? (
          <ul className="flex flex-col">
            {waiting.map((p) => (
              <Waiting key={p.id} row={p} onDone={() => router.refresh()} />
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">No hay paquetes esperando.</p>
        )}
      </section>
      <section className={card} aria-labelledby="entregados">
        <h2 id="entregados" className="text-lg font-bold">
          Entregados (últimos 30 días)
        </h2>
        {delivered.length ? (
          <ul className="flex flex-col">
            {delivered.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 border-t py-3 first:border-t-0">
                <span className="flex min-w-0 flex-1 flex-col">
                  <b>{p.description}</b>
                  <span className="text-sm text-muted-foreground">
                    Para {p.residentName} · entregado {p.deliveredAt ? time.format(p.deliveredAt) : ""}
                    {p.deliveredTo ? ` a ${p.deliveredTo}` : ""}
                  </span>
                </span>
                <StatusBadge tone="ok">Entregado</StatusBadge>
                <ConfirmButton
                  trigger={
                    <Button type="button" variant="ghost" className="size-11" aria-label="Borrar paquete">
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  }
                  title="¿Borrar este paquete?"
                  description="Se quita del historial. No se puede deshacer."
                  confirmLabel="Borrar"
                  onConfirm={() => remove(p.id)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">Todavía no se entregó ningún paquete.</p>
        )}
      </section>
    </>
  );
}
