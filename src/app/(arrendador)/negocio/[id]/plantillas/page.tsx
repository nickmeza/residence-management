import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ConfigTabs } from "@/components/business/config-tabs";
import { TemplateEditor } from "@/components/templates/template-editor";
import { listTemplates } from "@/server/templates/queries";

export const metadata: Metadata = { title: "Plantillas · Gestión de residencias" };

async function Content({ params }: { params: PageProps<"/negocio/[id]/plantillas">["params"] }) {
  const { id } = await params;
  const data = await listTemplates(id);
  if (!data) notFound();

  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          {data.tradeName} › Configuración › <b className="text-foreground">Plantillas</b>
        </p>
        <h1 className="text-[34px] font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground">
          Textos de tus contratos. La app los rellena con los datos de cada residente y arma el PDF para
          imprimir.
        </p>
      </div>
      <ConfigTabs businessId={id} current="Plantillas" />
      <TemplateEditor businessId={id} templates={data.templates} />
    </>
  );
}

export default function TemplatesPage({ params }: PageProps<"/negocio/[id]/plantillas">) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
      <Content params={params} />
    </Suspense>
  );
}
