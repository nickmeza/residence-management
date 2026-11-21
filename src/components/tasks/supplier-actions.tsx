"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { ConfirmButton } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import { deleteSupplierAction } from "@/server/tasks/actions";

import { SupplierDialog } from "./supplier-dialog";

// Editar o borrar un proveedor desde su ficha.
export function SupplierActions({
  supplier,
}: {
  supplier: { id: string; name: string; trade: string | null; phone: string | null; note: string | null };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  const remove = () =>
    startTransition(async () => {
      const r = await deleteSupplierAction(supplier.id);
      if (!r.ok) return setMessage(r.message);
      router.push("/mantenimiento/proveedores");
      router.refresh();
    });

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="h-11 gap-2" onClick={() => setOpen(true)}>
          <Pencil className="size-4" aria-hidden="true" />
          Editar
        </Button>
        <ConfirmButton
          trigger={
            <Button type="button" variant="outline" className="h-11 gap-2" disabled={pending}>
              <Trash2 className="size-4" aria-hidden="true" />
              Borrar
            </Button>
          }
          title={`¿Borrar a ${supplier.name}?`}
          description="Sus trabajos se quedan en los pedidos y las tareas, pero ya sin su nombre."
          confirmLabel="Borrar"
          onConfirm={remove}
        />
      </div>
      <FormMessage message={message} />
      <SupplierDialog
        open={open}
        onOpenChange={setOpen}
        supplierId={supplier.id}
        initial={{
          name: supplier.name,
          trade: supplier.trade ?? "",
          phone: supplier.phone ?? "",
          note: supplier.note ?? "",
        }}
      />
    </div>
  );
}
