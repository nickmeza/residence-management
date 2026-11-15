import type { Metadata } from "next";
import { Suspense } from "react";

import { ApplicationLinkCard } from "@/components/applications/application-link-card";
import { ApplicationList } from "@/components/applications/application-list";
import { listApplications } from "@/server/applications/queries";
import { getShellData } from "@/server/business/current";

export const metadata: Metadata = { title: "Postulantes · Gestión de residencias" };

async function Content() {
  const { current } = await getShellData();
  if (!current) return <p className="text-muted-foreground">Primero configura tu negocio.</p>;
  if (current.service !== "residence") {
    return <p className="text-muted-foreground">Postulantes es de un negocio de Residencia.</p>;
  }
  const view = await listApplications(current.id);
  if (!view) return <p className="text-muted-foreground">No encontramos tu negocio. Recarga la página.</p>;
  return (
    <>
      <ApplicationLinkCard businessId={current.id} accepting={view.accepting} />
      <ApplicationList rows={view.rows} now={new Date()} />
    </>
  );
}

// Postulantes (RS-04, RS-05): el enlace público para postular y las postulaciones recibidas.
export default function ApplicationsPage() {
  return (
    <>
      <h1 className="text-[34px] font-bold tracking-tight">Postulantes</h1>
      <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
        <Content />
      </Suspense>
    </>
  );
}
