import { describe, expect, it } from "vitest";

import { daysBetween, endsInLabel, formatLongDate, limaToday, periodsOverlap } from "./dates";
import {
  confirmProblems,
  contractPhase,
  occupiesToday,
  overlappingContracts,
  statusAfterDraft,
  type ContractInput,
} from "./rules";

const contract = (over: Partial<ContractInput>): ContractInput => ({
  id: "c1",
  unitId: "cuarto",
  startDate: "2026-03-01",
  endDate: "2026-12-31",
  status: "confirmed",
  ...over,
});

describe("fechas", () => {
  it("hoy se cuenta en Lima, no en UTC", () => {
    // 3:00 en UTC del 1 de marzo todavía es 28 de febrero en Lima (UTC-5).
    expect(limaToday(new Date("2026-03-01T03:00:00Z"))).toBe("2026-02-28");
  });

  it("cuenta días y escribe fechas en español", () => {
    expect(daysBetween("2026-03-01", "2026-03-31")).toBe(30);
    expect(formatLongDate("2026-03-01")).toBe("1 de marzo de 2026");
  });

  it("dos periodos que comparten un día se solapan; sin fin no tiene límite", () => {
    const march = { startDate: "2026-03-01", endDate: "2026-03-31" };
    expect(periodsOverlap(march, { startDate: "2026-03-31", endDate: "2026-04-30" })).toBe(true);
    expect(periodsOverlap(march, { startDate: "2026-04-01", endDate: "2026-04-30" })).toBe(false);
    expect(
      periodsOverlap({ startDate: "2026-01-01", endDate: null }, { startDate: "2030-01-01", endDate: null }),
    ).toBe(true);
  });
});

describe("fase del contrato (vigente, por vencer, terminado)", () => {
  it("borrador, pendiente y cancelado no dependen de las fechas", () => {
    expect(contractPhase(contract({ status: "draft" }), "2026-05-01")).toBe("draft");
    expect(contractPhase(contract({ status: "pending_signature" }), "2026-05-01")).toBe("pending_signature");
    expect(contractPhase(contract({ status: "cancelled" }), "2026-05-01")).toBe("cancelled");
  });

  it("un confirmado se calcula con la fecha de hoy", () => {
    const c = contract({});
    expect(contractPhase(c, "2026-02-28")).toBe("upcoming");
    expect(contractPhase(c, "2026-03-01")).toBe("active");
    expect(contractPhase(c, "2026-12-01")).toBe("ending_soon");
    expect(contractPhase(c, "2026-12-31")).toBe("ending_soon");
    expect(contractPhase(c, "2027-01-01")).toBe("ended");
  });

  it("los días de 'por vencer' se pueden cambiar", () => {
    expect(contractPhase(contract({}), "2026-11-15", 60)).toBe("ending_soon");
    expect(contractPhase(contract({}), "2026-11-15", 30)).toBe("active");
  });

  it("sin fecha de fin sigue vigente", () => {
    expect(contractPhase(contract({ endDate: null }), "2040-01-01")).toBe("active");
  });
});

describe("ocupación de la unidad", () => {
  it("ocupa con contrato confirmado o pendiente de firma dentro de sus fechas", () => {
    expect(occupiesToday(contract({}), "2026-05-01")).toBe(true);
    expect(occupiesToday(contract({ status: "pending_signature" }), "2026-05-01")).toBe(true);
    expect(occupiesToday(contract({ status: "draft" }), "2026-05-01")).toBe(false);
    expect(occupiesToday(contract({ status: "cancelled" }), "2026-05-01")).toBe(false);
    expect(occupiesToday(contract({}), "2027-01-01")).toBe(false);
  });
});

