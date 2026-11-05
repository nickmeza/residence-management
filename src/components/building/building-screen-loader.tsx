"use client";

import dynamic from "next/dynamic";

import type { BuildingView } from "@/server/business/queries";

// La pantalla Edificio se arma solo en el navegador: necesita leer el modo guardado y qué aguanta el equipo.
const BuildingScreen = dynamic(() => import("./building-screen").then((m) => m.BuildingScreen), {
  ssr: false,
  loading: () => (
    <p role="status" className="text-muted-foreground">
      Cargando el edificio…
    </p>
  ),
});

export function BuildingScreenLoader({ building }: { building: BuildingView }) {
  return <BuildingScreen building={building} />;
}
