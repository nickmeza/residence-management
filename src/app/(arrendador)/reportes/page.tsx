import { Download } from "lucide-react";
import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";

import { REPORT_TABS, SectionTabs } from "@/components/section-tabs";
import { buttonVariants } from "@/components/ui/button";
import { formatSoles } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getShellData } from "@/server/business/current";
import { periodLabel } from "@/server/payments/rules";
import { getReport, REPORT_MONTHS } from "@/server/reports/queries";

export const metadata: Metadata = { title: "Reportes · Gestión de residencias" };

const card = "flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-card";
const th = "px-4 py-3 text-left text-xs font-bold tracking-wide text-muted-foreground uppercase";
const td = "border-t px-4 py-3";

function Block({ title, csv, children }: { title: string; csv: string; children: ReactNode }) {
  return (
    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{title}</h2>
        <a
          href={`/reportes/csv?tipo=${csv}`}
          className={buttonVariants({ variant: "outline", className: "h-11 gap-2" })}
        >
          <Download className="size-4" aria-hidden="true" />
          Descargar CSV (Excel)
        </a>
      </div>
      {/* En móvil la tabla se desliza de lado. */}
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

const money = (v: string) => formatSoles(v) ?? "S/ 0";

async function Content() {
  const { current } = await getShellData();
  if (!current) return <p className="text-muted-foreground">Primero configura tu negocio.</p>;
  const report = await getReport(current.id);
  if (!report) return <p className="text-muted-foreground">No encontramos tu negocio. Recarga la página.</p>;

  if (report.kind === "meal_plan") {
    return (
      <Block title={`Pensión · últimos ${REPORT_MONTHS} meses`} csv="pension">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr>
              <th className={th}>Mes</th>
              <th className={th}>Cobrado</th>
              <th className={th}>Comensales</th>
            </tr>
          </thead>
          <tbody>
            {report.monthly.map((r) => (
              <tr key={r.period}>
                <td className={cn(td, "font-semibold capitalize")}>{periodLabel(r.period)}</td>
                <td className={td}>{money(r.collected)}</td>
                <td className={td}>{r.diners}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted-foreground">
          Cobrado: pagos confirmados, según el día en que pagaron. Comensales: con plan algún día del mes.
        </p>
      </Block>
    );
  }

  const debtors = report.overdue.residents;
  return (
    <>
      <section className={cn(card, "sm:flex-row sm:items-center sm:justify-between")}>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
            Deuda vencida hoy
          </span>
          <span className="text-2xl font-bold">{money(report.overdue.total)}</span>
        </div>
        <span className="text-muted-foreground">
          {debtors === 0
            ? "Nadie tiene recibos vencidos."
            : `${debtors} ${debtors === 1 ? "residente" : "residentes"} con recibos vencidos.`}
        </span>
      </section>
      <Block title={`Ingresos y ocupación · últimos ${REPORT_MONTHS} meses`} csv="finanzas">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr>
              <th className={th}>Mes</th>
              <th className={th}>Facturado</th>
              <th className={th}>Cobrado</th>
              <th className={th}>Por cobrar</th>
              <th className={th}>Mantenimiento</th>
              <th className={th}>Neto</th>
              <th className={th}>Ocupación</th>
            </tr>
          </thead>
          <tbody>
            {report.finance.map((r, i) => (
              <tr key={r.period}>
                <td className={cn(td, "font-semibold capitalize")}>{periodLabel(r.period)}</td>
                <td className={td}>{money(r.billed)}</td>
                <td className={td}>{money(r.collected)}</td>
                <td className={td}>{money(r.pending)}</td>
                <td className={td}>{money(r.maintenance)}</td>
                <td className={cn(td, "font-semibold")}>{money(r.net)}</td>
                <td className={td}>{report.monthly[i]?.percent ?? 0} %</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted-foreground">
          Cobrado: pagos confirmados de los recibos de ese mes. Mantenimiento: costo de los pedidos resueltos
          ese mes. Neto: cobrado menos mantenimiento.
        </p>
      </Block>
      <Block title="Ocupación de hoy por piso" csv="ocupacion">
        {report.floors.length ? (
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr>
                <th className={th}>Piso</th>
                <th className={th}>Unidades</th>
                <th className={th}>Ocupadas</th>
                <th className={th}>Ocupación</th>
              </tr>
            </thead>
            <tbody>
              {report.floors.map((f) => (
                <tr key={f.label}>
                  <td className={cn(td, "font-semibold")}>{f.label}</td>
                  <td className={td}>{f.rentable}</td>
                  <td className={td}>{f.occupied}</td>
                  <td className={td}>{f.percent} %</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-muted-foreground">Todavía no tienes unidades que se alquilen.</p>
        )}
      </Block>
    </>
  );
}

// Reportes (RP-01 a RP-05) del negocio elegido arriba: tablas simples que se descargan para Excel.
export default function ReportsPage() {
  return (
    <>
      <h1 className="text-[34px] font-bold tracking-tight">Reportes</h1>
      <SectionTabs tabs={REPORT_TABS} current="numeros" label="Secciones de reportes" />
      <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
        <Content />
      </Suspense>
    </>
  );
}
