"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { ConfirmButton } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import { deleteBusinessAction } from "@/server/business/actions";

// Zona de peligro de Configuración › Negocio. Si sale bien, el servidor lleva al panel; si no (por ejemplo,
// el negocio tiene residentes), muestra el motivo.
export function DeleteBusinessButton({ id, name }: { id: string; name: string }) {
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  const remove = () =>
    startTransition(async () => {
      const result = await deleteBusinessAction(id);
      setMessage(result.message);
    });

  return (
    <section
      aria-labelledby="zona-de-peligro"
      className="flex flex-col items-start gap-3 rounded-xl border border-destructive/40 bg-card p-5 shadow-card"
    >
      <h2 id="zona-de-peligro" className="text-lg font-bold">
        Zona de peligro
      </h2>
      <p className="text-sm text-muted-foreground">
        Eliminar el negocio borra también sus edificios, pisos, cuartos y su configuración. Solo se puede si
        todavía no tiene residentes.
      </p>
      <ConfirmButton
        trigger={
          <Button type="button" variant="destructive" className="h-11 gap-2 px-4" disabled={pending}>
            <Trash2 className="size-4" aria-hidden="true" />
            Eliminar negocio
          </Button>
        }
        title={`¿Eliminar «${name}»?`}
        description="Se borran el negocio, sus edificios, pisos y cuartos, la garantía, las plantillas y los documentos que pides. No se puede deshacer."
        confirmLabel="Eliminar negocio"
        onConfirm={remove}
      />
      {pending ? (
        <p role="status" className="text-sm text-muted-foreground">
          Eliminando…
        </p>
      ) : null}
      <FormMessage message={message} />
    </section>
  );
}
