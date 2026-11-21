import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ContractList } from "@/components/contracts/contract-list";
import { ListSkeleton } from "@/components/skeletons";
import { getShellData } from "@/server/business/current";
import { listContracts } from "@/server/contracts/queries";

export const metadata: Metadata = { title: "Contratos · Gestión de residencias" };

// Contratos, versión simple (decisión del dueño): título y la tabla.
async function Content({ searchParams }: { searchParams: PageProps<"/contratos">["searchParams"] }) {
  const { current } = await getShellData();
  if (!current) {
    return <p className="text-muted-foreground">Primero configura tu negocio para crear contratos.</p>;
  }
  // Enlaces viejos (?residente=…&unidad=…) siguen funcionando: van a la página de Nuevo contrato.
  const params = await searchParams;
  if (typeof params.residente === "string") {
    const next = new URLSearchParams({ residente: params.residente });
    if (typeof params.unidad === "string") next.set("unidad", params.unidad);
    redirect(`/contratos/nuevo?${next}`);
  }
  const rows = await listContracts(current.id);
  return (
    <>
      <h1 className="text-[34px] font-bold tracking-tight">Contratos</h1>
      <ContractList rows={rows} />
    </>
  );
}

export default function ContractsPage({ searchParams }: PageProps<"/contratos">) {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
