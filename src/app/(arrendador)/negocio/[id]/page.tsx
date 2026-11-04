import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { BusinessEditForm } from "@/components/business/business-edit-form";
import { getBusinessForEdit } from "@/server/business/queries";

export const metadata: Metadata = { title: "Configuración · Gestión de residencias" };

const SERVICE_LABEL = { residence: "Residencia", meal_plan: "Pensión" } as const;
// Pestañas de Configuración del prototipo. Solo "Negocio" existe por ahora.
const TABS = ["Negocio", "Usuarios y roles", "Plantillas", "Garantía", "Documentos"];

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
      <nav aria-label="Secciones de configuración" className="flex flex-wrap gap-2 border-b pb-3">
        {TABS.map((tab, i) =>
          i === 0 ? (
            <span
              key={tab}
              aria-current="page"
              className="rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground"
            >
              {tab}
            </span>
          ) : (
            <span
              key={tab}
              aria-disabled="true"
              className="rounded-lg border bg-card px-3.5 py-2 text-sm font-semibold text-muted-foreground opacity-60"
            >
              {tab} <span className="text-xs font-normal">(pronto)</span>
            </span>
          ),
        )}
      </nav>
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
