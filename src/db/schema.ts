// Tablas de la base con Drizzle. Modelo completo en docs/modelo-de-datos.md.
// Negocio → Propiedad → Piso → Unidad. Cada fila pertenece a una persona por la cadena
// cuenta (auth.users) → person → business → property → floor → unit, y el RLS la sigue.
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgPolicy,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { authenticatedRole, authUid, authUsers } from "drizzle-orm/supabase";

export const propertyType = pgEnum("property_type", ["room", "floor", "building"]);
export const unitType = pgEnum("unit_type", ["apartment", "room"]);
export const rentalMode = pgEnum("rental_mode", ["whole", "by_room"]);
export const bathroomType = pgEnum("bathroom_type", ["private", "shared"]);
// Tipo de ambiente de una unidad (historia ED-06, "uso"): dormitorio, estudio, oficina, depósito u otro.
export const spaceType = pgEnum("space_type", ["bedroom", "studio", "office", "storage", "other"]);
// Cada negocio es un servicio. Lavandería, cowork… se agregan cuando salgan de pausa.
export const businessService = pgEnum("business_service", ["residence", "meal_plan"]);
export const businessKind = pgEnum("business_kind", ["natural", "company"]);
export const paymentMethod = pgEnum("payment_method", ["yape", "plin", "transfer", "cash", "card"]);
// DNI, carné de extranjería o pasaporte.
export const identityDocumentType = pgEnum("identity_document_type", ["dni", "foreign_id", "passport"]);
// Modalidad del contrato: sin contrato escrito, contrato en papel propio o generado desde una plantilla.
export const contractPaperwork = pgEnum("contract_paperwork", ["none", "paper", "template"]);
// Vigente, por vencer y terminado no se guardan: se calculan de las fechas.
export const contractStatus = pgEnum("contract_status", [
  "draft",
  "pending_signature",
  "confirmed",
  "cancelled",
]);
export const documentFormat = pgEnum("document_format", ["pdf", "image"]);
export const documentKind = pgEnum("document_kind", ["requirement", "signed_contract", "other"]);
export const documentStatus = pgEnum("document_status", ["in_review", "verified", "rejected"]);
// Fase 5. Regla 5: sin garantía, 1 mes, 2 meses o monto fijo.
export const depositRule = pgEnum("deposit_rule", ["none", "one_month", "two_months", "fixed"]);
// "Por cobrar" y "En disputa" no se guardan: salen del cargo de la garantía y de los descuentos.
export const depositStatus = pgEnum("deposit_status", ["none", "held", "settling", "returned"]);
// Pensión y servicios extra se agregan cuando lleguen sus fases.
export const chargeConcept = pgEnum("charge_concept", ["rent", "deposit", "damages"]);
export const paymentStatus = pgEnum("payment_status", ["in_review", "confirmed", "rejected"]);
export const inspectionArea = pgEnum("inspection_area", [
  "walls",
  "door",
  "window",
  "furniture",
  "keys",
  "cleaning",
  "other",
]);
export const settlementStatus = pgEnum("settlement_status", ["draft", "sent", "closed"]);
export const discountStatus = pgEnum("discount_status", ["active", "disputed", "adjusted", "withdrawn"]);

