import { Star } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { REPORT_TABS, SectionTabs } from "@/components/section-tabs";
import { CardsSkeleton } from "@/components/skeletons";
import { StatusBadge } from "@/components/status-badge";
import { formatTimeAgo } from "@/lib/format";
import { getShellData } from "@/server/business/current";
import { getBusinessReviews } from "@/server/reviews/queries";
import { RUBRICS } from "@/server/reviews/rules";

export const metadata: Metadata = { title: "Reseñas · Gestión de residencias" };

const card = "flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-card";

const score = (n: number | null) =>
  n === null ? "—" : n.toLocaleString("es-PE", { maximumFractionDigits: 1 });

async function Content() {
  const { current } = await getShellData();
  if (!current) return <p className="text-muted-foreground">Primero configura tu negocio.</p>;
  if (current.service !== "residence") {
    return <p className="text-muted-foreground">Las reseñas son de un negocio de Residencia.</p>;
  }
  const { reviews, summary } = await getBusinessReviews(current.id);
  if (!reviews.length) {
    return (
      <section className={card}>
        <h2 className="text-lg font-bold">Todavía no tienes reseñas</h2>
        <p className="text-muted-foreground">
          Cuando termine un contrato, el residente podrá calificar su estadía desde su cuenta. Te llegará un
          aviso.
        </p>
      </section>
    );
  }
  const now = new Date();
  return (
    <>
      <section className={card} aria-labelledby="promedios">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="promedios" className="text-lg font-bold">
            Promedio por rubro
          </h2>
          <span className="text-sm text-muted-foreground">
            {summary.count === 1 ? "1 reseña" : `${summary.count} reseñas`} · {summary.recommendPercent}%
            recomienda
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {RUBRICS.map((r) => (
            <div key={r.key} className="flex flex-col gap-0.5 rounded-lg bg-muted px-3 py-2.5">
              <dt className="text-xs font-bold tracking-wide text-muted-foreground uppercase">{r.label}</dt>
              <dd className="flex items-center gap-1 text-xl font-bold">
                <Star className="size-4 fill-warn text-warn" aria-hidden="true" />
                {score(summary.averages[r.key])}
                <span className="text-xs font-normal text-muted-foreground">de 5</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="flex flex-col gap-3" aria-labelledby="lista">
        <h2 id="lista" className="text-lg font-bold">
          Lo que escribieron
        </h2>
        {reviews.map((r) => (
          <article key={r.id} className={card}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <h3 className="font-bold">{r.anonymous ? "Anónimo" : r.residentName}</h3>
                <span className="text-xs text-muted-foreground">
                  {r.unitName ? `${r.unitName} · ` : ""}
                  {formatTimeAgo(r.createdAt, now)}
                </span>
              </div>
              <StatusBadge tone={r.recommends ? "ok" : "warn"}>
                {r.recommends ? "Recomienda" : "No recomienda"}
              </StatusBadge>
            </div>
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {RUBRICS.map((k) =>
                r[k.key] === null ? null : (
                  <span key={k.key}>
                    {k.label}: <b>{r[k.key]} de 5</b>
                  </span>
                ),
              )}
            </p>
            {r.comment ? <p className="text-sm whitespace-pre-line">{r.comment}</p> : null}
          </article>
        ))}
      </section>
    </>
  );
}

// Reseñas recibidas (CR-05): promedio por rubro y lo que escribió cada residente (sin nombre si es anónima).
export default function ReviewsPage() {
  return (
    <>
      <h1 className="text-[34px] font-bold tracking-tight">Reportes</h1>
      <SectionTabs tabs={REPORT_TABS} current="resenas" label="Secciones de reportes" />
      <Suspense fallback={<CardsSkeleton />}>
        <Content />
      </Suspense>
    </>
  );
}
