"use client";

import dynamic from "next/dynamic";

// El registro guarda su borrador en el navegador, así que se arma solo allí (sin dibujarlo en el servidor).
// Mientras carga se muestra su esqueleto.
const SetupWizard = dynamic(() => import("./setup-wizard").then((m) => m.SetupWizard), {
  ssr: false,
  loading: () => <FormSkeleton className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8" />,
});

export function SetupWizardLoader({ mode }: { mode: "signup" | "existing" }) {
  return <SetupWizard mode={mode} />;
}
import { FormSkeleton } from "@/components/skeletons";
