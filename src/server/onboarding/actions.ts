"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { withRls } from "@/db/rls";
import { person } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { getSessionClaims } from "@/server/auth/session";

import { insertSetup } from "./save";
import { accountSchema, issuesByPath, setupSchema } from "./schema";

export type SetupResult =
  | { status: "error"; message?: string; fieldErrors?: Record<string, string> }
  | { status: "check-email"; email: string };

const GENERIC_ERROR = "No pudimos guardar tu configuración. Vuelve a intentarlo.";

// Último paso del registro: crea la cuenta y, en la misma petición, guarda todo lo configurado.
// Todavía no hay sesión (falta confirmar el correo), así que se guarda con la conexión de administrador.
// El dueño NO lo manda el navegador: es la Persona que Supabase y el trigger acaban de crear para esta cuenta.
export async function createAccountWithSetup(input: {
  setup: unknown;
  account: unknown;
}): Promise<SetupResult> {
  const account = accountSchema.safeParse(input.account);
  const setup = setupSchema.safeParse(input.setup);
  if (!account.success || !setup.success) {
    const fieldErrors = {
      ...(setup.success ? {} : issuesByPath(setup.error)),
      ...(account.success ? {} : prefix("account", issuesByPath(account.error))),
    };
    return { status: "error", message: "Revisa los campos marcados.", fieldErrors };
  }

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: account.data.email,
    password: account.data.password,
    options: {
      data: { full_name: account.data.fullName },
      emailRedirectTo: `${origin}/auth/confirm?next=/panel`,
    },
  });

  if (error) {
    const message =
      error.code === "weak_password"
        ? "La contraseña es muy débil. Usa una más larga o con más variedad."
        : error.code === "over_email_send_rate_limit"
          ? "Se enviaron demasiados correos. Espera unos minutos y vuelve a intentarlo."
          : "No pudimos crear la cuenta. Vuelve a intentarlo.";
    return { status: "error", message };
  }

  // Si el correo ya tenía cuenta, Supabase responde como si todo fuera bien (para no revelarlo),
  // pero sin identidades. En ese caso no se guarda nada y se muestra el mismo mensaje.
  const userId = data.user?.identities?.length ? data.user.id : null;
  if (userId) {
    try {
      await db.transaction(async (tx) => {
        const [me] = await tx
          .update(person)
          .set({ termsAcceptedAt: new Date() })
          .where(eq(person.userId, userId))
          .returning({ id: person.id });
        if (!me) throw new Error("La cuenta nueva no tiene Persona.");
        await insertSetup(tx, me.id, setup.data);
      });
    } catch (e) {
      console.error(e);
      return {
        status: "error",
        message:
          "Tu cuenta se creó, pero no pudimos guardar tu configuración. Confirma tu correo, inicia sesión y vuelve a armarla desde el panel.",
      };
    }
  }

  return { status: "check-email", email: account.data.email };
}

// Para cuentas que ya existen y todavía no configuraron nada. Corre con su sesión, así que el RLS aplica.
export async function saveSetupForCurrentUser(input: { setup: unknown }): Promise<SetupResult> {
  const setup = setupSchema.safeParse(input.setup);
  if (!setup.success) {
    return {
      status: "error",
      message: "Revisa los campos marcados.",
      fieldErrors: issuesByPath(setup.error),
    };
  }

  const claims = await getSessionClaims();
  try {
    await withRls(claims, async (tx) => {
      const [me] = await tx
        .select({ id: person.id })
        .from(person)
        .where(eq(person.userId, claims.sub))
        .limit(1);
      if (!me) throw new Error("La cuenta no tiene Persona.");
      await insertSetup(tx, me.id, setup.data);
    });
  } catch (e) {
    console.error(e);
    return { status: "error", message: GENERIC_ERROR };
  }
  redirect("/panel");
}

function prefix(base: string, errors: Record<string, string>) {
  return Object.fromEntries(Object.entries(errors).map(([k, v]) => [`${base}.${k}`, v]));
}
