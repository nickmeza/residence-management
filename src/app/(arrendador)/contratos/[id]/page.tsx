import { ArrowLeft, FileDown } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { ContractActions } from "@/components/contracts/contract-actions";
import { ContractPhaseBadge } from "@/components/residents/badges";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { formatSoles } from "@/lib/format";
import { formatLongDate } from "@/server/contracts/dates";
import { getContract, getContractFormOptions } from "@/server/contracts/queries";
import { confirmedLabel } from "@/server/contracts/rules";
import { PAPERWORK_HINT, PAPERWORK_LABEL } from "@/server/contracts/schemas";

export const metadata: Metadata = { title: "Contrato · Gestión de residencias" };

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-t py-2.5 text-sm first:border-t-0">
      <span className="text-muted-foreground">{label}</span>
      <b className="text-right">{value}</b>
    </div>
  );
}

async function Content({ params }: { params: PageProps<"/contratos/[id]">["params"] }) {
  const { id } = await params;
  const c = await getContract(id);
  if (!c) notFound();
  const options = await getContractFormOptions(c.businessId);
  if (!options) notFound();
  const showConfirmed = c.status === "confirmed";

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {c.businessName} › Contratos › <b className="text-foreground">{c.residentName}</b>
        </p>
        <Link href="/contratos" className={buttonVariants({ variant: "outline", className: "h-11 gap-2" })}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver a contratos
        </Link>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[34px] font-bold tracking-tight">Contrato de {c.residentName}</h1>
          <ContractPhaseBadge phase={c.phase} />
          {showConfirmed ? <StatusBadge tone="neutral">{confirmedLabel(c.paperwork)}</StatusBadge> : null}
        </div>
        <p className="text-muted-foreground">
          {c.propertyName} · {c.unitName}
        </p>
      </div>

      <ContractActions c={c} options={options} />

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-5 shadow-card sm:p-6">
          <h2 className="mb-3 text-lg font-bold">Condiciones</h2>
          <Row
            label="Residente"
            value={
              <Link href={`/residentes/${c.residentId}`} className="text-link hover:underline">
                {c.residentName}
              </Link>
            }
          />
          <Row label="Unidad" value={c.unitName} />
          <Row label="Renta" value={`${formatSoles(c.monthlyRent)} al mes`} />
          <Row
            label="Pago"
            value={c.paymentDay === 31 ? "Último día de cada mes" : `Día ${c.paymentDay} de cada mes`}
          />
          <Row label="Desde" value={formatLongDate(c.startDate)} />
          <Row label="Hasta" value={c.endDate ? formatLongDate(c.endDate) : "Sin fecha de fin (mes a mes)"} />
        </section>
        <div className="flex min-w-0 flex-col gap-5">
          <section className="rounded-xl border bg-card p-5 shadow-card sm:p-6">
            <h2 className="mb-3 text-lg font-bold">Modalidad</h2>
            <p className="font-semibold">{PAPERWORK_LABEL[c.paperwork]}</p>
            <p className="text-sm text-muted-foreground">{PAPERWORK_HINT[c.paperwork]}</p>
            {c.templateName ? <p className="mt-2 text-sm">Plantilla: {c.templateName}</p> : null}
            {c.paperwork === "template" && c.status !== "cancelled" ? (
              <a
                href={`/contratos/${c.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "outline", className: "mt-3 h-11 gap-2" })}
              >
                <FileDown className="size-4" aria-hidden="true" />
                Descargar PDF para imprimir
              </a>
            ) : null}
            {c.status === "pending_signature" ? (
              <p className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
                Falta subir la copia firmada. Esto llega con los documentos, en la siguiente parte.
              </p>
            ) : null}
          </section>
          {c.renewedFrom || c.renewedTo ? (
            <section className="rounded-xl border bg-card p-5 shadow-card sm:p-6">
              <h2 className="mb-3 text-lg font-bold">Historial</h2>
              {c.renewedFrom ? (
                <Row
                  label="Reemplaza al contrato"
                  value={
                    <Link href={`/contratos/${c.renewedFrom.id}`} className="text-link hover:underline">
                      del {formatLongDate(c.renewedFrom.startDate)}
                    </Link>
                  }
                />
              ) : null}
              {c.renewedTo ? (
                <Row
                  label="Lo reemplaza el contrato"
                  value={
                    <Link href={`/contratos/${c.renewedTo.id}`} className="text-link hover:underline">
                      del {formatLongDate(c.renewedTo.startDate)}
                    </Link>
                  }
                />
              ) : null}
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}

export default function ContractPage({ params }: PageProps<"/contratos/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
      <Content params={params} />
    </Suspense>
  );
}
