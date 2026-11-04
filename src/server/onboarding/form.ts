// Forma de los datos del formulario de registro (todo como texto, como lo escribe la persona),
// valores iniciales y validación por paso. Funciones puras: las usa la pantalla, se prueban sin ella.
import {
  accountSchema,
  businessSchema,
  issuesByPath,
  propertySchema,
  servicesSchema,
  type PaymentMethod,
} from "./schema";
import { z } from "zod";

export type BusinessForm = {
  kind: "natural" | "company";
  tradeName: string;
  legalName: string;
  ruc: string;
  phone: string;
  contactEmail: string;
  city: string;
  address: string;
  paymentMethods: PaymentMethod[];
  billingDay: string;
};

export type RoomForm = { key: string; name: string; monthlyPrice: string; areaM2: string };

export type UnitForm = {
  key: string;
  type: "apartment" | "room";
  name: string;
  monthlyPrice: string;
  areaM2: string;
  occupiesWholeFloor: boolean;
  rentalMode: "whole" | "by_room";
  rooms: RoomForm[];
};

export type PropertyType = "room" | "floor" | "building";

export type SetupForm = {
  services: { residence: boolean; mealPlan: boolean };
  residenceBusiness: BusinessForm;
  mealPlanBusiness: BusinessForm & { sameAsResidence: boolean };
  property: {
    type: PropertyType | "";
    ownerLivesHere: "yes" | "no" | "";
    name: string;
    address: string;
    districtCity: string;
    floors: { units: UnitForm[] }[];
  };
  account: { fullName: string; email: string; password: string; acceptTerms: boolean };
};

export type StepId = "services" | "business" | "offer" | "building" | "account";

export const STEP_LABELS: Record<StepId, string> = {
  services: "Servicios",
  business: "Tu negocio",
  offer: "Qué ofreces",
  building: "Arma tu propiedad",
  account: "Cuenta",
};

export const newKey = () => crypto.randomUUID();

const pad = (n: number) => String(n).padStart(2, "0");

// Nombres sugeridos como en el prototipo: "Cuarto 202" = piso 2, unidad 2.
export function suggestUnitName(type: UnitForm["type"], level: number, index: number) {
  return `${type === "apartment" ? "Departamento" : "Cuarto"} ${level}${pad(index + 1)}`;
}

export function suggestRoomName(apartmentName: string, index: number) {
  const code = apartmentName.match(/\d+$/)?.[0];
  return code ? `Cuarto ${code}-${String.fromCharCode(65 + index)}` : `Dormitorio ${index + 1}`;
}

export function newUnit(type: UnitForm["type"], level: number, index: number): UnitForm {
  return {
    key: newKey(),
    type,
    name: suggestUnitName(type, level, index),
    monthlyPrice: "",
    areaM2: "",
    occupiesWholeFloor: false,
    rentalMode: "whole",
    rooms: [],
  };
}

export function newRoom(apartmentName: string, index: number): RoomForm {
  return { key: newKey(), name: suggestRoomName(apartmentName, index), monthlyPrice: "", areaM2: "" };
}

const emptyBusiness = (): BusinessForm => ({
  kind: "natural",
  tradeName: "",
  legalName: "",
  ruc: "",
  phone: "",
  contactEmail: "",
  city: "",
  address: "",
  paymentMethods: [],
  billingDay: "5",
});

export function initialSetupForm(): SetupForm {
  return {
    services: { residence: true, mealPlan: false },
    residenceBusiness: emptyBusiness(),
    mealPlanBusiness: { ...emptyBusiness(), sameAsResidence: true },
    property: {
      type: "",
      ownerLivesHere: "",
      name: "",
      address: "",
      districtCity: "",
      floors: [{ units: [newUnit("room", 1, 0)] }],
    },
    account: { fullName: "", email: "", password: "", acceptTerms: false },
  };
}

// Pasos que se muestran según lo elegido. Sin Residencia no hay propiedad que armar.
export function stepsFor(form: Pick<SetupForm, "services">, withAccount: boolean): StepId[] {
  const steps: StepId[] = ["services", "business"];
  if (form.services.residence) steps.push("offer", "building");
  if (withAccount) steps.push("account");
  return steps;
}

