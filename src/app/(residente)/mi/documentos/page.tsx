import type { Metadata } from "next";
import { Suspense } from "react";

import { RequirementCard } from "@/components/resident-side/requirement-card";
import { getMyResidences } from "@/server/residents/self";

export const metadata: Metadata = { title: "Mis documentos · Mi residencia" };

async function Content() {
  const { residences } = await getMyResidences();
  return (
    <>
      <h1 className="text-2xl font-bold">Mis documentos</h1>
      {residences.length === 0 ? (
        <p className="text-muted-foreground">Tu cuenta todavía no está en ninguna residencia.</p>
      ) : null}
      {residences.map((r) => (
        <div key={r.residentId} className="flex flex-col gap-3">
          {residences.length > 1 ? <h2 className="text-lg font-bold">{r.businessName}</h2> : null}
          {!r.contract ? (
            <p className="text-muted-foreground">
              Cuando {r.businessName} te asigne una unidad, aquí verás qué documentos te pide.
            </p>
          ) : r.requirements.length ? (
            <>
              <p className="text-sm text-muted-foreground">
                Esto es lo que te pide {r.businessName} para confirmar tu contrato.
              </p>
              {r.requirements.map((q) => (
                <RequirementCard key={q.id} residence={r} requirement={q} />
              ))}
            </>
          ) : (
            <p className="rounded-lg bg-ok-soft px-3 py-2.5 text-sm font-semibold text-ok">
              {r.businessName} no te pide documentos.
            </p>
          )}
        </div>
      ))}
    </>
  );
}

export default function MyDocumentsPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
      <Content />
    </Suspense>
  );
}
