import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { BuildingScreen } from "@/components/building/building-screen";
import { getBuilding } from "@/server/business/queries";

// Marco del edificio: el interruptor 3D/Simple y, en 3D, el edificio al lado de la página. Lo comparten las
// páginas del edificio, de cada piso y de cada unidad, y no se vuelve a montar al pasar de una a otra.
async function Frame({ params, children }: { params: Promise<{ id: string }>; children: ReactNode }) {
  const { id } = await params;
  const building = await getBuilding(id);
  if (!building) notFound();
  return <BuildingScreen building={building}>{children}</BuildingScreen>;
}

export default function BuildingLayout({ params, children }: LayoutProps<"/edificio/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Cargando el edificio…</p>}>
      <Frame params={params}>{children}</Frame>
    </Suspense>
  );
}
