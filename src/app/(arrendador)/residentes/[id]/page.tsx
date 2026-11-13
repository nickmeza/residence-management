import { ArrowLeft, Bell } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { DepositBadge } from "@/components/deposits/deposit-badge";
import { UploadButton } from "@/components/documents/upload-button";
import { UploadedList } from "@/components/documents/uploaded-list";
import { ReceiptBadge } from "@/components/payments/receipt-badge";
import { ContractPhaseBadge } from "@/components/residents/badges";
import { ProfileActions } from "@/components/residents/profile-actions";
import { RequirementsChecklist } from "@/components/residents/requirements-checklist";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { formatSoles } from "@/lib/format";
import { cn } from "@/lib/utils";
import { formatLongDate } from "@/server/contracts/dates";
import { listContracts } from "@/server/contracts/queries";
import { confirmedLabel } from "@/server/contracts/rules";
import { PAPERWORK_LABEL } from "@/server/contracts/schemas";
import { needsSettlement } from "@/server/deposits/list-filter";
import { listDeposits } from "@/server/deposits/queries";
import { getResidentReceipts } from "@/server/payments/queries";
import { periodLabel } from "@/server/payments/rules";
import { getResident } from "@/server/residents/queries";
import { IDENTITY_DOCUMENT_LABEL } from "@/server/residents/schemas";

export const metadata: Metadata = { title: "Perfil del residente · Gestión de residencias" };

