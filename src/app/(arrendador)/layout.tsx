import { AppShell } from "@/components/app-shell/app-shell";

// Todas las pantallas del arrendador comparten el menú lateral y el selector de negocio.
export default function ArrendadorLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>;
}
