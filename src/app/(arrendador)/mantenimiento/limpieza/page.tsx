import type { Metadata } from "next";
import { Suspense } from "react";

import { CleaningBoard } from "@/components/cleaning/cleaning-board";
import { MAINTENANCE_TABS, SectionTabs } from "@/components/section-tabs";
import { TaskBoard } from "@/components/tasks/task-board";
import { getShellData } from "@/server/business/current";
import { getCleaningBoard } from "@/server/cleaning/queries";
import { limaToday } from "@/server/contracts/dates";
import { listTasks } from "@/server/tasks/queries";

export const metadata: Metadata = { title: "Limpieza · Gestión de residencias" };

async function Content() {
  const { current } = await getShellData();
  if (!current) return <p className="text-muted-foreground">Primero configura tu negocio.</p>;
  if (current.service !== "residence") {
    return <p className="text-muted-foreground">La limpieza es de un negocio de Residencia.</p>;
  }
  const [board, tasks] = await Promise.all([getCleaningBoard(current.id), listTasks(current.id, "cleaning")]);
  if (!board || !tasks)
    return <p className="text-muted-foreground">No encontramos tu negocio. Recarga la página.</p>;
  const today = limaToday(new Date());
  return (
    <>
      <section className="flex flex-col gap-3" aria-labelledby="areas-comunes">
        <div className="flex flex-col gap-1">
          <h2 id="areas-comunes" className="text-lg font-bold">
            Áreas comunes
          </h2>
          <p className="text-sm text-muted-foreground">
            Tu calendario de limpieza: pasillos, escaleras, cocina común… Cada tarea se repite sola.
          </p>
        </div>
        <TaskBoard businessId={current.id} kind="cleaning" today={today} {...tasks} />
      </section>
      <CleaningBoard
        businessId={current.id}
        acceptsRequests={board.acceptsRequests}
        requests={board.requests}
        units={board.units}
        today={today}
        now={new Date()}
      />
    </>
  );
}

// Limpieza (MT-05): áreas comunes con su calendario, pedidos de los residentes y el estado de cada unidad.
export default function CleaningPage() {
  return (
    <>
      <h1 className="text-[34px] font-bold tracking-tight">Mantenimiento</h1>
      <SectionTabs tabs={MAINTENANCE_TABS} current="limpieza" label="Secciones de mantenimiento" />
      <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
        <Content />
      </Suspense>
    </>
  );
}
