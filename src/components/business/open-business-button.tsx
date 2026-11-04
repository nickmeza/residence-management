"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { selectBusiness } from "@/server/business/actions";

// "Abrir": elige este negocio (como el selector de arriba) y lleva a su panel.
export function OpenBusinessButton({ id, current }: { id: string; current: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (current) {
    return (
      <span className="rounded-full bg-primary-soft px-3 py-1.5 text-xs font-bold text-primary-text">
        Viendo ahora
      </span>
    );
  }
  return (
    <Button
      type="button"
      className="h-11 px-4"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const { ok } = await selectBusiness(id);
          if (ok) router.push("/panel");
          router.refresh();
        })
      }
    >
      {pending ? "Abriendo…" : "Abrir"}
    </Button>
  );
}
