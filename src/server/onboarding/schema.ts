import { z } from "zod";

// Validación del registro inicial (servicios → negocio → qué ofreces → edificio → cuenta).
// Lo usan el navegador (para avisar paso a paso) y el servidor (que vuelve a validar todo antes de guardar).
// Los campos de texto llegan como texto; aquí se limpian y convierten (vacío → null).

export const PAYMENT_METHODS = ["yape", "plin", "transfer", "cash", "card"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

const trimmed = z.string().trim();
const optionalText = (max = 200) =>
  trimmed.max(max, { error: "Es demasiado largo." }).transform((v) => (v === "" ? null : v));

// Montos en soles con hasta 2 decimales, como texto para no perder exactitud ("650" o "650.50").
export const optionalMoney = trimmed
  .refine((v) => v === "" || /^\d{1,8}(\.\d{1,2})?$/.test(v), {
    error: "Escribe un monto válido, por ejemplo 650 o 650.50.",
  })
  .transform((v) => (v === "" ? null : v));

export const optionalArea = trimmed
  .refine((v) => v === "" || (/^\d{1,4}(\.\d{1,2})?$/.test(v) && Number(v) > 0), {
    error: "Escribe los m², por ejemplo 12 o 12.5.",
  })
  .transform((v) => (v === "" ? null : Number(v)));

export const businessSchema = z.object({
  kind: z.enum(["natural", "company"], { error: "Elige cómo operas." }),
  tradeName: trimmed
    .min(2, { error: "Escribe el nombre de tu negocio." })
    .max(100, { error: "Es demasiado largo." }),
  legalName: optionalText(150),
  ruc: trimmed
    .refine((v) => v === "" || /^\d{11}$/.test(v), { error: "El RUC tiene 11 dígitos." })
    .transform((v) => (v === "" ? null : v)),
  phone: trimmed
    .refine((v) => v === "" || /^[+\d\s()-]{6,20}$/.test(v), { error: "Escribe un teléfono válido." })
    .transform((v) => (v === "" ? null : v)),
  contactEmail: trimmed
    .toLowerCase()
    .refine((v) => v === "" || z.email().safeParse(v).success, { error: "Escribe un correo válido." })
    .transform((v) => (v === "" ? null : v)),
  city: optionalText(100),
  address: optionalText(200),
  paymentMethods: z.array(z.enum(PAYMENT_METHODS)).min(1, { error: "Elige al menos un método de pago." }),
  billingDay: z.coerce
    .number({ error: "Elige el día de cobro." })
    .int()
    .min(1, { error: "Elige el día de cobro." })
    .max(31, { error: "Elige el día de cobro." }),
});

export const mealPlanBusinessSchema = businessSchema.extend({ sameAsResidence: z.boolean() });

const roomSchema = z.object({
  key: z.string().min(1),
  name: trimmed.min(1, { error: "Ponle un nombre." }).max(60, { error: "Es demasiado largo." }),
  monthlyPrice: optionalMoney,
  areaM2: optionalArea,
});

const unitSchema = z.object({
  key: z.string().min(1),
  type: z.enum(["apartment", "room"]),
  name: trimmed.min(1, { error: "Ponle un nombre." }).max(60, { error: "Es demasiado largo." }),
  monthlyPrice: optionalMoney,
  areaM2: optionalArea,
  occupiesWholeFloor: z.boolean(),
  rentalMode: z.enum(["whole", "by_room"]),
  // Solo departamentos: sus cuartos (dormitorios). En "completo" solo describen; en "por cuartos" se alquilan.
  rooms: z.array(roomSchema).max(20, { error: "Máximo 20 cuartos por departamento." }),
});

const floorSchema = z.object({
  units: z.array(unitSchema).min(1, { error: "Agrega al menos una unidad a este piso." }).max(40),
});

export const propertySchema = z
  .object({
    type: z.enum(["room", "floor", "building"], { error: "Elige qué ofreces." }),
    ownerLivesHere: z.enum(["yes", "no"], { error: "Indica si vives en la propiedad." }),
    name: trimmed
      .min(2, { error: "Escribe el nombre de la propiedad." })
      .max(100, { error: "Es demasiado largo." }),
    address: trimmed.min(3, { error: "Escribe la dirección." }).max(200, { error: "Es demasiado larga." }),
    districtCity: trimmed.min(2, { error: "Escribe el distrito y la ciudad." }).max(100),
    floors: z.array(floorSchema).min(1, { error: "Agrega al menos un piso." }).max(60),
  })
  .superRefine((p, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });

    // El tamaño de lo que ofreces limita la estructura.
    if (p.type !== "building" && p.floors.length > 1) issue(["floors"], "Esta opción tiene un solo piso.");
    if (p.type === "room") {
      const units = p.floors[0]?.units ?? [];
      if (units.length !== 1 || units[0].type !== "room")
        issue(["floors", 0, "units"], "Un cuarto suelto es una sola unidad.");
    }

    p.floors.forEach((floor, f) => {
      const names = new Map<string, string>();
      const checkName = (name: string, path: (string | number)[]) => {
        const k = name.trim().toLowerCase();
        if (names.has(k)) issue(path, "Ya hay una unidad con este nombre en el piso.");
        names.set(k, name);
      };

      floor.units.forEach((u, i) => {
        const at = ["floors", f, "units", i];
        checkName(u.name, [...at, "name"]);
        if (u.type === "room") {
          if (u.occupiesWholeFloor)
            issue([...at, "occupiesWholeFloor"], "Solo un departamento puede ocupar todo el piso.");
          if (u.rooms.length) issue([...at, "rooms"], "Un cuarto no tiene cuartos dentro.");
          return;
        }
        // Regla: "ocupa todo el piso" solo si el piso tiene un único departamento.
        if (u.occupiesWholeFloor && floor.units.length !== 1) {
          issue([...at, "occupiesWholeFloor"], "Solo se puede si es la única unidad del piso.");
        }
        // Regla: el precio vive en lo que se alquila.
        if (u.rentalMode === "by_room") {
          if (u.monthlyPrice !== null)
            issue([...at, "monthlyPrice"], "Por cuartos: el precio va en cada cuarto.");
          if (!u.rooms.length) issue([...at, "rooms"], "Agrega los cuartos que alquilas.");
        }
        u.rooms.forEach((r, j) => {
          checkName(r.name, [...at, "rooms", j, "name"]);
          if (u.rentalMode === "whole" && r.monthlyPrice !== null) {
            issue(
              [...at, "rooms", j, "monthlyPrice"],
              "Se alquila completo: el precio va en el departamento.",
            );
          }
        });
      });
    });
  });

