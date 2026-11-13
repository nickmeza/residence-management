import { redirect } from "next/navigation";

// "Hoy" (panel de cocina) llega en una pieza siguiente; por ahora Pensión abre en Configuración.
export default function PensionPage() {
  redirect("/pension/configuracion");
}
