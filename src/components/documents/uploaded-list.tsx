import { ExternalLink } from "lucide-react";

import { ReviewButtons } from "@/components/documents/review-buttons";
import { DocumentStatusBadge } from "@/components/residents/badges";
import type { UploadedDocument } from "@/server/contracts/queries";

const dateFormat = new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeZone: "America/Lima" });

// "Ver" abre el archivo con un enlace que vence en minutos (src/app/documentos/[id]/route.ts).
export function ViewLink({ id }: { id: string }) {
  return (
    <a
      href={`/documentos/${id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-link hover:underline"
    >
      Ver
      <ExternalLink className="size-3.5" aria-hidden="true" />
      <span className="sr-only">(se abre en otra pestaña)</span>
    </a>
  );
}

// Lista de archivos subidos con su estado. Los que están en revisión se pueden verificar o rechazar.
export function UploadedList({
  documents,
  canReview,
}: {
  documents: UploadedDocument[];
  canReview: boolean;
}) {
  return (
    <ul>
      {documents.map((d) => (
        <li key={d.id} className="flex flex-wrap items-center gap-3 border-t py-2.5 text-sm first:border-t-0">
          <span className="min-w-40 flex-1">
            <b>{d.name}</b>
            <span className="block text-xs text-muted-foreground">
              Subido el {dateFormat.format(d.uploadedAt)}
            </span>
            {d.status === "rejected" && d.rejectionReason ? (
              <span className="block text-xs text-danger">Motivo: {d.rejectionReason}</span>
            ) : null}
          </span>
          <DocumentStatusBadge status={d.status} />
          <ViewLink id={d.id} />
          {canReview && d.status === "in_review" ? <ReviewButtons documentId={d.id} title={d.name} /> : null}
        </li>
      ))}
    </ul>
  );
}
