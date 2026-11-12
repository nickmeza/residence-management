"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { Button } from "@/components/ui/button";
import { confirmSignedAction } from "@/server/contracts/actions";

// Con la copia firmada subida: el contrato pasa a firmado. El servidor revisa la regla 10 (documentos que se le
// piden verificados) y explica qué falta si no se puede.
export function ConfirmSignedButton({ contractId }: { contractId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <span className="flex flex-col gap-1">
      <Button
        type="button"
        className="h-11"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(undefined);
            const result = await confirmSignedAction(contractId);
            if (!result.ok) return setError(result.message);
            router.refresh();
          })
        }
      >
        {pending ? "Confirmando…" : "Confirmar contrato firmado"}
      </Button>
      <FormMessage message={error} />
    </span>
  );
}
