"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { FilterMenu } from "@/components/filter-menu";
import { StatusBadge } from "@/components/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatShortDate, formatSoles } from "@/lib/format";
import { initials } from "@/lib/greeting";
import { cn } from "@/lib/utils";
import { addDinerAction } from "@/server/pension/actions";
import type { DinerRow } from "@/server/pension/queries";
import { BILLING_CYCLE_LABEL, type BillingCycle } from "@/server/pension/rules";

import { SUBSCRIPTION_STATE } from "./subscription-state";

const GRID = "grid grid-cols-[1.6fr_1.2fr_.8fr_1fr_.9fr_auto] items-center gap-3 px-5";
const selectClass = "h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base md:text-sm";

type Filter = "active" | "paused" | "upcoming" | "ended" | "none" | "owes";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "active", label: "Activos" },
  { id: "paused", label: "En pausa" },
  { id: "upcoming", label: "Empiezan pronto" },
  { id: "ended", label: "Terminaron" },
  { id: "none", label: "Sin plan" },
  { id: "owes", label: "Deben" },
];

const matches = (d: DinerRow, f: Filter) => {
  const s = d.subscription;
  if (f === "none") return s === null;
  if (f === "owes") return s !== null && Number(s.account.balance) < 0;
  return s?.state === f;
};

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

type Draft = {
  fullName: string;
  phone: string;
  email: string;
  planId: string;
  startDate: string;
  billingCycle: BillingCycle;
  dietNote: string;
};

