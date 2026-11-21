import type { Metadata } from "next";
import { Suspense } from "react";

import { ApplicationForm } from "@/components/applications/application-form";
import { FormSkeleton } from "@/components/skeletons";
import { getApplicationForm } from "@/server/applications/public";
import { isUuid } from "@/server/business/queries";

export const metadata: Metadata = { title: "Postular · Gestión de residencias" };

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const form = isUuid(id) ? await getApplicationForm(id) : null;
  if (!form) {
    return (
      <section className="flex flex-col gap-2 rounded-xl border bg-card p-6 shadow-card">
        <h1 className="text-2xl font-bold">Este enlace no está recibiendo postulaciones</h1>
        <p className="text-muted-foreground">Pregúntale a la residencia si tiene cuartos disponibles.</p>
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-5 rounded-xl border bg-card p-5 shadow-card sm:p-7">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Postula a {form.tradeName}</h1>
        <p className="text-muted-foreground">
          {form.city ? `${form.city} · ` : ""}Déjanos tus datos y la residencia te escribirá. No necesitas
          crear una cuenta.
        </p>
      </div>
      <ApplicationForm businessId={id} />
    </section>
  );
}

// Enlace público de postulación de una residencia (RS-03). Lo comparte el arrendador (WhatsApp, Facebook, un cartel).
export default function ApplyPage({ params }: PageProps<"/postular/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-8">
      <Suspense fallback={<FormSkeleton fields={5} />}>
        <Content params={params} />
      </Suspense>
    </main>
  );
}
