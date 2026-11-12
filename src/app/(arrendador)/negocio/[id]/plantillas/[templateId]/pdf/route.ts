import type { NextRequest } from "next/server";

import { renderContractPdf } from "@/server/contracts/pdf";
import { fillTemplate } from "@/server/contracts/template";
import { listTemplates } from "@/server/templates/queries";
import { EXAMPLE_VALUES } from "@/server/templates/schemas";

// Vista previa en PDF de una plantilla, con datos de ejemplo entre corchetes.
export async function GET(_req: NextRequest, ctx: RouteContext<"/negocio/[id]/plantillas/[templateId]/pdf">) {
  const { id, templateId } = await ctx.params;
  const found = (await listTemplates(id))?.templates.find((t) => t.id === templateId);
  if (!found) return new Response("No encontramos esa plantilla.", { status: 404 });
  const pdf = await renderContractPdf({
    title: found.name,
    text: fillTemplate(found.body, EXAMPLE_VALUES).text,
    landlordName: "[Arrendador]",
    residentName: "[Residente]",
  });
  return new Response(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="ejemplo.pdf"' },
  });
}
