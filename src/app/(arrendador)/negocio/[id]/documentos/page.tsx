import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ConfigTabs } from "@/components/business/config-tabs";
import { RequirementsEditor } from "@/components/documents/requirements-editor";
import { listRequirements } from "@/server/documents/queries";

export const metadata: Metadata = { title: "Documentos que pides · Gestión de residencias" };

async function Content({ params }: { params: PageProps<"/negocio/[id]/documentos">["params"] }) {
  const { id } = await params;
  const data = await listRequirements(id);
  if (!data) notFound();

  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          {data.tradeName} › Configuración › <b className="text-foreground">Documentos</b>
        </p>
        <h1 className="text-[34px] font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground">
          Elige qué documentos pides a tus residentes y cuáles son obligatorios.
        </p>
      </div>
      <ConfigTabs businessId={id} current="Documentos" />
      <RequirementsEditor businessId={id} requirements={data.requirements} properties={data.properties} />
    </>
  );
}

export default function DocumentRequirementsPage({ params }: PageProps<"/negocio/[id]/documentos">) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
      <Content params={params} />
    </Suspense>
  );
}
