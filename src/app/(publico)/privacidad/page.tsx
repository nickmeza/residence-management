import type { Metadata } from "next";

import { PendingPage } from "@/components/pending-page";

export const metadata: Metadata = { title: "Política de privacidad · Gestión de residencias" };

export default function PrivacyPage() {
  return <PendingPage title="Política de privacidad" />;
}
