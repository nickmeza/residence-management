"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { markAllNotificationsReadAction } from "@/server/notifications/actions";
import type { MyNotifications } from "@/server/notifications/queries";

import { NotificationItem } from "./notification-item";

// Campanita de la barra de arriba: el número de avisos sin leer y, al tocarla, los últimos. "Ver todas" lleva a la
// página completa (/notificaciones para el arrendador, /mi/avisos para el residente).
export function NotificationBell({
  data,
  allHref,
  align = "end",
}: {
  data: MyNotifications;
  allHref: string;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const now = new Date();
  const label = data.unread
    ? `Notificaciones: ${data.unread} sin leer`
    : "Notificaciones: no tienes avisos nuevos";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={label}
        className="relative flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"
      >
        <Bell className="size-5" aria-hidden="true" />
        {data.unread ? (
          <span className="absolute top-1.5 right-1.5 flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] leading-5 font-bold text-primary-foreground">
            {data.unread > 9 ? "9+" : data.unread}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align={align} className="w-[min(380px,calc(100vw-32px))] gap-1 p-2">
        <div className="flex items-center justify-between gap-2 px-2 pt-1 pb-2">
          <span className="font-bold">Notificaciones</span>
          {data.unread ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await markAllNotificationsReadAction();
                  router.refresh();
                })
              }
              className="text-xs font-semibold text-link underline-offset-4 hover:underline disabled:opacity-60"
            >
              Marcar todas como leídas
            </button>
          ) : null}
        </div>
        {data.items.length ? (
          <ul className="flex max-h-[60vh] flex-col overflow-y-auto">
            {data.items.map((n) => (
              <li key={n.id}>
                <NotificationItem item={n} now={now} onOpen={() => setOpen(false)} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            No tienes avisos todavía. Aquí verás pagos, documentos, mantenimiento y más.
          </p>
        )}
        <Link
          href={allHref}
          onClick={() => setOpen(false)}
          className="mt-1 rounded-lg border-t px-2 pt-2.5 pb-1 text-center text-sm font-semibold text-link hover:underline"
        >
          Ver todas
        </Link>
      </PopoverContent>
    </Popover>
  );
}
