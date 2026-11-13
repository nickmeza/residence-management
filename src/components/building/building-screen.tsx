"use client";

import dynamic from "next/dynamic";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, useSyncExternalStore, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ViewModeToggle } from "@/components/view-mode-toggle";
import {
  decideMode,
  readDeviceInfo,
  saveViewMode,
  type ModeDecision,
  type ViewMode,
} from "@/lib/view-mode";
import type { BuildingView } from "@/server/business/queries";

import { parseBuildingPath } from "./building-route";

// El 3D (three.js) se descarga solo cuando se elige ese modo. El modo simple no lo necesita.
const Building3DView = dynamic(
  () => import("@/components/edificio-3d/building-3d-view").then((m) => m.Building3DView),
  {
    ssr: false,
    loading: () => (
      <p role="status" className="rounded-xl border bg-card p-6 text-muted-foreground shadow-card">
        Cargando el edificio en 3D…
      </p>
    ),
  },
);

// Qué modo usar se sabe solo en el navegador (lo guardado y lo que aguanta el equipo). Se calcula una vez por
// carga; en el servidor es null y se dibuja la página sola, como en el modo simple.
let decided: ModeDecision | null = null;
const readDecision = () => (decided ??= decideMode(readDeviceInfo()));
const noop = () => () => {};

// Marco del edificio (lo usa el layout de /edificio/[id]): el interruptor 3D/Simple y, en 3D, el edificio al lado
// de la página (edificio, piso o unidad). Al pasar de una página a otra el marco no se vuelve a montar: el 3D
// sigue cargado. La página siempre va en el mismo lugar, así que no se reinicia al cambiar de modo.
export function BuildingScreen({ building, children }: { building: BuildingView; children: ReactNode }) {
  const decision = useSyncExternalStore(noop, readDecision, () => null);
  const [chosen, setChosen] = useState<ViewMode | null>(null);
  const [noticeClosed, setNoticeClosed] = useState(false);
  const route = parseBuildingPath(usePathname(), useSearchParams().get("pestana"));
  const mode = chosen ?? decision?.mode ?? "simple";
  const notice = noticeClosed ? null : (decision?.notice ?? null);
  const is3d = decision !== null && mode === "3d";

  const change = (next: ViewMode) => {
    setChosen(next);
    saveViewMode(next);
    if (notice === "slow_device") setNoticeClosed(true);
  };

  return (
    <>
      <div className="flex min-h-11 flex-wrap items-center gap-3">
        {decision ? (
          <ViewModeToggle
            mode={mode}
            onChange={change}
            disable3d={decision.notice === "no_webgl" ? "Este navegador no puede mostrar 3D" : undefined}
          />
        ) : null}
      </div>
      {notice ? (
        <div
          role="status"
          className="flex flex-wrap items-center gap-3 rounded-xl border bg-primary-soft px-4 py-3 text-sm text-primary-text"
        >
          <span className="flex-1">
            {notice === "no_webgl"
              ? "Este navegador no puede mostrar el edificio en 3D. Usa el modo simple: tiene todo lo mismo."
              : "Tu equipo podría ir lento en 3D, así que abrimos el modo simple. Tiene todo lo mismo."}
          </span>
          {notice === "slow_device" ? (
            <Button type="button" variant="link" className="h-9 px-1 text-link" onClick={() => change("3d")}>
              Usar 3D igual
            </Button>
          ) : null}
        </div>
      ) : null}
      <div
        className={
          is3d ? "grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]" : "flex flex-col gap-6"
        }
      >
        {is3d ? (
          <div className="lg:sticky lg:top-24">
            <Building3DView building={building} route={route} />
          </div>
        ) : null}
        <div className="flex min-w-0 flex-col gap-6">{children}</div>
      </div>
    </>
  );
}
