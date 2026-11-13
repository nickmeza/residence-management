import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ConfigTabs } from "@/components/business/config-tabs";
import { PensionSettingsEditor } from "@/components/pension/pension-settings-editor";
import { PlansEditor } from "@/components/pension/plans-editor";
import { getBusinessForEdit } from "@/server/business/queries";
import { getPensionAdmin } from "@/server/pension/queries";

export const metadata: Metadata = { title: "Comidas y planes · Gestión de residencias" };

// Configuración › Comidas y planes (solo negocios de Pensión): las comidas, la hora de cancelación, cómo entrega
// y sus planes.
async function Content({ params }: { params: PageProps<"/negocio/[id]/comidas">["params"] }) {
  const { id } = await params;
  const [b, view] = await Promise.all([getBusinessForEdit(id), getPensionAdmin(id)]);
  if (!b || !view) notFound();
  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          {b.tradeName} › Configuración › <b className="text-foreground">Comidas y planes</b>
        </p>
        <h1 className="text-[34px] font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground">Qué comidas das, hasta qué hora se cancela y tus planes.</p>
      </div>
      <ConfigTabs businessId={id} current="Comidas y planes" service="meal_plan" />
      <PensionSettingsEditor
        businessId={view.businessId}
        saved={view.mealsSaved}
        initial={{
          serviceDays: view.settings.serviceDays,
          cancelDeadline: view.settings.cancelDeadline,
          serviceModes: view.settings.serviceModes,
          seatsPerTurn: view.settings.seatsPerTurn === null ? "" : String(view.settings.seatsPerTurn),
          acceptsExternal: view.settings.acceptsExternal,
          acceptsPaymentProofs: view.settings.acceptsPaymentProofs,
          diets: view.settings.diets.join(", "),
          meals: view.meals.map((m) => ({ ...m, singlePrice: String(Number(m.singlePrice)) })),
        }}
      />
      <PlansEditor businessId={view.businessId} plans={view.plans} meals={view.meals} />
    </>
  );
}

export default function MealSettingsPage({ params }: PageProps<"/negocio/[id]/comidas">) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
      <Content params={params} />
    </Suspense>
  );
}
