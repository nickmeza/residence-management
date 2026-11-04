# Residence Management

Sistema para que un arrendador gestione su residencia: cuartos, departamentos, residentes, contratos, cobros,
garantías, mantenimiento y pensión. Las reglas del proyecto están en [`CLAUDE.md`](CLAUDE.md) y el material de
referencia en [`docs/`](docs/).

## Requisitos

- **Node 24** (fijado en `.nvmrc` y en `engines` de `package.json`).
- **pnpm 9**.
- Un proyecto de **Supabase** en la nube.

## Arrancar en local

1. `pnpm install`
2. Crea `.env.local` en la raíz con estas dos variables (los valores salen de tu proyecto de Supabase):
   - `NEXT_PUBLIC_SUPABASE_URL`: solo `https://<referencia>.supabase.co`, **sin** `/rest/v1/` al final.
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
3. `pnpm dev` y abre http://localhost:3000. La insignia debe decir **"Supabase: Conectado"**.

`.env.local` nunca se sube a git.

## Comandos

| Comando             | Qué hace                                           |
| ------------------- | -------------------------------------------------- |
| `pnpm dev`          | Servidor local en `localhost:3000`                 |
| `pnpm build`        | Compilación de producción                          |
| `pnpm lint`         | Revisa el estilo del código                        |
| `pnpm typecheck`    | Revisa los tipos (`tsc --noEmit`)                  |
| `pnpm test`         | Corre las pruebas una vez                          |
| `pnpm test:watch`   | Vuelve a correr las pruebas al guardar un archivo  |
| `pnpm format`       | Formatea todo el proyecto con Prettier             |
| `pnpm format:check` | Solo revisa el formato, sin cambiar nada           |

## Despliegue

Vercel despliega solo desde GitHub (`nickmeza/residence-management`):

- La rama `main` va a la dirección principal.
- Cada rama de fase tiene su propia versión de prueba (*preview*).

Las dos variables de Supabase también están configuradas en Vercel.

## Fases

| Fase | Estado |
| ---- | ------ |
| 0 · Base del proyecto | ✅ Terminada |
| 1 · Datos y cuentas | Pendiente |

### Fase 0, paso a paso

| Paso | Qué se hizo |
| ---- | ----------- |
| 1. Proyecto base | Next.js 16 con TypeScript estricto, Tailwind 4, ESLint, App Router y `src/` |
| 2. Diseño | Tokens Lavanda (claro y nocturno), shadcn, fuentes y modo nocturno |
| 3. Carpetas | Estructura de la sección 5 de `CLAUDE.md` |
| 4. Supabase | Conexión desde servidor y navegador, con insignia de estado |
| 5. Herramientas | Prettier y Vitest, con las primeras pruebas |
| 6. Despliegue | GitHub y Vercel |

## Registro de decisiones

| Fecha | Decisión | Por qué |
| ----- | -------- | ------- |
| 2026-11-04 | Instalar cada librería **solo cuando su fase la necesite** | Entender cada pieza y avanzar de a una. Drizzle entra en la Fase 1, three.js en la Fase 3. |
| 2026-11-04 | Código en **inglés**, interfaz en **español** | Sigue el glosario de `CLAUDE.md`. |
| 2026-11-04 | **Node 24 LTS** en lugar de 25 | Es una versión LTS (con soporte largo) y Vercel la soporta. |
| 2026-11-04 | Paleta **Lavanda**, con Bosque guardada como alternativa | La eligió el dueño. Sin degradados ni azul clásico, y con modo nocturno teñido de índigo, no gris. Detalle en `docs/sistema-de-diseno.md`. |
| 2026-11-04 | **Plus Jakarta Sans** para todo y **Great Vibes** solo en saludos | Great Vibes pierde su toque si se usa mucho. Se cargan con `next/font`, sin instalar nada. |
| 2026-11-04 | Las variables de shadcn **apuntan a `tokens.css`** | `tokens.css` es la única fuente de colores, radios y fuentes. |
| 2026-11-04 | **Base UI** en lugar de Radix para shadcn | Es la base que shadcn usa por defecto hoy. |
| 2026-11-04 | El prototipo de diseño es **referencia de flujos**, no de estilos | Mantener sus colores al día obligaría a tocar unas 150 pantallas que no van a producción. |
| 2026-11-04 | Se mantiene **`cacheComponents`** activado | Viene activado en la plantilla de Next.js 16. Lo que cambia en cada visita, como las consultas a Supabase, va dentro de `<Suspense>`. |
| 2026-11-04 | Supabase **en la nube** | El dueño ya tenía un proyecto creado. |
| 2026-11-04 | `pnpm test` es `vitest run` (corre y termina) | `CLAUDE.md` pide correr las pruebas antes de cerrar cada tarea. El modo que se queda esperando es `pnpm test:watch`. |
| 2026-11-04 | Prettier **no formatea** los Markdown ni `components/ui/` | Para no cambiar `CLAUDE.md` ni `docs/` sin que se note, y porque los componentes de shadcn no se editan a mano. |
| 2026-11-04 | Repositorio privado en GitHub con nombre en inglés: `residence-management` | Lo eligió el dueño. |