// Pestañas del perfil (decisión del dueño): Datos · Cobros · Contrato · Garantía. Van en la dirección (?pestana=).
const TABS = [
  { key: "datos", label: "Datos" },
  { key: "cobros", label: "Cobros" },
  { key: "contrato", label: "Contrato" },
  { key: "garantia", label: "Garantía" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

type Resident = NonNullable<Awaited<ReturnType<typeof getResident>>>;

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

function Tabs({ residentId, current }: { residentId: string; current: TabKey }) {
  return (
    <nav aria-label="Secciones del residente" className="flex flex-wrap gap-2 border-b pb-3">
      {TABS.map((t) =>
        t.key === current ? (
          <span
            key={t.key}
            aria-current="page"
            className="rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground"
          >
            {t.label}
          </span>
        ) : (
          <Link
            key={t.key}
            href={
              t.key === "datos" ? `/residentes/${residentId}` : `/residentes/${residentId}?pestana=${t.key}`
            }
            className="rounded-lg border bg-card px-3.5 py-2 text-sm font-semibold text-muted-foreground transition-colors duration-200 hover:text-foreground"
          >
            {t.label}
          </Link>
        ),
      )}
    </nav>
  );
}

// Datos: lo que antes era todo el perfil (datos personales y documentos).
function DataTab({ r }: { r: Resident }) {
  const { person: p, card, contract: c } = r;
  const document = p.identityDocumentType
    ? `${IDENTITY_DOCUMENT_LABEL[p.identityDocumentType]} ${p.identityDocumentNumber}`
    : null;
  const emergency = [card.emergencyContactName, card.emergencyContactPhone].filter(Boolean).join(" · ");
  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <Card title="Datos personales">
        <Row label="Nombre completo" value={p.fullName} />
        <Row label="Documento" value={document} />
        <Row label="Teléfono" value={p.phone} />
        <Row label="Correo" value={p.email} />
        <Row label="Universidad" value={card.university} />
        <Row label="Contacto de emergencia" value={emergency} />
        {card.notes ? <Row label="Notas" value={card.notes} /> : null}
      </Card>
      <div className="flex min-w-0 flex-col gap-5">
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
    </div>
  );
}

// Cobros: todos sus recibos, de todos los meses (no uno por mes como en Cobros).
async function ChargesTab({ residentId }: { residentId: string }) {
  const data = await getResidentReceipts(residentId);
  if (!data) return null;
  if (!data.receipts.length) {
    return (
      <p className="rounded-xl border bg-card p-6 text-muted-foreground shadow-card">
        Todavía no tiene recibos. Se crean solos al confirmar su contrato, uno por cada mes que dura.
      </p>
    );
  }
  return (
    <>
      {data.overdue.count > 0 ? (
        <div
          role="status"
          className="flex items-center gap-3 rounded-xl bg-danger-soft px-4 py-2.5 text-sm text-danger"
        >
          <Bell className="size-4 shrink-0" aria-hidden="true" />
          <span>
            Debe <b>{formatSoles(data.overdue.total)}</b> ·{" "}
            {data.overdue.count === 1 ? "1 recibo vencido" : `${data.overdue.count} recibos vencidos`}
          </span>
        </div>
      ) : null}
      <section className="overflow-hidden rounded-xl border bg-card shadow-card">
        {/* En móvil la tabla se desliza de lado. */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="bg-background text-left text-xs font-bold tracking-wide text-muted-foreground uppercase">
                <th scope="col" className="px-5 py-3">
                  Mes
                </th>
                <th scope="col" className="px-3 py-3 text-right">
                  Monto
                </th>
                <th scope="col" className="px-3 py-3 text-right">
                  Pagado
                </th>
                <th scope="col" className="px-3 py-3">
                  Vence
                </th>
                <th scope="col" className="px-3 py-3">
                  Estado
                </th>
                <th scope="col" className="px-5 py-3">
                  <span className="sr-only">Acción</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.receipts.map((x) => {
                const action = x.status === "paid" ? "Ver" : x.inReview ? "Revisar" : "Registrar pago";
                return (
                  <tr key={x.period} className="border-t">
                    <td className="px-5 py-3.5">
                      <span className="font-semibold first-letter:uppercase">{periodLabel(x.period)}</span>
                      {x.inReview ? (
                        <span className="block text-xs font-semibold text-primary-text">
                          + {x.inReview === 1 ? "1 comprobante" : `${x.inReview} comprobantes`} en revisión
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3.5 text-right tabular-nums">{formatSoles(x.total)}</td>
                    <td className="px-3 py-3.5 text-right text-muted-foreground tabular-nums">
                      {Number(x.paid) > 0 ? formatSoles(x.paid) : "—"}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-3.5",
                        x.status === "overdue" ? "font-bold text-danger" : "text-muted-foreground",
                      )}
                    >
                      {x.status === "paid" || !x.nextDue ? "—" : formatLongDate(x.nextDue)}
                    </td>
                    <td className="px-3 py-3.5">
                      <ReceiptBadge status={x.status} balance={x.balance} paid={x.paid} />
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <Link
                        href={`/cobros/${residentId}/${x.period}`}
                        className={buttonVariants({
                          variant: action === "Ver" ? "outline" : "default",
                          className: "h-10 px-3.5",
                        })}
                      >
                        {action}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t px-5 py-3 text-sm text-muted-foreground">
          {data.receipts.length} {data.receipts.length === 1 ? "recibo" : "recibos"} en total
        </p>
      </section>
    </>
  );
}

// Contrato: el de ahora y, debajo, los anteriores (por ejemplo, antes de una renovación).
async function ContractTab({ r }: { r: Resident }) {
  const c = r.contract;
  const others = (await listContracts(r.businessId)).filter((x) => x.residentId === r.id && x.id !== c?.id);
  return (
    <div className="flex flex-col gap-5">
      <Card
        title="Contrato actual"
        badge={
          c && c.phase !== "draft" && c.phase !== "pending_signature" && c.phase !== "cancelled" ? (
            <StatusBadge tone="neutral">{confirmedLabel(c.paperwork)}</StatusBadge>
          ) : null
        }
      >
        {c ? (
          <>
            <Row label="Estado" value={<ContractPhaseBadge phase={c.phase} />} />
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
      {others.length ? (
        <Card title="Contratos anteriores">
          <ul>
            {others.map((x) => (
              <li
                key={x.id}
                className="flex flex-wrap items-center gap-3 border-t py-3 text-sm first:border-t-0"
              >
                <span className="min-w-44 flex-1">
                  <b className="block">{x.unitName}</b>
                  <span className="text-muted-foreground">
                    {formatSoles(x.monthlyRent)} al mes · {x.endsIn}
                  </span>
                </span>
                <ContractPhaseBadge phase={x.phase} />
                <Link
                  href={`/contratos/${x.id}`}
                  className={buttonVariants({ variant: "outline", className: "h-10" })}
                >
                  Ver
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

// Garantía: la de cada contrato confirmado (al renovar pasa al contrato nuevo, así que suele ser una).
async function DepositTab({ r }: { r: Resident }) {
  const view = await listDeposits(r.businessId);
  const rows = (view?.rows ?? []).filter((x) => x.residentId === r.id);
  if (!rows.length) {
    return (
      <p className="rounded-xl border bg-card p-6 text-muted-foreground shadow-card">
        Todavía no tiene garantía. Se crea sola al confirmar su contrato, según lo que definas en
        Configuración › Garantía.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      {rows.map((x) => {
        const settleNow = needsSettlement(x);
        return (
          <Card key={x.id} title={`Garantía · ${x.unitName}`} badge={<DepositBadge phase={x.phase} />}>
            <Row label="Monto" value={x.phase === "none" ? "Sin garantía" : formatSoles(x.amount)} />
            <Row label="Salida" value={x.endsIn} />
            {x.phase === "returned" ? <Row label="Devuelto" value={formatSoles(x.refunded)} /> : null}
            <div className="mt-3">
              <Link
                href={`/garantias/${x.id}`}
                className={buttonVariants({ variant: settleNow ? "default" : "outline", className: "h-11" })}
              >
                {settleNow ? "Liquidar" : "Ver garantía"}
              </Link>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

async function Content({
  params,
  searchParams,
}: {
  params: PageProps<"/residentes/[id]">["params"];
  searchParams: PageProps<"/residentes/[id]">["searchParams"];
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const r = await getResident(id);
  if (!r) notFound();
  const tab: TabKey = TABS.find((t) => t.key === query.pestana)?.key ?? "datos";
  const { person: p, card, contract: c } = r;

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
      <Tabs residentId={r.id} current={tab} />
      {tab === "datos" ? <DataTab r={r} /> : null}
      {tab === "cobros" ? <ChargesTab residentId={r.id} /> : null}
      {tab === "contrato" ? <ContractTab r={r} /> : null}
      {tab === "garantia" ? <DepositTab r={r} /> : null}
    </>
  );
}

export default function ResidentPage({ params, searchParams }: PageProps<"/residentes/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
      <Content params={params} searchParams={searchParams} />
    </Suspense>
  );
}
