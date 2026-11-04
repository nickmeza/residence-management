import Link from "next/link";

// Página provisional para textos que todavía no existen (por ejemplo, los legales).
export function PendingPage({ title }: { title: string }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
        Pendiente: este texto lo redacta el dueño del sistema antes de usar datos reales.
      </p>
      <Link href="/" className="text-link underline-offset-4 hover:underline">
        Volver al inicio
      </Link>
    </main>
  );
}
