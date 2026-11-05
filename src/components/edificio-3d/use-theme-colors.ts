"use client";

import { useMemo, useSyncExternalStore } from "react";

// Colores del 3D, leídos de los tokens (src/styles/tokens.css). El 3D no tiene colores propios.
// Se vuelven a leer cuando cambia el tema (next-themes pone o quita la clase "dark" en <html>).
const TOKENS = {
  stage: "--ds-bg",
  surface: "--ds-surface",
  border: "--ds-border",
  text: "--ds-text",
  primary: "--ds-primary",
  bar: "--ds-bar",
  primarySoft: "--ds-primary-soft",
  accent: "--ds-accent",
} as const;

// También la letra de la página, para las etiquetas que se dibujan dentro del 3D.
export type ThemeColors = Record<keyof typeof TOKENS, string> & { fontFamily: string };

function snapshot() {
  const style = getComputedStyle(document.documentElement);
  const colors = Object.values(TOKENS).map((name) => style.getPropertyValue(name).trim());
  return [...colors, getComputedStyle(document.body).fontFamily].join("|");
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });
  return () => observer.disconnect();
}

export function useThemeColors(): ThemeColors {
  // Se usa solo en el navegador (el 3D no se dibuja en el servidor).
  const key = useSyncExternalStore(subscribe, snapshot, () => "");
  return useMemo(() => {
    const values = key.split("|");
    const names = Object.keys(TOKENS);
    const colors = Object.fromEntries(names.map((k, i) => [k, values[i] || "#888888"]));
    return { ...colors, fontFamily: values[names.length] || "sans-serif" } as ThemeColors;
  }, [key]);
}
