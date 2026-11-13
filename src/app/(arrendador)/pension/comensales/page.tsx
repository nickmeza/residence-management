import type { Metadata } from "next";
import { Suspense } from "react";

import { DinerList } from "@/components/pension/diner-list";
import { currentPension, NotAPension, PensionHeader } from "@/components/pension/pension-page";
import { getPensionAdmin, listDiners } from "@/server/pension/queries";

export const metadata: Metadata = { title: "Pensión · Comensales · Gestión de residencias" };

async function Content() {
  const pension = await currentPension();
  if (!pension) return <NotAPension />;
  const [list, admin] = await Promise.all([listDiners(pension.id), getPensionAdmin(pension.id)]);
  if (!list || !admin)
    return <p className="text-muted-foreground">No encontramos tu pensión. Recarga la página.</p>;
  return (
    <DinerList
      businessId={pension.id}
      today={list.today}
      diners={list.diners}
      plans={admin.plans.filter((p) => p.active)}
      diets={admin.settings.diets}
    />
  );
}

export default function DinersPage() {
  return (
    <>
      <PensionHeader
        tab="comensales"
        description="Quién come en tu pensión, con qué plan y hasta cuándo pagó."
      />
      <Suspense fallback={<p className="text-muted-foreground">Cargando tus comensales…</p>}>
        <Content />
      </Suspense>
    </>
  );
}
