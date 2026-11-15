"use client";

import {
  Bell,
  CalendarClock,
  FileCheck,
  FileText,
  Megaphone,
  ShieldCheck,
  Soup,
  UserCheck,
  UserPlus,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { formatTimeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { markNotificationReadAction } from "@/server/notifications/actions";
import type { NotificationType } from "@/server/notifications/catalog";
import type { MyNotification } from "@/server/notifications/queries";

const ICON: Partial<Record<NotificationType, LucideIcon>> = {
  invitation_accepted: UserCheck,
  document_uploaded: FileText,
  document_reviewed: FileCheck,
  contract_to_sign: FileText,
  payment_proof: Wallet,
  payment_auto_confirmed: Wallet,
  payment_reviewed: Wallet,
  payment_voided: Wallet,
  pension_proof: Wallet,
  pension_payment_reviewed: Wallet,
  discount_disputed: ShieldCheck,
  settlement_accepted: ShieldCheck,
  settlement_ready: ShieldCheck,
  meal_cancelled: Soup,
  menu_published: Soup,
  kitchen_cancelled: Soup,
  meal_takeaway: Soup,
  maintenance_request: Wrench,
  maintenance_comment: Wrench,
  maintenance_update: Wrench,
  application_received: UserPlus,
  announcement: Megaphone,
  move_scheduled: CalendarClock,
};

// Un aviso de la campanita o de la página de notificaciones. Al tocarlo se marca como leído y lleva a su pantalla.
export function NotificationItem({
  item,
  now,
  onOpen,
}: {
  item: MyNotification;
  now: Date;
  onOpen?: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const Icon = ICON[item.type] ?? Bell;

  const open = () => {
    onOpen?.();
    if (!item.read) {
      startTransition(async () => {
        await markNotificationReadAction(item.id);
        router.refresh();
      });
    }
  };

  const content = (
    <>
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full",
          item.urgent && !item.read ? "bg-warn-soft text-warn" : "bg-primary-soft text-primary-text",
        )}
      >
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("text-sm", item.read ? "font-medium text-muted-foreground" : "font-bold")}>
          {item.title}
        </span>
        {item.body ? <span className="line-clamp-2 text-xs text-muted-foreground">{item.body}</span> : null}
        <span className="text-xs text-muted-foreground">
          {formatTimeAgo(item.createdAt, now)}
          {item.read ? null : <span className="font-semibold text-primary-text"> · Nuevo</span>}
          {item.urgent && !item.read ? <span className="font-semibold text-warn"> · Urgente</span> : null}
        </span>
      </span>
    </>
  );

  const base =
    "flex w-full items-start gap-3 rounded-lg p-2.5 text-left transition-colors duration-200 hover:bg-muted";
  return item.link ? (
    <Link href={item.link} onClick={open} className={base}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={open} className={base}>
      {content}
    </button>
  );
}
