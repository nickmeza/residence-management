import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DepositBadge } from "@/components/deposits/deposit-badge";
import { SettlementPanel } from "@/components/deposits/settlement-panel";
import { ContractPhaseBadge } from "@/components/residents/badges";
import { buttonVariants } from "@/components/ui/button";
import { formatSoles } from "@/lib/format";
import { formatLongDate } from "@/server/contracts/dates";
import { getDepositDetail } from "@/server/deposits/queries";
import { DEPOSIT_RULE_LABEL } from "@/server/deposits/rules";

export const metadata: Metadata = { title: "Liquidar garantía · Gestión de residencias" };

async function Content({ params }: { params: PageProps<"/garantias/[id]">["params"] }) {
  const { id } = await params;
  const d = await getDepositDetail(id);
  if (!d) notFound();

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            {d.tradeName} ›{" "}
            <Link href="/garantias" className="hover:underline">
              Garantías
            </Link>{" "}
            ›{" "}
            <b className="text-foreground">
              {d.residentName} · {d.unitName}
            </b>
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[34px] font-bold tracking-tight">Garantía</h1>
            <DepositBadge phase={d.phase} />
          </div>
          <p className="text-muted-foreground">
            {d.phase === "none" ? "Sin garantía" : `${formatSoles(d.amount)} · ${DEPOSIT_RULE_LABEL[d.rule]}`}{" "}
            · Contrato del {formatLongDate(d.startDate)}
            {d.endDate ? ` al ${formatLongDate(d.endDate)}` : " (mes a mes)"}{" "}
            <ContractPhaseBadge phase={d.contractPhase} />
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/contratos/${d.contractId}`}
            className={buttonVariants({ variant: "outline", className: "h-11" })}
          >
            Ver contrato
          </Link>
          <Link href="/garantias" className={buttonVariants({ variant: "outline", className: "h-11" })}>
            ← Volver a garantías
          </Link>
        </div>
      </div>
      {d.phase === "unpaid" ? (
        <p className="rounded-lg bg-warn-soft px-3 py-2.5 text-sm text-warn">
          La garantía todavía no está pagada: está en el recibo del residente, en Cobros.
        </p>
      ) : null}
      <SettlementPanel detail={d} />
    </>
  );
}

export default function DepositPage({ params }: PageProps<"/garantias/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
      <Content params={params} />
    </Suspense>
  );
}
