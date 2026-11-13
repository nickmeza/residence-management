import { describe, expect, it } from "vitest";

import {
  cellOf,
  dishLines,
  isEditableDay,
  menuKey,
  moveDay,
  moveMeal,
  pasteDay,
  pasteMeal,
  pasteReplaces,
  pastMenuChanged,
  type MenuCells,
} from "./menu-moves";

// Semana del lunes 9 al domingo 15 de noviembre de 2026; hoy es el miércoles 11; el domingo no se cocina.
const ctx = { today: "2026-11-11", serviceDays: [1, 2, 3, 4, 5, 6] };
const MON = "2026-11-09";
const WED = "2026-11-11";
const THU = "2026-11-12";
const FRI = "2026-11-13";
const SAT = "2026-11-14";
const SUN = "2026-11-15";

const cells: MenuCells = {
  [menuKey(MON, "lunch")]: { dish: "Lomo saltado", hasVegetarian: false },
  [menuKey(WED, "lunch")]: { dish: "Arroz chaufa\nAjí de gallina", hasVegetarian: true },
  [menuKey(THU, "lunch")]: { dish: "Estofado", hasVegetarian: false },
  [menuKey(THU, "breakfast")]: { dish: "Pan con huevo", hasVegetarian: false },
};

describe("menú: mover una comida (arrastrar y soltar)", () => {
  it("a un día vacío: se mueve y el origen queda vacío", () => {
    const r = moveMeal(cells, { date: THU, meal: "lunch" }, { date: SAT, meal: "lunch" }, ctx);
    if (!r.ok) throw new Error(r.problem);
    expect(cellOf(r.cells, SAT, "lunch").dish).toBe("Estofado");
    expect(cellOf(r.cells, THU, "lunch").dish).toBe("");
  });

  it("a un día con platos: se intercambian", () => {
    const r = moveMeal(cells, { date: THU, meal: "lunch" }, { date: WED, meal: "lunch" }, ctx);
    if (!r.ok) throw new Error(r.problem);
    expect(cellOf(r.cells, WED, "lunch").dish).toBe("Estofado");
    expect(cellOf(r.cells, THU, "lunch")).toEqual({ dish: "Arroz chaufa\nAjí de gallina", hasVegetarian: true });
  });

  it("solo a la misma comida: un almuerzo no pasa a cena", () => {
    const r = moveMeal(cells, { date: THU, meal: "lunch" }, { date: FRI, meal: "dinner" }, ctx);
    expect(r).toEqual({ ok: false, problem: "Una comida solo se mueve a la misma comida de otro día." });
  });

  it("no se suelta en un día pasado ni en uno sin servicio; hoy sí recibe", () => {
    expect(moveMeal(cells, { date: THU, meal: "lunch" }, { date: MON, meal: "lunch" }, ctx).ok).toBe(false);
    expect(moveMeal(cells, { date: THU, meal: "lunch" }, { date: SUN, meal: "lunch" }, ctx).ok).toBe(false);
    expect(moveMeal(cells, { date: THU, meal: "lunch" }, { date: WED, meal: "lunch" }, ctx).ok).toBe(true);
  });

  it("lo que ya pasó no se mueve", () => {
    const r = moveMeal(cells, { date: MON, meal: "lunch" }, { date: FRI, meal: "lunch" }, ctx);
    expect(r.ok).toBe(false);
  });

  it("no hace nada sobre el mismo día ni con una comida vacía", () => {
    expect(moveMeal(cells, { date: THU, meal: "lunch" }, { date: THU, meal: "lunch" }, ctx).ok).toBe(false);
    expect(moveMeal(cells, { date: FRI, meal: "lunch" }, { date: SAT, meal: "lunch" }, ctx).ok).toBe(false);
  });
});

