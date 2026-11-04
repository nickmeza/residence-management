"use client";

import { useFormStatus } from "react-dom";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { signOut } from "@/server/auth/actions";

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <AlertDialogAction type="submit" disabled={pending}>
      {pending ? "Cerrando…" : "Cerrar sesión"}
    </AlertDialogAction>
  );
}

// Cerrar sesión pide confirmación (regla de acciones destructivas).
export function SignOutButton() {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="outline" className="h-11" />}>
        Cerrar sesión
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Cerrar sesión?</AlertDialogTitle>
          <AlertDialogDescription>
            Tendrás que volver a escribir tu correo y contraseña para entrar.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={signOut}>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <ConfirmButton />
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