// Persona: dueño, encargado, residente… Puede tener cuenta (user_id) o no.
// Se crea sola al registrarse (trigger en la migración a mano). Los roles llegan en la Fase 4.
export const person = pgTable(
  "person",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .unique()
      .references(() => authUsers.id, { onDelete: "set null" }),
    fullName: text().notNull(),
    email: text(),
    phone: text(),
    // Cuándo aceptó los Términos y la Política de privacidad al registrarse.
    termsAcceptedAt: timestamp({ withTimezone: true }),
    // Documento de identidad (opcional). Puede quedarse solo con el número, sin archivo subido.
    identityDocumentType: identityDocumentType(),
    identityDocumentNumber: text(),
  },
  (t) => [
    check(
      "person_identity_document_pair",
      sql`(${t.identityDocumentType} is null) = (${t.identityDocumentNumber} is null)`,
    ),
    check(
      "person_dni_format",
      sql`${t.identityDocumentType} is distinct from 'dni' or ${t.identityDocumentNumber} ~ '^[0-9]{8}$'`,
    ),
    pgPolicy("person_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.userId} = ${authUid}`,
    }),
    pgPolicy("person_update_own", {
      for: "update",
      to: authenticatedRole,
      using: sql`${t.userId} = ${authUid}`,
      withCheck: sql`${t.userId} = ${authUid}`,
    }),
    // El arrendador ve a las personas que son residentes de sus negocios. Usa una función de la base
    // (migración 0006) porque una subconsulta directa a resident volvería a pasar por esta misma tabla.
    pgPolicy("person_select_my_residents", {
      for: "select",
      to: authenticatedRole,
      using: sql`public.is_resident_of_my_business(${t.id})`,
    }),
    // Y edita sus datos solo mientras el residente no tenga cuenta; después los edita él mismo.
    pgPolicy("person_update_my_residents_without_account", {
      for: "update",
      to: authenticatedRole,
      using: sql`${t.userId} is null and public.is_resident_of_my_business(${t.id})`,
      withCheck: sql`${t.userId} is null and public.is_resident_of_my_business(${t.id})`,
    }),
    // El arrendador crea personas sin cuenta (residentes por invitar).
    pgPolicy("person_insert_without_account", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${t.userId} is null`,
    }),
  ],
);

// La persona con sesión. Se usa en las políticas de las demás tablas.
const myPersonIds = sql`(select id from public.person where user_id = ${authUid})`;

// Negocio: una Residencia, una Pensión… Una persona puede tener varios, cada uno con sus datos
// (RUC, contacto, cobros). Son independientes entre sí, aunque sean del mismo dueño.
export const business = pgTable(
  "business",
  {
    id: uuid().primaryKey().defaultRandom(),
    ownerId: uuid()
      .notNull()
      .references(() => person.id, { onDelete: "restrict" }),
    service: businessService().notNull(),
    kind: businessKind().notNull(),
    tradeName: text().notNull(),
    legalName: text(),
    ruc: text(),
    phone: text(),
    contactEmail: text(),
    city: text(),
    // La Pensión puede tener su propio local; la Residencia usa la dirección de cada propiedad.
    address: text(),
    paymentMethods: paymentMethod()
      .array()
      .notNull()
      .default(sql`'{}'`),
    // Día de cobro del mes. 31 = fin de mes (en meses más cortos, el último día).
    billingDay: smallint(),
    // Mes incompleto (entra o sale a mitad de mes): true = se cobran solo los días; false = el mes completo.
    prorateRent: boolean().notNull().default(true),
  },
  (t) => [
    index("business_owner_id_idx").on(t.ownerId),
    check("business_ruc_format", sql`${t.ruc} is null or ${t.ruc} ~ '^[0-9]{11}$'`),
    check("business_billing_day_range", sql`${t.billingDay} is null or ${t.billingDay} between 1 and 31`),
    pgPolicy("business_owner_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.ownerId} in ${myPersonIds}`,
      withCheck: sql`${t.ownerId} in ${myPersonIds}`,
    }),
  ],
);

// Los negocios de la persona con sesión.
const myBusinessIds = sql`(select b.id from public.business b where b.owner_id in ${myPersonIds})`;

// Propiedad: pertenece a un negocio de Residencia (el servidor valida que el negocio sea de ese tipo).
export const property = pgTable(
  "property",
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid()
      .notNull()
      .references(() => business.id, { onDelete: "restrict" }),
    name: text().notNull(),
    address: text().notNull(),
    districtCity: text().notNull(),
    type: propertyType().notNull(),
    ownerLivesHere: boolean().notNull().default(false),
    managerId: uuid().references(() => person.id, { onDelete: "set null" }),
    currency: text().notNull().default("PEN"),
  },
  (t) => [
    index("property_business_id_idx").on(t.businessId),
    pgPolicy("property_owner_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.businessId} in ${myBusinessIds}`,
      withCheck: sql`${t.businessId} in ${myBusinessIds}`,
    }),
  ],
);

// Una esquina del contorno de la losa, en metros.
export type OutlinePoint = { x: number; z: number };

export const floor = pgTable(
  "floor",
  {
    id: uuid().primaryKey().defaultRandom(),
    propertyId: uuid()
      .notNull()
      .references(() => property.id, { onDelete: "cascade" }),
    // Posición del piso. "Piso N" se calcula de aquí, no se guarda.
    level: integer().notNull(),
    // Contorno de la losa: esquinas en orden, con bordes en ángulo recto (rectángulo, L, U…).
    // El servidor valida que los cuartos queden dentro.
    outline: jsonb().$type<OutlinePoint[]>().notNull(),
  },
  (t) => [
    index("floor_property_id_idx").on(t.propertyId),
    check(
      "floor_outline_min_corners",
      sql`jsonb_typeof(${t.outline}) = 'array' and jsonb_array_length(${t.outline}) >= 4`,
    ),
    pgPolicy("floor_owner_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`exists (select 1 from public.property p where p.id = ${t.propertyId} and p.business_id in ${myBusinessIds})`,
      withCheck: sql`exists (select 1 from public.property p where p.id = ${t.propertyId} and p.business_id in ${myBusinessIds})`,
    }),
  ],
);

