import type { NextRequest } from "next/server";

import { renderContractPdf } from "@/server/contracts/pdf";
import { getContractPdfData } from "@/server/contracts/queries";
import { fillTemplate, templateValues } from "@/server/contracts/template";

// Nombre de archivo sin tildes ni espacios: "Cuarto 101" → "cuarto-101".
const slug = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// PDF del contrato desde su plantilla, rellenado con los datos de hoy. Se abre en el navegador para imprimir.
export async function GET(_req: NextRequest, ctx: RouteContext<"/contratos/[id]/pdf">) {
  const { id } = await ctx.params;
  const data = await getContractPdfData(id);
  if (!data) return new Response("No encontramos ese contrato o no tiene plantilla.", { status: 404 });
  const { text } = fillTemplate(data.templateBody, templateValues(data.template));
  const pdf = await renderContractPdf({
    title: data.templateName,
    text,
    landlordName: data.landlordName,
    residentName: data.template.residentName,
  });
  const fileName = `contrato-${slug(data.template.unitName)}-${slug(data.template.residentName)}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
      // Tiene datos personales: que no se guarde en cachés compartidas.
      "Cache-Control": "private, no-store",
    },
  });
}
