import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { MoveForm } from "@/components/moves/move-form";
import { DetailSkeleton } from "@/components/skeletons";
import { buttonVariants } from "@/components/ui/button";
import { formatLongDate } from "@/lib/format";
import { getMove } from "@/server/moves/queries";
import { MOVE_LABEL } from "@/server/moves/rules";
import { limaNow } from "@/server/pension/rules";

export const metadata: Metadata = { title: "Ingreso o salida · Gestión de residencias" };

async function Content({ params, searchParams }: PageProps<"/ingresos/[contractId]">) {
  const [{ contractId }, query] = await Promise.all([params, searchParams]);
  const kind = query.tipo === "salida" ? "check_out" : "check_in";
  const m = await getMove(contractId, kind);
  if (!m) notFound();
  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          <Link href="/ingresos" className="hover:underline">
            Ingresos y salidas
          </Link>{" "}
          › <b className="text-foreground">{MOVE_LABEL[kind]}</b>
        </p>
        <h1 className="text-[28px] font-bold tracking-tight">
          {MOVE_LABEL[kind]} de {m.residentName}
        </h1>
        <p className="text-muted-foreground">
          {m.unitName}
          {m.date ? ` · ${formatLongDate(m.date)}` : ""}
        </p>
      </div>
      <section className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-card">
        <MoveForm
          contractId={contractId}
          kind={kind}
          initial={{
            scheduledAt: m.scheduledAt ? limaNow(m.scheduledAt) : "",
            keysCount: m.keysCount === null ? "" : String(m.keysCount),
            checklist: m.checklist,
            notes: m.notes ?? "",
            done: m.doneAt !== null,
          }}
        />
      </section>
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/residentes/${m.residentId}`}
          className={buttonVariants({ variant: "outline", className: "h-11" })}
        >
          Ver residente
        </Link>
        {kind === "check_out" && m.depositId ? (
          <Link href={`/garantias/${m.depositId}`} className={buttonVariants({ className: "h-11" })}>
            Liquidar garantía
          </Link>
        ) : null}
      </div>
    </>
  );
}

// Un ingreso o una salida (CT-06, CT-07, CR-10): la cita, las llaves y el checklist del día.
export default function MovePage(props: PageProps<"/ingresos/[contractId]">) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}
