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
  time,
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
// Fase 7 · Limpieza (MT-05): cómo quedó una unidad. Al marcar una salida como hecha pasa sola a "sucio".
export const cleaningStatus = pgEnum("cleaning_status", ["clean", "dirty", "inspected"]);

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
    // ¿Recibe postulaciones por su enlace público /postular/<id>? Apagado por defecto (Fase 7).
    acceptsApplications: boolean().notNull().default(false),
    // ¿Sus residentes pueden pedir limpieza de su cuarto desde su cuenta? Apagado por defecto (Fase 7, MT-05).
    acceptsCleaningRequests: boolean().notNull().default(false),
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
    // Foto de portada (la ve el residente en su inicio). Ruta en el espacio privado: <negocio>/portadas/<id>.<ext>.
    coverPhotoPath: text(),
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
    // Limpieza entre un residente y otro (Fase 7): limpio, sucio o revisado.
    cleaningStatus: cleaningStatus().notNull().default("clean"),
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
    // true = el comprobante del residente coincidía con lo que faltaba del recibo y se confirmó solo, sin que nadie
    // lo revisara (decisión del dueño, 2026-11-15). El arrendador los ve en "Confirmados solos" y puede anularlos.
    // Lo decide la función auto_confirm_my_payment de la base (migración 0019), no el navegador.
    autoConfirmed: boolean().notNull().default(false),
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

// ---------------------------------------------------------------------------------------------------------------
// Fase 6 · Pensión (comidas). Un negocio de Pensión tiene sus comidas, planes, menú y comensales. Los comensales son
// fichas (resident) del negocio de Pensión: pueden vivir en otra residencia o ser externos (regla "negocios
// independientes"). El comensal confirma y pausa con funciones de la base (migración 0012), que revisan la hora
// límite y los días servidos; el arrendador (cocina) puede cambiar todo.

export const mealType = pgEnum("meal_type", ["breakfast", "lunch", "dinner"]);
export const mealServiceMode = pgEnum("meal_service_mode", ["dine_in", "takeaway", "delivery"]);
export const menuStatus = pgEnum("menu_status", ["draft", "published"]);
export const pensionBillingCycle = pgEnum("pension_billing_cycle", ["daily", "weekly", "monthly"]);

// Negocios donde la persona con sesión tiene ficha (para que el comensal lea comidas, planes y menú).
const myResidentBusinessIds = sql`(select r.business_id from public.resident r where r.person_id in ${myPersonIds})`;

