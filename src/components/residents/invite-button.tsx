"use client";

import { Check, Copy, MessageCircle, Send } from "lucide-react";
import { useState, useTransition } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { inviteResidentAction, type InvitationResult } from "@/server/residents/actions";

const expiryFormat = new Intl.DateTimeFormat("es-PE", {
  day: "numeric",
  month: "long",
  timeZone: "America/Lima",
});

// Botón "Invitar": crea un enlace nuevo y lo muestra para mandarlo por WhatsApp o copiarlo a cualquier medio.
// Cada vez que se pulsa se crea otro enlace y los anteriores dejan de servir.
export function InviteButton({
  residentId,
  label = "Invitar",
  variant = "default",
}: {
  residentId: string;
  label?: string;
  variant?: "default" | "outline";
}) {
  const [result, setResult] = useState<InvitationResult>();
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const invite = () =>
    startTransition(async () => {
      setCopied(false);
      setResult(await inviteResidentAction(residentId));
    });

  const copy = async () => {
    if (!result?.ok) return;
    try {
      await navigator.clipboard.writeText(result.message);
      setCopied(true);
    } catch {
      // Sin permiso para el portapapeles: el texto sigue a la vista para copiarlo a mano.
      setCopied(false);
    }
  };

  return (
    <>
      <Button type="button" variant={variant} className="h-11 gap-2" onClick={invite} disabled={pending}>
        <Send className="size-4" aria-hidden="true" />
        {pending ? "Creando enlace…" : label}
      </Button>
      <Dialog open={result !== undefined} onOpenChange={(open) => !open && setResult(undefined)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Invitación lista</DialogTitle>
            <DialogDescription>
              {result?.ok
                ? `Mándala por WhatsApp o copia el mensaje. El enlace vence el ${expiryFormat.format(new Date(result.expiresAt))}.`
                : "No se pudo crear la invitación."}
            </DialogDescription>
          </DialogHeader>
          {result?.ok ? (
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5 text-sm font-semibold">
                Mensaje
                <textarea
                  readOnly
                  value={result.message}
                  rows={5}
                  className="resize-none rounded-lg border border-input bg-transparent p-3 text-sm font-normal"
                  onFocus={(e) => e.currentTarget.select()}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <a
                  href={result.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ className: "h-11 gap-2" })}
                >
                  <MessageCircle className="size-4" aria-hidden="true" />
                  Enviar por WhatsApp
                </a>
                <Button type="button" variant="outline" className="h-11 gap-2" onClick={copy}>
                  {copied ? (
                    <Check className="size-4" aria-hidden="true" />
                  ) : (
                    <Copy className="size-4" aria-hidden="true" />
                  )}
                  {copied ? "Copiado" : "Copiar mensaje"}
                </Button>
              </div>
              <p role="status" className="text-sm text-muted-foreground">
                {copied ? "Mensaje copiado. Pégalo en el medio que prefieras." : ""}
              </p>
            </div>
          ) : (
            <FormMessage message={result?.message} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
