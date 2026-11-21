"use client";

import { UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { EMPTY_RESIDENT, ResidentForm } from "@/components/residents/resident-sheet";
import { SelectField } from "@/components/select-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { ContractFormOptions } from "@/server/contracts/queries";

type Step = "choose" | "new" | null;

// "Agregar residente" en una unidad libre (decisión del dueño): eliges a alguien que ya registraste o creas uno
// nuevo, y después se va a Nuevo contrato con esta unidad ya puesta (fija). Lo que vincula al residente con la unidad es el
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
  const router = useRouter();
  const [step, setStep] = useState<Step>(null);
  const [picked, setPicked] = useState("");
  const residents = options.residents;
  const toContract = (residentId: string) =>
    router.push(`/contratos/nuevo?residente=${residentId}&unidad=${unitId}&fija=1`);

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
                onCreated={(id) => toContract(id)}
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
                      if (picked) toContract(picked);
                    }}
                  >
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="existing-resident">O alguien que ya registraste</Label>
                      <SelectField
                        id="existing-resident"
                        value={picked}
                        onValueChange={(v) => setPicked(v)}
                        placeholder="Elige al residente"
                        options={residents.map((r) => ({ value: r.id, label: r.fullName }))}
                      />
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
    </>
  );
}
