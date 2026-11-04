# Stack y razones

| Capa | Elección | Por qué |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript | Un solo proyecto para pantallas y servidor; tipado estricto. |
| Estilos | Tailwind + shadcn/ui | Componentes propios, editables y con tokens de diseño. |
| 3D | React Three Fiber + drei + three | 3D declarativo dentro de React; carga diferida. |
| Datos del servidor | TanStack Query | Caché y sincronización. |
| Estado de pantalla | Zustand | Simple para selección, modo 3D/simple, cámara. |
| Formularios | React Hook Form + Zod | La misma validación en cliente y servidor. |
| Base de datos | PostgreSQL (Supabase) con RLS | Cada arrendador/residente ve solo lo suyo. |
| ORM | Drizzle | API cercana a SQL, ideal para aprender; migraciones claras. |
| Archivos | Supabase Storage con URLs firmadas | DNI, contratos y comprobantes privados. |
| Pruebas | Vitest + Playwright | Reglas puras y flujos completos. |
| Despliegue | Vercel | Simple para empezar. |

## Más adelante
Inngest o Trigger.dev (tareas programadas), Resend (correo), WhatsApp Business, Culqi/Izipay (pagos), PostGIS + MapLibre (Foráneos), Sentry y PostHog.
No ahora: monorepo (Turborepo).
