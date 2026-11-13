import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { DepositList } from "@/components/deposits/deposit-list";
import { buttonVariants } from "@/components/ui/button";
import { getShellData } from "@/server/business/current";
import { listDeposits } from "@/server/deposits/queries";

export const metadata: Metadata = { title: "Garantías · Gestión de residencias" };

// Garantías, versión simple (decisión del dueño): título y la tabla, sin números arriba.
async function Content() {
  const { current } = await getShellData();
  if (!current) return <p className="text-muted-foreground">Primero configura tu negocio.</p>;
  const view = await listDeposits(current.id);
  if (!view) return <p className="text-muted-foreground">No encontramos tu negocio. Recarga la página.</p>;

  return (
    <>
      <h1 className="text-[34px] font-bold tracking-tight">Garantías</h1>
      <DepositList
        rows={view.rows}
        action={
          <Link
            href={`/negocio/${current.id}/garantia`}
            className={buttonVariants({ variant: "outline", className: "h-11" })}
          >
            Configurar garantía
          </Link>
        }
      />
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