// Departamento o cuarto. El estado (disponible, ocupado, mantenimiento) no se guarda: se deriva.
export const unit = pgTable(
  "unit",
  {
    id: uuid().primaryKey().defaultRandom(),
    floorId: uuid()
      .notNull()
      .references(() => floor.id, { onDelete: "cascade" }),
    parentUnitId: uuid().references((): AnyPgColumn => unit.id, { onDelete: "cascade" }),
    type: unitType().notNull(),
    name: text().notNull(),
    occupiesWholeFloor: boolean().notNull().default(false),
    rentalMode: rentalMode(),
    // Dinero: numeric exacto. Drizzle lo devuelve como texto para no perder decimales.
    monthlyPrice: numeric({ precision: 10, scale: 2 }),
    // Nombre explícito: la conversión automática habría dado "area_m_2".
    areaM2: numeric("area_m2", { precision: 8, scale: 2 }),
    bathroom: bathroomType(),
    // Tipo de ambiente (opcional): las unidades creadas antes de este campo quedan sin tipo.
    spaceType: spaceType(),
    furnished: boolean().notNull().default(false),
    // Rectángulo en la planta, en metros.
    posX: numeric({ precision: 8, scale: 2, mode: "number" }).notNull(),
    posZ: numeric({ precision: 8, scale: 2, mode: "number" }).notNull(),
    width: numeric({ precision: 8, scale: 2, mode: "number" }).notNull(),
    depth: numeric({ precision: 8, scale: 2, mode: "number" }).notNull(),
  },
  (t) => [
    index("unit_floor_id_idx").on(t.floorId),
    index("unit_parent_unit_id_idx").on(t.parentUnitId),
    // Modo de alquiler y "ocupa todo el piso" son solo de departamentos; un departamento siempre tiene modo.
    check(
      "unit_apartment_fields",
      sql`(${t.type} = 'apartment' and ${t.rentalMode} is not null)
        or (${t.type} = 'room' and ${t.rentalMode} is null and ${t.occupiesWholeFloor} = false)`,
    ),
    // Por cuartos: el precio va en cada cuarto, nunca en el departamento.
    check(
      "unit_by_room_without_price",
      sql`${t.rentalMode} is distinct from 'by_room' or ${t.monthlyPrice} is null`,
    ),
    // Solo un cuarto puede estar dentro de otra unidad.
    check("unit_parent_only_rooms", sql`${t.parentUnitId} is null or ${t.type} = 'room'`),
    check("unit_positive_size", sql`${t.width} > 0 and ${t.depth} > 0`),
    check("unit_price_not_negative", sql`${t.monthlyPrice} is null or ${t.monthlyPrice} >= 0`),
    check("unit_area_positive", sql`${t.areaM2} is null or ${t.areaM2} > 0`),
    pgPolicy("unit_owner_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`exists (select 1 from public.floor f join public.property p on p.id = f.property_id
        where f.id = ${t.floorId} and p.business_id in ${myBusinessIds})`,
      withCheck: sql`exists (select 1 from public.floor f join public.property p on p.id = f.property_id
        where f.id = ${t.floorId} and p.business_id in ${myBusinessIds})`,
    }),
  ],
);

// --- Fase 4: residentes, contratos y documentos ---

// Las fichas de residente de los negocios de la persona con sesión (vista del arrendador).
const myBusinessResidentIds = sql`(select r.id from public.resident r where r.business_id in ${myBusinessIds})`;
// Las fichas de la persona con sesión como residente (puede estar en negocios de dueños distintos).
const myOwnResidentIds = sql`(select r.id from public.resident r where r.person_id in ${myPersonIds})`;

// Ficha del residente en un negocio. Los datos personales (nombre, documento, teléfono) están en person y se
// comparten; lo de aquí es propio de cada negocio y los demás negocios no lo ven.
export const resident = pgTable(
  "resident",
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid()
      .notNull()
      .references(() => business.id, { onDelete: "restrict" }),
    personId: uuid()
      .notNull()
      .references(() => person.id, { onDelete: "restrict" }),
    emergencyContactName: text(),
    emergencyContactPhone: text(),
    university: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Una persona tiene una sola ficha por negocio.
    uniqueIndex("resident_business_person_idx").on(t.businessId, t.personId),
    index("resident_person_id_idx").on(t.personId),
    pgPolicy("resident_landlord_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.businessId} in ${myBusinessIds}`,
      withCheck: sql`${t.businessId} in ${myBusinessIds}`,
    }),
    pgPolicy("resident_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.personId} in ${myPersonIds}`,
    }),
  ],
);

// Invitación para que el residente cree su cuenta. Se guarda solo el hash del enlace: si alguien lee la tabla,
// no puede usarla. Aceptarla lo hace el servidor, no el RLS.
export const residentInvitation = pgTable(
  "resident_invitation",
  {
    id: uuid().primaryKey().defaultRandom(),
    residentId: uuid()
      .notNull()
      .references(() => resident.id, { onDelete: "cascade" }),
    tokenHash: text().notNull().unique(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    acceptedAt: timestamp({ withTimezone: true }),
    createdBy: uuid()
      .notNull()
      .references(() => person.id, { onDelete: "restrict" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("resident_invitation_resident_id_idx").on(t.residentId),
    pgPolicy("resident_invitation_landlord_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.residentId} in ${myBusinessResidentIds}`,
      withCheck: sql`${t.residentId} in ${myBusinessResidentIds}`,
    }),
  ],
);

// Plantilla de contrato del negocio. El texto admite datos que se rellenan solos: {nombre}, {unidad}, {renta}…
export const contractTemplate = pgTable(
  "contract_template",
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid()
      .notNull()
      .references(() => business.id, { onDelete: "restrict" }),
    name: text().notNull(),
    body: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("contract_template_business_id_idx").on(t.businessId),
    pgPolicy("contract_template_landlord_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.businessId} in ${myBusinessIds}`,
      withCheck: sql`${t.businessId} in ${myBusinessIds}`,
    }),
  ],
);

