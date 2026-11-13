"use client";

import { UserPlus } from "lucide-react";
import { useState } from "react";

import { ContractSheet } from "@/components/contracts/contract-sheet";
import { EMPTY_RESIDENT, ResidentForm } from "@/components/residents/resident-sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { ContractFormOptions } from "@/server/contracts/queries";

const selectClass = "h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base md:text-sm";

type Step = "choose" | "new" | { residentId: string } | null;

// "Agregar residente" en una unidad libre (decisión del dueño): eliges a alguien que ya registraste o creas uno
// nuevo, y después se abre el contrato con esta unidad ya puesta. Lo que vincula al residente con la unidad es el
// contrato: el residente solo queda viviendo aquí al crearlo.
export function AddResidentButton({
  unitId,
  unitName,
  options,
}: {
  unitId: string;
  unitName: string;
  options: ContractFormOptions;
}) {
  const [step, setStep] = useState<Step>(null);
  const [picked, setPicked] = useState("");
  // El residente recién creado todavía no está en la lista que llegó del servidor: se agrega aquí.
  const [created, setCreated] = useState<{ id: string; fullName: string } | null>(null);
  const residents = created ? [...options.residents, created] : options.residents;
  const contractFor = typeof step === "object" && step !== null ? step.residentId : null;

  return (
    <>
      <div>
        <Button type="button" className="h-11 gap-2 px-4" onClick={() => setStep("choose")}>
          <UserPlus className="size-4" aria-hidden="true" />
          Agregar residente
        </Button>
      </div>

      <Sheet open={step === "choose" || step === "new"} onOpenChange={(open) => !open && setStep(null)}>
        <SheetContent side="right" className="flex w-full flex-col gap-4 sm:max-w-md">
          {step === "new" ? (
            <>
              <SheetHeader>
                <SheetTitle>Residente nuevo</SheetTitle>
                <SheetDescription>
                  Solo el nombre es obligatorio. Al guardar, sigues con su contrato en {unitName}.
                </SheetDescription>
              </SheetHeader>
              <ResidentForm
                residentId={null}
                initial={EMPTY_RESIDENT}
                hasAccount={false}
                onCreated={(id, fullName) => {
                  setCreated({ id, fullName });
                  setStep({ residentId: id });
                }}
                onSaved={() => {}}
              />
            </>
          ) : (
            <>
              <SheetHeader>
                <SheetTitle>Agregar residente a {unitName}</SheetTitle>
                <SheetDescription>
                  Elige a alguien que ya registraste o crea uno nuevo. Después haces su contrato.
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-5 px-4 pb-4">
                <Button type="button" className="h-11 gap-2" onClick={() => setStep("new")}>
                  <UserPlus className="size-4" aria-hidden="true" />
                  Residente nuevo
                </Button>
                {residents.length ? (
                  <form
                    className="flex flex-col gap-3 border-t pt-5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (picked) setStep({ residentId: picked });
                    }}
                  >
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="existing-resident">O alguien que ya registraste</Label>
                      <select
                        id="existing-resident"
                        className={selectClass}
                        value={picked}
                        onChange={(e) => setPicked(e.target.value)}
                      >
                        <option value="">Elige al residente</option>
                        {residents.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.fullName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button type="submit" variant="outline" className="h-11" disabled={!picked}>
                      Seguir con el contrato
                    </Button>
                  </form>
                ) : null}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ContractSheet
        target={contractFor ? { mode: "create", residentId: contractFor, unitId } : null}
        options={{ ...options, residents }}
        onClose={() => setStep(null)}
      />
    </>
  );
}
