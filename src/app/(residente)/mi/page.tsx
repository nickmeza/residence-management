import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { ReceiptBadge } from "@/components/payments/receipt-badge";
import { ContactButtons } from "@/components/resident-side/contact-buttons";
import { FALLBACK_COVER, ResidentHero } from "@/components/resident-side/resident-hero";
import { ContractPhaseBadge } from "@/components/residents/badges";
import { buttonVariants } from "@/components/ui/button";
import { formatSoles } from "@/lib/format";
import { greetingFor, initials } from "@/lib/greeting";
import { cn } from "@/lib/utils";
import { coverUrl } from "@/server/building/cover";
import { formatLongDate, limaToday } from "@/server/contracts/dates";
import { toCents } from "@/server/payments/money";
import { periodLabel } from "@/server/payments/rules";
import { getMyBilling, type MyBilling } from "@/server/payments/self";
import { contractHeadline } from "@/server/residents/home";
import { getMyResidences, type MyResidence } from "@/server/residents/self";

export const metadata: Metadata = { title: "Inicio · Mi residencia" };

const card = "rounded-xl border bg-card p-5 shadow-card";
const label = "text-xs font-bold tracking-wider text-muted-foreground uppercase";

function Field({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className={label}>{name}</span>
      <span className="font-bold sm:text-lg">{children}</span>
    </div>
  );
}

