import type { Metadata } from "next";
import { Suspense } from "react";

import { currentPension, NotAPension, PensionHeader } from "@/components/pension/pension-page";
import { PaymentsBoard } from "@/components/pension/payments-board";
import { listDiners, listPensionPayments } from "@/server/pension/queries";

export const metadata: Metadata = { title: "Pensión · Pagos · Gestión de residencias" };

async function Content() {
  const pension = await currentPension();
  if (!pension) return <NotAPension />;
  const [list, payments] = await Promise.all([listDiners(pension.id), listPensionPayments(pension.id)]);
  if (!list) return <p className="text-muted-foreground">No encontramos tu pensión. Recarga la página.</p>;
  return (
    <PaymentsBoard today={list.today} diners={list.diners} pending={payments.pending} payments={payments.recent} />
  );
}

export default function PensionPaymentsPage() {
  return (
    <>
      <PensionHeader
        tab="pagos"
        description="La pensión se cobra por adelantado. Los días en pausa y las comidas canceladas a tiempo quedan como saldo a favor."
      />
      <Suspense fallback={<p className="text-muted-foreground">Cargando los pagos…</p>}>
        <Content />
      </Suspense>
    </>
  );
}
