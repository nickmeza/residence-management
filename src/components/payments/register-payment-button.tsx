"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

import { PaymentForm } from "./payment-form";

// "Registrar otro pago" del detalle de un recibo: abre el formulario en un panel lateral, con lo que falta como
// monto sugerido. Puede ser una parte: el recibo queda en "Pago parcial" hasta completarlo.
export function RegisterPaymentButton({
  businessId,
  residentId,
  period,
  periodText,
  residentName,
  suggestedAmount,
  label,
}: {
  businessId: string;
  residentId: string;
  period: string;
  periodText: string;
  residentName: string;
  suggestedAmount: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" className="h-11 gap-2 px-4" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden="true" />
        {label}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{label}</SheetTitle>
            <SheetDescription>
              {residentName} · Recibo de {periodText}. Puede ser una parte: el recibo queda en “Pago parcial”
              hasta completarlo.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            <PaymentForm
              mode="landlord"
              businessId={businessId}
              period={period}
              residentId={residentId}
              suggestedAmount={suggestedAmount}
              onDone={() => setOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
