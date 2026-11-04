"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

// Pantalla de error de las páginas del arrendador: explica y deja reintentar.
export default function ArrendadorError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-4 py-8">
      <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
        No pudimos cargar esta página. Revisa tu conexión y vuelve a intentarlo.
      </p>
      <Button onClick={() => retry()} className="h-11">
        Reintentar
      </Button>
    </main>
  );
}
