"use client";

import { Check, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { setAcceptsApplicationsAction } from "@/server/applications/actions";

// Enlace público para postular: se prende o apaga y se copia para compartirlo (WhatsApp, Facebook, un cartel).
export function ApplicationLinkCard({ businessId, accepting }: { businessId: string; accepting: boolean }) {
  const router = useRouter();
  // El dominio solo se conoce en el navegador; en el servidor se muestra la ruta.
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
  const url = `${origin}/postular/${businessId}`;
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const toggle = (on: boolean) =>
    startTransition(async () => {
      const r = await setAcceptsApplicationsAction(businessId, on);
      setError(r.ok ? undefined : r.message);
      router.refresh();
    });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("No pudimos copiarlo. Selecciona el enlace y cópialo a mano.");
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card">
      <label className="flex min-h-11 items-start gap-3">
        <Checkbox
          checked={accepting}
          disabled={pending}
          onCheckedChange={(v) => toggle(v === true)}
          className="mt-1"
        />
        <span>
          <b>Recibir postulaciones por un enlace</b>
          <span className="block text-sm text-muted-foreground">
            {accepting
              ? "Prendido: cualquiera con el enlace puede postular. Te llegará un aviso por cada postulación."
              : "Apagado: el enlace muestra que no estás recibiendo postulaciones."}
          </span>
        </span>
      </label>
      {accepting ? (
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-2.5 text-sm">{url}</code>
          <Button type="button" variant="outline" className="h-11 gap-2" onClick={copy}>
            {copied ? (
              <Check className="size-4" aria-hidden="true" />
            ) : (
              <Copy className="size-4" aria-hidden="true" />
            )}
            {copied ? "Copiado" : "Copiar enlace"}
          </Button>
        </div>
      ) : null}
      <FormMessage message={error} />
    </section>
  );
}
