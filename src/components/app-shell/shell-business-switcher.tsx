"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { SwitchingOverlay } from "@/components/app-shell/switching-overlay";
import { BusinessSwitcher, type SwitcherOption } from "@/components/onboarding/business-switcher";
import { selectBusiness } from "@/server/business/actions";

// Lo que tarda la pantalla de paso en desvanecerse (igual que --ds-overlay-out en tokens.css).
const OVERLAY_OUT_MS = 600;

// Selector de negocio de la barra de arriba (al estilo de GCP). Al elegir otro, se recuerda y la app
// pasa a mostrar ese negocio; si estabas dentro de otro negocio, vuelves al panel.
export function ShellBusinessSwitcher({
  options,
  currentId,
}: {
  options: SwitcherOption[];
  currentId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // El negocio al que se está pasando: mientras exista, se ve la pantalla de paso.
  const [target, setTarget] = useState<SwitcherOption | null>(null);
  const leaving = target !== null && !pending;

  // Cuando el panel nuevo ya está listo, la pantalla de paso se desvanece y luego se quita.
  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => setTarget(null), OVERLAY_OUT_MS);
    return () => clearTimeout(timer);
  }, [leaving]);

  return (
    <div aria-busy={pending}>
      <BusinessSwitcher
        options={options}
        value={currentId}
        onChange={(id) => {
          setTarget(options.find((o) => o.id === id) ?? null);
          startTransition(async () => {
            const { ok } = await selectBusiness(id);
            if (ok) router.push("/panel");
            router.refresh();
          });
        }}
      />
      {target ? <SwitchingOverlay name={target.name} service={target.service} leaving={leaving} /> : null}
    </div>
  );
}
