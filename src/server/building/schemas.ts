import { z } from "zod";

import { optionalArea, optionalMoney } from "../onboarding/schema";

// Validación del panel "Editar unidad". La usan la pantalla (para avisar) y el servidor (que vuelve a validar).

export const SPACE_TYPES = ["bedroom", "studio", "office", "storage", "other"] as const;
export const SPACE_TYPE_LABEL: Record<(typeof SPACE_TYPES)[number], string> = {
  bedroom: "Dormitorio",
  studio: "Estudio",
  office: "Oficina",
  storage: "Depósito",
  other: "Otro",
};

// En el formulario, "sin elegir" es "".
const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.union([z.enum(values), z.literal("")]).transform((v) => (v === "" ? null : v));

export const unitEditSchema = z.object({
  name: z.string().trim().min(1, { error: "Ponle un nombre." }).max(60, { error: "Es demasiado largo." }),
  monthlyPrice: optionalMoney,
  areaM2: optionalArea,
  bathroom: optionalEnum(["private", "shared"] as const),
  furnished: z.boolean(),
  spaceType: optionalEnum(SPACE_TYPES),
  // Solo departamentos.
  rentalMode: z.enum(["whole", "by_room"]).optional(),
  occupiesWholeFloor: z.boolean().optional(),
});

export type UnitEditInput = z.input<typeof unitEditSchema>;
export type UnitEdit = z.output<typeof unitEditSchema>;