// Contrato: el alquiler de una unidad, haya papel o no (ver la modalidad). Que no se solape con otro de la
// misma unidad lo valida el servidor, igual que las posiciones de las unidades.
export const contract = pgTable(
  "contract",
  {
    id: uuid().primaryKey().defaultRandom(),
    unitId: uuid()
      .notNull()
      .references(() => unit.id, { onDelete: "restrict" }),
    residentId: uuid()
      .notNull()
      .references(() => resident.id, { onDelete: "restrict" }),
    startDate: date().notNull(),
    // Vacía: sin fecha de fin (mes a mes), vigente hasta que el arrendador lo termine.
    endDate: date(),
    monthlyRent: numeric({ precision: 10, scale: 2 }).notNull(),
    // 31 = fin de mes, como el día de cobro del negocio.
    paymentDay: smallint().notNull(),
    paperwork: contractPaperwork().notNull(),
    templateId: uuid().references(() => contractTemplate.id, { onDelete: "restrict" }),
    status: contractStatus().notNull().default("draft"),
    confirmedAt: timestamp({ withTimezone: true }),
    cancelledAt: timestamp({ withTimezone: true }),
    renewedFromId: uuid().references((): AnyPgColumn => contract.id, { onDelete: "set null" }),
    // Garantía decidida para esta persona (por ejemplo, un familiar sin garantía). Vacía = la de la unidad o la de
    // la configuración del negocio. deposit_due_date: cuándo se cobra (vacía = al inicio del contrato).
    depositRule: depositRule(),
    depositFixedAmount: numeric({ precision: 10, scale: 2 }),
    depositDueDate: date(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("contract_unit_id_idx").on(t.unitId),
    index("contract_resident_id_idx").on(t.residentId),
    check("contract_dates_order", sql`${t.endDate} is null or ${t.endDate} >= ${t.startDate}`),
    check("contract_rent_not_negative", sql`${t.monthlyRent} >= 0`),
    check("contract_payment_day_range", sql`${t.paymentDay} between 1 and 31`),
    // Solo los contratos desde plantilla tienen plantilla.
    check(
      "contract_template_matches_paperwork",
      sql`(${t.paperwork} = 'template') = (${t.templateId} is not null)`,
    ),
    // Sin contrato escrito no hay nada que firmar.
    check(
      "contract_none_without_signature",
      sql`${t.paperwork} <> 'none' or ${t.status} <> 'pending_signature'`,
    ),
    check("contract_confirmed_at", sql`${t.status} <> 'confirmed' or ${t.confirmedAt} is not null`),
    check("contract_cancelled_at", sql`${t.status} <> 'cancelled' or ${t.cancelledAt} is not null`),
    check(
      "contract_deposit_fixed",
      sql`(${t.depositRule} is not distinct from 'fixed') = (${t.depositFixedAmount} is not null)
        and coalesce(${t.depositFixedAmount}, 0) >= 0`,
    ),
    // La ficha y la unidad deben ser de los negocios del arrendador.
    pgPolicy("contract_landlord_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.residentId} in ${myBusinessResidentIds}`,
      withCheck: sql`${t.residentId} in ${myBusinessResidentIds} and exists (
        select 1 from public.unit u join public.floor f on f.id = u.floor_id join public.property p on p.id = f.property_id
        where u.id = ${t.unitId} and p.business_id in ${myBusinessIds})`,
    }),
    pgPolicy("contract_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.residentId} in ${myOwnResidentIds}`,
    }),
  ],
);

// Notas del arrendador sobre un residente ("paga puntual"). Van aparte de la ficha porque el residente puede leer
// su ficha (RLS resident_select_own, también por la API de Supabase), y las notas son solo del arrendador.
export const residentNote = pgTable(
  "resident_note",
  {
    residentId: uuid()
      .primaryKey()
      .references(() => resident.id, { onDelete: "cascade" }),
    body: text().notNull(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    pgPolicy("resident_note_landlord_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.residentId} in ${myBusinessResidentIds}`,
      withCheck: sql`${t.residentId} in ${myBusinessResidentIds}`,
    }),
  ],
);