describe("menú: mover un día completo", () => {
  it("intercambia todas las comidas de los dos días", () => {
    const r = moveDay(cells, THU, WED, ctx);
    if (!r.ok) throw new Error(r.problem);
    expect(cellOf(r.cells, WED, "breakfast").dish).toBe("Pan con huevo");
    expect(cellOf(r.cells, WED, "lunch").dish).toBe("Estofado");
    expect(cellOf(r.cells, THU, "lunch").dish).toBe("Arroz chaufa\nAjí de gallina");
    expect(cellOf(r.cells, THU, "breakfast").dish).toBe("");
  });

  it("no desde un día pasado ni hacia uno pasado o sin servicio", () => {
    expect(moveDay(cells, MON, FRI, ctx).ok).toBe(false);
    expect(moveDay(cells, THU, MON, ctx).ok).toBe(false);
    expect(moveDay(cells, THU, SUN, ctx).ok).toBe(false);
  });
});

describe("menú: copiar y pegar (lo pasado se copia)", () => {
  it("pega una comida pasada en un día que no pasó; el origen se queda igual", () => {
    const r = pasteMeal(cells, { date: MON, meal: "lunch" }, { date: SAT, meal: "lunch" }, ctx);
    if (!r.ok) throw new Error(r.problem);
    expect(cellOf(r.cells, SAT, "lunch").dish).toBe("Lomo saltado");
    expect(cellOf(r.cells, MON, "lunch").dish).toBe("Lomo saltado");
  });

  it("pegar sobre algo escrito lo reemplaza (la pantalla avisa antes)", () => {
    expect(pasteReplaces(cells, { date: WED, meal: "lunch" })).toBe(true);
    const r = pasteMeal(cells, { date: MON, meal: "lunch" }, { date: WED, meal: "lunch" }, ctx);
    if (!r.ok) throw new Error(r.problem);
    expect(cellOf(r.cells, WED, "lunch").dish).toBe("Lomo saltado");
  });

  it("no se pega en otra comida, en un día pasado ni en uno sin servicio", () => {
    expect(pasteMeal(cells, { date: MON, meal: "lunch" }, { date: SAT, meal: "dinner" }, ctx).ok).toBe(false);
    expect(pasteMeal(cells, { date: MON, meal: "lunch" }, { date: "2026-11-10", meal: "lunch" }, ctx).ok).toBe(
      false,
    );
    expect(pasteMeal(cells, { date: MON, meal: "lunch" }, { date: SUN, meal: "lunch" }, ctx).ok).toBe(false);
  });

  it("pega un día completo: el destino queda igual al origen", () => {
    const r = pasteDay(cells, MON, THU, ctx);
    if (!r.ok) throw new Error(r.problem);
    expect(cellOf(r.cells, THU, "lunch").dish).toBe("Lomo saltado");
    expect(cellOf(r.cells, THU, "breakfast").dish).toBe("");
  });
});

describe("menú: días editables y validación del servidor", () => {
  it("se edita desde hoy y solo los días que se cocina", () => {
    expect(isEditableDay(MON, ctx)).toBe(false);
    expect(isEditableDay(WED, ctx)).toBe(true);
    expect(isEditableDay(SUN, ctx)).toBe(false);
  });

  it("un plato por línea", () => {
    expect(dishLines("Entrada: sopa\n\n  Segundo: lomo  \n")).toEqual(["Entrada: sopa", "Segundo: lomo"]);
  });

  it("detecta si se quiso cambiar o borrar el menú de un día pasado", () => {
    const saved = [{ date: MON, meal: "lunch" as const, dish: "Lomo saltado", hasVegetarian: false }];
    const same = [{ date: MON, meal: "lunch" as const, dish: "Lomo saltado ", hasVegetarian: false }];
    expect(pastMenuChanged(saved, same, WED)).toBe(false);
    expect(pastMenuChanged(saved, [{ ...same[0], dish: "" }], WED)).toBe(true);
    expect(pastMenuChanged(saved, [{ ...same[0], hasVegetarian: true }], WED)).toBe(true);
    expect(pastMenuChanged([], [{ date: MON, meal: "dinner", dish: "Sopa", hasVegetarian: false }], WED)).toBe(true);
    expect(pastMenuChanged([], [{ date: MON, meal: "dinner", dish: "", hasVegetarian: false }], WED)).toBe(false);
    // Hoy y después sí se pueden cambiar.
    expect(pastMenuChanged(saved, [{ date: WED, meal: "lunch", dish: "Otro", hasVegetarian: false }], WED)).toBe(
      false,
    );
  });
});
