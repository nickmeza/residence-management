import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { ApplicationBadge } from "@/components/applications/application-badge";
import { ApplicationReview } from "@/components/applications/application-review";
import { formatLongDate, formatSoles } from "@/lib/format";
import { getApplication } from "@/server/applications/queries";

export const metadata: Metadata = { title: "Postulación · Gestión de residencias" };

const TYPE = { room: "Un cuarto", apartment: "Un departamento" } as const;

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
  const a = await getApplication(id);
  if (!a) notFound();
  const phoneDigits = a.phone.replace(/\D/g, "");
  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          <Link href="/postulantes" className="hover:underline">
            Postulantes
          </Link>{" "}
          › <b className="text-foreground">Postulación</b>
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[28px] font-bold tracking-tight">{a.fullName}</h1>
          <ApplicationBadge status={a.status} />
        </div>
      </div>
      <section className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-card">
        <div className="grid gap-4 sm:grid-cols-3">
          <Row name="Celular">
            <a
              href={`https://wa.me/${phoneDigits.length === 9 ? `51${phoneDigits}` : phoneDigits}`}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-link hover:underline"
            >
              {a.phone} (WhatsApp)
            </a>
          </Row>
          <Row name="Correo">{a.email ?? "—"}</Row>
          <Row name="Busca">{a.unitType ? TYPE[a.unitType] : "Cualquiera"}</Row>
          <Row name="Desde">{a.moveInDate ? formatLongDate(a.moveInDate) : "—"}</Row>
          <Row name="Por">{a.months ? `${a.months} ${a.months === 1 ? "mes" : "meses"}` : "—"}</Row>
          <Row name="Presupuesto">{a.budget ? `${formatSoles(a.budget)} al mes` : "—"}</Row>
          <Row name="Qué lo trae">{a.occupation ?? "—"}</Row>
        </div>
        {a.message ? <p className="whitespace-pre-line">{a.message}</p> : null}
        {a.residentId ? (
          <Link
            href={`/residentes/${a.residentId}`}
            className="self-start font-semibold text-link hover:underline"
          >
            Ver su ficha de residente
          </Link>
        ) : null}
      </section>
      <section className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-card">
        <h2 className="text-lg font-bold">Qué hacer</h2>
        {a.status === "approved" ? (
          <p className="text-muted-foreground">
            Aprobada. Sigue desde su ficha: asígnale una unidad con un contrato e invítalo a su cuenta.
          </p>
        ) : (
          <ApplicationReview id={a.id} status={a.status} note={a.note} />
        )}
      </section>
    </>
  );
}

// Una postulación (RS-04): sus datos, escribirle por WhatsApp y decidir.
export default function ApplicationPage({ params }: PageProps<"/postulantes/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
      <Content params={params} />
    </Suspense>
  );
}