// Configuración › Pensión: hora límite de cancelación (del día anterior), cómo se sirve, capacidad, externos y dietas.
export const mealSettings = pgTable(
  "meal_settings",
  {
    businessId: uuid()
      .primaryKey()
      .references(() => business.id, { onDelete: "cascade" }),
    // Por defecto se cocina para todos los afiliados; el comensal cancela hasta esta hora del DÍA ANTERIOR (hora de
    // Lima). Después solo la cocina puede cambiarlo (decisión del dueño, 2026-11-13).
    cancelDeadline: time().notNull().default("20:00"),
    // Días que cocina (1 = lunes … 7 = domingo). Los demás no se cocinan ni se cobran (decisión del dueño, 2026-11-13).
    serviceDays: smallint()
      .array()
      .notNull()
      .default(sql`'{1,2,3,4,5,6,7}'`),
    serviceModes: mealServiceMode()
      .array()
      .notNull()
      .default(sql`'{dine_in}'`),
    seatsPerTurn: smallint(),
    acceptsExternal: boolean().notNull().default(true),
    // ¿Los comensales pueden avisar su pago con comprobante desde "Mi pensión"? Apagado por defecto: la pensión
    // chica coordina por WhatsApp y marca los pagos ella misma (decisión del dueño, 2026-11-13).
    acceptsPaymentProofs: boolean().notNull().default(false),
    diets: text()
      .array()
      .notNull()
      .default(sql`'{}'`),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("meal_settings_seats", sql`${t.seatsPerTurn} is null or ${t.seatsPerTurn} between 1 and 1000`),
    check(
      "meal_settings_service_days",
      sql`cardinality(${t.serviceDays}) between 1 and 7 and ${t.serviceDays} <@ '{1,2,3,4,5,6,7}'::smallint[]`,
    ),
    pgPolicy("meal_settings_landlord_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.businessId} in ${myBusinessIds}`,
      withCheck: sql`${t.businessId} in ${myBusinessIds}`,
    }),
    pgPolicy("meal_settings_select_as_diner", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.businessId} in ${myResidentBusinessIds}`,
    }),
  ],
);

// Una comida del día (desayuno, almuerzo o cena) con su horario y su precio suelto.
export const meal = pgTable(
  "meal",
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid()
      .notNull()
      .references(() => business.id, { onDelete: "cascade" }),
    type: mealType().notNull(),
    startTime: time().notNull(),
    endTime: time().notNull(),
    singlePrice: numeric({ precision: 10, scale: 2 }).notNull(),
    active: boolean().notNull().default(true),
  },
  (t) => [
    uniqueIndex("meal_business_type_idx").on(t.businessId, t.type),
    check("meal_times", sql`${t.endTime} > ${t.startTime}`),
    check("meal_price_not_negative", sql`${t.singlePrice} >= 0`),
    pgPolicy("meal_landlord_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.businessId} in ${myBusinessIds}`,
      withCheck: sql`${t.businessId} in ${myBusinessIds}`,
    }),
    pgPolicy("meal_select_as_diner", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.businessId} in ${myResidentBusinessIds}`,
    }),
  ],
);

// Plan de pensión (PN-01): qué comidas incluye y su precio por día. Estimado del mes = días × precio.
export const pensionPlan = pgTable(
  "pension_plan",
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid()
      .notNull()
      .references(() => business.id, { onDelete: "cascade" }),
    name: text().notNull(),
    meals: mealType().array().notNull(),
    dailyPrice: numeric({ precision: 10, scale: 2 }).notNull(),
    active: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("pension_plan_business_id_idx").on(t.businessId),
    check("pension_plan_meals", sql`cardinality(${t.meals}) between 1 and 3`),
    check("pension_plan_price", sql`${t.dailyPrice} >= 0`),
    check("pension_plan_name", sql`length(trim(${t.name})) between 1 and 80`),
    pgPolicy("pension_plan_landlord_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.businessId} in ${myBusinessIds}`,
      withCheck: sql`${t.businessId} in ${myBusinessIds}`,
    }),
    pgPolicy("pension_plan_select_as_diner", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.businessId} in ${myResidentBusinessIds}`,
    }),
  ],
);

// Afiliación de un comensal a un plan (PN-04). Sin fecha de fin = hasta que se termine.
export const pensionSubscription = pgTable(
  "pension_subscription",
  {
    id: uuid().primaryKey().defaultRandom(),
    residentId: uuid()
      .notNull()
      .references(() => resident.id, { onDelete: "restrict" }),
    planId: uuid()
      .notNull()
      .references(() => pensionPlan.id, { onDelete: "restrict" }),
    startDate: date().notNull(),
    endDate: date(),
    // Dietas y alergias que la cocina debe ver (PN-08).
    dietNote: text(),
    // Cada cuánto paga por adelantado (decisión del dueño: la pensión compra insumos antes de cocinar).
    billingCycle: pensionBillingCycle().notNull().default("weekly"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("pension_subscription_resident_id_idx").on(t.residentId),
    check("pension_subscription_dates", sql`${t.endDate} is null or ${t.endDate} >= ${t.startDate}`),
    pgPolicy("pension_subscription_landlord_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.residentId} in ${myBusinessResidentIds}`,
      withCheck: sql`${t.residentId} in ${myBusinessResidentIds}`,
    }),
    pgPolicy("pension_subscription_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.residentId} in ${myOwnResidentIds}`,
    }),
  ],
);

const myBusinessSubscriptionIds = sql`(select s.id from public.pension_subscription s where s.resident_id in ${myBusinessResidentIds})`;
const myOwnSubscriptionIds = sql`(select s.id from public.pension_subscription s where s.resident_id in ${myOwnResidentIds})`;

// Días pausados de una afiliación (por un viaje): no se cobran ni se cocinan. No se solapan con días servidos.
export const pensionPause = pgTable(
  "pension_pause",
  {
    id: uuid().primaryKey().defaultRandom(),
    subscriptionId: uuid()
      .notNull()
      .references(() => pensionSubscription.id, { onDelete: "cascade" }),
    fromDate: date().notNull(),
    toDate: date().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("pension_pause_subscription_id_idx").on(t.subscriptionId),
    check("pension_pause_dates", sql`${t.toDate} >= ${t.fromDate}`),
    pgPolicy("pension_pause_landlord_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.subscriptionId} in ${myBusinessSubscriptionIds}`,
      withCheck: sql`${t.subscriptionId} in ${myBusinessSubscriptionIds}`,
    }),
    pgPolicy("pension_pause_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.subscriptionId} in ${myOwnSubscriptionIds}`,
    }),
  ],
);

