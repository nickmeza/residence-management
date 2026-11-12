import "server-only";

import { eq } from "drizzle-orm";

import type { withRls } from "@/db/rls";
import { business, contract, contractTemplate } from "@/db/schema";

import type { templateSchema } from "./schemas";

// Cambios de plantillas dentro de una transacción con la sesión (RLS). Las acciones validan antes.

type Tx = Parameters<Parameters<typeof withRls>[1]>[0];
type Data = import("zod").output<typeof templateSchema>;

export class TemplateError extends Error {}

export async function createTemplate(tx: Tx, businessId: string, data: Data) {
  const [own] = await tx
    .select({ id: business.id })
    .from(business)
    .where(eq(business.id, businessId))
    .limit(1);
  if (!own) throw new TemplateError("No encontramos tu negocio. Recarga la página.");
  const [row] = await tx
    .insert(contractTemplate)
    .values({ businessId, ...data })
    .returning({ id: contractTemplate.id });
  return row.id;
}

export async function updateTemplate(tx: Tx, id: string, data: Data) {
  const [row] = await tx
    .update(contractTemplate)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(contractTemplate.id, id))
    .returning({ businessId: contractTemplate.businessId });
  if (!row) throw new TemplateError("No encontramos esa plantilla. Recarga la página.");
  return row.businessId;
}

// Una plantilla que usa algún contrato no se borra: el contrato debe poder volver a generar su PDF.
export async function deleteTemplate(tx: Tx, id: string) {
  const [used] = await tx
    .select({ id: contract.id })
    .from(contract)
    .where(eq(contract.templateId, id))
    .limit(1);
  if (used) throw new TemplateError("La usan contratos, así que no se puede borrar. Puedes editarla.");
  const [row] = await tx
    .delete(contractTemplate)
    .where(eq(contractTemplate.id, id))
    .returning({ businessId: contractTemplate.businessId });
  if (!row) throw new TemplateError("No encontramos esa plantilla. Recarga la página.");
  return row.businessId;
}