const prefixed = (base: string, error: z.ZodError) =>
  Object.fromEntries(Object.entries(issuesByPath(error)).map(([k, v]) => [k ? `${base}.${k}` : base, v]));

const check = <T>(schema: z.ZodType<T>, value: unknown, base: string) => {
  const r = schema.safeParse(value);
  return r.success ? {} : prefixed(base, r.error);
};

// Errores de un paso, con la ruta de cada campo ("property.floors.0.units.1.name": "mensaje").
// Un objeto vacío significa que se puede continuar.
export function validateStep(step: StepId, form: SetupForm): Record<string, string> {
  switch (step) {
    case "services":
      return check(servicesSchema, form.services, "services");
    case "business": {
      const errors = form.services.residence
        ? check(businessSchema, form.residenceBusiness, "residenceBusiness")
        : {};
      if (form.services.mealPlan) {
        const same = form.services.residence && form.mealPlanBusiness.sameAsResidence;
        const schema = same ? businessSchema.pick({ tradeName: true, address: true }) : businessSchema;
        Object.assign(errors, check(schema, form.mealPlanBusiness, "mealPlanBusiness"));
      }
      return errors;
    }
    case "offer":
      return check(
        z.object({ type: propertySchema.shape.type, ownerLivesHere: propertySchema.shape.ownerLivesHere }),
        form.property,
        "property",
      );
    case "building":
      return check(propertySchema, form.property, "property");
    case "account":
      return check(accountSchema, form.account, "account");
  }
}

// Al cambiar qué ofreces, la estructura se ajusta: un cuarto es un piso con un cuarto; un piso, un solo nivel.
export function fitFloorsToType(type: PropertyType, floors: SetupForm["property"]["floors"]) {
  if (type === "building") return floors;
  const first = floors[0] ?? { units: [] };
  if (type === "floor") return [first.units.length ? first : { units: [newUnit("room", 1, 0)] }];
  const room = first.units.find((u) => u.type === "room") ?? newUnit("room", 1, 0);
  return [{ units: [{ ...room, occupiesWholeFloor: false, rooms: [] }] }];
}

// Borrador en el navegador: todo menos la contraseña.
export function toDraft(form: SetupForm): SetupForm {
  return { ...form, account: { ...form.account, password: "" } };
}

// Resumen para mostrar mientras se arma: pisos, departamentos y unidades que se alquilan por sí solas.
export function formSummary(floors: SetupForm["property"]["floors"]) {
  let apartments = 0;
  let rentable = 0;
  for (const floor of floors) {
    for (const u of floor.units) {
      if (u.type === "room") rentable++;
      else {
        apartments++;
        rentable += u.rentalMode === "whole" ? 1 : u.rooms.length;
      }
    }
  }
  return { floors: floors.length, apartments, rentable };
}

// Cómo se muestran los pasos (como el prototipo): "Qué ofreces" y "Arma tu propiedad" son partes de "Estructura".
export type StepGroup = { label: string; steps: StepId[] };

export function groupSteps(steps: StepId[]): StepGroup[] {
  const groups: StepGroup[] = [];
  for (const step of steps) {
    const inStructure = step === "offer" || step === "building";
    const last = groups.at(-1);
    if (inStructure && last?.label === "Estructura") last.steps.push(step);
    else groups.push({ label: inStructure ? "Estructura" : STEP_LABELS[step], steps: [step] });
  }
  return groups;
}

// "Paso 3 de 4 · Parte 1 de 2"
export function stepPosition(steps: StepId[], step: StepId) {
  const groups = groupSteps(steps);
  const index = Math.max(
    0,
    groups.findIndex((g) => g.steps.includes(step)),
  );
  const group = groups[index];
  const part =
    group.steps.length > 1 ? { index: group.steps.indexOf(step), total: group.steps.length } : null;
  return { index, total: groups.length, part, groups };
}
