"use client";

import dynamic from "next/dynamic";

// El registro guarda su borrador en el navegador, así que se arma solo allí (sin dibujarlo en el servidor).
// Mientras carga se muestra un aviso.
const SetupWizard = dynamic(() => import("./setup-wizard").then((m) => m.SetupWizard), {
  ssr: false,
  loading: () => (
    <p role="status" className="mx-auto w-full max-w-5xl px-4 py-8 text-muted-foreground sm:px-8">
      Cargando…
    </p>
  ),
});

export function SetupWizardLoader({ mode }: { mode: "signup" | "existing" }) {
  return <SetupWizard mode={mode} />;
}
