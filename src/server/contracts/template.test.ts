import { describe, expect, it } from "vitest";

import { fillTemplate, templateValues, type TemplateData } from "./template";

const data: TemplateData = {
  residentName: "Residente de Prueba",
  identityDocument: { type: "dni", number: "12345678" },
  unitName: "Cuarto 101",
  propertyName: "Edificio de ejemplo",
  propertyAddress: "Calle Ejemplo 123",
  monthlyRent: "1800",
  paymentDay: 5,
  startDate: "2026-03-01",
  endDate: "2026-12-31",
  businessName: "Residencia de ejemplo",
  ruc: null,
  today: "2026-02-20",
};

describe("plantillas de contrato", () => {
  it("rellena los datos con formato peruano", () => {
    const { text, unknown, empty } = fillTemplate(
      "Yo, {nombre}, con {documento}, alquilo {unidad} por {renta} desde el {fecha_inicio}. Pago el día {dia_pago}.",
      templateValues(data),
    );
    expect(text).toBe(
      "Yo, Residente de Prueba, con DNI 12345678, alquilo Cuarto 101 por S/ 1,800 desde el 1 de marzo de 2026. Pago el día 5.",
    );
    expect(unknown).toEqual([]);
    expect(empty).toEqual([]);
  });

  it("deja a la vista los campos mal escritos y los que no tienen dato", () => {
    const values = templateValues({ ...data, endDate: null, identityDocument: null });
    const { text, unknown, empty } = fillTemplate(
      "{nombr} hasta {fecha_fin}, {documento}, RUC {ruc}",
      values,
    );
    expect(text).toBe("{nombr} hasta {fecha_fin}, {documento}, RUC {ruc}");
    expect(unknown).toEqual(["nombr"]);
    expect(empty).toEqual(["fecha_fin", "documento", "ruc"]);
  });

  it("el día 31 se lee como el último día del mes", () => {
    expect(templateValues({ ...data, paymentDay: 31 }).dia_pago).toBe("último día");
  });
});