// Menú de un día y una comida (PN-03). El comensal solo ve lo publicado.
export const menuItem = pgTable(
  "menu_item",
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid()
      .notNull()
      .references(() => business.id, { onDelete: "cascade" }),
    date: date().notNull(),
    meal: mealType().notNull(),
    dish: text().notNull(),
    hasVegetarian: boolean().notNull().default(false),
    status: menuStatus().notNull().default("draft"),
  },
  (t) => [
    uniqueIndex("menu_item_business_date_meal_idx").on(t.businessId, t.date, t.meal),
    check("menu_item_dish", sql`length(trim(${t.dish})) between 1 and 600`),
    pgPolicy("menu_item_landlord_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.businessId} in ${myBusinessIds}`,
      withCheck: sql`${t.businessId} in ${myBusinessIds}`,
    }),
    pgPolicy("menu_item_select_published", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.status} = 'published' and ${t.businessId} in ${myResidentBusinessIds}`,
    }),
  ],
);

// Asistencia de un comensal a una comida: si la canceló y si comió (PN-05, PN-06, PN-07). Sin fila = viene (por
// defecto se cocina para todos los afiliados; decisión del dueño, 2026-11-13).
export const mealAttendance = pgTable(
  "meal_attendance",
  {
    id: uuid().primaryKey().defaultRandom(),
    residentId: uuid()
      .notNull()
      .references(() => resident.id, { onDelete: "cascade" }),
    date: date().notNull(),
    meal: mealType().notNull(),
    // true = canceló esa comida (no se cocina ni se cobra si fue a tiempo). Sin fila = viene.
    cancelled: boolean().notNull().default(false),
    // true = canceló la cocina por su lado (una emergencia): NO se cobra nunca y el comensal no puede volver a
    // pedirla. false = canceló el comensal (o la cocina lo anotó por él): se cobra si fue después de la hora límite
    // (decisión del dueño, 2026-11-15).
    kitchenCancelled: boolean().notNull().default(false),
    served: boolean().notNull().default(false),
    updatedBy: uuid().references(() => person.id, { onDelete: "set null" }),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("meal_attendance_resident_date_meal_idx").on(t.residentId, t.date, t.meal),
    index("meal_attendance_date_idx").on(t.date),
    pgPolicy("meal_attendance_landlord_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.residentId} in ${myBusinessResidentIds}`,
      withCheck: sql`${t.residentId} in ${myBusinessResidentIds}`,
    }),
    pgPolicy("meal_attendance_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.residentId} in ${myOwnResidentIds}`,
    }),
  ],
);

// Pago de la pensión, por adelantado: cuánto pagó y qué días cubre ("S/ 85 · del 16 al 22 de noviembre"). No usa los
// recibos de la residencia porque esos dependen de un contrato. Lo registra la cocina (queda confirmado) o el comensal
// con su comprobante, si la pensión lo permite (queda en revisión hasta que la cocina lo apruebe o lo rechace con un
// motivo; decisión del dueño, 2026-11-13). Solo los confirmados cuentan. Queda en la bitácora money_log (trigger de la
// migración 0014).
export const pensionPayment = pgTable(
  "pension_payment",
  {
    id: uuid().primaryKey().defaultRandom(),
    subscriptionId: uuid()
      .notNull()
      .references(() => pensionSubscription.id, { onDelete: "restrict" }),
    amount: numeric({ precision: 10, scale: 2 }).notNull(),
    method: paymentMethod().notNull(),
    paidOn: date().notNull(),
    coversFrom: date().notNull(),
    coversTo: date().notNull(),
    note: text(),
    operationCode: text(),
    // Comprobante en el espacio privado "documents": <negocio>/<ficha>/comprobantes/<id>.<ext>
    proofPath: text().unique(),
    // Lo que había antes de esta migración (todo lo registró la cocina) queda confirmado.
    status: paymentStatus().notNull().default("confirmed"),
    // Quién lo registró o lo mandó (la cocina o el comensal).
    registeredBy: uuid()
      .notNull()
      .references(() => person.id, { onDelete: "restrict" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    reviewedBy: uuid().references(() => person.id, { onDelete: "set null" }),
    reviewedAt: timestamp({ withTimezone: true }),
    rejectionReason: text(),
  },
  (t) => [
    index("pension_payment_subscription_id_idx").on(t.subscriptionId),
    check("pension_payment_amount_positive", sql`${t.amount} > 0`),
    check("pension_payment_dates", sql`${t.coversTo} >= ${t.coversFrom}`),
    check(
      "pension_payment_rejection_reason",
      sql`${t.status} <> 'rejected' or coalesce(trim(${t.rejectionReason}), '') <> ''`,
    ),
    // El comensal manda su comprobante: a su nombre, en revisión y solo si su pensión lo permite.
    pgPolicy("pension_payment_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${t.subscriptionId} in ${myOwnSubscriptionIds} and ${t.registeredBy} in ${myPersonIds}
        and ${t.status} = 'in_review' and ${t.reviewedBy} is null and ${t.proofPath} is not null
        and exists (select 1 from public.pension_subscription s
          join public.pension_plan p on p.id = s.plan_id
          join public.meal_settings ms on ms.business_id = p.business_id
          where s.id = ${t.subscriptionId} and ms.accepts_payment_proofs)`,
    }),
    pgPolicy("pension_payment_landlord_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.subscriptionId} in ${myBusinessSubscriptionIds}`,
      withCheck: sql`${t.subscriptionId} in ${myBusinessSubscriptionIds}`,
    }),
    pgPolicy("pension_payment_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.subscriptionId} in ${myOwnSubscriptionIds}`,
    }),
  ],
);

