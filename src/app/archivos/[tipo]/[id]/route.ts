import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { withRls } from "@/db/rls";
import { depositRefund, entryReport, payment, pensionPayment, settlementDiscount } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { getSessionClaims } from "@/server/auth/session";
import { isUuid } from "@/server/business/queries";
import { DOCUMENTS_BUCKET, SIGNED_URL_SECONDS } from "@/server/documents/files";

// Abre un archivo de cobros o garantía (comprobante, foto de ingreso, foto de un descuento, comprobante de
// devolución) con un enlace firmado que vence en minutos. Como en /documentos/[id], el RLS decide quién lo
// encuentra: el arrendador de ese negocio o el propio residente.
const SOURCES = {
  comprobante: { table: payment, column: payment.proofPath, id: payment.id },
  ingreso: { table: entryReport, column: entryReport.photoPath, id: entryReport.id },
  descuento: { table: settlementDiscount, column: settlementDiscount.photoPath, id: settlementDiscount.id },
  devolucion: { table: depositRefund, column: depositRefund.proofPath, id: depositRefund.id },
  // Comprobante de un pago de pensión (lo ve la cocina de esa pensión o el propio comensal).
  "comprobante-pension": { table: pensionPayment, column: pensionPayment.proofPath, id: pensionPayment.id },
} as const;

export async function GET(_request: NextRequest, { params }: RouteContext<"/archivos/[tipo]/[id]">) {
  const { tipo, id } = await params;
  const source = SOURCES[tipo as keyof typeof SOURCES];
  if (!source || !isUuid(id)) return new NextResponse("No encontrado", { status: 404 });
  const claims = await getSessionClaims();
  const [row] = await withRls(claims, (tx) =>
    tx.select({ path: source.column }).from(source.table).where(eq(source.id, id)).limit(1),
  );
  if (!row?.path) return new NextResponse("No encontrado", { status: 404 });
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(row.path, SIGNED_URL_SECONDS);
  if (!data?.signedUrl) return new NextResponse("No pudimos abrir el archivo", { status: 502 });
  return NextResponse.redirect(data.signedUrl);
}
