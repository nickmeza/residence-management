import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { CollectionsBoard } from "@/components/payments/collections-board";
import { buttonVariants } from "@/components/ui/button";
import { formatSoles } from "@/lib/format";
import { getShellData } from "@/server/business/current";
import { limaToday } from "@/server/contracts/dates";
import { getCollections } from "@/server/payments/queries";
import { nextPeriod, periodLabel } from "@/server/payments/rules";

export const metadata: Metadata = { title: "Cobros · Gestión de residencias" };

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border bg-card px-5 py-4 shadow-card">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-[28px] font-bold">{value}</div>
      <div className="text-sm text-muted-foreground">{note}</div>
    </div>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/cobros">["searchParams"] }) {
  const { current } = await getShellData();
  if (!current) return <p className="text-muted-foreground">Primero configura tu negocio para cobrar.</p>;
  const params = await searchParams;
  const view = await getCollections(current.id, typeof params.mes === "string" ? params.mes : undefined);
  if (!view) return <p className="text-muted-foreground">No encontramos tu negocio. Recarga la página.</p>;
  const { stats } = view;
  const percent =
    Number(stats.total) > 0 ? Math.round((Number(stats.collected) / Number(stats.total)) * 100) : 0;
  const monthLink = (months: number) => `/cobros?mes=${nextPeriod(view.period, months)}`;

  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          {view.tradeName} › <b className="text-foreground">Cobros</b>
        </p>
        <h1 className="text-[34px] font-bold tracking-tight">Cobros y morosidad</h1>
        <p className="text-muted-foreground">Lo cobrado este mes, lo que falta y quién se atrasó.</p>
      </div>

      <nav aria-label="Mes" className="flex flex-wrap items-center gap-2">
        <Link
          href={monthLink(-1)}
          className={buttonVariants({ variant: "outline", className: "h-11 gap-1" })}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Mes anterior
        </Link>
        <b className="min-w-40 text-center text-lg first-letter:uppercase">{periodLabel(view.period)}</b>
        <Link href={monthLink(1)} className={buttonVariants({ variant: "outline", className: "h-11 gap-1" })}>
          Mes siguiente
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
        {view.period !== view.currentPeriod ? (
          <Link href="/cobros" className="px-2 text-sm text-link underline-offset-4 hover:underline">
            Volver a este mes
          </Link>
        ) : null}
      </nav>

      <section className="rounded-xl border bg-card px-5 py-5 shadow-card sm:px-6">
        <div className="mb-3 flex flex-wrap justify-between gap-3">
          <b>
            {formatSoles(stats.collected)} cobrados de {formatSoles(stats.total)}
          </b>
          <span className="text-sm text-muted-foreground">{percent}%</span>
        </div>
        <div
          className="h-2.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Cobrado del mes"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Cobrado"
          value={formatSoles(stats.collected) ?? "S/ 0"}
          note={`${view.receipts.filter((r) => r.status === "paid").length} pagados`}
        />
        <Stat label="Pendiente" value={formatSoles(stats.pending) ?? "S/ 0"} note="Todavía no vence" />
        <Stat
          label="Vencido"
          value={formatSoles(stats.overdue) ?? "S/ 0"}
          note={`${stats.overdueResidents} ${stats.overdueResidents === 1 ? "residente" : "residentes"}`}
        />
      </div>

      <CollectionsBoard view={view} today={limaToday(new Date())} />
    </>
  );
}

export default function CollectionsPage({ searchParams }: PageProps<"/cobros">) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
