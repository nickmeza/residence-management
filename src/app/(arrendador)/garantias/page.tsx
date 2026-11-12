import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { DepositList } from "@/components/deposits/deposit-list";
import { buttonVariants } from "@/components/ui/button";
import { formatSoles } from "@/lib/format";
import { getShellData } from "@/server/business/current";
import { listDeposits } from "@/server/deposits/queries";

export const metadata: Metadata = { title: "Garantías · Gestión de residencias" };

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border bg-card px-5 py-4 shadow-card">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-[28px] font-bold">{value}</div>
      <div className="text-sm text-muted-foreground">{note}</div>
    </div>
  );
}

async function Content() {
  const { current } = await getShellData();
  if (!current) return <p className="text-muted-foreground">Primero configura tu negocio.</p>;
  const view = await listDeposits(current.id);
  if (!view) return <p className="text-muted-foreground">No encontramos tu negocio. Recarga la página.</p>;
  const { stats } = view;
  const people = (n: number) => `${n} ${n === 1 ? "residente" : "residentes"}`;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            {view.tradeName} › <b className="text-foreground">Garantías</b>
          </p>
          <h1 className="text-[34px] font-bold tracking-tight">Garantías</h1>
          <p className="text-muted-foreground">Todo el dinero que tienes retenido y lo que falta liquidar.</p>
        </div>
        <Link
          href={`/negocio/${current.id}/garantia`}
          className={buttonVariants({ variant: "outline", className: "h-11" })}
        >
          Configurar garantía
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Retenido hoy" value={formatSoles(stats.held) ?? "S/ 0"} note={people(stats.heldCount)} />
        <Stat
          label="Por liquidar"
          value={String(stats.toSettle)}
          note="Contratos que terminan pronto o ya terminaron"
        />
        <Stat
          label="Devuelto este mes"
          value={formatSoles(stats.returnedThisMonth) ?? "S/ 0"}
          note={people(stats.returnedCount)}
        />
      </div>
      <DepositList rows={view.rows} />
      <p className="text-sm text-muted-foreground">
        Al liquidar, el residente ve el detalle en su vista “Mi garantía” y puede aceptarlo o disputar un
        descuento.
      </p>
    </>
  );
}

export default function DepositsPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
      <Content />
    </Suspense>
  );
}