describe("regla 4: sin contratos solapados en la misma unidad", () => {
  const units = [
    { id: "cuarto", parentId: null },
    { id: "depto", parentId: null },
    { id: "depto-c1", parentId: "depto" },
    { id: "depto-c2", parentId: "depto" },
  ];
  const april = { id: "nuevo", startDate: "2026-04-01", endDate: "2026-04-30" };

  it("choca con un contrato de la misma unidad en fechas cruzadas", () => {
    const others = [contract({ id: "a" })];
    expect(overlappingContracts({ ...april, unitId: "cuarto" }, others, units).map((c) => c.id)).toEqual([
      "a",
    ]);
  });

  it("no choca con fechas distintas, otras unidades, borradores ni cancelados", () => {
    const others = [
      contract({ id: "antes", endDate: "2026-03-31" }),
      contract({ id: "otra", unitId: "depto-c1" }),
      contract({ id: "borrador", status: "draft" }),
      contract({ id: "cancelado", status: "cancelled" }),
    ];
    expect(overlappingContracts({ ...april, unitId: "cuarto" }, others, units)).toEqual([]);
  });

  it("un departamento completo choca con los contratos de sus cuartos, y al revés", () => {
    const roomContract = contract({ id: "cuarto-1", unitId: "depto-c1" });
    expect(overlappingContracts({ ...april, unitId: "depto" }, [roomContract], units)).toHaveLength(1);
    const wholeContract = contract({ id: "completo", unitId: "depto" });
    expect(overlappingContracts({ ...april, unitId: "depto-c2" }, [wholeContract], units)).toHaveLength(1);
    // Dos cuartos del mismo departamento no chocan entre sí.
    expect(overlappingContracts({ ...april, unitId: "depto-c2" }, [roomContract], units)).toEqual([]);
  });

  it("al editar un contrato no choca consigo mismo", () => {
    const self = contract({ id: "nuevo" });
    expect(overlappingContracts({ ...april, unitId: "cuarto" }, [self], units)).toEqual([]);
  });
});

describe("regla 10: confirmar el contrato", () => {
  const base = {
    contract: { status: "pending_signature" as const, paperwork: "paper" as const, propertyId: "p1" },
    requirements: [
      { id: "dni", propertyId: null, required: true },
      { id: "constancia", propertyId: null, required: false },
      { id: "otra-propiedad", propertyId: "p2", required: true },
    ],
  };
  const signed = { kind: "signed_contract" as const, requirementId: null, status: "in_review" as const };
  const dni = (status: "in_review" | "verified" | "rejected") => ({
    kind: "requirement" as const,
    requirementId: "dni",
    status,
  });

  it("se puede con la copia firmada y los obligatorios de su propiedad verificados", () => {
    expect(confirmProblems({ ...base, documents: [signed, dni("verified")] })).toEqual([]);
  });

  it("falta la copia firmada si hay papel; sin papel no se pide", () => {
    expect(confirmProblems({ ...base, documents: [dni("verified")] })).toEqual([
      { code: "signed_copy_missing" },
    ]);
    const none = {
      ...base,
      contract: { ...base.contract, status: "draft" as const, paperwork: "none" as const },
    };
    expect(confirmProblems({ ...none, documents: [dni("verified")] })).toEqual([]);
  });

  it("un obligatorio en revisión o rechazado no cuenta; los opcionales no bloquean", () => {
    for (const status of ["in_review", "rejected"] as const) {
      expect(confirmProblems({ ...base, documents: [signed, dni(status)] })).toEqual([
        { code: "required_documents_missing", requirementIds: ["dni"] },
      ]);
    }
  });

  it("sin requisitos obligatorios no se pide ningún documento", () => {
    expect(confirmProblems({ ...base, requirements: [], documents: [signed] })).toEqual([]);
  });

  it("no se confirma un contrato ya confirmado o cancelado", () => {
    for (const status of ["confirmed", "cancelled"] as const) {
      const c = { ...base, contract: { ...base.contract, status } };
      expect(confirmProblems({ ...c, documents: [signed, dni("verified")] })).toEqual([
        { code: "wrong_status" },
      ]);
    }
  });

  it("sin papel el borrador queda acordado; con papel espera la firma", () => {
    expect(statusAfterDraft("none")).toBe("confirmed");
    expect(statusAfterDraft("paper")).toBe("pending_signature");
    expect(statusAfterDraft("template")).toBe("pending_signature");
  });
});

describe("cuánto falta para el fin", () => {
  it("lo dice en días o meses", () => {
    expect(endsInLabel(null, "2026-03-01")).toBe("Sin fecha de fin");
    expect(endsInLabel("2026-02-01", "2026-03-01")).toBe("Venció");
    expect(endsInLabel("2026-03-01", "2026-03-01")).toBe("Hoy");
    expect(endsInLabel("2026-03-02", "2026-03-01")).toBe("Mañana");
    expect(endsInLabel("2026-03-06", "2026-03-01")).toBe("En 5 días");
    expect(endsInLabel("2026-09-01", "2026-03-01")).toBe("En 6 meses");
  });
});
