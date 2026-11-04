import { z } from "zod";

// Validación de los formularios de cuenta. Corre en el servidor: no se confía en el navegador.
const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Escribe un correo válido." }));

export const signUpSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, { error: "Escribe tu nombre completo." })
    .max(100, { error: "El nombre es demasiado largo." }),
  email,
  // 72 es el máximo que admite Supabase Auth.
  password: z
    .string()
    .min(8, { error: "La contraseña debe tener al menos 8 caracteres." })
    .max(72, { error: "La contraseña puede tener como máximo 72 caracteres." }),
});

export const signInSchema = z.object({
  email,
  password: z.string().min(1, { error: "Escribe tu contraseña." }),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;

// Lo que una acción de formulario devuelve a la pantalla. "values" devuelve lo escrito
// para que un error nunca borre el formulario (la contraseña no se devuelve).
export type AuthFormState = {
  status: "idle" | "error" | "check-email";
  message?: string;
  fieldErrors?: Partial<Record<"fullName" | "email" | "password", string>>;
  values?: { fullName?: string; email?: string };
};

export function firstFieldErrors(error: z.ZodError): AuthFormState["fieldErrors"] {
  const result: NonNullable<AuthFormState["fieldErrors"]> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if ((field === "fullName" || field === "email" || field === "password") && !result[field]) {
      result[field] = issue.message;
    }
  }
  return result;
}

// Solo rutas internas ("/panel"), nunca otra web ("//sitio.com" o "https://…"), para no
// convertir el enlace del correo en una redirección a cualquier lugar.
export function safeNextPath(next: string | null | undefined, fallback = "/panel"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
