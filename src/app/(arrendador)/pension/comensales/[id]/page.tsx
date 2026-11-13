import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DinerDetailView } from "@/components/pension/diner-detail";
import { currentPension, NotAPension } from "@/components/pension/pension-page";
import { getDiner } from "@/server/pension/queries";

export const metadata: Metadata = { title: "Pensión · Comensal · Gestión de residencias" };

type Props = PageProps<"/pension/comensales/[id]">;

async function Content({ params }: Pick<Props, "params">) {
  const pension = await currentPension();
  if (!pension) return <NotAPension />;
  const { id } = await params;
  const diner = await getDiner(pension.id, id);
  if (!diner) notFound();
  return (
    <>
      <div className="flex flex-col gap-2">
        <nav aria-label="Ruta" className="text-sm text-muted-foreground">
          <Link
            href="/pension/comensales"
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            Comensales
          </Link>{" "}
          › <b className="text-foreground">{diner.name}</b>
        </nav>
        <h1 className="text-[34px] font-bold tracking-tight">{diner.name}</h1>
      </div>
      <DinerDetailView diner={diner} />
    </>
  );
}

export default function DinerPage({ params }: Props) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
      <Content params={params} />
    </Suspense>
  );
}
