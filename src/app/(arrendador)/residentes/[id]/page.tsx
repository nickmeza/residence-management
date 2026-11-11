import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { UploadButton } from "@/components/documents/upload-button";
import { UploadedList } from "@/components/documents/uploaded-list";
import { ContractPhaseBadge } from "@/components/residents/badges";
import { ProfileActions } from "@/components/residents/profile-actions";
import { RequirementsChecklist } from "@/components/residents/requirements-checklist";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { formatSoles } from "@/lib/format";
import { formatLongDate } from "@/server/contracts/dates";
import { confirmedLabel } from "@/server/contracts/rules";
import { getResident } from "@/server/residents/queries";
import { IDENTITY_DOCUMENT_LABEL } from "@/server/residents/schemas";

export const metadata: Metadata = { title: "Perfil del residente · Gestión de residencias" };

function Card({ title, badge, children }: { title: string; badge?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-card sm:p-6">
      <div className="mb-3 flex items-center justify-between gap-2.5">
        <h2 className="text-lg font-bold">{title}</h2>
        {badge}
      </div>
      {children}
    </section>
  );
}

// Fila "etiqueta · valor". Sin valor muestra una raya, para que se note que falta.
function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-t py-2.5 text-sm first:border-t-0">
      <span className="text-muted-foreground">{label}</span>
      <b className="text-right">{value || <span className="font-normal text-muted-foreground">—</span>}</b>
    </div>
  );
}

const PAPERWORK_LABEL = {
  none: "Sin contrato escrito",
  paper: "Contrato en papel",
  template: "Desde plantilla",
};

async function Content({ params }: { params: PageProps<"/residentes/[id]">["params"] }) {
  const { id } = await params;
  const r = await getResident(id);
  if (!r) notFound();
  const { person: p, card, contract: c } = r;
  const document = p.identityDocumentType
    ? `${IDENTITY_DOCUMENT_LABEL[p.identityDocumentType]} ${p.identityDocumentNumber}`
    : null;
  const emergency = [card.emergencyContactName, card.emergencyContactPhone].filter(Boolean).join(" · ");

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {r.businessName} › Residentes › <b className="text-foreground">{p.fullName}</b>
        </p>
        <Link href="/residentes" className={buttonVariants({ variant: "outline", className: "h-11 gap-2" })}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver a residentes
        </Link>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3.5">
          <h1 className="text-[34px] font-bold tracking-tight">{p.fullName}</h1>
          <ContractPhaseBadge phase={c?.phase ?? null} />
        </div>
        <p className="text-muted-foreground">
          {c ? c.unitName : "Todavía sin unidad asignada"}
          {" · "}
          {r.hasAccount
            ? "Tiene cuenta en la app"
            : r.invitationExpiresAt
              ? "Invitación enviada, todavía sin cuenta"
              : "Sin cuenta en la app"}
        </p>
      </div>
      <ProfileActions
        residentId={r.id}
        hasAccount={r.hasAccount}
        hasPendingInvitation={r.invitationExpiresAt !== null}
        initial={{
          fullName: p.fullName,
          phone: p.phone ?? "",
          email: p.email ?? "",
          identityDocumentType: p.identityDocumentType ?? "",
          identityDocumentNumber: p.identityDocumentNumber ?? "",
          university: card.university ?? "",
          emergencyContactName: card.emergencyContactName ?? "",
          emergencyContactPhone: card.emergencyContactPhone ?? "",
          notes: card.notes ?? "",
        }}
      />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-5">
          <Card title="Datos personales">
            <Row label="Nombre completo" value={p.fullName} />
            <Row label="Documento" value={document} />
            <Row label="Teléfono" value={p.phone} />
            <Row label="Correo" value={p.email} />
            <Row label="Universidad" value={card.university} />
            <Row label="Contacto de emergencia" value={emergency} />
            {card.notes ? <Row label="Notas" value={card.notes} /> : null}
          </Card>
          <Card title="Documentos que se le piden">
            <RequirementsChecklist
              businessId={r.businessId}
              residentId={r.id}
              firstName={p.fullName.split(" ")[0]}
              requirements={r.requirements}
              hasContract={c !== null}
            />
          </Card>
          <Card title="Archivos subidos">
            {r.documents.length ? (
              <UploadedList documents={r.documents} canReview />
            ) : (
              <p className="text-sm text-muted-foreground">Todavía no tiene documentos subidos.</p>
            )}
            <div className="mt-3">
              <UploadButton
                businessId={r.businessId}
                residentId={r.id}
                kind="other"
                label="Subir otro documento"
              />
            </div>
          </Card>
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <Card
            title="Contrato"
            badge={
              c && c.phase !== "draft" && c.phase !== "pending_signature" && c.phase !== "cancelled" ? (
                <StatusBadge tone="neutral">{confirmedLabel(c.paperwork)}</StatusBadge>
              ) : null
            }
          >
            {c ? (
              <>
                <Row label="Unidad" value={c.unitName} />
                <Row label="Renta" value={`${formatSoles(c.monthlyRent)} al mes`} />
                <Row
                  label="Pago"
                  value={c.paymentDay === 31 ? "Último día de cada mes" : `Día ${c.paymentDay} de cada mes`}
                />
                <Row label="Desde" value={formatLongDate(c.startDate)} />
                <Row label="Hasta" value={c.endDate ? formatLongDate(c.endDate) : "Sin fecha de fin"} />
                <Row label="Modalidad" value={PAPERWORK_LABEL[c.paperwork]} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Todavía no tiene contrato.</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2.5">
              {c ? (
                <Link
                  href={`/contratos/${c.id}`}
                  className={buttonVariants({ variant: "outline", className: "h-11" })}
                >
                  Ver contrato
                </Link>
              ) : null}
              {/* Con un contrato vigente, los cambios se hacen desde el contrato (Cambiar condiciones). */}
              {!c || c.phase === "ended" || c.phase === "cancelled" ? (
                <Link href={`/contratos?residente=${r.id}`} className={buttonVariants({ className: "h-11" })}>
                  Crear contrato
                </Link>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

export default function ResidentPage({ params }: PageProps<"/residentes/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
      <Content params={params} />
    </Suspense>
  );
}
