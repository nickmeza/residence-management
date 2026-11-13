import { ResidentShell } from "@/components/resident-side/resident-shell";

// Pantallas del residente: menú a la izquierda en escritorio; en el celular, una columna y la navegación abajo.
export default function ResidenteLayout({ children }: LayoutProps<"/">) {
  return <ResidentShell>{children}</ResidentShell>;
}
