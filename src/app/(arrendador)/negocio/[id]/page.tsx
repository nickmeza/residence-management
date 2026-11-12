import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { BusinessEditForm } from "@/components/business/business-edit-form";
import { ConfigTabs } from "@/components/business/config-tabs";
import { getBusinessForEdit } from "@/server/business/queries";

export const metadata: Metadata = { title: "Configuración · Gestión de residencias" };

const SERVICE_LABEL = { residence: "Residencia", meal_plan: "Pensión" } as const;

async function Content({ params }: { params: PageProps<"/negocio/[id]">["params"] }) {
  const { id } = await params;
  const b = await getBusinessForEdit(id);
  if (!b) notFound();

  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          {b.tradeName} › Configuración › <b className="text-foreground">Negocio</b>
        </p>
        <h1 className="text-[34px] font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground">
          Datos de tu {SERVICE_LABEL[b.service].toLowerCase()}, usuarios y plantillas.
        </p>
      </div>
      <ConfigTabs businessId={b.id} current="Negocio" />
      <BusinessEditForm
        id={b.id}
        service={b.service}
        initial={{
          kind: b.kind,
          tradeName: b.tradeName,
          legalName: b.legalName ?? "",
          ruc: b.ruc ?? "",
          phone: b.phone ?? "",
          contactEmail: b.contactEmail ?? "",
          city: b.city ?? "",
          address: b.address ?? "",
          paymentMethods: b.paymentMethods,
          billingDay: String(b.billingDay ?? 5),
        }}
      />
    </>
  );
}

export default function BusinessPage({ params }: PageProps<"/negocio/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
      <Content params={params} />
    </Suspense>
  );
}