// Unidad, renta y fechas del contrato. Va montada sobre la portada.
function ContractCard({ r, showBusiness }: { r: MyResidence; showBusiness: boolean }) {
  const c = r.contract;
  return (
    <section className={cn(card, "flex flex-col gap-4 sm:p-6")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">{showBusiness ? r.businessName : c ? c.propertyName : "Tu residencia"}</h2>
        <ContractPhaseBadge phase={c?.phase ?? null} />
      </div>
      {c ? (
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <Field name="Unidad">{c.unitName}</Field>
          <Field name="Renta">{formatSoles(c.monthlyRent)} al mes</Field>
          <Field name="Inicio">{formatLongDate(c.startDate)}</Field>
          <Field name="Fin">{c.endDate ? formatLongDate(c.endDate) : "Mes a mes"}</Field>
        </div>
      ) : (
        <p className="text-muted-foreground">
          Tu residencia todavía no te asignó una unidad. Cuando lo haga, aquí verás tu contrato y lo que te
          pide.
        </p>
      )}
    </section>
  );
}

function ContactCard({ b, firstName }: { b: MyBilling | undefined; firstName: string }) {
  if (!b) return null;
  return (
    <section className={cn(card, "flex flex-col gap-4")}>
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary-text">
          {initials(b.businessName)}
        </span>
        <div className="min-w-0">
          <div className="truncate font-bold">{b.businessName}</div>
          <div className="text-sm text-muted-foreground">{b.phone ?? "Tu residencia"}</div>
        </div>
      </div>
      <ContactButtons phone={b.phone} businessName={b.businessName} firstName={firstName} />
    </section>
  );
}

// Estado de los documentos, siempre con texto (no solo color).
function DocumentsCard({ r }: { r: MyResidence }) {
  const inReview = r.requirements.filter((q) => q.latest?.status === "in_review").length;
  const [title, text] =
    r.missing > 0
      ? [
          r.missing === 1 ? "Te falta 1 documento" : `Te faltan ${r.missing} documentos`,
          "Súbelos para que tu residencia pueda revisarlos.",
        ]
      : inReview > 0
        ? ["Tu residencia está revisando tus documentos", "Te avisamos aquí cuando terminen."]
        : [
            "Todo listo. No te falta ningún documento.",
            "Si tu residencia te pide algo nuevo, lo verás aquí.",
          ];
  return (
    <section className="flex h-full flex-col gap-3 rounded-xl bg-primary p-6 text-primary-foreground shadow-card">
      <span className="text-xs font-bold tracking-wider uppercase opacity-80">Estado de tus documentos</span>
      <h2 className="max-w-md text-xl font-bold sm:text-2xl">{title}</h2>
      <p className="max-w-md text-sm opacity-90">{text}</p>
      <div className="mt-auto flex flex-wrap gap-2 pt-2">
        <Link
          href="/mi/documentos"
          className={buttonVariants({
            variant: "outline",
            className: "h-11 border-transparent bg-card px-4 text-primary-text hover:bg-card/90",
          })}
        >
          {r.missing > 0 ? "Subir documentos" : "Ver mis documentos"}
        </Link>
        <Link
          href="/mi/contrato"
          className={buttonVariants({
            variant: "outline",
            className:
              "h-11 border-primary-foreground/40 bg-transparent px-4 text-primary-foreground hover:bg-primary-foreground/10",
          })}
        >
          Ver mi contrato
        </Link>
      </div>
    </section>
  );
}

// Lo que toca pagar ahora: el recibo actual (el más antiguo con saldo, o el de este mes).
function PaymentsCard({ b }: { b: MyBilling | undefined }) {
  const r = b?.current ?? null;
  if (!r) {
    return (
      <section className={cn(card, "flex flex-col gap-2")}>
        <span className={label}>Pagos</span>
        <p className="text-sm text-muted-foreground">
          No tienes recibos por ahora. Se crean cuando tu residencia confirma tu contrato.
        </p>
      </section>
    );
  }
  const total = toCents(r.total);
  const percent = total > 0 ? Math.min(100, Math.round((toCents(r.paid) / total) * 100)) : 0;
  const paid = r.status === "paid";
  return (
    <section className={cn(card, "flex flex-col gap-2.5")}>
      <span className={label}>
        {paid ? "Pagado" : "Por pagar"} · {periodLabel(r.period)}
      </span>
      <span className="text-3xl font-extrabold">{formatSoles(paid ? r.paid : r.balance)}</span>
      <span className="text-sm text-muted-foreground">
        de {formatSoles(r.total)}
        {!paid && r.nextDue ? ` · vence el ${formatLongDate(r.nextDue)}` : ""}
      </span>
      <div
        role="progressbar"
        aria-label="Cuánto pagaste de este recibo"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-2 overflow-hidden rounded-full bg-primary-soft"
      >
        <div className="h-full rounded-full bg-bar" style={{ width: `${percent}%` }} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ReceiptBadge status={r.status} balance={r.balance} paid={r.paid} />
        {r.inReview > 0 ? (
          <span className="text-xs text-muted-foreground">
            {r.inReview === 1 ? "1 comprobante en revisión" : `${r.inReview} comprobantes en revisión`}
          </span>
        ) : null}
      </div>
      <Link
        href="/mi/pagos"
        className={buttonVariants({
          className: cn(
            "mt-1 h-12 text-base",
            !paid && "bg-terracota text-terracota-foreground hover:bg-terracota/90",
          ),
          variant: paid ? "outline" : "default",
        })}
      >
        {paid ? "Ver mis pagos" : "Subir comprobante"}
      </Link>
    </section>
  );
}

// Un bloque por negocio. En el celular el orden es: contrato, pagos, documentos, contacto (lo urgente arriba).
// En escritorio: contrato y contacto arriba; documentos y pagos abajo, como en el diseño aprobado.
function Residence({
  r,
  b,
  firstName,
  showBusiness,
}: {
  r: MyResidence;
  b: MyBilling | undefined;
  firstName: string;
  showBusiness: boolean;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="order-1 lg:col-span-2">
        <ContractCard r={r} showBusiness={showBusiness} />
      </div>
      <div className="order-4 lg:order-2">
        <ContactCard b={b} firstName={firstName} />
      </div>
      {r.contract ? (
        <div className="order-3 lg:col-span-2">
          <DocumentsCard r={r} />
        </div>
      ) : null}
      <div className="order-2 lg:order-4">
        <PaymentsCard b={b} />
      </div>
    </div>
  );
}

async function Content() {
  const [{ firstName, residences }, billing] = await Promise.all([getMyResidences(), getMyBilling()]);
  const today = limaToday(new Date());
  const main = residences.find((r) => r.contract) ?? null;
  // La foto del edificio si el arrendador subió una; si no, la de respaldo (o la franja de color).
  const cover = (await coverUrl(main?.contract?.coverPath ?? null)) ?? FALLBACK_COVER;
  return (
    <>
      <ResidentHero
        greeting={greetingFor(new Date())}
        firstName={firstName}
        headline={contractHeadline(main?.contract ?? null, today)}
        coverUrl={cover}
      />
      <div className="relative mx-auto -mt-16 flex w-full max-w-5xl flex-col gap-8 px-4 pb-10 sm:px-8">
        {residences.length ? (
          residences.map((r) => (
            <Residence
              key={r.residentId}
              r={r}
              b={billing.find((x) => x.residentId === r.residentId)}
              firstName={firstName}
              showBusiness={residences.length > 1}
            />
          ))
        ) : (
          <section className={card}>
            <p className="text-muted-foreground">
              Tu cuenta todavía no está en ninguna residencia. Si te invitaron, entra desde el enlace que te
              mandaron.
            </p>
          </section>
        )}
      </div>
    </>
  );
}

export default function ResidentHomePage() {
  return (
    <Suspense fallback={<p className="px-4 py-5 text-muted-foreground sm:px-8">Cargando…</p>}>
      <Content />
    </Suspense>
  );
}
