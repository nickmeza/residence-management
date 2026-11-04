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

export type ThemeColors = Record<keyof typeof TOKENS, string>;

function snapshot() {
  const style = getComputedStyle(document.documentElement);
  return Object.values(TOKENS)
    .map((name) => style.getPropertyValue(name).trim())
    .join("|");
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
    return Object.fromEntries(Object.keys(TOKENS).map((k, i) => [k, values[i] || "#888888"])) as ThemeColors;
  }, [key]);
}