// Requisito de documento (DNI, constancia de estudios…). Hay una lista para quien alquila un cuarto y otra para
// quien alquila un departamento completo (unit_type). Solo los obligatorios y activos impiden confirmar el
// contrato mientras no estén verificados; los opcionales el residente no los ve (los sube el arrendador).
export const documentRequirement = pgTable(
  "document_requirement",
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid()
      .notNull()
      .references(() => business.id, { onDelete: "restrict" }),
    unitType: unitType().notNull(),
    name: text().notNull(),
    description: text(),
    required: boolean().notNull().default(false),
    // Apagado: deja de pedirse a todos, pero se conservan los archivos ya subidos.
    active: boolean().notNull().default(true),
    acceptedFormats: documentFormat()
      .array()
      .notNull()
      .default(sql`'{pdf,image}'`),
    maxSizeMb: smallint().notNull().default(5),
  },
  (t) => [
    index("document_requirement_business_id_idx").on(t.businessId),
    check("document_requirement_max_size", sql`${t.maxSizeMb} between 1 and 20`),
    pgPolicy("document_requirement_landlord_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.businessId} in ${myBusinessIds}`,
      withCheck: sql`${t.businessId} in ${myBusinessIds}`,
    }),
    // El residente ve los obligatorios y activos de los negocios donde tiene ficha; los opcionales no.
    pgPolicy("document_requirement_select_as_resident", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.required} and ${t.active}
        and ${t.businessId} in (select r.business_id from public.resident r where r.person_id in ${myPersonIds})`,
    }),
  ],
);

// "A esta persona no se lo pido" (un familiar, un conocido): el requisito no se le muestra ni frena su contrato.
// Es por ficha de residente: al siguiente residente se le pide todo.
export const documentRequirementExemption = pgTable(
  "document_requirement_exemption",
  {
    id: uuid().primaryKey().defaultRandom(),
    residentId: uuid()
      .notNull()
      .references(() => resident.id, { onDelete: "cascade" }),
    requirementId: uuid()
      .notNull()
      .references(() => documentRequirement.id, { onDelete: "cascade" }),
    createdBy: uuid().references(() => person.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("document_requirement_exemption_pair_idx").on(t.residentId, t.requirementId),
    index("document_requirement_exemption_requirement_id_idx").on(t.requirementId),
    // El requisito tiene que ser del mismo negocio que la ficha.
    pgPolicy("document_requirement_exemption_landlord_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.residentId} in ${myBusinessResidentIds}`,
      withCheck: sql`${t.residentId} in ${myBusinessResidentIds} and exists (
        select 1 from public.document_requirement q join public.resident r on r.business_id = q.business_id
        where q.id = ${t.requirementId} and r.id = ${t.residentId})`,
    }),
    // El residente ve las suyas: así su lista no muestra lo que no se le pide.
    pgPolicy("document_requirement_exemption_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.residentId} in ${myOwnResidentIds}`,
    }),
  ],
);

