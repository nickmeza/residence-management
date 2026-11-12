import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ContractPhaseBadge } from "@/components/residents/badges";
import { buttonVariants } from "@/components/ui/button";
import { formatSoles } from "@/lib/format";
import { greetingFor } from "@/lib/greeting";
import { getMyResidences, type MyResidence } from "@/server/residents/self";

export const metadata: Metadata = { title: "Inicio · Mi residencia" };

// "Te faltan 2 documentos", "Lo están revisando" o "Todo listo" (siempre con texto, no solo color).
function DocumentsBanner({ r }: { r: MyResidence }) {
  if (!r.contract) return null;
  const inReview = r.requirements.filter((q) => q.latest?.status === "in_review").length;
  const [tone, text] =
    r.missing > 0
      ? [
          "bg-warn-soft text-warn",
          r.missing === 1 ? "Te falta 1 documento. Súbelo →" : `Te faltan ${r.missing} documentos. Súbelos →`,
        ]
      : inReview > 0
        ? ["bg-primary-soft text-primary-text", "Tu residencia está revisando tus documentos."]
        : ["bg-ok-soft text-ok", "Todo listo. No te falta ningún documento."];
  return (
    <Link href="/mi/documentos" className={`rounded-lg px-3 py-2.5 text-sm font-semibold ${tone}`}>
      {text}
    </Link>
  );
}

async function Content() {
  const { firstName, residences } = await getMyResidences();
  return (
    <>
      <h1 className="text-2xl font-bold">
        <span className="font-script text-[40px] leading-tight font-normal text-primary">
          {greetingFor(new Date())}
        </span>
        {firstName ? `, ${firstName}` : ""}
      </h1>
      {residences.length ? (
        residences.map((r) => (
          <section
            key={r.residentId}
            className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold">{r.businessName}</h2>
              <ContractPhaseBadge phase={r.contract?.phase ?? null} />
            </div>
            {r.contract ? (
              <p className="text-muted-foreground">
                {r.contract.propertyName} · {r.contract.unitName} · {formatSoles(r.contract.monthlyRent)} al
                mes
              </p>
            ) : (
              <p className="text-muted-foreground">
                Tu residencia todavía no te asignó una unidad. Cuando lo haga, aquí verás tu contrato y lo que
                te pide.
              </p>
            )}
            <DocumentsBanner r={r} />
            {r.contract ? (
              <Link href="/mi/contrato" className={buttonVariants({ variant: "outline", className: "h-11" })}>
                Ver mi contrato
              </Link>
            ) : null}
          </section>
        ))
      ) : (
        <p className="text-muted-foreground">
          Tu cuenta todavía no está en ninguna residencia. Si te invitaron, entra desde el enlace que te
          mandaron.
        </p>
      )}
    </>
  );
}

export default function ResidentHomePage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
      <Content />
    </Suspense>
  );
}
