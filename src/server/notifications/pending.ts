// "Pendientes" (docs/notificaciones.md): lo que espera una acción, calculado al abrir la pantalla. No se guardan: si ya
// no hay nada pendiente, desaparecen solos. Funciones puras: reciben cuántos hay de cada cosa y devuelven qué mostrar.

export type PendingItem = {
  key: string;
  label: string;
  href: string;
  // Urgente: plata o un plazo de por medio.
  urgent: boolean;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export type LandlordCounts = {
  paymentsToReview: number;
  overdueResidents: number;
  documentsToReview: number;
  disputedDiscounts: number;
  contractsToSign: number;
  pensionProofs: number;
  openMaintenance: number;
  urgentMaintenance: number;
  newApplications: number;
  upcomingMoves: number;
};

export function landlordPending(c: LandlordCounts): PendingItem[] {
  const items: (PendingItem | false)[] = [
    c.paymentsToReview > 0 && {
      key: "payments",
      label: `${plural(c.paymentsToReview, "comprobante", "comprobantes")} por revisar`,
      href: "/cobros",
      urgent: true,
    },
    c.pensionProofs > 0 && {
      key: "pension-proofs",
      label: `${plural(c.pensionProofs, "comprobante", "comprobantes")} de pensión por revisar`,
      href: "/pension/pagos",
      urgent: true,
    },
    c.overdueResidents > 0 && {
      key: "overdue",
      label: `${plural(c.overdueResidents, "residente", "residentes")} con recibos vencidos`,
      href: "/cobros",
      urgent: true,
    },
    c.disputedDiscounts > 0 && {
      key: "disputes",
      label: `${plural(c.disputedDiscounts, "descuento", "descuentos")} en disputa`,
      href: "/garantias",
      urgent: true,
    },
    c.urgentMaintenance > 0 && {
      key: "maintenance-urgent",
      label: `${plural(c.urgentMaintenance, "pedido urgente", "pedidos urgentes")} de mantenimiento`,
      href: "/mantenimiento",
      urgent: true,
    },
    c.openMaintenance - c.urgentMaintenance > 0 && {
      key: "maintenance",
      label: `${plural(c.openMaintenance - c.urgentMaintenance, "pedido", "pedidos")} de mantenimiento sin terminar`,
      href: "/mantenimiento",
      urgent: false,
    },
    c.documentsToReview > 0 && {
      key: "documents",
      label: `${plural(c.documentsToReview, "documento", "documentos")} por revisar`,
      href: "/residentes",
      urgent: false,
    },
    c.contractsToSign > 0 && {
      key: "contracts",
      label: `${plural(c.contractsToSign, "contrato", "contratos")} esperando la firma`,
      href: "/contratos",
      urgent: false,
    },
    c.newApplications > 0 && {
      key: "applications",
      label: `${plural(c.newApplications, "postulación nueva", "postulaciones nuevas")}`,
      href: "/postulantes",
      urgent: false,
    },
    c.upcomingMoves > 0 && {
      key: "moves",
      label: `${plural(c.upcomingMoves, "ingreso o salida", "ingresos o salidas")} en los próximos 7 días`,
      href: "/ingresos",
      urgent: false,
    },
  ];
  return items.filter((i): i is PendingItem => i !== false);
}

export type ResidentCounts = {
  missingDocuments: number;
  overdueReceipts: number;
  contractToSign: boolean;
  settlementToAnswer: boolean;
  // Días hábiles que le quedan para reportar lo que ya estaba mal al ingresar (null = no aplica o ya cerró).
  entryReportDaysLeft: number | null;
};

export function residentPending(c: ResidentCounts): PendingItem[] {
  const items: (PendingItem | false)[] = [
    c.overdueReceipts > 0 && {
      key: "overdue",
      label: `Tienes ${plural(c.overdueReceipts, "recibo vencido", "recibos vencidos")}`,
      href: "/mi/pagos",
      urgent: true,
    },
    c.settlementToAnswer && {
      key: "settlement",
      label: "Revisa tu liquidación de garantía y dinos si estás conforme",
      href: "/mi/garantia",
      urgent: true,
    },
    c.contractToSign && {
      key: "contract",
      label: "Tu contrato está esperando tu firma",
      href: "/mi/contrato",
      urgent: true,
    },
    c.missingDocuments > 0 && {
      key: "documents",
      label: `Te ${c.missingDocuments === 1 ? "falta" : "faltan"} ${plural(c.missingDocuments, "documento", "documentos")}`,
      href: "/mi/documentos",
      urgent: false,
    },
    c.entryReportDaysLeft !== null &&
      c.entryReportDaysLeft >= 0 && {
        key: "entry-report",
        label:
          c.entryReportDaysLeft === 0
            ? "Hoy es el último día para reportar lo que ya estaba mal en tu cuarto"
            : `Te ${c.entryReportDaysLeft === 1 ? "queda 1 día hábil" : `quedan ${c.entryReportDaysLeft} días hábiles`} para reportar lo que ya estaba mal en tu cuarto`,
        href: "/mi/garantia",
        urgent: c.entryReportDaysLeft <= 2,
      },
  ];
  return items.filter((i): i is PendingItem => i !== false);
}

// Días hábiles (lunes a viernes) que quedan desde hoy hasta `until` incluido, sin contar hoy. null si ya pasó.
// Feriados, después (igual que el plazo de reporte de ingreso).
export function businessDaysLeft(today: string, until: string): number | null {
  if (until < today) return null;
  let left = 0;
  const d = new Date(`${today}T00:00:00Z`);
  while (d.toISOString().slice(0, 10) < until) {
    d.setUTCDate(d.getUTCDate() + 1);
    const weekday = d.getUTCDay();
    if (weekday !== 0 && weekday !== 6) left++;
  }
  return left;
}
