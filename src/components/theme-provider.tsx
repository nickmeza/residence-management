"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

// Pone la clase .dark en <html> según la elección del usuario (o la del sistema si no eligió).
// Recuerda la elección entre visitas y evita el parpadeo blanco al cargar.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
