import { StatusBadge, type BadgeTone } from "@/components/status-badge";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  type MaintenancePriority,
  type MaintenanceStatus,
} from "@/server/maintenance/rules";

const STATUS_TONE: Record<MaintenanceStatus, BadgeTone> = {
  open: "warn",
  in_progress: "primary",
  done: "ok",
  cancelled: "neutral",
};

const PRIORITY_TONE: Record<MaintenancePriority, BadgeTone> = {
  low: "neutral",
  normal: "neutral",
  high: "warn",
  urgent: "danger",
};

export function MaintenanceStatusBadge({ status }: { status: MaintenanceStatus }) {
  return <StatusBadge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</StatusBadge>;
}

export function PriorityBadge({ priority }: { priority: MaintenancePriority }) {
  return <StatusBadge tone={PRIORITY_TONE[priority]}>{PRIORITY_LABEL[priority]}</StatusBadge>;
}