// ---------------------------------------------------------------------------------------------------------------
// Fase 7 · Operación diaria. Catálogo de avisos en docs/notificaciones.md.

// Notificación de la campanita: un aviso personal que crea el sistema cuando algo pasa ("subió un comprobante").
// Nadie la inserta directo: pasa por las funciones notify_owner y notify_resident de la base (migración 0020), que
// solo dejan avisar dentro de un mismo negocio (el arrendador a sus residentes y el residente a su arrendador).
// business_id: de qué negocio viene (para mostrarlo y filtrarlo); link: a dónde lleva al tocarla.
export const notification = pgTable(
  "notification",
  {
    id: uuid().primaryKey().defaultRandom(),
    personId: uuid()
      .notNull()
      .references(() => person.id, { onDelete: "cascade" }),
    businessId: uuid().references(() => business.id, { onDelete: "cascade" }),
    // Tipo del catálogo (por ejemplo "payment_proof"); la pantalla elige el ícono con él.
    type: text().notNull(),
    title: text().notNull(),
    body: text(),
    link: text(),
    urgent: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index("notification_person_created_idx").on(t.personId, t.createdAt),
    check("notification_title", sql`length(trim(${t.title})) between 1 and 200`),
    check("notification_body", sql`${t.body} is null or length(${t.body}) <= 2000`),
    // Solo enlaces dentro de la app ("/cobros/…"), nunca a otro sitio.
    check("notification_link", sql`${t.link} is null or ${t.link} ~ '^/[^/]'`),
    pgPolicy("notification_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.personId} in ${myPersonIds}`,
    }),
    // Marcar como leída (o no leída).
    pgPolicy("notification_update_own", {
      for: "update",
      to: authenticatedRole,
      using: sql`${t.personId} in ${myPersonIds}`,
      withCheck: sql`${t.personId} in ${myPersonIds}`,
    }),
    pgPolicy("notification_delete_own", {
      for: "delete",
      to: authenticatedRole,
      using: sql`${t.personId} in ${myPersonIds}`,
    }),
  ],
);

// Mantenimiento (MT-01, MT-02, MT-03, MT-07): un pedido del residente (con foto) o del arrendador. Mientras un pedido
// con "deja la unidad fuera de servicio" esté abierto o en curso, la unidad se ve "Mantenimiento" (regla de estados).
export const maintenanceStatus = pgEnum("maintenance_status", ["open", "in_progress", "done", "cancelled"]);
export const maintenancePriority = pgEnum("maintenance_priority", ["low", "normal", "high", "urgent"]);
export const maintenanceCategory = pgEnum("maintenance_category", [
  "plumbing",
  "electrical",
  "furniture",
  "appliance",
  "internet",
  "cleaning",
  "other",
]);

