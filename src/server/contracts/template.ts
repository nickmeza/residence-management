// Plantillas de contrato: texto con datos entre llaves que se rellenan solos, como {nombre} o {renta}.
import { formatSoles } from "@/lib/format";

import { formatLongDate, type IsoDate } from "./dates";

// Los datos que puede usar una plantilla, con la explicación que verá el arrendador al escribirla.
export const TEMPLATE_FIELDS = {
  nombre: "Nombre completo del residente",
  documento: "Documento de identidad del residente (por ejemplo, DNI 12345678)",
  unidad: "Nombre de la unidad (por ejemplo, Cuarto 101)",
  propiedad: "Nombre de la propiedad",
  direccion: "Dirección de la propiedad",
  renta: "Renta mensual en soles",
  dia_pago: "Día de pago de cada mes",
  fecha_inicio: "Fecha de inicio del contrato",
  fecha_fin: "Fecha de fin del contrato",
  negocio: "Nombre comercial del negocio",
  ruc: "RUC del negocio",
  hoy: "Fecha de hoy",
} as const;

export type TemplateField = keyof typeof TEMPLATE_FIELDS;

const DOCUMENT_LABEL = { dni: "DNI", foreign_id: "Carné de extranjería", passport: "Pasaporte" } as const;

export type TemplateData = {
  residentName: string;
  identityDocument: { type: keyof typeof DOCUMENT_LABEL; number: string } | null;
  unitName: string;
  propertyName: string;
  propertyAddress: string;
  monthlyRent: string;
  paymentDay: number;
  startDate: IsoDate;
  endDate: IsoDate | null;
  businessName: string;
  ruc: string | null;
  today: IsoDate;
};

// Convierte los datos del contrato en el texto de cada campo. Vacío = no hay dato.
export function templateValues(data: TemplateData): Record<TemplateField, string> {
  return {
    nombre: data.residentName,
    documento: data.identityDocument
      ? `${DOCUMENT_LABEL[data.identityDocument.type]} ${data.identityDocument.number}`
      : "",
    unidad: data.unitName,
    propiedad: data.propertyName,
    direccion: data.propertyAddress,
    renta: formatSoles(data.monthlyRent) ?? "",
    dia_pago: data.paymentDay === 31 ? "último día" : String(data.paymentDay),
    fecha_inicio: formatLongDate(data.startDate),
    fecha_fin: data.endDate ? formatLongDate(data.endDate) : "",
    negocio: data.businessName,
    ruc: data.ruc ?? "",
    hoy: formatLongDate(data.today),
  };
}

const FIELD = /\{([a-z_]+)\}/g;
const isField = (name: string): name is TemplateField => Object.hasOwn(TEMPLATE_FIELDS, name);

// Rellena la plantilla. Lo que no se puede rellenar se deja tal cual y se avisa, para que el arrendador
// lo vea antes de imprimir: `unknown` son campos mal escritos y `empty` son campos sin dato.
export function fillTemplate(body: string, values: Record<TemplateField, string>) {
  const unknown = new Set<string>();
  const empty = new Set<TemplateField>();
  const text = body.replace(FIELD, (match, name: string) => {
    if (!isField(name)) {
      unknown.add(name);
      return match;
    }
    if (values[name] === "") {
      empty.add(name);
      return match;
    }
    return values[name];
  });
  return { text, unknown: [...unknown], empty: [...empty] };
}
