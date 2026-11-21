"use client";

import { createPortal } from "react-dom";

import { LoadingPill } from "@/components/loading-pill";

const SERVICE_LABEL = { residence: "Residencia", meal_plan: "Pensión" } as const;

// Pantalla de paso al cambiar de negocio: tapa todo (menú incluido) con el color del fondo, sólida y sin esqueletos,
// y solo dice a qué negocio se está pasando. Aparece de golpe; cuando el panel nuevo está listo ("leaving") se
// desvanece despacio. Va en el <body> para tapar también el menú.
export function SwitchingOverlay({
  name,
  service,
  leaving,
}: {
  name: string;
  service: "residence" | "meal_plan";
  leaving: boolean;
}) {
  return createPortal(
    <div
      role="status"
      aria-busy={!leaving}
      className={`fixed inset-0 z-50 bg-background ${leaving ? "overlay-leaving" : ""}`}
    >
      <LoadingPill
        delay={0}
        messages={[`Cambiando a ${name}…`, `Cargando el panel de tu ${SERVICE_LABEL[service]}…`]}
      />
    </div>,
    document.body,
  );
}
