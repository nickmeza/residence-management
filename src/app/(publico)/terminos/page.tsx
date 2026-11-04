import type { Metadata } from "next";

import { PendingPage } from "@/components/pending-page";

export const metadata: Metadata = { title: "Términos de uso · Gestión de residencias" };

export default function TermsPage() {
  return <PendingPage title="Términos de uso" />;
}
