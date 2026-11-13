import type { Metadata } from "next";
import { Suspense } from "react";

import { PensionSettingsEditor } from "@/components/pension/pension-settings-editor";
import { PensionTabs } from "@/components/pension/pension-tabs";
import { PlansEditor } from "@/components/pension/plans-editor";
import { getShellData } from "@/server/business/current";
import { getPensionAdmin } from "@/server/pension/queries";

export const metadata: Metadata = { title: "Pensión · Configuración · Gestión de residencias" };

// Pensión › Configuración: las comidas, la hora de cancelación, cómo entrega y sus planes. Sigue al negocio elegido
// arriba; si es una Residencia, avisa que esto es de un negocio de Pensión.
async function Content() {
  const { current } = await getShellData();
  if (!current || current.service !== "meal_plan") {
    return (
      <p className="rounded-xl border bg-card p-6 text-muted-foreground shadow-card">
        Esto es de un negocio de Pensión. Elige tu pensión arriba, en el selector de negocio.
      </p>
    );
  }
  const view = await getPensionAdmin(current.id);
  if (!view) return <p className="text-muted-foreground">No encontramos tu pensión. Recarga la página.</p>;
  return (
    <>
      <PensionSettingsEditor
        businessId={view.businessId}
        saved={view.mealsSaved}
        initial={{
          cancelDeadline: view.settings.cancelDeadline,
          serviceModes: view.settings.serviceModes,
          seatsPerTurn: view.settings.seatsPerTurn === null ? "" : String(view.settings.seatsPerTurn),
          acceptsExternal: view.settings.acceptsExternal,
          diets: view.settings.diets.join(", "),
          meals: view.meals.map((m) => ({ ...m, singlePrice: String(Number(m.singlePrice)) })),
        }}
      />
      <PlansEditor businessId={view.businessId} plans={view.plans} meals={view.meals} />
    </>
  );
}

export default function PensionSettingsPage() {
  return (
    <>
      <h1 className="text-[34px] font-bold tracking-tight">Pensión</h1>
      <PensionTabs current="configuracion" />
      <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
        <Content />
      </Suspense>
    </>
  );
}
