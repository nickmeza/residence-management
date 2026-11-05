"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ViewModeToggle } from "@/components/view-mode-toggle";
import { decideMode, readDeviceInfo, saveViewMode, type ViewMode } from "@/lib/view-mode";
import type { BuildingView } from "@/server/business/queries";

import { BuildingEditor } from "./building-editor";

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

// Pantalla Edificio: elige el modo (3D o Simple), lo recuerda en este dispositivo y muestra el que toca.
// Corre solo en el navegador (ver building-screen-loader.tsx) porque necesita saber qué aguanta el equipo.
export function BuildingScreen({ building }: { building: BuildingView }) {
  const [decision] = useState(() => decideMode(readDeviceInfo()));
  const [mode, setMode] = useState<ViewMode>(decision.mode);
  const [notice, setNotice] = useState(decision.notice);

  const change = (next: ViewMode) => {
    setMode(next);
    saveViewMode(next);
    if (notice === "slow_device") setNotice(null);
  };

  const toggle = (
    <ViewModeToggle
      mode={mode}
      onChange={change}
      disable3d={decision.notice === "no_webgl" ? "Este navegador no puede mostrar 3D" : undefined}
    />
  );

  return (
    <>
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
      {mode === "3d" ? (
        <Building3DView building={building} toggle={toggle} />
      ) : (
        <BuildingEditor building={building} toggle={toggle} />
      )}
    </>
  );
}