export const maintenanceRequest = pgTable(
  "maintenance_request",
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid()
      .notNull()
      .references(() => business.id, { onDelete: "cascade" }),
    // Vacía: un área común (pasillo, azotea…) o algo de todo el edificio.
    unitId: uuid().references(() => unit.id, { onDelete: "set null" }),
    // Quién lo pidió, si fue un residente. Vacía: lo creó el arrendador.
    residentId: uuid().references(() => resident.id, { onDelete: "set null" }),
    title: text().notNull(),
    description: text(),
    category: maintenanceCategory().notNull().default("other"),
    priority: maintenancePriority().notNull().default("normal"),
    status: maintenanceStatus().notNull().default("open"),
    // Foto en el espacio privado "documents": <negocio>/mantenimiento/<id>.<ext>
    photoPath: text().unique(),
    // Responsable (texto libre: "Gasfitero Juan", "Yo"). Los usuarios con rol llegan después.
    assignee: text(),
    cost: numeric({ precision: 10, scale: 2 }),
    blocksUnit: boolean().notNull().default(false),
    // Quién lo arregló, del directorio de proveedores (MT-06). Vacío: nadie del directorio.
    supplierId: uuid().references((): AnyPgColumn => supplier.id, { onDelete: "set null" }),
    reportedBy: uuid()
      .notNull()
      .references(() => person.id, { onDelete: "restrict" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index("maintenance_request_business_status_idx").on(t.businessId, t.status),
    index("maintenance_request_unit_id_idx").on(t.unitId),
    index("maintenance_request_resident_id_idx").on(t.residentId),
    check("maintenance_request_title", sql`length(trim(${t.title})) between 1 and 120`),
    check(
      "maintenance_request_description",
      sql`${t.description} is null or length(${t.description}) <= 2000`,
    ),
    check("maintenance_request_cost", sql`${t.cost} is null or ${t.cost} >= 0`),
    check(
      "maintenance_request_resolved_at",
      sql`(${t.status} in ('done', 'cancelled')) = (${t.resolvedAt} is not null)`,
    ),
    pgPolicy("maintenance_request_landlord_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.businessId} in ${myBusinessIds}`,
      withCheck: sql`${t.businessId} in ${myBusinessIds}`,
    }),
    pgPolicy("maintenance_request_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.residentId} in ${myOwnResidentIds}`,
    }),
    // El residente pide a su nombre, en su negocio, abierto y sin costo ni responsable; la unidad, si la pone, es la de
    // uno de sus contratos.
    pgPolicy("maintenance_request_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${t.residentId} in ${myOwnResidentIds} and ${t.reportedBy} in ${myPersonIds}
        and ${t.businessId} = (select r.business_id from public.resident r where r.id = ${t.residentId})
        and ${t.status} = 'open' and ${t.cost} is null and ${t.assignee} is null and ${t.blocksUnit} = false
        and (${t.unitId} is null or ${t.unitId} in (select c.unit_id from public.contract c where c.resident_id = ${t.residentId}))`,
    }),
  ],
);

const myBusinessMaintenanceIds = sql`(select m.id from public.maintenance_request m where m.business_id in ${myBusinessIds})`;
const myOwnMaintenanceIds = sql`(select m.id from public.maintenance_request m where m.resident_id in ${myOwnResidentIds})`;

// Conversación de un pedido: lo que escriben el arrendador y el residente ("Pasamos el jueves en la tarde").
export const maintenanceComment = pgTable(
  "maintenance_comment",
  {
    id: uuid().primaryKey().defaultRandom(),
    requestId: uuid()
      .notNull()
      .references(() => maintenanceRequest.id, { onDelete: "cascade" }),
    authorId: uuid()
      .notNull()
      .references(() => person.id, { onDelete: "restrict" }),
    body: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("maintenance_comment_request_id_idx").on(t.requestId),
    check("maintenance_comment_body", sql`length(trim(${t.body})) between 1 and 1000`),
    pgPolicy("maintenance_comment_landlord_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.requestId} in ${myBusinessMaintenanceIds}`,
      withCheck: sql`${t.requestId} in ${myBusinessMaintenanceIds} and ${t.authorId} in ${myPersonIds}`,
    }),
    pgPolicy("maintenance_comment_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.requestId} in ${myOwnMaintenanceIds}`,
    }),
    pgPolicy("maintenance_comment_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${t.requestId} in ${myOwnMaintenanceIds} and ${t.authorId} in ${myPersonIds}`,
    }),
  ],
);

// Comunicado del arrendador (CM-01): para todo el negocio, un edificio, un piso o una persona. Se entrega como una
// notificación a cada destinatario (la ven en la campanita y en "Avisos"); aquí queda el historial de lo enviado.
export const announcementAudience = pgEnum("announcement_audience", ["all", "property", "floor", "resident"]);

export const announcement = pgTable(
  "announcement",
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid()
      .notNull()
      .references(() => business.id, { onDelete: "cascade" }),
    audience: announcementAudience().notNull(),
    propertyId: uuid().references(() => property.id, { onDelete: "set null" }),
    floorId: uuid().references(() => floor.id, { onDelete: "set null" }),
    residentId: uuid().references(() => resident.id, { onDelete: "set null" }),
    title: text().notNull(),
    body: text().notNull(),
    urgent: boolean().notNull().default(false),
    // A cuántas personas les llegó al enviarlo.
    recipients: integer().notNull().default(0),
    createdBy: uuid()
      .notNull()
      .references(() => person.id, { onDelete: "restrict" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("announcement_business_created_idx").on(t.businessId, t.createdAt),
    check("announcement_title", sql`length(trim(${t.title})) between 1 and 120`),
    check("announcement_body", sql`length(trim(${t.body})) between 1 and 2000`),
    pgPolicy("announcement_landlord_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.businessId} in ${myBusinessIds}`,
      withCheck: sql`${t.businessId} in ${myBusinessIds}`,
    }),
  ],
);

// Postulación (RS-03, RS-04, RS-05): alguien que pide un cuarto por el enlace público del negocio. La guarda el
// servidor (no hay sesión) después de validarla; el arrendador la aprueba (se crea su ficha de residente), la deja en
// lista de espera o la rechaza.
export const applicationStatus = pgEnum("application_status", ["new", "waitlist", "approved", "rejected"]);

export const application = pgTable(
  "application",
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid()
      .notNull()
      .references(() => business.id, { onDelete: "cascade" }),
    fullName: text().notNull(),
    phone: text().notNull(),
    email: text(),
    // Qué busca: cuarto o departamento (vacío = cualquiera).
    unitType: unitType(),
    moveInDate: date(),
    months: smallint(),
    budget: numeric({ precision: 10, scale: 2 }),
    // Universidad, trabajo u hospital (lo que lo trae a la ciudad).
    occupation: text(),
    message: text(),
    status: applicationStatus().notNull().default("new"),
    // Nota del arrendador (por ejemplo, el motivo del rechazo). No la ve el postulante.
    note: text(),
    residentId: uuid().references(() => resident.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index("application_business_created_idx").on(t.businessId, t.createdAt),
    check("application_full_name", sql`length(trim(${t.fullName})) between 2 and 120`),
    check("application_message", sql`${t.message} is null or length(${t.message}) <= 1000`),
    check("application_months", sql`${t.months} is null or ${t.months} between 1 and 60`),
    check("application_budget", sql`${t.budget} is null or ${t.budget} >= 0`),
    pgPolicy("application_landlord_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.businessId} in ${myBusinessIds}`,
      withCheck: sql`${t.businessId} in ${myBusinessIds}`,
    }),
  ],
);

