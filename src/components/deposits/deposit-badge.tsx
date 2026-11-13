import { StatusBadge, type BadgeTone } from "@/components/status-badge";
import { DEPOSIT_PHASE_LABEL, type DepositPhase } from "@/server/deposits/rules";

const TONE: Record<DepositPhase, BadgeTone> = {
  none: "neutral",
  unpaid: "warn",
  held: "primary",
  settling: "warn",
  disputed: "danger",
  returned: "ok",
};

// "Retenida", "Por cobrar", "En disputa"… siempre con texto además del color.
export function DepositBadge({ phase }: { phase: DepositPhase }) {
  return <StatusBadge tone={TONE[phase]}>{DEPOSIT_PHASE_LABEL[phase]}</StatusBadge>;
}
