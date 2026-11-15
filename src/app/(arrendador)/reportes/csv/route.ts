import { NextResponse, type NextRequest } from "next/server";

import { getShellData } from "@/server/business/current";
import { periodLabel } from "@/server/payments/rules";
import { getReport } from "@/server/reports/queries";
import { toCsv } from "@/server/reports/rules";

// Descarga una tabla de Reportes como CSV (RP-03), del negocio elegido arriba. Excel lo abre directo: va con "BOM"
// (una marca al inicio) para que respete las tildes.
export async function GET(request: NextRequest) {
  const { current } = await getShellData();
  const report = current ? await getReport(current.id) : null;
  if (!report) return new NextResponse("No encontrado", { status: 404 });
  const tipo = request.nextUrl.searchParams.get("tipo");
  let csv: string | null = null;
  if (report.kind === "residence" && tipo === "ocupacion") {
    csv = toCsv(
      ["Piso", "Unidades", "Ocupadas", "Ocupación %"],
      report.floors.map((f) => [f.label, f.rentable, f.occupied, f.percent]),
    );
  } else if (report.kind === "residence" && tipo === "finanzas") {
    csv = toCsv(
      ["Mes", "Facturado", "Cobrado", "Por cobrar", "Mantenimiento", "Neto", "Ocupación %"],
      report.finance.map((r, i) => [
        periodLabel(r.period),
        r.billed,
        r.collected,
        r.pending,
        r.maintenance,
        r.net,
        report.monthly[i]?.percent ?? 0,
      ]),
    );
  } else if (report.kind === "meal_plan" && tipo === "pension") {
    csv = toCsv(
      ["Mes", "Cobrado", "Comensales"],
      report.monthly.map((r) => [periodLabel(r.period), r.collected, r.diners]),
    );
  }
  if (!csv) return new NextResponse("No encontrado", { status: 404 });
  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reporte-${tipo}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
