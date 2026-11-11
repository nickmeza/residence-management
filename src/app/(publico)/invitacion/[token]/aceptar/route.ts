import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { acceptInvitation, InvitationError } from "@/server/residents/accept";

// Después de entrar con el código (o el enlace del correo): une la cuenta con la ficha que creó la residencia.
export async function GET(request: NextRequest, { params }: RouteContext<"/invitacion/[token]/aceptar">) {
  const { token } = await params;
  const back = (error?: string) =>
    NextResponse.redirect(new URL(`/invitacion/${token}${error ? `?error=${error}` : ""}`, request.url));

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return back();

  try {
    await acceptInvitation(token, claims.sub, typeof claims.email === "string" ? claims.email : null);
  } catch (e) {
    if (e instanceof InvitationError) {
      return back(
        /otra cuenta/.test(e.message) ? "otra-cuenta" : /ya está/.test(e.message) ? "ya-esta" : undefined,
      );
    }
    console.error(e);
    return back("general");
  }
  return NextResponse.redirect(new URL("/mi", request.url));
}
