import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ContractEditor } from "@/components/contracts/contract-editor";
import { FormSkeleton } from "@/components/skeletons";
import { buttonVariants } from "@/components/ui/button";
import { priceText } from "@/lib/format";
import { getShellData } from "@/server/business/current";
import { isUuid } from "@/server/business/queries";
import { limaToday } from "@/server/contracts/dates";
import { getContractFormOptions } from "@/server/contracts/queries";

export const metadata: Metadata = { title: "Nuevo contrato · Gestión de residencias" };

// ?residente= llega elegido y fijo (desde la ficha o una postulación); ?unidad= llega elegida y se puede cambiar,
// salvo con ?fija=1 (desde la unidad del edificio, "Agregar residente").
async function Content({ searchParams }: { searchParams: PageProps<"/contratos/nuevo">["searchParams"] }) {
  const { current } = await getShellData();
  if (!current) {
    return <p className="text-muted-foreground">Primero configura tu negocio para crear contratos.</p>;
  }
  const [options, params] = await Promise.all([getContractFormOptions(current.id), searchParams]);
  if (!options) return <p className="text-muted-foreground">No encontramos tu negocio. Recarga la página.</p>;
  if (!options.residents.length) {
    return (
      <section className="flex flex-col items-start gap-3 rounded-xl border bg-card p-6 shadow-card">
        <p className="text-muted-foreground">Primero agrega a un residente.</p>
        <Link href="/residentes" className={buttonVariants({ className: "h-11" })}>
          Ir a Residentes
        </Link>
      </section>
    );
  }
  const param = (key: string) => {
    const v = params[key];
    return typeof v === "string" && isUuid(v) ? v : undefined;
  };
  const residentId = options.residents.find((r) => r.id === param("residente"))?.id;
  const unit = options.units.find((u) => u.id === param("unidad"));

  return (
    <ContractEditor
      options={options}
      mode={{
        kind: "create",
        lockResident: Boolean(residentId),
        lockUnit: Boolean(unit) && params.fija === "1",
      }}
      initial={{
        residentId: residentId ?? "",
        unitId: unit?.id ?? "",
        startDate: limaToday(new Date()),
        endDate: "",
        // Con la unidad ya elegida, la renta propuesta es su precio (igual que al elegirla en la lista).
        monthlyRent: priceText(unit?.monthlyPrice ?? null),
        paymentDay: String(options.billingDay),
        paperwork: "none",
        templateId: "",
        depositRule: "",
        depositFixedAmount: "",
        depositDueDate: "",
      }}
    />
  );
}

export default function NewContractPage({ searchParams }: PageProps<"/contratos/nuevo">) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          <Link href="/contratos" className="hover:underline">
            Contratos
          </Link>{" "}
          › <b className="text-foreground">Nuevo contrato</b>
        </p>
        <h1 className="text-[34px] font-bold tracking-tight">Nuevo contrato</h1>
        <p className="text-muted-foreground">
          Como borrador no ocupa la unidad. Al crearlo, sin papel queda acordado; con papel, pendiente de la
          copia firmada.
        </p>
      </div>
      <Suspense fallback={<FormSkeleton fields={6} />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  );
}
