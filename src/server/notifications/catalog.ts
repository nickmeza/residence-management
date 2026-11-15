// Catálogo de notificaciones (docs/notificaciones.md): el texto de cada aviso, en un solo lugar. Funciones puras: reciben
// los datos del evento y devuelven lo que se guarda. Los nombres, montos y textos son ejemplos (CLAUDE.md, sección 9).
import { formatLongDate, formatSoles } from "@/lib/format";
import { periodLabel } from "@/server/payments/rules";

export type NotificationType =
  // Al arrendador (o la cocina)
  | "invitation_accepted"
  | "document_uploaded"
  | "payment_proof"
  | "payment_auto_confirmed"
  | "discount_disputed"
  | "settlement_accepted"
  | "pension_proof"
  | "meal_cancelled"
  | "maintenance_request"
  | "maintenance_comment"
  | "application_received"
  // Al residente (o comensal)
  | "document_reviewed"
  | "contract_to_sign"
  | "payment_reviewed"
  | "payment_voided"
  | "settlement_ready"
  | "menu_published"
  | "kitchen_cancelled"
  | "meal_takeaway"
  | "pension_payment_reviewed"
  | "maintenance_update"
  | "announcement"
  | "move_scheduled";

export type NotificationDraft = {
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  urgent: boolean;
};

const MEAL_NAME = { breakfast: "desayuno", lunch: "almuerzo", dinner: "cena" } as const;
type Meal = keyof typeof MEAL_NAME;

const soles = (amount: string) => formatSoles(amount) ?? `S/ ${amount}`;
const firstLine = (text: string, max = 160) => {
  const line = text.trim().split(/\r?\n/)[0] ?? "";
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
};

// --- Al arrendador ---

export const invitationAccepted = (name: string, residentId: string): NotificationDraft => ({
  type: "invitation_accepted",
  title: `${name} aceptó tu invitación`,
  body: "Ya tiene su cuenta: puede subir documentos y avisar sus pagos.",
  link: `/residentes/${residentId}`,
  urgent: false,
});

export const documentUploaded = (name: string, document: string, residentId: string): NotificationDraft => ({
  type: "document_uploaded",
  title: `${name} subió un documento por revisar`,
  body: document,
  link: `/residentes/${residentId}`,
  urgent: false,
});

export const paymentProof = (
  name: string,
  amount: string,
  period: string,
  residentId: string,
  autoConfirmed: boolean,
): NotificationDraft =>
  autoConfirmed
    ? {
        type: "payment_auto_confirmed",
        title: `${name} pagó ${soles(amount)} y se confirmó solo`,
        body: `Era justo lo que faltaba del recibo de ${periodLabel(period)}. Si algo no cuadra, puedes anularlo.`,
        link: `/cobros/${residentId}/${period}`,
        urgent: false,
      }
    : {
        type: "payment_proof",
        title: `${name} mandó un comprobante de ${soles(amount)}`,
        body: `Recibo de ${periodLabel(period)}. Revísalo para confirmarlo o rechazarlo.`,
        link: `/cobros/${residentId}/${period}`,
        urgent: true,
      };

export const discountDisputed = (name: string, reason: string, depositId: string): NotificationDraft => ({
  type: "discount_disputed",
  title: `${name} no está de acuerdo con un descuento`,
  body: firstLine(reason),
  link: `/garantias/${depositId}`,
  urgent: true,
});

export const settlementAccepted = (name: string, depositId: string): NotificationDraft => ({
  type: "settlement_accepted",
  title: `${name} está conforme con su liquidación`,
  body: "Ya puedes registrar la devolución de la garantía.",
  link: `/garantias/${depositId}`,
  urgent: false,
});

export const pensionProof = (name: string, amount: string): NotificationDraft => ({
  type: "pension_proof",
  title: `${name} mandó un comprobante de ${soles(amount)}`,
  body: "Revísalo en Pagos para aprobarlo o rechazarlo.",
  link: "/pension/pagos",
  urgent: true,
});

export const mealCancelled = (name: string, meal: Meal, date: string): NotificationDraft => ({
  type: "meal_cancelled",
  title: `${name} canceló su ${MEAL_NAME[meal]}`,
  body: `Del ${formatLongDate(date)}.`,
  link: `/pension/hoy?fecha=${date}`,
  urgent: false,
});

export const maintenanceRequest = (
  name: string,
  title: string,
  id: string,
  urgent: boolean,
): NotificationDraft => ({
  type: "maintenance_request",
  title: `${name} pidió mantenimiento`,
  body: firstLine(title),
  link: `/mantenimiento/${id}`,
  urgent,
});

export const maintenanceComment = (name: string, comment: string, id: string): NotificationDraft => ({
  type: "maintenance_comment",
  title: `${name} escribió en su pedido de mantenimiento`,
  body: firstLine(comment),
  link: `/mantenimiento/${id}`,
  urgent: false,
});

