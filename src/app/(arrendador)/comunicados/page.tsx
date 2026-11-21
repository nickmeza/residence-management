import type { Metadata } from "next";
import { Suspense } from "react";

import { AnnouncementForm } from "@/components/announcements/announcement-form";
import { ListSkeleton } from "@/components/skeletons";
import { StatusBadge } from "@/components/status-badge";
import { formatTimeAgo } from "@/lib/format";
import { getAnnouncements } from "@/server/announcements/queries";
import { getShellData } from "@/server/business/current";

export const metadata: Metadata = { title: "Comunicados · Gestión de residencias" };

const card = "flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-card";

async function Content() {
  const { current } = await getShellData();
  if (!current) return <p className="text-muted-foreground">Primero configura tu negocio.</p>;
  const view = await getAnnouncements(current.id);
  if (!view) return <p className="text-muted-foreground">No encontramos tu negocio. Recarga la página.</p>;
  const now = new Date();
  return (
    <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
      <section className={`${card} self-start`} aria-labelledby="nuevo">
        <h2 id="nuevo" className="text-lg font-bold">
          Nuevo comunicado
        </h2>
        <AnnouncementForm businessId={current.id} options={view.options} />
      </section>
      <section className="flex flex-col gap-3" aria-labelledby="enviados">
        <h2 id="enviados" className="text-lg font-bold">
          Enviados
        </h2>
        {view.rows.length ? (
          <ul className="flex flex-col gap-3">
            {view.rows.map((a) => (
              <li key={a.id} className={card}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-col gap-0.5">
                    <h3 className="font-bold">{a.title}</h3>
                    <span className="text-xs text-muted-foreground">
                      Para: {a.audienceLabel} · Le llegó a {a.recipients}{" "}
                      {a.recipients === 1 ? "persona" : "personas"} · {formatTimeAgo(a.createdAt, now)}
                    </span>
                  </div>
                  {a.urgent ? <StatusBadge tone="danger">Urgente</StatusBadge> : null}
                </div>
                <p className="text-sm whitespace-pre-line">{a.body}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border bg-card p-5 text-muted-foreground shadow-card">
            Todavía no enviaste comunicados. Úsalos para avisar cortes de agua, limpiezas, reuniones o cambios
            de horario.
          </p>
        )}
      </section>
    </div>
  );
}

// Comunicados (CM-01): escribir un aviso para todos, un edificio, un piso o una persona, y ver lo enviado.
export default function AnnouncementsPage() {
  return (
    <>
      <h1 className="text-[34px] font-bold tracking-tight">Comunicados</h1>
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <Content />
      </Suspense>
    </>
  );
}
