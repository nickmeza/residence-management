import type { NextRequest } from "next/server";

import { renderContractPdf } from "@/server/contracts/pdf";
import { getMyContractPdfData } from "@/server/contracts/queries";
import { fillTemplate, templateValues } from "@/server/contracts/template";

// El PDF del contrato, para el residente. Solo su propio contrato (ver getMyContractPdfData).
export async function GET(_req: NextRequest, ctx: RouteContext<"/mi/contrato/[id]/pdf">) {
  const { id } = await ctx.params;
  const data = await getMyContractPdfData(id);
  if (!data) return new Response("No encontramos ese contrato.", { status: 404 });
  const { text } = fillTemplate(data.templateBody, templateValues(data.template));
  const pdf = await renderContractPdf({
    title: data.templateName,
    text,
    landlordName: data.landlordName,
    residentName: data.template.residentName,
  });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="mi-contrato.pdf"',
      // Tiene datos personales: que no se guarde en cachés compartidas.
      "Cache-Control": "private, no-store",
    },
  });
}
