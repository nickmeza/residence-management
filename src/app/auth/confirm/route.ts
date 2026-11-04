import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/server/auth/schemas";

// Aquí llega el enlace del correo de confirmación. Acepta las dos formas que usa Supabase:
// token_hash (sirve aunque abras el correo en otro equipo) y code (solo en el mismo navegador).
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeNextPath(params.get("next"));
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const code = params.get("code");

  const supabase = await createClient();
  const { error } =
    tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : code
        ? await supabase.auth.exchangeCodeForSession(code)
        : { error: new Error("Enlace incompleto") };

  const target = error ? "/iniciar-sesion?error=confirmacion" : next;
  return NextResponse.redirect(new URL(target, request.url));
}
