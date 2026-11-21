// Ingresos y salidas (CT-06, CT-07, CR-10, DB-02). Funciones puras: qué ingresos y salidas vienen y su checklist.
import { addDays, type IsoDate } from "@/server/contracts/dates";

export type MoveKind = "check_in" | "check_out";

export const MOVE_LABEL: Record<MoveKind, string> = { check_in: "Ingreso", check_out: "Salida" };

// Checklist del día de la entrega (ejemplos: el dueño los puede cambiar).
export const CHECKLIST: Record<MoveKind, { key: string; label: string }[]> = {
  check_in: [
    { key: "keys", label: "Entregué las llaves" },
    { key: "clean", label: "El cuarto está limpio" },
    { key: "inventory", label: "Revisamos juntos los muebles y artefactos" },
    { key: "meters", label: "Anoté la lectura de luz y agua" },
    { key: "rules", label: "Le expliqué el reglamento y los horarios" },
    { key: "entry_report", label: "Le conté que puede reportar lo que ya estaba mal (con foto)" },
  ],
  check_out: [
    { key: "keys", label: "Recibí las llaves" },
    { key: "inspection", label: "Revisé el cuarto" },
    { key: "belongings", label: "Se llevó todas sus cosas" },
    { key: "meters", label: "Anoté la lectura de luz y agua" },
    { key: "refund_account", label: "Tengo su cuenta para devolver la garantía" },
  ],
};

// Solo las claves del checklist de ese tipo (lo demás que llegue del navegador se ignora).
export function cleanChecklist(kind: MoveKind, input: Record<string, unknown>): Record<string, boolean> {
  return Object.fromEntries(CHECKLIST[kind].map(({ key }) => [key, input[key] === true]));
}

export type MoveContract = {
  id: string;
  residentId: string;
  residentName: string;
  unitName: string;
  startDate: IsoDate;
  endDate: IsoDate | null;
  status: "draft" | "pending_signature" | "confirmed" | "cancelled";
};

export type MoveEventState = {
  contractId: string;
  kind: MoveKind;
  scheduledAt: Date | null;
  doneAt: Date | null;
};

export type UpcomingMove = MoveContract & {
  kind: MoveKind;
  date: IsoDate;
  scheduledAt: Date | null;
  done: boolean;
};

// Ingresos (inicio del contrato) y salidas (fin) entre hoy − 7 días y hoy + `days`, sin los ya hechos de antes de
// hoy. Lo atrasado (pasó la fecha y no se marcó hecho) también se muestra, para no olvidarlo.
export function upcomingMoves(
  contracts: MoveContract[],
  events: MoveEventState[],
  today: IsoDate,
  days = 30,
): UpcomingMove[] {
  const from = addDays(today, -7);
  const to = addDays(today, days);
  const list: UpcomingMove[] = [];
  for (const c of contracts) {
    if (c.status !== "confirmed" && c.status !== "pending_signature") continue;
    const dates: [MoveKind, IsoDate | null][] = [
      ["check_in", c.startDate],
      ["check_out", c.endDate],
    ];
    for (const [kind, date] of dates) {
      if (!date || date < from || date > to) continue;
      const e = events.find((x) => x.contractId === c.id && x.kind === kind);
      const done = Boolean(e?.doneAt);
      if (done && date < today) continue;
      list.push({ ...c, kind, date, scheduledAt: e?.scheduledAt ?? null, done });
    }
  }
  return list.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind));
}

// Para el Panel: cuántos vienen en los próximos 7 días (o están atrasados) sin hacer.
export const pendingMovesSoon = (moves: UpcomingMove[], today: IsoDate) =>
  moves.filter((m) => !m.done && m.date <= addDays(today, 7)).length;
