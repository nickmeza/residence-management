import type { Metadata } from "next";
import { Suspense } from "react";

import { ContractList } from "@/components/contracts/contract-list";
import { isUuid } from "@/server/business/queries";
import { getShellData } from "@/server/business/current";
import { getContractFormOptions, listContracts } from "@/server/contracts/queries";

export const metadata: Metadata = { title: "Contratos · Gestión de residencias" };

// Contratos, versión simple (decisión del dueño): título y la tabla.
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
  return (
    <>
      <h1 className="text-[34px] font-bold tracking-tight">Contratos</h1>
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
