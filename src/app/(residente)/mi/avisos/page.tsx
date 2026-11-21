import type { Metadata } from "next";
import { Suspense } from "react";

import { NotificationFeed } from "@/components/notifications/notification-feed";
import { ListSkeleton } from "@/components/skeletons";
import { getMyNotifications } from "@/server/notifications/queries";

export const metadata: Metadata = { title: "Avisos · Mi residencia" };

async function Content() {
  return <NotificationFeed data={await getMyNotifications(100)} now={new Date()} />;
}

// Avisos del residente: comunicados de su residencia y lo que pasa con sus pagos, documentos, pensión y pedidos.
export default function MyNoticesPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Avisos</h1>
      <Suspense fallback={<ListSkeleton />}>
        <Content />
      </Suspense>
    </>
  );
}