// Comensales de la pensión (PN-04, PN-09): buscador, Filtrar, Agregar comensal y la tabla. Al agregar se pide lo
// mínimo (decisión del dueño): nombre y celular o correo, su plan y cada cuánto paga.
export function DinerList({
  businessId,
  today,
  diners,
  plans,
  diets,
}: {
  businessId: string;
  today: string;
  diners: DinerRow[];
  plans: { id: string; name: string; dailyPrice: string }[];
  diets: string[];
}) {
  const router = useRouter();
  const [filters, setFilters] = useState<Filter[]>([]);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<{ message: string; fields: Record<string, string> }>();
  const [pending, startTransition] = useTransition();

  const q = fold(query.trim());
  const shown = diners.filter(
    (d) =>
      (filters.length === 0 || filters.some((f) => matches(d, f))) &&
      (q === "" || fold(`${d.name} ${d.phone ?? ""} ${d.email ?? ""}`).includes(q)),
  );

  const open = () => {
    setError(undefined);
    setDraft({
      fullName: "",
      phone: "",
      email: "",
      planId: plans[0]?.id ?? "",
      startDate: today,
      billingCycle: "weekly",
      dietNote: "",
    });
  };

  const save = () =>
    draft &&
    startTransition(async () => {
      setError(undefined);
      const result = await addDinerAction(businessId, draft);
      if (!result.ok) {
        return setError({
          message: result.message,
          fields: ("fieldErrors" in result ? result.fieldErrors : undefined) ?? {},
        });
      }
      setDraft(null);
      router.push(`/pension/comensales/${result.id}`);
    });

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  const fieldError = (name: keyof Draft) =>
    error?.fields[name] ? <p className="text-sm text-danger">{error.fields[name]}</p> : null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative w-full sm:w-72">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            aria-label="Buscar"
            type="search"
            placeholder="Buscar por nombre o celular"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 pl-9"
          />
        </div>
        <FilterMenu
          options={FILTERS.map((f) => ({ ...f, count: diners.filter((d) => matches(d, f.id)).length }))}
          selected={filters}
          onChange={setFilters}
        />
        <span className="hidden flex-1 sm:block" />
        <Button type="button" className="h-11 gap-2" onClick={open} disabled={!plans.length}>
          <Plus className="size-4" aria-hidden="true" />
          Agregar comensal
        </Button>
      </div>
      {!plans.length ? (
        <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-card">
          Para agregar comensales primero crea un plan en{" "}
          <Link
            href="/pension/configuracion"
            className="font-semibold text-link underline-offset-4 hover:underline"
          >
            Configuración
          </Link>
          .
        </p>
      ) : null}

      <section className="overflow-hidden rounded-xl border bg-card shadow-card">
        {/* En móvil la tabla se desliza de lado. */}
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div
              className={cn(
                GRID,
                "bg-background py-3 text-xs font-bold tracking-wide text-muted-foreground uppercase",
              )}
            >
              <span>Comensal</span>
              <span>Plan</span>
              <span>Paga</span>
              <span>Pagado hasta</span>
              <span>Estado</span>
              <span className="sr-only">Acciones</span>
            </div>
            {shown.length ? (
              <ul>
                {shown.map((d) => {
                  const s = d.subscription;
                  const owes = s !== null && Number(s.account.balance) < 0;
                  return (
                    <li key={d.residentId} className={cn(GRID, "border-t py-3.5 text-sm")}>
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary-text">
                          {initials(d.name)}
                        </span>
                        <span className="min-w-0">
                          <b className="block truncate">{d.name}</b>
                          <span className="block truncate text-muted-foreground">{d.phone ?? d.email}</span>
                        </span>
                      </span>
                      <span>
                        {s ? (
                          <>
                            <span className="block">{s.planName}</span>
                            {s.dietNote ? (
                              <span className="block truncate text-muted-foreground">{s.dietNote}</span>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-muted-foreground">Sin plan</span>
                        )}
                      </span>
                      <span>{s ? BILLING_CYCLE_LABEL[s.billingCycle] : "—"}</span>
                      <span>
                        {s?.account.paidUntil ? (
                          formatShortDate(s.account.paidUntil)
                        ) : (
                          <span className="text-muted-foreground">Sin pagos</span>
                        )}
                        {owes ? (
                          <span className="block font-semibold text-danger">
                            Debe {formatSoles(-Number(s.account.balance))}
                          </span>
                        ) : null}
                      </span>
                      <span>
                        {s ? (
                          <StatusBadge tone={SUBSCRIPTION_STATE[s.state].tone}>
                            {SUBSCRIPTION_STATE[s.state].label}
                          </StatusBadge>
                        ) : (
                          <StatusBadge tone="neutral">Sin plan</StatusBadge>
                        )}
                      </span>
                      <Link
                        href={`/pension/comensales/${d.residentId}`}
                        className={buttonVariants({ variant: "outline", className: "h-11" })}
                      >
                        Ver
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="border-t px-5 py-8 text-center text-muted-foreground">
                {diners.length
                  ? "Nadie coincide con ese filtro o búsqueda."
                  : "Todavía no tienes comensales. Agrega el primero con “Agregar comensal”."}
              </p>
            )}
          </div>
        </div>
        <p className="border-t px-5 py-3 text-sm text-muted-foreground">
          Mostrando {shown.length} de {diners.length} {diners.length === 1 ? "comensal" : "comensales"}
        </p>
      </section>

      <Dialog open={draft !== null} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar comensal</DialogTitle>
            <DialogDescription>
              Solo su nombre y su celular o correo. Por defecto se le cocina todos los días de su plan.
            </DialogDescription>
          </DialogHeader>
          {draft ? (
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="d-name">Nombre y apellido</Label>
                <Input
                  id="d-name"
                  className="h-11"
                  value={draft.fullName}
                  onChange={(e) => set("fullName", e.target.value)}
                />
                {fieldError("fullName")}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="d-phone">Celular</Label>
                  <Input
                    id="d-phone"
                    className="h-11"
                    inputMode="tel"
                    value={draft.phone}
                    onChange={(e) => set("phone", e.target.value)}
                  />
                  {fieldError("phone")}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="d-email">Correo (opcional)</Label>
                  <Input
                    id="d-email"
                    className="h-11"
                    type="email"
                    value={draft.email}
                    onChange={(e) => set("email", e.target.value)}
                  />
                  {fieldError("email")}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="d-plan">Plan</Label>
                <select
                  id="d-plan"
                  className={selectClass}
                  value={draft.planId}
                  onChange={(e) => set("planId", e.target.value)}
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {formatSoles(p.dailyPrice)} al día
                    </option>
                  ))}
                </select>
                {fieldError("planId")}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="d-start">Desde</Label>
                  <Input
                    id="d-start"
                    className="h-11"
                    type="date"
                    value={draft.startDate}
                    onChange={(e) => set("startDate", e.target.value)}
                  />
                  {fieldError("startDate")}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="d-cycle">Paga por adelantado</Label>
                  <select
                    id="d-cycle"
                    className={selectClass}
                    value={draft.billingCycle}
                    onChange={(e) => set("billingCycle", e.target.value as BillingCycle)}
                  >
                    {(Object.keys(BILLING_CYCLE_LABEL) as BillingCycle[]).map((c) => (
                      <option key={c} value={c}>
                        {BILLING_CYCLE_LABEL[c]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="d-diet">Dieta o alergias (opcional)</Label>
                <Input
                  id="d-diet"
                  className="h-11"
                  list="d-diets"
                  value={draft.dietNote}
                  onChange={(e) => set("dietNote", e.target.value)}
                />
                <datalist id="d-diets">
                  {diets.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
                {fieldError("dietNote")}
              </div>
              <FormMessage message={error?.message} />
              <DialogFooter>
                <Button type="button" variant="outline" className="h-11" onClick={() => setDraft(null)}>
                  Cancelar
                </Button>
                <Button type="submit" className="h-11 px-5" disabled={pending}>
                  {pending ? "Guardando…" : "Agregar comensal"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
