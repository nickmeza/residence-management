import { StatusBadge, type BadgeTone } from "@/components/status-badge";
import { PHASE_LABEL, type ContractPhase } from "@/server/contracts/rules";
import type { DocumentsSummary } from "@/server/residents/list";

const PHASE_TONE: Record<ContractPhase, BadgeTone> = {
  draft: "neutral",
  pending_signature: "warn",
  cancelled: "neutral",
  upcoming: "primary",
  active: "ok",
  ending_soon: "warn",
  ended: "neutral",
};

export function ContractPhaseBadge({ phase }: { phase: ContractPhase | null }) {
  if (!phase) return <StatusBadge tone="neutral">Sin contrato</StatusBadge>;
  return <StatusBadge tone={PHASE_TONE[phase]}>{PHASE_LABEL[phase]}</StatusBadge>;
}

export function DocumentsBadge({ summary }: { summary: DocumentsSummary }) {
  if (summary.missing > 0) {
    return (
      <StatusBadge tone="warn">{summary.missing === 1 ? "Falta 1" : `Faltan ${summary.missing}`}</StatusBadge>
    );
  }
  if (summary.inReview > 0) return <StatusBadge tone="primary">Por revisar</StatusBadge>;
  return <StatusBadge tone="ok">Completos</StatusBadge>;
}

const DOCUMENT_STATUS = {
  in_review: { tone: "warn", label: "En revisión" },
  verified: { tone: "ok", label: "Verificado" },
  rejected: { tone: "danger", label: "Rechazado" },
} as const;

export function DocumentStatusBadge({ status }: { status: keyof typeof DOCUMENT_STATUS }) {
  const { tone, label } = DOCUMENT_STATUS[status];
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}