// Documento subido (archivo privado en Supabase Storage). Lo puede subir el residente o el arrendador;
// uploaded_by guarda quién fue.
export const document = pgTable(
  "document",
  {
    id: uuid().primaryKey().defaultRandom(),
    residentId: uuid()
      .notNull()
      .references(() => resident.id, { onDelete: "cascade" }),
    kind: documentKind().notNull(),
    requirementId: uuid().references(() => documentRequirement.id, { onDelete: "set null" }),
    contractId: uuid().references(() => contract.id, { onDelete: "cascade" }),
    // Ruta del archivo dentro del bucket privado.
    storagePath: text().notNull().unique(),
    fileName: text().notNull(),
    mimeType: text().notNull(),
    sizeBytes: integer().notNull(),
    status: documentStatus().notNull().default("in_review"),
    uploadedBy: uuid()
      .notNull()
      .references(() => person.id, { onDelete: "restrict" }),
    uploadedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    reviewedBy: uuid().references(() => person.id, { onDelete: "set null" }),
    reviewedAt: timestamp({ withTimezone: true }),
    rejectionReason: text(),
  },
  (t) => [
    index("document_resident_id_idx").on(t.residentId),
    index("document_contract_id_idx").on(t.contractId),
    check("document_size_positive", sql`${t.sizeBytes} > 0`),
    // Rechazar exige un motivo, que el residente ve.
    check(
      "document_rejection_reason",
      sql`${t.status} <> 'rejected' or coalesce(trim(${t.rejectionReason}), '') <> ''`,
    ),
    check(
      "document_signed_contract_has_contract",
      sql`${t.kind} <> 'signed_contract' or ${t.contractId} is not null`,
    ),
    pgPolicy("document_landlord_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.residentId} in ${myBusinessResidentIds}`,
      withCheck: sql`${t.residentId} in ${myBusinessResidentIds}`,
    }),
    pgPolicy("document_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.residentId} in ${myOwnResidentIds}`,
    }),
    // El residente sube los suyos, a su nombre y sin poder marcarlos como verificados.
    pgPolicy("document_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${t.residentId} in ${myOwnResidentIds} and ${t.uploadedBy} in ${myPersonIds}
        and ${t.status} = 'in_review' and ${t.reviewedBy} is null`,
    }),
  ],
);

// --- Fase 5: cobros y garantía ---

// Contratos de las fichas de la persona con sesión, como arrendador o como residente.
const myBusinessContractIds = sql`(select c.id from public.contract c where c.resident_id in ${myBusinessResidentIds})`;
const myOwnContractIds = sql`(select c.id from public.contract c where c.resident_id in ${myOwnResidentIds})`;

// Configuración › Garantía de un negocio: la política por tipo de unidad, qué cubre y cómo se devuelve.
// Sin fila = no se pide garantía. El residente la puede leer (ve qué cubre y en cuántos días se devuelve).
export const depositSettings = pgTable(
  "deposit_settings",
  {
    businessId: uuid()
      .primaryKey()
      .references(() => business.id, { onDelete: "cascade" }),
    roomRule: depositRule().notNull().default("none"),
    roomFixedAmount: numeric({ precision: 10, scale: 2 }),
    apartmentRule: depositRule().notNull().default("none"),
    apartmentFixedAmount: numeric({ precision: 10, scale: 2 }),
    covers: inspectionArea()
      .array()
      .notNull()
      .default(sql`'{walls,door,window,furniture,keys,cleaning}'`),
    // Días hábiles para devolver la garantía después de la salida.
    refundDays: smallint().notNull().default(7),
    refundMethods: paymentMethod()
      .array()
      .notNull()
      .default(sql`'{yape,plin,transfer}'`),
    // Días desde el inicio del contrato en que el residente puede reportar lo que ya estaba mal (regla 8).
    entryReportDays: smallint().notNull().default(7),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "deposit_settings_room_fixed",
      sql`(${t.roomRule} = 'fixed') = (${t.roomFixedAmount} is not null) and coalesce(${t.roomFixedAmount}, 0) >= 0`,
    ),
    check(
      "deposit_settings_apartment_fixed",
      sql`(${t.apartmentRule} = 'fixed') = (${t.apartmentFixedAmount} is not null) and coalesce(${t.apartmentFixedAmount}, 0) >= 0`,
    ),
    check("deposit_settings_refund_days", sql`${t.refundDays} between 1 and 60`),
    check("deposit_settings_entry_days", sql`${t.entryReportDays} between 0 and 60`),
    pgPolicy("deposit_settings_landlord_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.businessId} in ${myBusinessIds}`,
      withCheck: sql`${t.businessId} in ${myBusinessIds}`,
    }),
    pgPolicy("deposit_settings_select_as_resident", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.businessId} in (select r.business_id from public.resident r where r.person_id in ${myPersonIds})`,
    }),
  ],
);

// Excepción de garantía de una unidad (GA-02): gana sobre la configuración de su tipo.
export const depositUnitException = pgTable(
  "deposit_unit_exception",
  {
    unitId: uuid()
      .primaryKey()
      .references(() => unit.id, { onDelete: "cascade" }),
    rule: depositRule().notNull(),
    fixedAmount: numeric({ precision: 10, scale: 2 }),
  },
  (t) => [
    check(
      "deposit_unit_exception_fixed",
      sql`(${t.rule} = 'fixed') = (${t.fixedAmount} is not null) and coalesce(${t.fixedAmount}, 0) >= 0`,
    ),
    pgPolicy("deposit_unit_exception_landlord_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`exists (select 1 from public.unit u join public.floor f on f.id = u.floor_id
        join public.property p on p.id = f.property_id where u.id = ${t.unitId} and p.business_id in ${myBusinessIds})`,
      withCheck: sql`exists (select 1 from public.unit u join public.floor f on f.id = u.floor_id
        join public.property p on p.id = f.property_id where u.id = ${t.unitId} and p.business_id in ${myBusinessIds})`,
    }),
  ],
);

// Cargo: lo que se cobra en un mes (renta, garantía, daños). Se crean al confirmar el contrato. Su estado (pagado,
// pendiente, vencido) no se guarda: sale de los pagos del recibo y de la fecha.
export const charge = pgTable(
  "charge",
  {
    id: uuid().primaryKey().defaultRandom(),
    contractId: uuid()
      .notNull()
      .references(() => contract.id, { onDelete: "restrict" }),
    concept: chargeConcept().notNull(),
    // Mes del recibo donde aparece: "AAAA-MM".
    period: text().notNull(),
    amount: numeric({ precision: 10, scale: 2 }).notNull(),
    dueDate: date().notNull(),
    // Por ejemplo, "17 de 31 días" en un mes incompleto.
    note: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("charge_contract_id_idx").on(t.contractId),
    index("charge_period_idx").on(t.period),
    // Una renta por mes y contrato.
    uniqueIndex("charge_rent_once_idx")
      .on(t.contractId, t.period)
      .where(sql`${t.concept} = 'rent'`),
    check("charge_period_format", sql`${t.period} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`),
    check("charge_amount_not_negative", sql`${t.amount} >= 0`),
    pgPolicy("charge_landlord_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.contractId} in ${myBusinessContractIds}`,
      withCheck: sql`${t.contractId} in ${myBusinessContractIds}`,
    }),
    pgPolicy("charge_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.contractId} in ${myOwnContractIds}`,
    }),
  ],
);

