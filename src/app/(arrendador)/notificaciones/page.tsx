import type { Metadata } from "next";
import { Suspense } from "react";

import { NotificationFeed } from "@/components/notifications/notification-feed";
import { ListSkeleton } from "@/components/skeletons";
import { getMyNotifications } from "@/server/notifications/queries";

export const metadata: Metadata = { title: "Notificaciones · Gestión de residencias" };

async function Content() {
  return <NotificationFeed data={await getMyNotifications(100)} now={new Date()} />;
}

// Todas las notificaciones del arrendador (la campanita muestra solo las últimas).
export default function NotificationsPage() {
  return (
    <>
      <h1 className="text-[34px] font-bold tracking-tight">Notificaciones</h1>
      <Suspense fallback={<ListSkeleton />}>
        <Content />
      </Suspense>
    </>
  );
}
