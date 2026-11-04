import type { Metadata } from "next";

import { SetupWizardLoader } from "@/components/onboarding/setup-wizard-loader";

export const metadata: Metadata = { title: "Configura tu negocio · Gestión de residencias" };

// Para cuentas que ya existen y todavía no configuraron nada. El proxy exige sesión para entrar,
// y al guardar el servidor vuelve a comprobarla.
export default function ConfigurePage() {
  return <SetupWizardLoader mode="existing" />;
}
