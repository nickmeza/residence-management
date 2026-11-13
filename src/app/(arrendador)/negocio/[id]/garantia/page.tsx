import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ConfigTabs } from "@/components/business/config-tabs";
import { DepositSettingsEditor } from "@/components/deposits/deposit-settings-editor";
import { getDepositSettings } from "@/server/deposits/settings";

export const metadata: Metadata = { title: "Garantía · Gestión de residencias" };

async function Content({ params }: { params: PageProps<"/negocio/[id]/garantia">["params"] }) {
  const { id } = await params;
  const view = await getDepositSettings(id);
  if (!view) notFound();

  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          {view.tradeName} › Configuración › <b className="text-foreground">Garantía</b>
        </p>
        <h1 className="text-[34px] font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground">
          Define cuánto dejan tus residentes como respaldo y cómo se devuelve.
        </p>
      </div>
      <ConfigTabs businessId={id} current="Garantía" />
      <DepositSettingsEditor businessId={id} view={view} />
    </>
  );
}

export default function DepositSettingsPage({ params }: PageProps<"/negocio/[id]/garantia">) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
      <Content params={params} />
    </Suspense>
  );
}
