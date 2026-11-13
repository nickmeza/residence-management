"use client";

import { ImagePlus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRef, useState, useTransition } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { ConfirmButton } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { setCoverPhotoAction } from "@/server/building/actions";
import {
  COVER_ACCEPT,
  COVER_MAX_MB,
  coverPath,
  coverProblem,
  DOCUMENTS_BUCKET,
} from "@/server/documents/files";

// Foto de portada del edificio: la ven los residentes en su inicio. Se sube al espacio privado desde el
// navegador y luego el servidor revisa que exista y la guarda.
export function CoverPhotoCard({
  propertyId,
  businessId,
  url,
}: {
  propertyId: string;
  businessId: string;
  url: string | null;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  const upload = (file: File) =>
    startTransition(async () => {
      setMessage(undefined);
      const problem = coverProblem({ mimeType: file.type, sizeBytes: file.size });
      if (problem) return setMessage(problem);
      const path = coverPath(businessId, crypto.randomUUID(), file.type);
      const { error } = await createClient()
        .storage.from(DOCUMENTS_BUCKET)
        .upload(path, file, { contentType: file.type });
      if (error) return setMessage("No pudimos subir la foto. Revisa tu conexión y vuelve a intentarlo.");
      const result = await setCoverPhotoAction(propertyId, path);
      if (!result.ok) setMessage(result.message);
    });

  const remove = () =>
    startTransition(async () => {
      setMessage(undefined);
      const result = await setCoverPhotoAction(propertyId, null);
      if (!result.ok) setMessage(result.message);
    });

  return (
    <section
      aria-labelledby="foto-de-portada"
      className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card"
    >
      <div>
        <h2 id="foto-de-portada" className="text-lg font-bold">
          Foto de portada
        </h2>
        <p className="text-sm text-muted-foreground">
          La ven tus residentes al entrar a su inicio. JPG, PNG o WEBP, hasta {COVER_MAX_MB} MB.
        </p>
      </div>
      <input
        ref={input}
        type="file"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        accept={COVER_ACCEPT}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) upload(file);
        }}
      />
      {url ? (
        <div className="relative aspect-[16/5] overflow-hidden rounded-lg border bg-muted">
          <Image src={url} alt="Foto de portada del edificio" fill unoptimized className="object-cover" />
        </div>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => input.current?.click()}
          className="flex aspect-[16/5] flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed bg-muted px-3 text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
        >
          <ImagePlus className="size-6" aria-hidden="true" />
          {pending ? "Subiendo…" : "Subir una foto del edificio"}
        </button>
      )}
      {url ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 gap-2 px-4"
            disabled={pending}
            onClick={() => input.current?.click()}
          >
            <ImagePlus className="size-4" aria-hidden="true" />
            {pending ? "Guardando…" : "Cambiar foto"}
          </Button>
          <ConfirmButton
            trigger={
              <Button type="button" variant="outline" className="h-11 gap-2 px-4" disabled={pending}>
                <Trash2 className="size-4" aria-hidden="true" />
                Quitar foto
              </Button>
            }
            title="¿Quitar la foto de portada?"
            description="Tus residentes verán la portada sin foto. La foto se borra y no se puede recuperar."
            confirmLabel="Quitar foto"
            onConfirm={remove}
          />
        </div>
      ) : null}
      <FormMessage message={message} />
    </section>
  );
}
