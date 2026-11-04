// Tablas de la base con Drizzle. Modelo completo en docs/modelo-de-datos.md.
// Propiedad → Piso → Unidad. Cada fila pertenece a una persona por la cadena
// cuenta (auth.users) → person → property → floor → unit, y el RLS la sigue.
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { authenticatedRole, authUid, authUsers } from "drizzle-orm/supabase";

export const propertyType = pgEnum("property_type", ["room", "floor", "building"]);
export const unitType = pgEnum("unit_type", ["apartment", "room"]);
export const rentalMode = pgEnum("rental_mode", ["whole", "by_room"]);
export const bathroomType = pgEnum("bathroom_type", ["private", "shared"]);

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
  },
  (t) => [
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
  ],
);

// La persona con sesión. Se usa en las políticas de las demás tablas.
const myPersonIds = sql`(select id from public.person where user_id = ${authUid})`;

export const property = pgTable(
  "property",
  {
    id: uuid().primaryKey().defaultRandom(),
    ownerId: uuid()
      .notNull()
      .references(() => person.id, { onDelete: "restrict" }),
    name: text().notNull(),
    address: text().notNull(),
    districtCity: text().notNull(),
    type: propertyType().notNull(),
    ownerLivesHere: boolean().notNull().default(false),
    managerId: uuid().references(() => person.id, { onDelete: "set null" }),
    currency: text().notNull().default("PEN"),
  },
  (t) => [
    index("property_owner_id_idx").on(t.ownerId),
    pgPolicy("property_owner_all", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.ownerId} in ${myPersonIds}`,
      withCheck: sql`${t.ownerId} in ${myPersonIds}`,
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
      using: sql`exists (select 1 from public.property p where p.id = ${t.propertyId} and p.owner_id in ${myPersonIds})`,
      withCheck: sql`exists (select 1 from public.property p where p.id = ${t.propertyId} and p.owner_id in ${myPersonIds})`,
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
    areaM2: numeric({ precision: 8, scale: 2 }),
    bathroom: bathroomType(),
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
        where f.id = ${t.floorId} and p.owner_id in ${myPersonIds})`,
      withCheck: sql`exists (select 1 from public.floor f join public.property p on p.id = f.property_id
        where f.id = ${t.floorId} and p.owner_id in ${myPersonIds})`,
    }),
  ],
);
