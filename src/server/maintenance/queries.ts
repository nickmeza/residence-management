import "server-only";

import { asc, eq, inArray, sql } from "drizzle-orm";
import { withRls } from "@/db/rls";
import {
  business,
  floor,
  maintenanceComment,
  maintenanceRequest,
  person,
  property,
  resident,
  unit,
} from "@/db/schema";
import { getSessionClaims } from "@/server/auth/session";
import { isUuid } from "@/server/business/queries";

import {
  compareRequests,
  type MaintenanceCategory,
  type MaintenancePriority,
  type MaintenanceStatus,
} from "./rules";

export type RequestRow = {
  id: string;
  title: string;
  category: MaintenanceCategory;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  unitName: string | null;
  residentName: string | null;
  assignee: string | null;
  blocksUnit: boolean;
  createdAt: Date;
  comments: number;
};

// Pedidos de un negocio de Residencia (MT-02), con su unidad y quién lo pidió. null si el negocio no es de quien
// inició sesión.
export async function listRequests(businessId: string): Promise<RequestRow[] | null> {
  if (!isUuid(businessId)) return null;
  const claims = await getSessionClaims();
  return withRls(claims, async (tx) => {
    const [b] = await tx
      .select({ id: business.id })
      .from(business)
      .where(eq(business.id, businessId))
      .limit(1);
    if (!b) return null;
    const rows = await tx
      .select({
        id: maintenanceRequest.id,
        title: maintenanceRequest.title,
        category: maintenanceRequest.category,
        priority: maintenanceRequest.priority,
        status: maintenanceRequest.status,
        unitName: unit.name,
        residentName: person.fullName,
        assignee: maintenanceRequest.assignee,
        blocksUnit: maintenanceRequest.blocksUnit,
        createdAt: maintenanceRequest.createdAt,
        comments: sql<number>`(select count(*)::int from ${maintenanceComment} where ${maintenanceComment.requestId} = ${maintenanceRequest.id})`,
      })
      .from(maintenanceRequest)
      .leftJoin(unit, eq(unit.id, maintenanceRequest.unitId))
      .leftJoin(resident, eq(resident.id, maintenanceRequest.residentId))
      .leftJoin(person, eq(person.id, resident.personId))
      .where(eq(maintenanceRequest.businessId, businessId));
    return rows.sort(compareRequests);
  });
}

export type RequestComment = { id: string; authorName: string; mine: boolean; body: string; createdAt: Date };

export type RequestDetail = RequestRow & {
  businessId: string;
  supplierId: string | null;
  description: string | null;
  cost: string | null;
  hasPhoto: boolean;
  resolvedAt: Date | null;
  residentId: string | null;
  reportedByName: string;
  commentList: RequestComment[];
};

async function loadComments(
  tx: Parameters<Parameters<typeof withRls>[1]>[0],
  requestId: string,
  userId: string,
) {
  const rows = await tx
    .select({
      id: maintenanceComment.id,
      authorName: person.fullName,
      authorUserId: person.userId,
      body: maintenanceComment.body,
      createdAt: maintenanceComment.createdAt,
    })
    .from(maintenanceComment)
    .leftJoin(person, eq(person.id, maintenanceComment.authorId))
    .where(eq(maintenanceComment.requestId, requestId))
    .orderBy(asc(maintenanceComment.createdAt));
  return rows.map((c) => ({
    id: c.id,
    // El residente no puede leer la persona del arrendador (RLS): se muestra "Tu residencia".
    authorName: c.authorName ?? "Tu residencia",
    mine: c.authorUserId === userId,
    body: c.body,
    createdAt: c.createdAt,
  }));
}

// Detalle de un pedido para el arrendador (MT-03). null si no es de sus negocios.
export async function getRequest(id: string): Promise<RequestDetail | null> {
  if (!isUuid(id)) return null;
  const claims = await getSessionClaims();
  return withRls(claims, async (tx) => {
    const reporter = sql`(select p.full_name from public.person p where p.id = ${maintenanceRequest.reportedBy})`;
    const [r] = await tx
      .select({
        id: maintenanceRequest.id,
        businessId: maintenanceRequest.businessId,
        title: maintenanceRequest.title,
        description: maintenanceRequest.description,
        category: maintenanceRequest.category,
        priority: maintenanceRequest.priority,
        status: maintenanceRequest.status,
        unitName: unit.name,
        residentId: maintenanceRequest.residentId,
        residentName: person.fullName,
        assignee: maintenanceRequest.assignee,
        supplierId: maintenanceRequest.supplierId,
        cost: maintenanceRequest.cost,
        blocksUnit: maintenanceRequest.blocksUnit,
        photoPath: maintenanceRequest.photoPath,
        createdAt: maintenanceRequest.createdAt,
        resolvedAt: maintenanceRequest.resolvedAt,
        reportedByName: sql<string | null>`${reporter}`,
        ownerId: business.ownerId,
      })
      .from(maintenanceRequest)
      .innerJoin(business, eq(business.id, maintenanceRequest.businessId))
      .leftJoin(unit, eq(unit.id, maintenanceRequest.unitId))
      .leftJoin(resident, eq(resident.id, maintenanceRequest.residentId))
      .leftJoin(person, eq(person.id, resident.personId))
      .where(eq(maintenanceRequest.id, id))
      .limit(1);
    if (!r) return null;
    const commentList = await loadComments(tx, id, claims.sub);
    const { photoPath, ownerId: _owner, ...rest } = r;
    void _owner;
    return {
      ...rest,
      hasPhoto: photoPath !== null,
      reportedByName: r.reportedByName ?? "Tu residencia",
      comments: commentList.length,
      commentList,
    };
  });
}

// Unidades del negocio para el formulario del arrendador ("Edificio Sol · 201").
export async function listUnitOptions(businessId: string) {
  const claims = await getSessionClaims();
  return withRls(claims, (tx) =>
    tx
      .select({ id: unit.id, name: unit.name, propertyName: property.name, level: floor.level })
      .from(unit)
      .innerJoin(floor, eq(floor.id, unit.floorId))
      .innerJoin(property, eq(property.id, floor.propertyId))
      .where(eq(property.businessId, businessId))
      .orderBy(asc(property.name), asc(floor.level), asc(unit.name)),
  );
}

export type MyRequest = {
  id: string;
  title: string;
  description: string | null;
  category: MaintenanceCategory;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  createdAt: Date;
  resolvedAt: Date | null;
  hasPhoto: boolean;
  comments: RequestComment[];
};

// Los pedidos del residente (MT-07), lo más nuevo primero, con su conversación.
export async function listMyRequests(): Promise<MyRequest[]> {
  const claims = await getSessionClaims();
  return withRls(claims, async (tx) => {
    const cards = await tx
      .select({ id: resident.id })
      .from(resident)
      .innerJoin(person, eq(person.id, resident.personId))
      .where(eq(person.userId, claims.sub));
    if (!cards.length) return [];
    const rows = await tx
      .select()
      .from(maintenanceRequest)
      .where(
        inArray(
          maintenanceRequest.residentId,
          cards.map((c) => c.id),
        ),
      );
    rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        category: r.category,
        priority: r.priority,
        status: r.status,
        createdAt: r.createdAt,
        resolvedAt: r.resolvedAt,
        hasPhoto: r.photoPath !== null,
        comments: await loadComments(tx, r.id, claims.sub),
      })),
    );
  });
}
