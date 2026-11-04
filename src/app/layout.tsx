import type { Metadata } from "next";
import { Great_Vibes, Plus_Jakarta_Sans } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

// next/font descarga las fuentes al compilar y las sirve desde nuestro dominio (no hace falta un paquete aparte).
const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin", "latin-ext"],
});

// Solo para saludos de bienvenida (ver docs/sistema-de-diseno.md).
const greatVibes = Great_Vibes({
  variable: "--font-great-vibes",
  weight: "400",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Gestión de residencias",
  description: "Gestiona tu residencia: cuartos, residentes, contratos, cobros y pensión.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: next-themes agrega la clase .dark antes de que React cargue.
    <html
      lang="es-PE"
      suppressHydrationWarning
      className={`${plusJakarta.variable} ${greatVibes.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