// Ingreso y salida de un contrato (CT-06, CT-07, CR-10): la cita para entregar o recibir llaves y el checklist de ese
// día. Uno de cada tipo por contrato. Las fallas del cuarto las reporta el residente (entry_report) y los daños van en
// la liquidación de la garantía: aquí queda solo lo de la entrega.
export const moveKind = pgEnum("move_kind", ["check_in", "check_out"]);

export const moveEvent = pgTable(
  "move_event",
  {
    id: uuid().primaryKey().defaultRandom(),
    contractId: uuid()
      .notNull()
      .references(() => contract.id, { onDelete: "cascade" }),
    kind: moveKind().notNull(),
    scheduledAt: timestamp({ withTimezone: true }),
    doneAt: timestamp({ withTimezone: true }),
    keysCount: smallint(),
    // Lo marcado del checklist, por clave ("keys", "clean"…). Las claves salen de src/server/moves/rules.ts.
    checklist: jsonb().$type<Record<string, boolean>>().notNull().default({}),
    notes: text(),
    updatedBy: uuid().references(() => person.id, { onDelete: "set null" }),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("move_event_contract_kind_idx").on(t.contractId, t.kind),
    check("move_event_keys", sql`${t.keysCount} is null or ${t.keysCount} between 0 and 20`),
    check("move_event_notes", sql`${t.notes} is null or length(${t.notes}) <= 1000`),
    pgPolicy("move_event_landlord_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.contractId} in ${myBusinessContractIds}`,
      withCheck: sql`${t.contractId} in ${myBusinessContractIds}`,
    }),
    pgPolicy("move_event_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.contractId} in ${myOwnContractIds}`,
    }),
  ],
);

// --- Fase 7 · Segunda parte: mensajes, reseñas, visitas, paquetes, proveedores, tareas periódicas y limpieza ---

// Mensajes (CM-03): una conversación por ficha (residente o comensal) con su negocio. from_resident dice quién lo
// escribió; read_at, cuándo lo leyó el otro lado. El residente marca como leídos los del arrendador con la función
// read_my_messages (migración 0025), porque una política de "update" le dejaría cambiar el texto.
export const message = pgTable(
  "message",
  {
    id: uuid().primaryKey().defaultRandom(),
    residentId: uuid()
      .notNull()
      .references(() => resident.id, { onDelete: "cascade" }),
    authorId: uuid()
      .notNull()
      .references(() => person.id, { onDelete: "restrict" }),
    fromResident: boolean().notNull(),
    body: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index("message_resident_created_idx").on(t.residentId, t.createdAt),
    check("message_body", sql`length(trim(${t.body})) between 1 and 2000`),
    pgPolicy("message_landlord_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.residentId} in ${myBusinessResidentIds}`,
      withCheck: sql`${t.residentId} in ${myBusinessResidentIds} and ${t.authorId} in ${myPersonIds} and ${t.fromResident} = false`,
    }),
    pgPolicy("message_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.residentId} in ${myOwnResidentIds}`,
    }),
    pgPolicy("message_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${t.residentId} in ${myOwnResidentIds} and ${t.authorId} in ${myPersonIds}
        and ${t.fromResident} = true and ${t.readAt} is null`,
    }),
  ],
);

// Reseña al terminar el contrato (CR-03 a CR-05): una sola por contrato, cuando ya terminó y no se renovó. El
// arrendador no lee la tabla directo: la ve con la función business_reviews (migración 0025), que quita el nombre
// y la unidad si la reseña es anónima.
export const review = pgTable(
  "review",
  {
    id: uuid().primaryKey().defaultRandom(),
    contractId: uuid()
      .notNull()
      .unique()
      .references(() => contract.id, { onDelete: "cascade" }),
    residentId: uuid()
      .notNull()
      .references(() => resident.id, { onDelete: "cascade" }),
    businessId: uuid()
      .notNull()
      .references(() => business.id, { onDelete: "cascade" }),
    // De 1 a 5. La pensión es opcional (solo si comió ahí).
    room: smallint().notNull(),
    cleaning: smallint().notNull(),
    treatment: smallint().notNull(),
    coexistence: smallint().notNull(),
    mealPlan: smallint(),
    comment: text(),
    recommends: boolean().notNull(),
    anonymous: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("review_business_created_idx").on(t.businessId, t.createdAt),
    check(
      "review_scores",
      sql`${t.room} between 1 and 5 and ${t.cleaning} between 1 and 5 and ${t.treatment} between 1 and 5
        and ${t.coexistence} between 1 and 5 and (${t.mealPlan} is null or ${t.mealPlan} between 1 and 5)`,
    ),
    check("review_comment", sql`${t.comment} is null or length(${t.comment}) <= 1000`),
    pgPolicy("review_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.residentId} in ${myOwnResidentIds}`,
    }),
    // Solo de un contrato suyo, confirmado, que ya terminó (fin hoy o antes, en Lima) y que no se renovó.
    pgPolicy("review_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${t.residentId} in ${myOwnResidentIds}
        and ${t.businessId} = (select r.business_id from public.resident r where r.id = ${t.residentId})
        and exists (select 1 from public.contract c where c.id = ${t.contractId} and c.resident_id = ${t.residentId}
          and c.status = 'confirmed' and c.end_date is not null
          and c.end_date <= (now() at time zone 'America/Lima')::date
          and not exists (select 1 from public.contract n where n.renewed_from_id = c.id and n.status <> 'cancelled'))`,
    }),
  ],
);

// Visitas (CM-05): quién llegó, a quién visita y a qué hora entró y salió. Solo el nombre: sin DNI (dato sensible).
export const visit = pgTable(
  "visit",
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid()
      .notNull()
      .references(() => business.id, { onDelete: "cascade" }),
    residentId: uuid().references(() => resident.id, { onDelete: "set null" }),
    visitorName: text().notNull(),
    arrivedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    leftAt: timestamp({ withTimezone: true }),
    note: text(),
    createdBy: uuid()
      .notNull()
      .references(() => person.id, { onDelete: "restrict" }),
  },
  (t) => [
    index("visit_business_arrived_idx").on(t.businessId, t.arrivedAt),
    check("visit_visitor_name", sql`length(trim(${t.visitorName})) between 2 and 120`),
    check("visit_note", sql`${t.note} is null or length(${t.note}) <= 300`),
    check("visit_left_after", sql`${t.leftAt} is null or ${t.leftAt} >= ${t.arrivedAt}`),
    pgPolicy("visit_landlord_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.businessId} in ${myBusinessIds}`,
      withCheck: sql`${t.businessId} in ${myBusinessIds}`,
    }),
  ],
);

