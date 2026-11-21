import type { ReactNode } from "react";

import { LoadingPill } from "@/components/loading-pill";
import { Skeleton } from "@/components/ui/skeleton";

// Esqueletos de carga: la forma de la pantalla en gris mientras llegan los datos, sin texto "Cargando…".
// El texto queda solo para lectores de pantalla (sr-only). En las pantallas que piden varias cosas, "messages"
// pone encima una pastilla que dice qué se está pidiendo.

type Messages = { messages?: string[] };

function Loading({ className, children, messages }: { className?: string; children: ReactNode } & Messages) {
  return (
    <div role="status" aria-busy="true" className={`relative ${className ?? ""}`}>
      <span className="sr-only">Cargando…</span>
      {children}
      {messages ? <LoadingPill messages={messages} /> : null}
    </div>
  );
}

// Lo que llega entra de a uno: cada hijo sube y se enfoca, uno tras otro. "contents" no cambia el diseño.
export function Reveal({ children }: { children: ReactNode }) {
  return <div className="reveal-list contents">{children}</div>;
}

function Lines({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className={`h-4 ${i === count - 1 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}

function Box({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-xl bg-card p-4 ring-1 ring-foreground/10 ${className ?? ""}`}>{children}</div>
  );
}

// Listas y tablas: buscador, "Filtrar" y filas.
export function ListSkeleton({
  rows = 6,
  className,
  messages,
}: { rows?: number; className?: string } & Messages) {
  return (
    <Loading className={`flex flex-col gap-4 ${className ?? ""}`} messages={messages}>
      <div className="flex gap-3">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-28" />
      </div>
      <Box className="flex flex-col gap-4">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="hidden h-6 w-20 rounded-full sm:block" />
          </div>
        ))}
      </Box>
    </Loading>
  );
}

// Detalle de algo (un contrato, un pedido, una ficha): título y bloques.
export function DetailSkeleton({ className, messages }: { className?: string } & Messages) {
  return (
    <Loading className={`flex flex-col gap-4 ${className ?? ""}`} messages={messages}>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-2/3 max-w-sm" />
        <Skeleton className="h-4 w-1/3 max-w-48" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <Box>
          <Lines count={5} />
        </Box>
        <Box>
          <Lines count={3} />
        </Box>
      </div>
    </Loading>
  );
}

// Formularios y configuración: etiquetas, campos y botón.
export function FormSkeleton({ fields = 4, className }: { fields?: number; className?: string }) {
  return (
    <Loading className={className}>
      <Box className="flex flex-col gap-5">
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
        <Skeleton className="h-11 w-36" />
      </Box>
    </Loading>
  );
}

// Paneles, inicio y reportes: tarjetas de resumen y un bloque grande.
export function CardsSkeleton({
  cards = 3,
  className,
  messages,
}: { cards?: number; className?: string } & Messages) {
  return (
    <Loading className={`flex flex-col gap-4 ${className ?? ""}`} messages={messages}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }, (_, i) => (
          <Box key={i} className="flex flex-col gap-3">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-7 w-1/3" />
          </Box>
        ))}
      </div>
      <Box>
        <Lines count={4} />
      </Box>
    </Loading>
  );
}

// Calendario del mes (weeks = 5) o la semana del menú (weeks = 1).
export function CalendarSkeleton({
  weeks = 5,
  className,
  messages,
}: { weeks?: number; className?: string } & Messages) {
  return (
    <Loading className={`flex flex-col gap-4 ${className ?? ""}`} messages={messages}>
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-40" />
        <div className="flex gap-2">
          <Skeleton className="size-9" />
          <Skeleton className="size-9" />
        </div>
      </div>
      <div className="hidden grid-cols-7 gap-2 md:grid">
        {Array.from({ length: weeks * 7 }, (_, i) => (
          <Skeleton key={i} className={weeks === 1 ? "h-48" : "h-24"} />
        ))}
      </div>
      <div className="flex flex-col gap-3 md:hidden">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    </Loading>
  );
}

// Conversación: burbujas a los dos lados y el cuadro para escribir.
export function ChatSkeleton({ className }: { className?: string }) {
  return (
    <Loading className={`flex flex-col gap-3 ${className ?? ""}`}>
      <Skeleton className="h-12 w-3/5 self-start rounded-2xl" />
      <Skeleton className="h-16 w-1/2 self-end rounded-2xl" />
      <Skeleton className="h-10 w-2/5 self-start rounded-2xl" />
      <Skeleton className="h-12 w-3/5 self-end rounded-2xl" />
      <Skeleton className="mt-2 h-12 w-full" />
    </Loading>
  );
}

// Edificio, piso y vista 3D: un bloque grande del tamaño de la escena.
export function BuildingSkeleton({ className }: { className?: string }) {
  return (
    <Loading className={`flex flex-col gap-4 ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-32" />
      </div>
      <Skeleton className="h-[60vh] min-h-72 w-full rounded-xl" />
    </Loading>
  );
}

// Solo la escena (dentro de una pantalla que ya tiene su título).
export function SceneSkeleton({ className }: { className?: string }) {
  return (
    <Loading className={className}>
      <Skeleton className="h-full min-h-72 w-full rounded-xl" />
    </Loading>
  );
}

// Saludo del Panel: "Buenos días" y el nombre.
export function GreetingSkeleton() {
  return (
    <Loading className="flex flex-col gap-3">
      <Skeleton className="h-14 w-64 max-w-full" />
      <Skeleton className="h-5 w-48" />
    </Loading>
  );
}

// Pendientes del Panel: filas en gris y la pastilla con lo que se va revisando.
export function PendingSkeleton({ messages }: { messages: string[] }) {
  return (
    <Loading messages={messages}>
      <Box className="flex flex-col gap-4">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </Box>
    </Loading>
  );
}

// Menú lateral: ícono y texto por opción.
export function NavSkeleton({ items = 8 }: { items?: number }) {
  return (
    <Loading className="flex flex-1 flex-col gap-3 px-3">
      {Array.from({ length: items }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-5 shrink-0" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}
    </Loading>
  );
}

// Barra de arriba: selector de negocio a la izquierda, campanita y avatar a la derecha.
export function TopBarSkeleton() {
  return (
    <Loading className="flex flex-1 items-center gap-3">
      <Skeleton className="h-9 w-44" />
      <div className="ml-auto flex items-center gap-3">
        <Skeleton className="size-9 rounded-full" />
        <Skeleton className="size-9 rounded-full" />
      </div>
    </Loading>
  );
}