// La contraseña sigue las reglas del prototipo: 8 a 72 caracteres, una mayúscula y un número.
export const passwordSchema = z
  .string()
  .min(8, { error: "Al menos 8 caracteres." })
  .max(72, { error: "Como máximo 72 caracteres." })
  .regex(/[A-ZÁÉÍÓÚÑ]/, { error: "Agrega una letra mayúscula." })
  .regex(/[0-9]/, { error: "Agrega un número." });

export const accountSchema = z.object({
  fullName: trimmed
    .min(2, { error: "Escribe tu nombre completo." })
    .max(100, { error: "Es demasiado largo." }),
  email: trimmed.toLowerCase().pipe(z.email({ error: "Escribe un correo válido." })),
  password: passwordSchema,
  acceptTerms: z.literal(true, { error: "Debes aceptar los Términos y la Política de privacidad." }),
});

export const servicesSchema = z
  .object({ residence: z.boolean(), mealPlan: z.boolean() })
  .refine((s) => s.residence || s.mealPlan, { error: "Elige al menos un servicio.", path: ["residence"] });

// Todo lo configurado (sin la cuenta). Las partes que no aplican se ignoran:
// sin Residencia no hay propiedad; sin Pensión no hay negocio de pensión.
export const setupSchema = z
  .object({
    services: servicesSchema,
    residenceBusiness: z.unknown().optional(),
    mealPlanBusiness: z.unknown().optional(),
    property: z.unknown().optional(),
  })
  .transform((raw, ctx) => {
    const parse = <T>(schema: z.ZodType<T>, value: unknown, path: string): T | null => {
      const result = schema.safeParse(value);
      if (result.success) return result.data;
      for (const issue of result.error.issues) {
        ctx.addIssue({
          code: "custom",
          path: [path, ...issue.path.map((p) => p as string | number)],
          message: issue.message,
        });
      }
      return null;
    };

    const residence = raw.services.residence
      ? parse(businessSchema, raw.residenceBusiness, "residenceBusiness")
      : null;
    const property = raw.services.residence ? parse(propertySchema, raw.property, "property") : null;

    let mealPlan: z.output<typeof businessSchema> | null = null;
    if (raw.services.mealPlan) {
      const value = raw.mealPlanBusiness as { sameAsResidence?: boolean } | undefined;
      if (value?.sameAsResidence && raw.services.residence) {
        // "Usar los mismos datos": copia todo de la Residencia salvo el nombre comercial y la dirección.
        const own = parse(
          z.object({ tradeName: businessSchema.shape.tradeName, address: businessSchema.shape.address }),
          value,
          "mealPlanBusiness",
        );
        if (residence && own) mealPlan = { ...residence, ...own };
      } else {
        mealPlan = parse(businessSchema, value, "mealPlanBusiness");
      }
    }

    return { residence, mealPlan, property };
  });

export type SetupInput = z.input<typeof setupSchema>;
export type Setup = z.output<typeof setupSchema>;
export type PropertySetup = z.output<typeof propertySchema>;
export type BusinessSetup = z.output<typeof businessSchema>;
export type AccountInput = z.input<typeof accountSchema>;

// Convierte los problemas de Zod en { "property.floors.0.units.1.name": "mensaje" } para mostrarlos junto a cada campo.
export function issuesByPath(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
