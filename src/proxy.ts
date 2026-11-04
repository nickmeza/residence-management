import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

// En Next.js 16, "proxy" reemplaza al antiguo "middleware".
export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Todo menos archivos estáticos e imágenes, que no necesitan sesión.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
