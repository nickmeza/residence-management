import "server-only";

import { createClient } from "@/lib/supabase/server";
import { DOCUMENTS_BUCKET } from "@/server/documents/files";

// Segundos que dura el enlace de una foto de portada (1 hora): no es un dato sensible y así la imagen no se
// rompe si la pantalla queda abierta un rato. Los documentos siguen con 5 minutos.
const COVER_URL_SECONDS = 60 * 60;

// Enlace firmado para ver la foto de portada. Lo crea Storage con la sesión de quien la pide: sus reglas
// (migraciones 0007 y 0011) deciden si la ve. null si no hay foto o no se pudo firmar.
export async function coverUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage.from(DOCUMENTS_BUCKET).createSignedUrl(path, COVER_URL_SECONDS);
  return data?.signedUrl ?? null;
}

// Borra una foto que ya no se usa. Si falla, solo queda un archivo privado huérfano: no se avisa.
export async function removeCover(path: string) {
  const supabase = await createClient();
  await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
}
