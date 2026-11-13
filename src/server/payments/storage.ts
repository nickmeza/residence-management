import "server-only";

import { createClient } from "@/lib/supabase/server";
import { DOCUMENTS_BUCKET } from "@/server/documents/files";

// ¿Existe de verdad el archivo subido? Lo revisa Storage con la sesión de quien lo subió (sus reglas deciden si
// lo ve). No va en un archivo "use server": no tiene que poder llamarse desde el navegador.
export async function fileExists(path: string) {
  const supabase = await createClient();
  const folder = path.slice(0, path.lastIndexOf("/"));
  const name = path.slice(path.lastIndexOf("/") + 1);
  const { data } = await supabase.storage.from(DOCUMENTS_BUCKET).list(folder, { search: name, limit: 1 });
  return Boolean(data?.some((o) => o.name === name));
}
