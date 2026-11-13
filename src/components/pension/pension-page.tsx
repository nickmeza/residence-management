import type { ReactNode } from "react";

import { getShellData } from "@/server/business/current";

import { PensionTabs, type PensionTab } from "./pension-tabs";

// Encabezado de las pantallas de Pensión: título, una línea de ayuda y las pestañas.
export function PensionHeader({ tab, description }: { tab: PensionTab; description: string }) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-[34px] font-bold tracking-tight">Pensión</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>
      <PensionTabs current={tab} />
    </>
  );
}

// La pensión elegida arriba (selector de negocio). null si el negocio elegido no es de Pensión.
export async function currentPension() {
  const { current } = await getShellData();
  return current && current.service === "meal_plan" ? current : null;
}

export function NotAPension(): ReactNode {
  return (
    <p className="rounded-xl border bg-card p-6 text-muted-foreground shadow-card">
      Esto es de un negocio de Pensión. Elige tu pensión arriba, en el selector de negocio.
    </p>
  );
}
