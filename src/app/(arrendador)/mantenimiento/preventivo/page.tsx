import type { Metadata } from "next";
import { Suspense } from "react";

import { MAINTENANCE_TABS, SectionTabs } from "@/components/section-tabs";
import { ListSkeleton } from "@/components/skeletons";
import { TaskBoard } from "@/components/tasks/task-board";
import { getShellData } from "@/server/business/current";
import { limaToday } from "@/server/contracts/dates";
import { listTasks } from "@/server/tasks/queries";

export const metadata: Metadata = { title: "Mantenimiento preventivo · Gestión de residencias" };

async function Content() {
  const { current } = await getShellData();
  if (!current) return <p className="text-muted-foreground">Primero configura tu negocio.</p>;
  if (current.service !== "residence") {
    return <p className="text-muted-foreground">Mantenimiento es de un negocio de Residencia.</p>;
  }
  const data = await listTasks(current.id, "maintenance");
  if (!data) return <p className="text-muted-foreground">No encontramos tu negocio. Recarga la página.</p>;
  return <TaskBoard businessId={current.id} kind="maintenance" today={limaToday(new Date())} {...data} />;
}

// Mantenimiento preventivo (MT-04): revisiones que se repiten (extintores, tanque, ascensor).
export default function PreventivePage() {
  return (
    <>
      <h1 className="text-[34px] font-bold tracking-tight">Mantenimiento</h1>
      <SectionTabs tabs={MAINTENANCE_TABS} current="preventivo" label="Secciones de mantenimiento" />
      <Suspense fallback={<ListSkeleton />}>
        <Content />
      </Suspense>
    </>
  );
}
