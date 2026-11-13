import { daysBetween, formatLongDate, type IsoDate } from "@/server/contracts/dates";
import type { ContractPhase } from "@/server/contracts/rules";

// La línea de la portada del inicio del residente: lo más importante de su contrato en una frase.
export function contractHeadline(
  contract: { phase: ContractPhase; startDate: IsoDate; endDate: IsoDate | null } | null,
  today: IsoDate,
): string | null {
  if (!contract) return null;
  if (contract.phase === "pending_signature") return "Tu contrato está listo para firmar";
  if (contract.phase === "upcoming") return `Tu contrato empieza el ${formatLongDate(contract.startDate)}`;
  if (contract.endDate === null) return "Tu contrato es mes a mes";
  const days = daysBetween(today, contract.endDate);
  if (days < 0) return `Tu contrato terminó el ${formatLongDate(contract.endDate)}`;
  if (days === 0) return "Tu contrato vence hoy";
  if (days === 1) return "Tu contrato vence mañana";
  return `Tu contrato vence en ${days} días`;
}
