import { FileDown } from "lucide-react";
import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";

import { UploadedList } from "@/components/documents/uploaded-list";
import { ContractPhaseBadge } from "@/components/residents/badges";
import { buttonVariants } from "@/components/ui/button";
import { formatSoles } from "@/lib/format";
import { formatLongDate } from "@/server/contracts/dates";
import { PAPERWORK_LABEL } from "@/server/contracts/schemas";
import { getMyResidences } from "@/server/residents/self";

export const metadata: Metadata = { title: "Mi contrato · Mi residencia" };

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-t py-2.5 text-sm first:border-t-0">
      <span className="text-muted-foreground">{label}</span>
      <b className="text-right">{value}</b>
    </div>
  );
}

async function Content() {
  const { residences } = await getMyResidences();
  const withContract = residences.filter((r) => r.contract);
  return (
    <>
      <h1 className="text-2xl font-bold">Mi contrato</h1>
      {withContract.length === 0 ? (
        <p className="text-muted-foreground">Todavía no tienes un contrato con tu residencia.</p>
      ) : null}
      {withContract.map(({ residentId, businessName, contract: c }) =>
        c ? (
          <section key={residentId} className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold">{businessName}</h2>
              <ContractPhaseBadge phase={c.phase} />
            </div>
            <div>
              <Row label="Unidad" value={`${c.propertyName} · ${c.unitName}`} />
              <Row label="Renta" value={`${formatSoles(c.monthlyRent)} al mes`} />
              <Row
                label="Pago"
                value={c.paymentDay === 31 ? "Último día de cada mes" : `Día ${c.paymentDay} de cada mes`}
              />
              <Row label="Desde" value={formatLongDate(c.startDate)} />
              <Row
                label="Hasta"
                value={c.endDate ? formatLongDate(c.endDate) : "Sin fecha de fin (mes a mes)"}
              />
              <Row label="Modalidad" value={PAPERWORK_LABEL[c.paperwork]} />
            </div>
            {c.hasTemplate ? (
              <a
                href={`/mi/contrato/${c.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "outline", className: "h-11 gap-2" })}
              >
                <FileDown className="size-4" aria-hidden="true" />
                Descargar el contrato (PDF)
              </a>
            ) : null}
            {c.signedCopies.length ? (
              <div>
                <h3 className="mb-1 font-bold">Copia firmada</h3>
                <UploadedList documents={c.signedCopies} canReview={false} />
              </div>
            ) : null}
          </section>
        ) : null,
      )}
    </>
  );
}

export default function MyContractPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
      <Content />
    </Suspense>
  );
}
