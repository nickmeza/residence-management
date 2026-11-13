import { redirect } from "next/navigation";

// Pensión abre en "Hoy": lo que la cocina necesita saber primero.
export default function PensionPage() {
  redirect("/pension/hoy");
}
