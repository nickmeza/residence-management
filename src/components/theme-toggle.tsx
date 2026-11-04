"use client"

import { useSyncExternalStore } from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

// En el servidor no se sabe qué tema tiene el usuario: hasta que el navegador lo confirme,
// el botón se muestra sin ícono para no dibujar uno equivocado.
const noop = () => () => {}
function useIsClient() {
  return useSyncExternalStore(noop, () => true, () => false)
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const isClient = useIsClient()
  const isDark = isClient && resolvedTheme === "dark"
  const label = isDark ? "Cambiar a modo claro" : "Cambiar a modo nocturno"

  return (
    <Button
      variant="outline"
      size="icon-lg"
      aria-label={label}
      title={label}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isClient && (isDark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />)}
    </Button>
  )
}
