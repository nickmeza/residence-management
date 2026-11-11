"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendCodeAction, verifyCodeAction, type CodeFormState } from "@/server/auth/code-actions";

import { FormMessage } from "./auth-field";

// Sin contraseña: se pide el correo y Supabase manda un enlace para entrar. El código de 6 números queda listo
// para cuando haya correo propio (SMTP): solo así se puede poner el código en la plantilla del correo.
export function CodeSignInForm({ invite, defaultEmail }: { invite?: string; defaultEmail?: string }) {
  const [sent, send, sending] = useActionState(sendCodeAction, { step: "email", email: defaultEmail });
  const [checked, verify, verifying] = useActionState(verifyCodeAction, { step: "code" } as CodeFormState);
  const [changing, setChanging] = useState(false);
  const onCodeStep = sent.step === "code" && !changing;
  const email = sent.email ?? defaultEmail ?? "";

  if (!onCodeStep) {
    return (
      <form
        action={(data) => {
          setChanging(false);
          send(data);
        }}
        noValidate
        className="flex flex-col gap-4"
      >
        {invite ? <input type="hidden" name="invite" value={invite} /> : null}
        <FormMessage message={sent.error} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="code-email">Tu correo</Label>
          <Input
            id="code-email"
            name="email"
            type="email"
            autoComplete="email"
            className="h-11"
            defaultValue={email}
          />
        </div>
        <Button type="submit" disabled={sending} className="h-11">
          {sending ? "Enviando…" : "Enviarme el enlace"}
        </Button>
      </form>
    );
  }

  return (
    <form action={verify} noValidate className="flex flex-col gap-4">
      {invite ? <input type="hidden" name="invite" value={invite} /> : null}
      <input type="hidden" name="email" value={email} />
      <div className="rounded-lg bg-primary-soft px-3 py-2.5 text-sm text-primary-text">
        <p className="font-semibold">{sent.message}</p>
        <p>
          Ábrelo desde este mismo celular o computadora: el enlace solo funciona en el equipo donde lo
          pediste.
        </p>
      </div>
      <FormMessage message={checked.error} />
      <details className="text-sm" open={Boolean(checked.error)}>
        <summary className="min-h-11 cursor-pointer py-2.5 text-muted-foreground">
          ¿Te llegó un código de 6 números?
        </summary>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="code-value">Código</Label>
            <Input
              id="code-value"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="h-11 text-center text-lg tracking-[0.4em]"
            />
          </div>
          <Button type="submit" disabled={verifying} className="h-11">
            {verifying ? "Entrando…" : "Entrar con el código"}
          </Button>
        </div>
      </details>
      <p className="text-sm text-muted-foreground">
        ¿No te llegó? Revisa la carpeta de spam o{" "}
        <button
          type="button"
          className="text-link underline-offset-4 hover:underline"
          onClick={() => setChanging(true)}
        >
          vuelve a pedirlo
        </button>
        .
      </p>
    </form>
  );
}
