import type { Metadata } from "next";
import { Suspense } from "react";

import { ContractList } from "@/components/contracts/contract-list";
import { isUuid } from "@/server/business/queries";
import { getShellData } from "@/server/business/current";
import { getContractFormOptions, listContracts } from "@/server/contracts/queries";

export const metadata: Metadata = { title: "Contratos · Gestión de residencias" };

function Stat({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="rounded-xl border bg-card px-5 py-4 shadow-card">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-[28px] font-bold">{value}</div>
      <div className="text-sm text-muted-foreground">{note}</div>
    </div>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/contratos">["searchParams"] }) {
  const { current } = await getShellData();
  if (!current) {
    return <p className="text-muted-foreground">Primero configura tu negocio para crear contratos.</p>;
  }
  const [rows, options, params] = await Promise.all([
    listContracts(current.id),
    getContractFormOptions(current.id),
    searchParams,
  ]);
  if (!options) return <p className="text-muted-foreground">No encontramos tu negocio. Recarga la página.</p>;
  const residentParam =
    typeof params.residente === "string" && isUuid(params.residente) ? params.residente : undefined;
  const count = (...phases: string[]) => rows.filter((r) => phases.includes(r.phase)).length;

  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          {current.tradeName} › <b className="text-foreground">Contratos</b>
        </p>
        <h1 className="text-[34px] font-bold tracking-tight">Contratos</h1>
        <p className="text-muted-foreground">Quién alquila qué, quién está por vencer y qué falta cerrar.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Vigentes" value={count("active", "ending_soon")} note={`De ${rows.length} contratos`} />
        <Stat label="Por vencer" value={count("ending_soon")} note="En los próximos 30 días" />
        <Stat
          label="Por cerrar"
          value={count("draft", "pending_signature")}
          note="Borradores y pendientes de firma"
        />
      </div>
      <ContractList rows={rows} options={options} initialResidentId={residentParam} />
    </>
  );
}

export default function ContractsPage({ searchParams }: PageProps<"/contratos">) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Cargando contratos…</p>}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
