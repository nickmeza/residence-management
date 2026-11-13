import type { BadgeTone } from "@/components/status-badge";
import type { SubscriptionRow } from "@/server/pension/queries";

// Estado de una afiliación, con texto además de color (CLAUDE.md, sección 9).
export const SUBSCRIPTION_STATE: Record<SubscriptionRow["state"], { label: string; tone: BadgeTone }> = {
  active: { label: "Activo", tone: "ok" },
  paused: { label: "En pausa", tone: "warn" },
  upcoming: { label: "Empieza pronto", tone: "primary" },
  ended: { label: "Terminó", tone: "neutral" },
};
