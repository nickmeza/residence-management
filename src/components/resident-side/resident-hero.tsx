import Image from "next/image";

import { cn } from "@/lib/utils";

// Foto de respaldo de la portada. Cuando el dueño deje una foto en public/ (por ejemplo public/portada-residente.jpg),
// se pone aquí su ruta ("/portada-residente.jpg"). Sin foto, la portada es una franja de color.
export const FALLBACK_COVER: string | null = null;

// Portada del inicio del residente: saludo grande y la línea de su contrato, sobre una foto o una franja de color.
export function ResidentHero({
  greeting,
  firstName,
  headline,
  coverUrl,
}: {
  greeting: string;
  firstName: string;
  headline: string | null;
  coverUrl: string | null;
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden pt-10 pb-24 sm:pt-16 sm:pb-28",
        coverUrl ? "text-on-hero" : "bg-primary-soft text-foreground",
      )}
    >
      {coverUrl ? (
        <>
          {/* unoptimized: la foto del edificio llega con un enlace firmado de Storage que vence. */}
          <Image src={coverUrl} alt="" fill priority unoptimized className="object-cover" />
          <div className="absolute inset-0 bg-hero-overlay" aria-hidden="true" />
        </>
      ) : null}
      <div className="relative mx-auto flex max-w-5xl flex-col gap-1.5 px-4 sm:px-8">
        <h1 className="text-2xl font-bold sm:text-3xl">
          <span
            className={cn(
              "font-script text-[40px] leading-tight font-normal sm:text-[52px]",
              !coverUrl && "text-primary",
            )}
          >
            {greeting}
          </span>
          {firstName ? `, ${firstName}` : ""}
        </h1>
        {headline ? <p className="text-sm font-medium sm:text-base">{headline}</p> : null}
      </div>
    </section>
  );
}
