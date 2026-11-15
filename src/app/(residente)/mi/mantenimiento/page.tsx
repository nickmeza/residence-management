import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { CommentThread } from "@/components/maintenance/comment-thread";
import { MaintenanceStatusBadge } from "@/components/maintenance/maintenance-badges";
import { MyRequestForm } from "@/components/maintenance/my-request-form";
import { StatusBadge } from "@/components/status-badge";
import { formatTimeAgo } from "@/lib/format";
import { listMyRequests } from "@/server/maintenance/queries";
import { CATEGORY_LABEL, isActive } from "@/server/maintenance/rules";
import { getMyResidences } from "@/server/residents/self";

export const metadata: Metadata = { title: "Mantenimiento · Mi residencia" };

const card = "flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-card";

async function Content() {
  const [{ residences }, requests] = await Promise.all([getMyResidences(), listMyRequests()]);
  const places = residences
    .filter((r) => r.contract)
    .map((r) => ({
      residentId: r.residentId,
      businessId: r.businessId,
      contractId: r.contract!.id,
      label: `${r.businessName} · ${r.contract!.unitName}`,
    }));
  const now = new Date();
  return (
    <>
      <section className={card} aria-labelledby="pedir">
        <h2 id="pedir" className="text-lg font-bold">
          Pedir mantenimiento
        </h2>
        {places.length ? (
          <MyRequestForm places={places} />
        ) : (
          <p className="text-muted-foreground">
            Cuando tu residencia te asigne una unidad, desde aquí podrás pedir que arreglen algo.
          </p>
        )}
      </section>
      <section className="flex flex-col gap-3" aria-labelledby="mis-pedidos">
        <h2 id="mis-pedidos" className="text-lg font-bold">
          Mis pedidos
        </h2>
        {requests.length ? (
          requests.map((r) => (
            <article key={r.id} className={card}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <h3 className="font-bold">{r.title}</h3>
                  <span className="text-xs text-muted-foreground">
                    {CATEGORY_LABEL[r.category]} · {formatTimeAgo(r.createdAt, now)}
                  </span>
                </div>
                <div className="flex gap-2">
                  {r.priority === "urgent" && isActive(r.status) ? (
                    <StatusBadge tone="danger">Urgente</StatusBadge>
                  ) : null}
                  <MaintenanceStatusBadge status={r.status} />
                </div>
              </div>
              {r.description ? <p className="text-sm whitespace-pre-line">{r.description}</p> : null}
              {r.hasPhoto ? (
                <a
                  href={`/archivos/mantenimiento/${r.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-link underline-offset-4 hover:underline"
                >
                  Ver foto
                  <ExternalLink className="size-4" aria-hidden="true" />
                </a>
              ) : null}
              <CommentThread requestId={r.id} comments={r.comments} now={now} closed={!isActive(r.status)} />
            </article>
          ))
        ) : (
          <p className="rounded-xl border bg-card p-5 text-muted-foreground shadow-card">
            Todavía no pediste nada. Tus pedidos y sus respuestas aparecerán aquí.
          </p>
        )}
      </section>
    </>
  );
}

// Mantenimiento del residente (MT-01, MT-07): pedir un arreglo con foto y seguir sus pedidos.
export default function MyMaintenancePage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Mantenimiento</h1>
      <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
        <Content />
      </Suspense>
    </>
  );
}
