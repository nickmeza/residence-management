import { describe, expect, it } from "vitest";

import { businessDaysLeft, landlordPending, residentPending, type LandlordCounts } from "./pending";

const none: LandlordCounts = {
  paymentsToReview: 0,
  overdueResidents: 0,
  documentsToReview: 0,
  disputedDiscounts: 0,
  contractsToSign: 0,
  pensionProofs: 0,
  openMaintenance: 0,
  urgentMaintenance: 0,
  newApplications: 0,
  upcomingMoves: 0,
  unreadMessages: 0,
  tasksDue: 0,
  tasksLate: 0,
  cleaningRequests: 0,
  dirtyUnits: 0,
};

describe("landlordPending", () => {
  it("sin nada pendiente no muestra nada", () => {
    expect(landlordPending(none)).toEqual([]);
  });

  it("dice cuántos hay, en singular o plural, y lo urgente primero", () => {
    const items = landlordPending({ ...none, documentsToReview: 1, paymentsToReview: 3 });
    expect(items.map((i) => i.label)).toEqual(["3 comprobantes por revisar", "1 documento por revisar"]);
    expect(items[0].urgent).toBe(true);
  });

  it("separa el mantenimiento urgente del resto", () => {
    const items = landlordPending({ ...none, openMaintenance: 4, urgentMaintenance: 1 });
    expect(items.map((i) => i.label)).toEqual([
      "1 pedido urgente de mantenimiento",
      "3 pedidos de mantenimiento sin terminar",
    ]);
  });

  it("separa las tareas atrasadas de las de esta semana", () => {
    const items = landlordPending({ ...none, tasksDue: 3, tasksLate: 1, dirtyUnits: 2 });
    expect(items.map((i) => i.label)).toEqual([
      "1 tarea atrasada de mantenimiento o limpieza",
      "2 tareas de mantenimiento o limpieza esta semana",
      "2 unidades por limpiar",
    ]);
    expect(items[0].urgent).toBe(true);
  });
});

describe("residentPending", () => {
  const base = {
    missingDocuments: 0,
    overdueReceipts: 0,
    contractToSign: false,
    settlementToAnswer: false,
    entryReportDaysLeft: null,
    unreadMessages: 0,
    parcelsToPickUp: 0,
    reviewsToWrite: 0,
  };

  it("sin nada pendiente no muestra nada", () => {
    expect(residentPending(base)).toEqual([]);
  });

  it("avisa los días hábiles que quedan para reportar lo de ingreso", () => {
    expect(residentPending({ ...base, entryReportDaysLeft: 3 })[0]).toMatchObject({
      label: "Te quedan 3 días hábiles para reportar lo que ya estaba mal en tu cuarto",
      urgent: false,
    });
    expect(residentPending({ ...base, entryReportDaysLeft: 0 })[0]).toMatchObject({ urgent: true });
  });

  it("cuenta documentos y recibos vencidos", () => {
    const labels = residentPending({ ...base, missingDocuments: 2, overdueReceipts: 1 }).map((i) => i.label);
    expect(labels).toEqual(["Tienes 1 recibo vencido", "Te faltan 2 documentos"]);
  });
});

describe("businessDaysLeft", () => {
  it("cuenta lunes a viernes hasta el plazo, sin contar hoy", () => {
    // Viernes 13 → martes 17: lunes y martes.
    expect(businessDaysLeft("2026-11-13", "2026-11-17")).toBe(2);
    expect(businessDaysLeft("2026-11-17", "2026-11-17")).toBe(0);
    expect(businessDaysLeft("2026-11-18", "2026-11-17")).toBeNull();
  });
});
