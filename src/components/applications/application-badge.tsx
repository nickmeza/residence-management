import { StatusBadge, type BadgeTone } from "@/components/status-badge";
import { APPLICATION_STATUS_LABEL, type ApplicationStatus } from "@/server/applications/rules";

const TONE: Record<ApplicationStatus, BadgeTone> = {
  new: "primary",
  waitlist: "warn",
  approved: "ok",
  rejected: "neutral",
};

export function ApplicationBadge({ status }: { status: ApplicationStatus }) {
  return <StatusBadge tone={TONE[status]}>{APPLICATION_STATUS_LABEL[status]}</StatusBadge>;
}
