import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ContractEditor } from "@/components/contracts/contract-editor";
import { FormSkeleton } from "@/components/skeletons";
import { limaToday } from "@/server/contracts/dates";
import { getContract, getContractFormOptions } from "@/server/contracts/queries";

export const metadata: Metadata = { title: "Cambiar condiciones · Gestión de residencias" };

// Cambiar condiciones de un contrato vigente: el actual termina el día anterior al nuevo inicio y empieza uno nuevo,
// enlazado a él. La garantía no se toca: pasa al contrato nuevo (regla 9).
async function Content({ params }: { params: PageProps<"/contratos/[id]/condiciones">["params"] }) {
  const { id } = await params;
  const c = await getContract(id);
  if (!c) notFound();
  const active = c.status === "confirmed" || c.status === "pending_signature";
  if (!active || c.phase === "ended" || c.renewedTo) {
    return (
      <p className="text-muted-foreground">
        Este contrato ya no se puede cambiar.{" "}
        <Link href={`/contratos/${c.id}`} className="text-link hover:underline">
          Volver al contrato
        </Link>
      </p>
    );
  }
  const options = await getContractFormOptions(c.businessId);
  if (!options) notFound();
  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          <Link href="/contratos" className="hover:underline">
            Contratos
          </Link>{" "}
          ›{" "}
          <Link href={`/contratos/${c.id}`} className="hover:underline">
            {c.residentName}
          </Link>{" "}
          › <b className="text-foreground">Cambiar condiciones</b>
        </p>
        <h1 className="text-[34px] font-bold tracking-tight">Cambiar condiciones</h1>
        <p className="text-muted-foreground">
          El contrato actual termina el día anterior al nuevo inicio, y el nuevo queda enlazado a él.
        </p>
      </div>
      <ContractEditor
        options={options}
        mode={{ kind: "terms", contractId: c.id }}
        initial={{
          residentId: c.residentId,
          unitId: c.unitId,
          startDate: limaToday(new Date()),
          endDate: c.endDate ?? "",
          monthlyRent: String(Number(c.monthlyRent)),
          paymentDay: String(c.paymentDay),
          paperwork: c.paperwork,
          templateId: c.templateId ?? "",
          depositRule: "",
          depositFixedAmount: "",
          depositDueDate: "",
        }}
      />
    </>
  );
}

export default function ChangeTermsPage({ params }: PageProps<"/contratos/[id]/condiciones">) {
  return (
    <Suspense fallback={<FormSkeleton fields={6} />}>
      <Content params={params} />
    </Suspense>
  );
}