export const applicationReceived = (name: string, id: string): NotificationDraft => ({
  type: "application_received",
  title: `Nueva postulación de ${name}`,
  body: "Revísala para aprobarla, dejarla en lista de espera o rechazarla.",
  link: `/postulantes/${id}`,
  urgent: false,
});

// --- Al residente ---

export const documentReviewed = (
  document: string,
  approved: boolean,
  reason: string | null,
): NotificationDraft => ({
  type: "document_reviewed",
  title: approved ? `Aprobaron tu documento: ${document}` : `Rechazaron tu documento: ${document}`,
  body: approved ? null : reason ? `Motivo: ${firstLine(reason)}. Vuelve a subirlo.` : "Vuelve a subirlo.",
  link: "/mi/documentos",
  urgent: !approved,
});

export const contractToSign = (unit: string): NotificationDraft => ({
  type: "contract_to_sign",
  title: "Tu contrato está listo para firmar",
  body: unit,
  link: "/mi/contrato",
  urgent: true,
});

export const paymentReviewed = (
  amount: string,
  period: string,
  status: "confirmed" | "rejected",
  reason: string | null,
  wasConfirmed: boolean,
): NotificationDraft => {
  if (status === "confirmed") {
    return {
      type: "payment_reviewed",
      title: `Confirmaron tu pago de ${soles(amount)}`,
      body: `Recibo de ${periodLabel(period)}.`,
      link: "/mi/pagos",
      urgent: false,
    };
  }
  // Rechazar un pago que ya estaba confirmado es anularlo (Fase 5).
  return {
    type: wasConfirmed ? "payment_voided" : "payment_reviewed",
    title: wasConfirmed ? `Anularon tu pago de ${soles(amount)}` : `Rechazaron tu pago de ${soles(amount)}`,
    body: `Recibo de ${periodLabel(period)}.${reason ? ` Motivo: ${firstLine(reason)}.` : ""}`,
    link: "/mi/pagos",
    urgent: true,
  };
};

export const settlementReady = (): NotificationDraft => ({
  type: "settlement_ready",
  title: "Tu liquidación de garantía está lista",
  body: "Revisa los descuentos y dinos si estás conforme o si no estás de acuerdo con alguno.",
  link: "/mi/garantia",
  urgent: true,
});

export const menuPublished = (monday: string): NotificationDraft => ({
  type: "menu_published",
  title: "Ya está el menú de la semana",
  body: `Semana del ${formatLongDate(monday)}.`,
  link: "/mi/pension",
  urgent: false,
});

// La cocina canceló por su lado (decisión del dueño, 2026-11-15): no se cobra y se pide disculpas.
export const kitchenCancelled = (meal: Meal, date: string): NotificationDraft => ({
  type: "kitchen_cancelled",
  title: `Disculpa: no habrá ${MEAL_NAME[meal]} el ${formatLongDate(date)}`,
  body: "La cocina tuvo que cancelarlo. No se te cobra.",
  link: "/mi/pension",
  urgent: true,
});

// El comensal avisó tarde y la cocina lo anotó: se cobra, pero la comida se guarda (decisión del dueño, 2026-11-15).
export const mealTakeaway = (meal: Meal, date: string): NotificationDraft => ({
  type: "meal_takeaway",
  title: `Tu ${MEAL_NAME[meal]} está en táper, puedes recogerla`,
  body: `Avisaste después de la hora límite del ${formatLongDate(date)}, así que se cobra igual.`,
  link: "/mi/pension",
  urgent: true,
});

export const pensionPaymentReviewed = (
  amount: string,
  status: "confirmed" | "rejected",
  reason: string | null,
): NotificationDraft => ({
  type: "pension_payment_reviewed",
  title:
    status === "confirmed"
      ? `La pensión confirmó tu pago de ${soles(amount)}`
      : `La pensión rechazó tu pago de ${soles(amount)}`,
  body: status === "rejected" && reason ? `Motivo: ${firstLine(reason)}.` : null,
  link: "/mi/pension",
  urgent: status === "rejected",
});

export const maintenanceUpdate = (title: string, statusLabel: string): NotificationDraft => ({
  type: "maintenance_update",
  title: `Tu pedido de mantenimiento: ${statusLabel}`,
  body: firstLine(title),
  link: "/mi/mantenimiento",
  urgent: false,
});

export const maintenanceReply = (comment: string): NotificationDraft => ({
  type: "maintenance_update",
  title: "Te respondieron en tu pedido de mantenimiento",
  body: firstLine(comment),
  link: "/mi/mantenimiento",
  urgent: false,
});

export const announcement = (title: string, body: string, urgent: boolean): NotificationDraft => ({
  type: "announcement",
  title: firstLine(title, 200),
  body: body.trim().slice(0, 2000) || null,
  link: "/mi/avisos",
  urgent,
});

export const moveScheduled = (kind: "check_in" | "check_out", when: string): NotificationDraft => ({
  type: "move_scheduled",
  title: kind === "check_in" ? "Se programó tu ingreso" : "Se programó tu salida",
  body: when,
  link: "/mi/contrato",
  urgent: false,
});
