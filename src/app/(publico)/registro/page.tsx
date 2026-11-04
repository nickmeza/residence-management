import type { Metadata } from "next";

import { SetupWizardLoader } from "@/components/onboarding/setup-wizard-loader";

export const metadata: Metadata = { title: "Crear cuenta · Gestión de residencias" };

// Registro como el prototipo: servicios → negocio → qué ofreces → propiedad → cuenta (al final).
export default function SignUpPage() {
  return <SetupWizardLoader mode="signup" />;
}