// Paquetes (CM-06): lo que llegó para un residente. Al registrarlo se le avisa; se marca entregado al recogerlo.
export const parcel = pgTable(
  "parcel",
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid()
      .notNull()
      .references(() => business.id, { onDelete: "cascade" }),
    residentId: uuid()
      .notNull()
      .references(() => resident.id, { onDelete: "cascade" }),
    description: text().notNull(),
    receivedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    deliveredAt: timestamp({ withTimezone: true }),
    // Quién lo recogió, si no fue el residente ("su hermana").
    deliveredTo: text(),
    createdBy: uuid()
      .notNull()
      .references(() => person.id, { onDelete: "restrict" }),
  },
  (t) => [
    index("parcel_business_received_idx").on(t.businessId, t.receivedAt),
    index("parcel_resident_id_idx").on(t.residentId),
    check("parcel_description", sql`length(trim(${t.description})) between 1 and 120`),
    check("parcel_delivered_to", sql`${t.deliveredTo} is null or length(${t.deliveredTo}) <= 120`),
    pgPolicy("parcel_landlord_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.businessId} in ${myBusinessIds}`,
      withCheck: sql`${t.businessId} in ${myBusinessIds}
        and ${t.residentId} in (select r.id from public.resident r where r.business_id = ${t.businessId})`,
    }),
    pgPolicy("parcel_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.residentId} in ${myOwnResidentIds}`,
    }),
  ],
);

// Proveedores (MT-06): gasfitero, electricista, limpieza… Su historial sale de los pedidos y las tareas que hizo.
export const supplier = pgTable(
  "supplier",
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid()
      .notNull()
      .references(() => business.id, { onDelete: "cascade" }),
    name: text().notNull(),
    trade: text(),
    phone: text(),
    note: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("supplier_business_id_idx").on(t.businessId),
    check("supplier_name", sql`length(trim(${t.name})) between 2 and 120`),
    check("supplier_trade", sql`${t.trade} is null or length(${t.trade}) <= 60`),
    check("supplier_phone", sql`${t.phone} is null or length(${t.phone}) <= 30`),
    check("supplier_note", sql`${t.note} is null or length(${t.note}) <= 500`),
    pgPolicy("supplier_landlord_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.businessId} in ${myBusinessIds}`,
      withCheck: sql`${t.businessId} in ${myBusinessIds}`,
    }),
  ],
);

// Tareas que se repiten (MT-04 y limpieza de áreas comunes): "Revisar extintores cada 6 meses", "Limpiar el pasillo
// del 2.º piso cada semana". next_due es la próxima fecha; al marcarla hecha se calcula la siguiente.
export const taskKind = pgEnum("task_kind", ["maintenance", "cleaning"]);
export const taskPeriod = pgEnum("task_period", ["day", "week", "month"]);