// Pago de un recibo (todo lo que un residente le debe a un negocio en un mes). Puede ser parcial. Lo registra el
// arrendador (queda confirmado) o el residente con su comprobante (queda en revisión hasta que el arrendador lo vea).
export const payment = pgTable(
  "payment",
  {
    id: uuid().primaryKey().defaultRandom(),
    residentId: uuid()
      .notNull()
      .references(() => resident.id, { onDelete: "restrict" }),
    period: text().notNull(),
    amount: numeric({ precision: 10, scale: 2 }).notNull(),
    method: paymentMethod().notNull(),
    paidOn: date().notNull(),
    operationCode: text(),
    // Comprobante en el espacio privado "documents": <negocio>/<ficha>/comprobantes/<id>.<ext>
    proofPath: text().unique(),
    status: paymentStatus().notNull().default("in_review"),
    submittedBy: uuid()
      .notNull()
      .references(() => person.id, { onDelete: "restrict" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    reviewedBy: uuid().references(() => person.id, { onDelete: "set null" }),
    reviewedAt: timestamp({ withTimezone: true }),
    rejectionReason: text(),
  },
  (t) => [
    index("payment_resident_period_idx").on(t.residentId, t.period),
    check("payment_period_format", sql`${t.period} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`),
    check("payment_amount_positive", sql`${t.amount} > 0`),
    check(
      "payment_rejection_reason",
      sql`${t.status} <> 'rejected' or coalesce(trim(${t.rejectionReason}), '') <> ''`,
    ),
    pgPolicy("payment_landlord_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.residentId} in ${myBusinessResidentIds}`,
      withCheck: sql`${t.residentId} in ${myBusinessResidentIds}`,
    }),
    pgPolicy("payment_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.residentId} in ${myOwnResidentIds}`,
    }),
    // El residente manda su comprobante: a su nombre y en revisión, nunca confirmado por él mismo.
    pgPolicy("payment_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${t.residentId} in ${myOwnResidentIds} and ${t.submittedBy} in ${myPersonIds}
        and ${t.status} = 'in_review' and ${t.reviewedBy} is null`,
    }),
  ],
);

// Garantía de un contrato. Se crea al confirmarlo, con el monto de ese momento. Al renovar pasa al contrato nuevo
// (regla 9): por eso contract_id se puede cambiar. charge_id: el cargo con el que se cobra (null si no hay).
export const deposit = pgTable(
  "deposit",
  {
    id: uuid().primaryKey().defaultRandom(),
    contractId: uuid()
      .notNull()
      .unique()
      .references(() => contract.id, { onDelete: "restrict" }),
    amount: numeric({ precision: 10, scale: 2 }).notNull(),
    rule: depositRule().notNull(),
    status: depositStatus().notNull(),
    chargeId: uuid().references(() => charge.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("deposit_amount_not_negative", sql`${t.amount} >= 0`),
    check("deposit_none_is_zero", sql`(${t.status} = 'none') = (${t.amount} = 0)`),
    pgPolicy("deposit_landlord_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.contractId} in ${myBusinessContractIds}`,
      withCheck: sql`${t.contractId} in ${myBusinessContractIds}`,
    }),
    pgPolicy("deposit_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.contractId} in ${myOwnContractIds}`,
    }),
  ],
);

