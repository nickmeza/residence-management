"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { BusinessSwitcher, type SwitcherOption } from "@/components/onboarding/business-switcher";
import { selectBusiness } from "@/server/business/actions";

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

  return (
    <div className={pending ? "opacity-60" : undefined} aria-busy={pending}>
      <BusinessSwitcher
        options={options}
        value={currentId}
        onChange={(id) =>
          startTransition(async () => {
            const { ok } = await selectBusiness(id);
            if (ok) router.push("/panel");
            router.refresh();
          })
        }
      />
    </div>
  );
}
