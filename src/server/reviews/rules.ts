// Reseñas al terminar el contrato (CR-03 a CR-05). Funciones puras: quién puede calificar y los promedios.
import type { IsoDate } from "@/server/contracts/dates";

export const RUBRICS = [
  { key: "room", label: "Cuarto" },
  { key: "cleaning", label: "Limpieza" },
  { key: "treatment", label: "Trato" },
  { key: "coexistence", label: "Convivencia" },
  { key: "mealPlan", label: "Pensión" },
] as const;

export type RubricKey = (typeof RUBRICS)[number]["key"];

export type ReviewScores = {
  room: number;
  cleaning: number;
  treatment: number;
  coexistence: number;
  // Opcional: solo si comió en la pensión.
  mealPlan: number | null;
};

export type ReviewableContract = {
  status: "draft" | "pending_signature" | "confirmed" | "cancelled";
  endDate: IsoDate | null;
  renewed: boolean;
  reviewed: boolean;
};

// Regla de negocio: solo al terminar el contrato y una sola vez. Un contrato renovado no terminó: la estadía sigue.
export const canReview = (c: ReviewableContract, today: IsoDate) =>
  c.status === "confirmed" && c.endDate !== null && c.endDate <= today && !c.renewed && !c.reviewed;

export type ReviewSummary = {
  count: number;
  // Promedio con un decimal por rubro; null si nadie calificó ese rubro.
  averages: Record<RubricKey, number | null>;
  // Porcentaje de reseñas que recomiendan (0–100); null sin reseñas.
  recommendPercent: number | null;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

export function reviewSummary(rows: (ReviewScores & { recommends: boolean })[]): ReviewSummary {
  const averages = {} as Record<RubricKey, number | null>;
  for (const { key } of RUBRICS) {
    const values = rows.map((r) => r[key]).filter((v): v is number => v !== null);
    averages[key] = values.length ? round1(values.reduce((a, b) => a + b, 0) / values.length) : null;
  }
  return {
    count: rows.length,
    averages,
    recommendPercent: rows.length
      ? Math.round((rows.filter((r) => r.recommends).length / rows.length) * 100)
      : null,
  };
}
