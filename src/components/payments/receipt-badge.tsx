import { StatusBadge, type BadgeTone } from "@/components/status-badge";
import { formatSoles } from "@/lib/format";
import { receiptLabel, type ReceiptStatus } from "@/server/payments/rules";

const TONE: Record<ReceiptStatus, BadgeTone> = {
  paid: "ok",
  partial: "warn",
  pending: "neutral",
  overdue: "danger",
};

// "Pagado", "Pendiente", "Vencido · faltan S/ 200"… siempre con texto además del color.
export function ReceiptBadge({
  status,
  balance,
  paid,
}: {
  status: ReceiptStatus;
  balance: string;
  paid: string;
}) {
  return <StatusBadge tone={TONE[status]}>{receiptLabel(status, balance, paid, formatSoles)}</StatusBadge>;
}
