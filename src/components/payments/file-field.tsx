"use client";

import { Paperclip, X } from "lucide-react";
import { useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  ACCEPT_ATTRIBUTE,
  DOCUMENTS_BUCKET,
  fileProblem,
  folderPath,
  type DocumentFormat,
  type FileFolder,
} from "@/server/documents/files";

// Sube un archivo (comprobante, foto) al espacio privado y le pasa la ruta al formulario. El formulario lo
// registra al guardarse; el servidor revisa que la ruta sea de esa ficha y que el archivo exista.
export function FileField({
  businessId,
  residentId,
  folder,
  label,
  formats = ["image", "pdf"],
  value,
  onChange,
}: {
  businessId: string;
  residentId: string;
  folder: FileFolder;
  label: string;
  formats?: DocumentFormat[];
  value: { path: string; name: string } | null;
  onChange: (file: { path: string; name: string } | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const limits = { acceptedFormats: formats, maxSizeMb: 10 };

  const upload = (file: File) =>
    startTransition(async () => {
      setError(undefined);
      const problem = fileProblem({ mimeType: file.type, sizeBytes: file.size }, limits);
      if (problem) return setError(problem);
      const path = folderPath(businessId, residentId, folder, crypto.randomUUID(), file.type);
      const { error: uploadError } = await createClient()
        .storage.from(DOCUMENTS_BUCKET)
        .upload(path, file, { contentType: file.type });
      if (uploadError)
        return setError("No pudimos subir el archivo. Revisa tu conexión y vuelve a intentarlo.");
      onChange({ path, name: file.name });
    });

  return (
    <div className="flex flex-col gap-1.5">
      <input
        ref={input}
        type="file"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        accept={formats.map((f) => ACCEPT_ATTRIBUTE[f]).join(",")}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) upload(file);
        }}
      />
      {value ? (
        <div className="flex min-h-11 items-center gap-2 rounded-lg border bg-muted px-3 text-sm">
          <Paperclip className="size-4 shrink-0" aria-hidden="true" />
          <span className="flex-1 truncate">{value.name}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11"
            aria-label="Quitar archivo"
            onClick={() => onChange(null)}
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => input.current?.click()}
          className="flex min-h-18 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed bg-muted px-3 py-3 text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
        >
          <Paperclip className="size-5" aria-hidden="true" />
          {pending ? "Subiendo…" : label}
        </button>
      )}
      {error ? (
        <span role="alert" className="text-sm text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}
