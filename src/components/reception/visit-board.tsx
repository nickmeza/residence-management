"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { ConfirmButton } from "@/components/confirm-button";
import { Field } from "@/components/form-controls";
import { SelectField } from "@/components/select-field";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addVisitAction, deleteVisitAction, visitLeftAction } from "@/server/reception/actions";
import type { VisitRow } from "@/server/reception/queries";

const time = new Intl.DateTimeFormat("es-PE", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Lima",
});

const card = "flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-card";
const EMPTY = { visitorName: "", residentId: "", note: "" };

// Visitas (CM-05): anotar quién llegó y a quién visita (la hora de entrada es la de ahora), y "Ya se fue" al salir.
// Solo el nombre: no se piden documentos.
export function VisitBoard({
  businessId,
  rows,
  residents,
}: {
  businessId: string;
  rows: VisitRow[];
  residents: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  const act = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) return setMessage(r.message);
      setMessage(undefined);
      router.refresh();
    });

  const save = () =>
    startTransition(async () => {
      const r = await addVisitAction(businessId, { ...form, residentId: form.residentId || null });
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        setMessage(r.message);
        return;
      }
      setForm(EMPTY);
      setErrors({});
      setMessage(undefined);
      router.refresh();
    });

  const inside = rows.filter((r) => !r.leftAt);
  const gone = rows.filter((r) => r.leftAt);

  return (
    <>
      <section className={card} aria-labelledby="nueva-visita">
        <h2 id="nueva-visita" className="text-lg font-bold">
          Llegó una visita
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="visita-nombre" label="Nombre de la visita" error={errors.visitorName}>
            <Input
              id="visita-nombre"
              className="h-11"
              maxLength={120}
              value={form.visitorName}
              onChange={(e) => setForm((f) => ({ ...f, visitorName: e.target.value }))}
            />
          </Field>
          <Field id="visita-a-quien" label="A quién visita">
            <SelectField
              id="visita-a-quien"
              value={form.residentId}
              onValueChange={(v) => setForm((f) => ({ ...f, residentId: v }))}
              options={[
                { value: "", label: "A la administración" },
                ...residents.map((r) => ({ value: r.id, label: r.name })),
              ]}
            />
          </Field>
        </div>
        <Field id="visita-nota" label="Nota (opcional)" error={errors.note}>
          <Input
            id="visita-nota"
            className="h-11"
            maxLength={300}
            placeholder="Por ejemplo: viene a dejar unas cajas"
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
          />
        </Field>
        <FormMessage message={message} />
        <Button type="button" className="h-11 self-start" disabled={pending} onClick={save}>
          {pending ? "Guardando…" : "Anotar entrada"}
        </Button>
      </section>
      <section className={card} aria-labelledby="adentro">
        <h2 id="adentro" className="text-lg font-bold">
          Adentro ahora
        </h2>
        {inside.length ? (
          <ul className="flex flex-col">
            {inside.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-3 border-t py-3 first:border-t-0">
                <span className="flex min-w-0 flex-1 flex-col">
                  <b>{v.visitorName}</b>
                  <span className="text-sm text-muted-foreground">
                    Visita a {v.residentName ?? "la administración"} · entró {time.format(v.arrivedAt)}
                    {v.note ? ` · ${v.note}` : ""}
                  </span>
                </span>
                <StatusBadge tone="primary">Adentro</StatusBadge>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  disabled={pending}
                  onClick={() => act(() => visitLeftAction(v.id))}
                >
                  Ya se fue
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">No hay visitas adentro.</p>
        )}
      </section>
      <section className={card} aria-labelledby="historial-visitas">
        <h2 id="historial-visitas" className="text-lg font-bold">
          Últimos 30 días
        </h2>
        {gone.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-xs font-bold tracking-wide text-muted-foreground uppercase">
                  <th className="py-2 pr-3">Visita</th>
                  <th className="py-2 pr-3">A quién</th>
                  <th className="py-2 pr-3">Entró</th>
                  <th className="py-2 pr-3">Salió</th>
                  <th className="py-2">
                    <span className="sr-only">Borrar</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {gone.map((v) => (
                  <tr key={v.id} className="border-t">
                    <td className="py-2.5 pr-3 font-semibold">{v.visitorName}</td>
                    <td className="py-2.5 pr-3">{v.residentName ?? "Administración"}</td>
                    <td className="py-2.5 pr-3">{time.format(v.arrivedAt)}</td>
                    <td className="py-2.5 pr-3">{v.leftAt ? time.format(v.leftAt) : "—"}</td>
                    <td className="py-1 text-right">
                      <ConfirmButton
                        trigger={
                          <Button
                            type="button"
                            variant="ghost"
                            className="size-11"
                            aria-label="Borrar visita"
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </Button>
                        }
                        title="¿Borrar esta visita?"
                        description="Se quita del historial. No se puede deshacer."
                        confirmLabel="Borrar"
                        onConfirm={() => act(() => deleteVisitAction(v.id))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted-foreground">Todavía no hay visitas anotadas.</p>
        )}
      </section>
    </>
  );
}
