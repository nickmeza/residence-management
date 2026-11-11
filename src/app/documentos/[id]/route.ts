import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { withRls } from "@/db/rls";
import { document } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { getSessionClaims } from "@/server/auth/session";
import { isUuid } from "@/server/business/queries";
import { DOCUMENTS_BUCKET, SIGNED_URL_SECONDS } from "@/server/documents/files";

// Abre un documento con un enlace firmado que vence en minutos. El RLS decide quién lo encuentra: el arrendador
// de ese negocio o el propio residente. Nunca se guarda ni se muestra un enlace permanente.
export async function GET(_request: NextRequest, { params }: RouteContext<"/documentos/[id]">) {
  const { id } = await params;
  if (!isUuid(id)) return new NextResponse("No encontrado", { status: 404 });
  const claims = await getSessionClaims();
  const [row] = await withRls(claims, (tx) =>
    tx.select({ path: document.storagePath }).from(document).where(eq(document.id, id)).limit(1),
  );
  if (!row) return new NextResponse("No encontrado", { status: 404 });
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(row.path, SIGNED_URL_SECONDS);
  if (!data?.signedUrl) return new NextResponse("No pudimos abrir el archivo", { status: 502 });
  return NextResponse.redirect(data.signedUrl);
}
