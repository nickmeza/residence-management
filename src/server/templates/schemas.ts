import { z } from "zod";

import { fillTemplate, TEMPLATE_FIELDS, type TemplateField } from "@/server/contracts/template";

// Formulario de plantilla de contrato. Un dato mal escrito ({nombr}) se rechaza: saldría tal cual en el papel.
export const templateSchema = z
  .object({
    name: z.string().trim().min(2, "Ponle un nombre.").max(80, "Es demasiado largo."),
    body: z.string().trim().min(20, "Escribe el texto del contrato.").max(20000, "Es demasiado largo."),
  })
  .superRefine((v, ctx) => {
    const { unknown } = fillTemplate(v.body, EXAMPLE_VALUES);
    if (unknown.length) {
      ctx.addIssue({
        code: "custom",
        path: ["body"],
        message: `No reconocemos: ${unknown.map((u) => `{${u}}`).join(", ")}. Revisa cómo está escrito.`,
      });
    }
  });

export type TemplateInput = z.input<typeof templateSchema>;

// Datos de ejemplo para la vista previa mientras se escribe la plantilla. No son datos reales.
export const EXAMPLE_VALUES: Record<TemplateField, string> = {
  nombre: "[Nombre del residente]",
  documento: "DNI [12345678]",
  unidad: "[Cuarto 101]",
  propiedad: "[Nombre de la propiedad]",
  direccion: "[Dirección de la propiedad]",
  renta: "S/ [650]",
  dia_pago: "[5]",
  fecha_inicio: "[1 de marzo de 2026]",
  fecha_fin: "[28 de febrero de 2027]",
  negocio: "[Nombre de tu negocio]",
  ruc: "[RUC]",
  hoy: "[fecha de hoy]",
};

export const FIELD_NAMES = Object.keys(TEMPLATE_FIELDS) as TemplateField[];

// Texto de ejemplo para empezar. Es un ejemplo, no un modelo legal: el arrendador lo adapta.
export const EXAMPLE_BODY = `Conste por el presente documento el contrato de alquiler que celebran {negocio}, en adelante EL ARRENDADOR, y {nombre}, identificado con {documento}, en adelante EL RESIDENTE.

PRIMERO. EL ARRENDADOR alquila a EL RESIDENTE la unidad {unidad} de {propiedad}, ubicada en {direccion}.

SEGUNDO. El alquiler va del {fecha_inicio} al {fecha_fin}.

TERCERO. La renta mensual es de {renta}, que EL RESIDENTE paga el día {dia_pago} de cada mes.

CUARTO. EL RESIDENTE se compromete a cuidar la unidad y a respetar las normas de convivencia.

Firmado el {hoy}.`;