// Lo que el residente ya encontró mal al ingresar (regla 8), con foto. No es obligatorio: lo reporta cuando lo nota,
// en los primeros días del contrato. Sirve de base al liquidar la garantía.
export const entryReport = pgTable(
  "entry_report",
  {
    id: uuid().primaryKey().defaultRandom(),
    contractId: uuid()
      .notNull()
      .references(() => contract.id, { onDelete: "cascade" }),
    area: inspectionArea().notNull(),
    note: text().notNull(),
    photoPath: text().notNull().unique(),
    reportedBy: uuid()
      .notNull()
      .references(() => person.id, { onDelete: "restrict" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("entry_report_contract_id_idx").on(t.contractId),
    pgPolicy("entry_report_landlord_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.contractId} in ${myBusinessContractIds}`,
      withCheck: sql`${t.contractId} in ${myBusinessContractIds}`,
    }),
    pgPolicy("entry_report_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.contractId} in ${myOwnContractIds}`,
    }),
    // A su nombre y solo dentro del plazo (función de la migración 0010). Borrar o cambiar, no.
    pgPolicy("entry_report_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${t.contractId} in ${myOwnContractIds} and ${t.reportedBy} in ${myPersonIds}
        and public.entry_report_open(${t.contractId})`,
    }),
  ],
);

// Liquidación de una garantía. El residente no la ve mientras es borrador. Sus respuestas (aceptar, disputar,
// dónde recibe) pasan por funciones de la base (migración 0010), no por un permiso de escritura en la tabla.
export const settlement = pgTable(
  "settlement",
  {
    id: uuid().primaryKey().defaultRandom(),
    depositId: uuid()
      .notNull()
      .unique()
      .references(() => deposit.id, { onDelete: "cascade" }),
    status: settlementStatus().notNull().default("draft"),
    refundMethod: paymentMethod(),
    refundAccount: text(),
    sentAt: timestamp({ withTimezone: true }),
    acceptedAt: timestamp({ withTimezone: true }),
    closedAt: timestamp({ withTimezone: true }),
    // Pregunta 9: lo que pasa la garantía se cobra como cargo o el arrendador lo perdona.
    excessChargeId: uuid().references(() => charge.id, { onDelete: "set null" }),
    excessWaived: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("settlement_sent_at", sql`${t.status} = 'draft' or ${t.sentAt} is not null`),
    check("settlement_closed_at", sql`${t.status} <> 'closed' or ${t.closedAt} is not null`),
    pgPolicy("settlement_landlord_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.depositId} in (select d.id from public.deposit d where d.contract_id in ${myBusinessContractIds})`,
      withCheck: sql`${t.depositId} in (select d.id from public.deposit d where d.contract_id in ${myBusinessContractIds})`,
    }),
    pgPolicy("settlement_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.status} <> 'draft'
        and ${t.depositId} in (select d.id from public.deposit d where d.contract_id in ${myOwnContractIds})`,
    }),
  ],
);

// Liquidaciones de las garantías de la persona con sesión como residente, sin borradores.
const myOwnSettlementIds = sql`(select s.id from public.settlement s join public.deposit d on d.id = s.deposit_id
  where s.status <> 'draft' and d.contract_id in ${myOwnContractIds})`;
const myBusinessSettlementIds = sql`(select s.id from public.settlement s join public.deposit d on d.id = s.deposit_id
  where d.contract_id in ${myBusinessContractIds})`;

// Descuento de una liquidación (GA-08). worse_than_entry: el rubro estaba en el reporte de ingreso y está peor.
export const settlementDiscount = pgTable(
  "settlement_discount",
  {
    id: uuid().primaryKey().defaultRandom(),
    settlementId: uuid()
      .notNull()
      .references(() => settlement.id, { onDelete: "cascade" }),
    area: inspectionArea().notNull(),
    note: text().notNull(),
    amount: numeric({ precision: 10, scale: 2 }).notNull(),
    // Monto antes de ajustarlo tras una disputa.
    originalAmount: numeric({ precision: 10, scale: 2 }),
    photoPath: text().unique(),
    worseThanEntry: boolean().notNull().default(false),
    status: discountStatus().notNull().default("active"),
    disputeReason: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("settlement_discount_settlement_id_idx").on(t.settlementId),
    check("settlement_discount_amount_positive", sql`${t.amount} > 0`),
    check(
      "settlement_discount_dispute_reason",
      sql`${t.status} <> 'disputed' or coalesce(trim(${t.disputeReason}), '') <> ''`,
    ),
    pgPolicy("settlement_discount_landlord_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.settlementId} in ${myBusinessSettlementIds}`,
      withCheck: sql`${t.settlementId} in ${myBusinessSettlementIds}`,
    }),
    pgPolicy("settlement_discount_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.settlementId} in ${myOwnSettlementIds}`,
    }),
  ],
);

// Devolución de la garantía al residente (GA-15). Puede ir en partes: lo no disputado primero.
export const depositRefund = pgTable(
  "deposit_refund",
  {
    id: uuid().primaryKey().defaultRandom(),
    settlementId: uuid()
      .notNull()
      .references(() => settlement.id, { onDelete: "cascade" }),
    amount: numeric({ precision: 10, scale: 2 }).notNull(),
    method: paymentMethod().notNull(),
    paidOn: date().notNull(),
    operationCode: text(),
    proofPath: text().unique(),
    registeredBy: uuid()
      .notNull()
      .references(() => person.id, { onDelete: "restrict" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("deposit_refund_settlement_id_idx").on(t.settlementId),
    check("deposit_refund_amount_positive", sql`${t.amount} > 0`),
    pgPolicy("deposit_refund_landlord_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.settlementId} in ${myBusinessSettlementIds}`,
      withCheck: sql`${t.settlementId} in ${myBusinessSettlementIds}`,
    }),
    pgPolicy("deposit_refund_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.settlementId} in ${myOwnSettlementIds}`,
    }),
  ],
);

// Bitácora de cambios de dinero (CLAUDE.md, sección 10): cargos, pagos, garantías, liquidaciones, descuentos y
// devoluciones. La llenan triggers de la base (migración 0010), así que también anota lo que entre por la API.
// Sin políticas: nadie la lee ni la cambia con su sesión; solo el administrador de la base.
export const moneyLog = pgTable("money_log", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  tableName: text().notNull(),
  rowId: uuid().notNull(),
  operation: text().notNull(),
  oldRow: jsonb(),
  newRow: jsonb(),
  actorUserId: uuid(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}).enableRLS();
