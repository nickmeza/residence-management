import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { ApplicationBadge } from "@/components/applications/application-badge";
import { ApplicationReview } from "@/components/applications/application-review";
import { DetailSkeleton } from "@/components/skeletons";
import { buttonVariants } from "@/components/ui/button";
import { formatLongDate, formatSoles } from "@/lib/format";
import { getApplication, getUnitSuggestion } from "@/server/applications/queries";
import type { UnitSuggestion } from "@/server/applications/rules";

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

// Cuánto se aleja el precio de su presupuesto, en palabras.
function differenceText(s: UnitSuggestion): string {
  if (s.differenceCents === null) return "No dio presupuesto: es la más barata de las libres.";
  if (s.differenceCents === 0) return "Justo su presupuesto.";
  const amount = formatSoles(Math.abs(s.differenceCents) / 100);
  return s.differenceCents < 0 ? `${amount} menos que su presupuesto.` : `${amount} más que su presupuesto.`;
}

// Cuarto sugerido: el libre de lo que busca con el precio más cercano a su presupuesto. Ya aprobado, se puede crear
// el contrato con ese cuarto elegido.
function SuggestionCard({
  s,
  residentId,
  unitType,
}: {
  s: UnitSuggestion | null;
  residentId: string | null;
  unitType: string;
}) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-card">
      <h2 className="text-lg font-bold">Cuarto sugerido</h2>
      {s ? (
        <>
          <p className="text-lg font-semibold">
            {s.label} · {formatSoles(s.monthlyPrice)} al mes
          </p>
          <p className="text-muted-foreground">{differenceText(s)}</p>
          {residentId ? (
            <Link
              href={`/contratos/nuevo?residente=${residentId}&unidad=${s.id}`}
              className={buttonVariants({ variant: "outline", className: "h-11 self-start" })}
            >
              Crear contrato con este cuarto
            </Link>
          ) : null}
        </>
      ) : (
        <p className="text-muted-foreground">No hay {unitType} libres con precio por ahora.</p>
      )}
    </section>
  );
}

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await getApplication(id);
  if (!a) notFound();
  const suggestion = a.status === "rejected" ? null : await getUnitSuggestion(a);
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
      {a.status === "rejected" ? null : (
        <SuggestionCard
          s={suggestion}
          residentId={a.residentId}
          unitType={
            a.unitType === "room" ? "cuartos" : a.unitType === "apartment" ? "departamentos" : "unidades"
          }
        />
      )}
      <section className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-card">
        <h2 className="text-lg font-bold">Qué hacer</h2>
        {a.status === "approved" ? (
          <p className="text-muted-foreground">
            Aprobada. Sigue desde su ficha: asígnale una unidad con un contrato e invítalo a su cuenta.
          </p>
        ) : (
          <ApplicationReview
            id={a.id}
            status={a.status}
            note={a.note}
            suggestedUnitId={suggestion?.id ?? null}
          />
        )}
      </section>
    </>
  );
}

// Una postulación (RS-04): sus datos, escribirle por WhatsApp y decidir.
export default function ApplicationPage({ params }: PageProps<"/postulantes/[id]">) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <Content params={params} />
    </Suspense>
  );
}
