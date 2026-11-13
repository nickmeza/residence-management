import type { Metadata } from "next";
import { Suspense } from "react";

import { MyPensionView } from "@/components/pension/my-pension";
import { limaToday } from "@/server/contracts/dates";
import { getMyPension } from "@/server/pension/queries";

export const metadata: Metadata = { title: "Mi pensión · Mi residencia" };

async function Content() {
  const pensions = await getMyPension();
  return <MyPensionView pensions={pensions} today={limaToday(new Date())} />;
}

export default function MyPensionPage() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Mi pensión</h1>
        <p className="text-muted-foreground">Tus comidas de la semana, el menú, tus pagos y tus pausas.</p>
      </div>
      <Suspense fallback={<p className="text-muted-foreground">Cargando tu pensión…</p>}>
        <Content />
      </Suspense>
    </>
  );
}
