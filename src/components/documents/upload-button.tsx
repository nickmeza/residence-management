"use client";

import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { registerDocumentAction } from "@/server/documents/actions";
import {
  ACCEPT_ATTRIBUTE,
  DEFAULT_LIMITS,
  DOCUMENTS_BUCKET,
  fileProblem,
  storagePath,
  type FileLimits,
} from "@/server/documents/files";

// Sube un archivo directo del navegador al espacio privado (las reglas de Storage revisan la carpeta) y luego le
// pide al servidor que lo registre. El servidor vuelve a revisar tipo y tamaño con lo que quedó guardado.
export function UploadButton({
  businessId,
  residentId,
  kind,
  requirementId = null,
  contractId = null,
  limits = DEFAULT_LIMITS,
  label = "Subir archivo",
  variant = "outline",
}: {
  businessId: string;
  residentId: string;
  kind: "requirement" | "signed_contract" | "other";
  requirementId?: string | null;
  contractId?: string | null;
  limits?: FileLimits;
  label?: string;
  variant?: "outline" | "default";
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const upload = (file: File) =>
    startTransition(async () => {
      setError(undefined);
      const problem = fileProblem({ mimeType: file.type, sizeBytes: file.size }, limits);
      if (problem) return setError(problem);
      const path = storagePath(businessId, residentId, crypto.randomUUID(), file.type);
      const { error: uploadError } = await createClient()
        .storage.from(DOCUMENTS_BUCKET)
        .upload(path, file, { contentType: file.type });
      if (uploadError)
        return setError("No pudimos subir el archivo. Revisa tu conexión y vuelve a intentarlo.");
      const result = await registerDocumentAction({
        residentId,
        kind,
        requirementId,
        contractId,
        storagePath: path,
        fileName: file.name,
      });
      if (!result.ok) return setError(result.message);
      router.refresh();
    });

  return (
    <span className="flex flex-col gap-1">
      <input
        ref={input}
        type="file"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        accept={limits.acceptedFormats.map((f) => ACCEPT_ATTRIBUTE[f]).join(",")}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) upload(file);
        }}
      />
      <Button
        type="button"
        variant={variant}
        className="h-11 gap-2"
        disabled={pending}
        onClick={() => input.current?.click()}
      >
        <Upload className="size-4" aria-hidden="true" />
        {pending ? "Subiendo…" : label}
      </Button>
      {error ? (
        <span role="alert" className="max-w-64 text-sm text-danger">
          {error}
        </span>
      ) : null}
    </span>
  );
}