export const recurringTask = pgTable(
  "recurring_task",
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid()
      .notNull()
      .references(() => business.id, { onDelete: "cascade" }),
    kind: taskKind().notNull(),
    title: text().notNull(),
    // Dónde: "Pasillo del 2.º piso", "Azotea" (texto libre). property_id: de qué edificio, si hay varios.
    place: text(),
    propertyId: uuid().references(() => property.id, { onDelete: "set null" }),
    every: smallint().notNull(),
    period: taskPeriod().notNull(),
    nextDue: date().notNull(),
    supplierId: uuid().references(() => supplier.id, { onDelete: "set null" }),
    notes: text(),
    active: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("recurring_task_business_due_idx").on(t.businessId, t.nextDue),
    check("recurring_task_title", sql`length(trim(${t.title})) between 1 and 120`),
    check("recurring_task_place", sql`${t.place} is null or length(${t.place}) <= 120`),
    check("recurring_task_every", sql`${t.every} between 1 and 365`),
    check("recurring_task_notes", sql`${t.notes} is null or length(${t.notes}) <= 1000`),
    pgPolicy("recurring_task_landlord_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.businessId} in ${myBusinessIds}`,
      withCheck: sql`${t.businessId} in ${myBusinessIds}`,
    }),
  ],
);

const myBusinessTaskIds = sql`(select t.id from public.recurring_task t where t.business_id in ${myBusinessIds})`;

// Cada vez que se hizo una tarea: cuándo, cuánto costó y quién la hizo.
export const taskLog = pgTable(
  "task_log",
  {
    id: uuid().primaryKey().defaultRandom(),
    taskId: uuid()
      .notNull()
      .references(() => recurringTask.id, { onDelete: "cascade" }),
    doneOn: date().notNull(),
    cost: numeric({ precision: 10, scale: 2 }),
    supplierId: uuid().references(() => supplier.id, { onDelete: "set null" }),
    note: text(),
    doneBy: uuid().references(() => person.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("task_log_task_done_idx").on(t.taskId, t.doneOn),
    check("task_log_cost", sql`${t.cost} is null or ${t.cost} >= 0`),
    check("task_log_note", sql`${t.note} is null or length(${t.note}) <= 500`),
    pgPolicy("task_log_landlord_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.taskId} in ${myBusinessTaskIds}`,
      withCheck: sql`${t.taskId} in ${myBusinessTaskIds}`,
    }),
  ],
);

// Pedido de limpieza del residente (MT-05): solo si su residencia lo prendió (business.accepts_cleaning_requests).
// El arrendador le pone fecha y lo marca hecho; al residente le llega el aviso. El residente no puede leer el
// negocio (RLS): la política pregunta con la función business_accepts_cleaning (migración 0025).
export const cleaningRequestStatus = pgEnum("cleaning_request_status", [
  "requested",
  "scheduled",
  "done",
  "cancelled",
]);

export const cleaningRequest = pgTable(
  "cleaning_request",
  {
    id: uuid().primaryKey().defaultRandom(),
    businessId: uuid()
      .notNull()
      .references(() => business.id, { onDelete: "cascade" }),
    residentId: uuid()
      .notNull()
      .references(() => resident.id, { onDelete: "cascade" }),
    unitId: uuid().references(() => unit.id, { onDelete: "set null" }),
    note: text(),
    preferredDate: date(),
    status: cleaningRequestStatus().notNull().default("requested"),
    scheduledFor: date(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    doneAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index("cleaning_request_business_status_idx").on(t.businessId, t.status),
    index("cleaning_request_resident_id_idx").on(t.residentId),
    check("cleaning_request_note", sql`${t.note} is null or length(${t.note}) <= 500`),
    check("cleaning_request_done_at", sql`(${t.status} = 'done') = (${t.doneAt} is not null)`),
    pgPolicy("cleaning_request_landlord_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.businessId} in ${myBusinessIds}`,
      withCheck: sql`${t.businessId} in ${myBusinessIds}`,
    }),
    pgPolicy("cleaning_request_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.residentId} in ${myOwnResidentIds}`,
    }),
    // A su nombre, en su negocio (que lo tenga prendido), recién pedido y en una unidad de sus contratos.
    pgPolicy("cleaning_request_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${t.residentId} in ${myOwnResidentIds}
        and ${t.businessId} = (select r.business_id from public.resident r where r.id = ${t.residentId})
        and public.business_accepts_cleaning(${t.businessId})
        and ${t.status} = 'requested' and ${t.scheduledFor} is null and ${t.doneAt} is null
        and (${t.unitId} is null or ${t.unitId} in (select c.unit_id from public.contract c where c.resident_id = ${t.residentId}))`,
    }),
  ],
);
