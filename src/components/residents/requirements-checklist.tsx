"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { ReviewButtons } from "@/components/documents/review-buttons";
import { UploadButton } from "@/components/documents/upload-button";
import { ViewLink } from "@/components/documents/uploaded-list";
import { DocumentStatusBadge } from "@/components/residents/badges";
import { StatusBadge } from "@/components/status-badge";
import { setAskedAction } from "@/server/documents/actions";
import { UNIT_TYPE_LABEL } from "@/server/documents/schemas";
import type { ResidentDetail } from "@/server/residents/queries";

type Requirement = ResidentDetail["requirements"][number];

// Perfil › Documentos: lo que se le pide a esta persona. "Pedírselo" se quita solo para ella (un familiar, un
// conocido): ya no lo ve y no frena su contrato. Los opcionales nunca los ve; los sube el arrendador.
export function RequirementsChecklist({
  businessId,
  residentId,
  firstName,
  requirements,
  hasContract,
}: {
  businessId: string;
  residentId: string;
  firstName: string;
  requirements: Requirement[];
  hasContract: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const toggle = (r: Requirement) =>
    startTransition(async () => {
      setError(undefined);
      const result = await setAskedAction({ residentId, requirementId: r.id, asked: !r.asked });
      if (!result.ok) return setError(result.message);
      router.refresh();
    });

  if (!requirements.length) {
    return <p className="text-sm text-muted-foreground">No pides documentos para lo que alquila.</p>;
  }

  return (
    <>
      {!hasContract ? (
        <p className="mb-2 text-sm text-muted-foreground">
          Todavía no tiene contrato: cuando lo tenga se le pedirá la lista de cuarto o la de departamento.
        </p>
      ) : null}
      <ul>
        {requirements.map((r) => {
          const exempt = r.required && !r.asked;
          const latest = r.latest;
          return (
            <li
              key={r.id}
              className={
                "flex flex-wrap items-center gap-3 border-t py-2.5 text-sm first:border-t-0 " +
                (exempt ? "text-muted-foreground" : "")
              }
            >
              <span className="min-w-40 flex-1">
                <b className={exempt ? "" : "text-foreground"}>{r.name}</b>
                <span className="block text-xs text-muted-foreground">
                  {!hasContract ? `${UNIT_TYPE_LABEL[r.unitType]} · ` : ""}
                  {!r.required
                    ? `Opcional: ${firstName} no lo ve, lo subes tú.`
                    : exempt
                      ? `${firstName} no lo ve y no frena su contrato.`
                      : `${firstName} lo ve y lo puede subir.`}
                </span>
                {latest?.status === "rejected" && latest.rejectionReason ? (
                  <span className="block text-xs text-danger">Motivo: {latest.rejectionReason}</span>
                ) : null}
              </span>
              {exempt ? (
                <StatusBadge tone="neutral">No se le pide</StatusBadge>
              ) : latest ? (
                <DocumentStatusBadge status={latest.status} />
              ) : (
                <StatusBadge tone={r.required ? "warn" : "neutral"}>
                  {r.required ? "Falta" : "Sin archivo"}
                </StatusBadge>
              )}
              {latest ? <ViewLink id={latest.id} /> : null}
              {latest?.status === "in_review" ? (
                <ReviewButtons documentId={latest.id} title={r.name} />
              ) : null}
              {!exempt && (!latest || latest.status === "rejected") ? (
                <UploadButton
                  businessId={businessId}
                  residentId={residentId}
                  kind="requirement"
                  requirementId={r.id}
                  limits={r}
                  label={latest ? "Subir de nuevo" : "Subir"}
                />
              ) : null}
              {r.required ? (
                <label className="flex min-h-11 items-center gap-2">
                  <input
                    type="checkbox"
                    className="size-5 accent-primary"
                    checked={r.asked}
                    disabled={pending}
                    onChange={() => toggle(r)}
                  />
                  Pedírselo
                </label>
              ) : null}
            </li>
          );
        })}
      </ul>
      <FormMessage message={error} />
    </>
  );
}
