// Reglas de los archivos de documentos (tipo, tamaño y ruta en el espacio privado). Funciones puras.

export type DocumentFormat = "pdf" | "image";

// Espacio privado de Supabase Storage (migración 0007).
export const DOCUMENTS_BUCKET = "documents";

// Segundos que dura el enlace para ver un archivo (5 minutos).
export const SIGNED_URL_SECONDS = 5 * 60;

// Los mismos tipos que acepta el espacio "documents" (migración 0007).
const MIME_FORMAT: Record<string, DocumentFormat> = {
  "application/pdf": "pdf",
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/heic": "image",
};

const MIME_EXTENSION: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

export const ACCEPT_ATTRIBUTE: Record<DocumentFormat, string> = {
  pdf: "application/pdf",
  image: "image/jpeg,image/png,image/webp,image/heic",
};

// Límite del espacio privado. Un requisito puede pedir menos.
export const MAX_FILE_MB = 20;

export const formatOf = (mime: string): DocumentFormat | null => MIME_FORMAT[mime] ?? null;

// Qué formatos y tamaño se aceptan: los del requisito, o PDF o foto hasta 20 MB.
export type FileLimits = { acceptedFormats: DocumentFormat[]; maxSizeMb: number };

export const DEFAULT_LIMITS: FileLimits = { acceptedFormats: ["pdf", "image"], maxSizeMb: MAX_FILE_MB };

// null si el archivo sirve; si no, el motivo para mostrarlo.
export function fileProblem(
  file: { mimeType: string; sizeBytes: number },
  limits: FileLimits,
): string | null {
  const format = formatOf(file.mimeType);
  if (!format || !limits.acceptedFormats.includes(format)) {
    return limits.acceptedFormats.length === 1 && limits.acceptedFormats[0] === "pdf"
      ? "Solo se acepta PDF."
      : limits.acceptedFormats.length === 1
        ? "Solo se acepta una foto (JPG, PNG, WEBP o HEIC)."
        : "Solo se acepta PDF o foto (JPG, PNG, WEBP o HEIC).";
  }
  if (file.sizeBytes <= 0) return "El archivo está vacío.";
  if (file.sizeBytes > limits.maxSizeMb * 1024 * 1024) {
    return `Pesa más de ${limits.maxSizeMb} MB. Prueba con una foto más liviana o un PDF comprimido.`;
  }
  return null;
}

// Ruta dentro del espacio privado: <negocio>/<ficha>/<id al azar>.<ext>. Las reglas de Storage leen las dos
// primeras carpetas para saber quién puede verlo (migración 0007).
export function storagePath(businessId: string, residentId: string, fileId: string, mimeType: string) {
  return `${businessId}/${residentId}/${fileId}.${MIME_EXTENSION[mimeType] ?? "bin"}`;
}

// ¿La ruta es de esta ficha y tiene la forma que crea storagePath?
export function isPathOf(path: string, businessId: string, residentId: string) {
  const parts = path.split("/");
  return (
    parts.length === 3 &&
    parts[0] === businessId &&
    parts[1] === residentId &&
    /^[0-9a-f-]{36}\.(pdf|jpg|png|webp|heic)$/.test(parts[2])
  );
}

// Archivos de cobros y garantía (Fase 5): <negocio>/<ficha>/<carpeta>/<id al azar>.<ext>. Las reglas de Storage
// siguen leyendo las dos primeras carpetas, así que valen igual para quién puede verlos o subirlos.
export const FILE_FOLDERS = ["comprobantes", "ingreso", "liquidacion", "devoluciones"] as const;
export type FileFolder = (typeof FILE_FOLDERS)[number];

export function folderPath(
  businessId: string,
  residentId: string,
  folder: FileFolder,
  fileId: string,
  mimeType: string,
) {
  return `${businessId}/${residentId}/${folder}/${fileId}.${MIME_EXTENSION[mimeType] ?? "bin"}`;
}

// ¿La ruta es de esta ficha, de esa carpeta y con la forma que crea folderPath?
export function isFolderPathOf(path: string, businessId: string, residentId: string, folder: FileFolder) {
  const parts = path.split("/");
  return (
    parts.length === 4 &&
    parts[0] === businessId &&
    parts[1] === residentId &&
    parts[2] === folder &&
    /^[0-9a-f-]{36}\.(pdf|jpg|png|webp|heic)$/.test(parts[3])
  );
}
