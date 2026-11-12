import { UploadButton } from "@/components/documents/upload-button";
import { ViewLink } from "@/components/documents/uploaded-list";
import { DocumentStatusBadge } from "@/components/residents/badges";
import { StatusBadge } from "@/components/status-badge";
import { formatsHint } from "@/server/documents/schemas";
import type { MyResidence } from "@/server/residents/self";

const HINT = {
  in_review: "Tu residencia lo está revisando.",
  verified: "Listo.",
  rejected: "Revisa el motivo y súbelo de nuevo.",
} as const;

// Un documento que le piden al residente, con su estado y el botón para subirlo (como en la maqueta de Luis).
export function RequirementCard({
  residence,
  requirement: r,
}: {
  residence: MyResidence;
  requirement: MyResidence["requirements"][number];
}) {
  const latest = r.latest;
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bold">{r.name}</h3>
        {latest ? (
          <DocumentStatusBadge status={latest.status} />
        ) : (
          <StatusBadge tone="warn">Falta</StatusBadge>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        {r.description ? `${r.description} ` : ""}
        {formatsHint(r.acceptedFormats, r.maxSizeMb)}
      </p>
      {latest?.status === "rejected" && latest.rejectionReason ? (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          <b>Motivo:</b> {latest.rejectionReason}
        </p>
      ) : null}
      {latest ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
            {latest.name} · {HINT[latest.status]}
          </span>
          <ViewLink id={latest.id} />
        </div>
      ) : null}
      {!latest || latest.status === "rejected" ? (
        <UploadButton
          businessId={residence.businessId}
          residentId={residence.residentId}
          kind="requirement"
          requirementId={r.id}
          limits={r}
          label={latest ? "Subir de nuevo" : "Subir foto o PDF"}
          variant="default"
        />
      ) : null}
    </section>
  );
}
