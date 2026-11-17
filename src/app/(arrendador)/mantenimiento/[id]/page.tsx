import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { CommentThread } from "@/components/maintenance/comment-thread";
import { MaintenanceStatusBadge, PriorityBadge } from "@/components/maintenance/maintenance-badges";
import { RequestEditor } from "@/components/maintenance/request-editor";
import { formatSoles } from "@/lib/format";
import { getRequest } from "@/server/maintenance/queries";
import { CATEGORY_LABEL } from "@/server/maintenance/rules";
import { getSupplierOptions } from "@/server/tasks/queries";

export const metadata: Metadata = { title: "Pedido de mantenimiento · Gestión de residencias" };

const card = "flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-card";

const dateTime = new Intl.DateTimeFormat("es-PE", {
  day: "numeric",
  month: "long",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Lima",
});

function Row({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">{name}</span>
      <span>{children}</span>
    </div>
  );
}

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await getRequest(id);
  if (!r) notFound();
  const suppliers = await getSupplierOptions(r.businessId);
  const now = new Date();
  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          <Link href="/mantenimiento" className="hover:underline">
            Mantenimiento
          </Link>{" "}
          › <b className="text-foreground">Pedido</b>
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[28px] font-bold tracking-tight">{r.title}</h1>
          <MaintenanceStatusBadge status={r.status} />
          <PriorityBadge priority={r.priority} />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-6">
          <section className={card} aria-labelledby="detalle">
            <h2 id="detalle" className="text-lg font-bold">
              Detalle
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Row name="Dónde">{r.unitName ?? "Área común"}</Row>
              <Row name="Tipo">{CATEGORY_LABEL[r.category]}</Row>
              <Row name="Lo pidió">
                {r.residentId ? (
                  <Link
                    href={`/residentes/${r.residentId}`}
                    className="font-semibold text-link hover:underline"
                  >
                    {r.residentName}
                  </Link>
                ) : (
                  r.reportedByName
                )}
              </Row>
              <Row name="Fecha">{dateTime.format(r.createdAt)}</Row>
              {r.resolvedAt ? <Row name="Cerrado">{dateTime.format(r.resolvedAt)}</Row> : null}
              {r.cost ? <Row name="Costo">{formatSoles(r.cost)}</Row> : null}
            </div>
            {r.description ? <p className="whitespace-pre-line">{r.description}</p> : null}
            {r.hasPhoto ? (
              <a
                href={`/archivos/mantenimiento/${r.id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center gap-1.5 self-start font-semibold text-link underline-offset-4 hover:underline"
              >
                Ver foto
                <ExternalLink className="size-4" aria-hidden="true" />
              </a>
            ) : null}
          </section>
          <section className={card} aria-labelledby="mensajes">
            <h2 id="mensajes" className="text-lg font-bold">
              Mensajes
            </h2>
            {r.residentId ? null : (
              <p className="text-sm text-muted-foreground">
                Este pedido lo registraste tú: los mensajes son notas para ti.
              </p>
            )}
            <CommentThread
              requestId={r.id}
              comments={r.commentList}
              now={now}
              closed={r.status === "done" || r.status === "cancelled"}
            />
          </section>
        </div>
        <section className={`${card} self-start`} aria-labelledby="seguimiento">
          <h2 id="seguimiento" className="text-lg font-bold">
            Seguimiento
          </h2>
          <RequestEditor r={r} suppliers={suppliers} />
        </section>
      </div>
    </>
  );
}

// Detalle de un pedido (MT-03): datos, foto, mensajes con el residente y seguimiento.
export default function MaintenanceRequestPage({ params }: PageProps<"/mantenimiento/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
      <Content params={params} />
    </Suspense>
  );
}
