# Comandos de inicio · De cero a un proyecto funcionando

Esta es la lista de comandos para arrancar el proyecto con el stack que elegimos, en el orden en que los usarías. Copia y pega bloque por bloque, y no pases al siguiente hasta que el anterior funcione.

**Antes de empezar**

- Los comandos de estas herramientas cambian con el tiempo. Si alguno falla, revisa la documentación oficial de esa herramienta. Verifiqué los de Next.js, pnpm y shadcn/ui; el resto es de mi conocimiento y conviene confirmarlo.
- Lo que esté en MAYÚSCULAS (como `TU_USUARIO`) lo reemplazas por tu dato.
- Usa una terminal. En Windows funciona mejor **Git Bash** o **WSL** que el símbolo del sistema clásico.

## 0. Requisitos

Comprueba que tienes estas herramientas:

```bash
node -v      # debe mostrar una versión LTS reciente
git --version
```

Instala **pnpm** (el gestor de paquetes):

```bash
corepack enable
corepack prepare pnpm@latest --activate
pnpm -v
```

Si `corepack` te da problemas, esta alternativa también sirve:

```bash
npm install -g pnpm
```

**Docker** es opcional. Solo lo necesitas si quieres correr Supabase en tu computadora.

## 1. Crear el proyecto

```bash
pnpm create next-app@latest residencias --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd residencias
pnpm dev
```

Abre `http://localhost:3000`. Si ves la página de bienvenida de Next.js, el paso funcionó. Para detener el servidor, `Ctrl + C`.

El asistente puede hacerte preguntas adicionales. Acepta las opciones por defecto si no sabes cuál elegir.

## 2. Git y GitHub

Primero crea un repositorio vacío en github.com, sin README. Luego:

```bash
git init
git add .
git commit -m "chore: proyecto base"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/residencias.git
git push -u origin main
```

Desde aquí trabaja con una rama por fase:

```bash
git switch -c fase-1-datos
```

## 3. Componentes de interfaz (shadcn/ui)

```bash
pnpm dlx shadcn@latest init
```

Responde las preguntas del asistente. Luego agrega los componentes que ya sabes que vas a necesitar:

```bash
pnpm dlx shadcn@latest add button card input label select switch table tabs dialog sheet accordion skeleton sonner badge
```

Prueba que funciona: importa un `Button` en `src/app/page.tsx` y míralo en el navegador.

## 4. Librerías base

Datos, estado y formularios:

```bash
pnpm add @tanstack/react-query zustand react-hook-form zod @hookform/resolvers
```

El 3D:

```bash
pnpm add three @react-three/fiber @react-three/drei
pnpm add -D @types/three
```

> **Ojo con las versiones:** Next.js reciente usa React 19, y React Three Fiber necesita su versión 9 o superior para eso. Si ves un error de dependencias, es lo primero que debes revisar.

Textos en español de Perú (puedes dejarlo para más adelante):

```bash
pnpm add next-intl
```

## 5. Supabase (base de datos, cuentas y archivos)

1. En supabase.com crea un proyecto nuevo. Guarda la contraseña de la base de datos en un lugar seguro.
2. Instala el cliente:

```bash
pnpm add @supabase/supabase-js @supabase/ssr
```

3. Crea el archivo `.env.local` en la raíz del proyecto, con los datos que te muestra el panel de Supabase (los nombres exactos de las claves están ahí):

```bash
NEXT_PUBLIC_SUPABASE_URL=TU_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=TU_CLAVE_PUBLICA
DATABASE_URL=TU_CADENA_DE_CONEXION
```

Ese archivo **nunca se sube a GitHub**. Next.js ya lo ignora por defecto; compruébalo con `git status`.

4. Instala la herramienta de línea de comandos de Supabase (opcional, pero útil):

```bash
pnpm add -D supabase
pnpm exec supabase init
pnpm exec supabase login
pnpm exec supabase link --project-ref TU_REFERENCIA
```

Si quieres correr Supabase localmente (requiere Docker):

```bash
pnpm exec supabase start
pnpm exec supabase status
```

## 6. Tablas con Drizzle

```bash
pnpm add drizzle-orm postgres
pnpm add -D drizzle-kit dotenv
```

Crea `drizzle.config.ts` en la raíz:

```ts
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

Las tablas las escribes tú en `src/db/schema.ts`, a partir de la hoja "Modelo de datos" del Excel. Empieza solo con Propiedad, Piso y Unidad.

Cada vez que cambies el esquema:

```bash
pnpm drizzle-kit generate   # crea el archivo de migración
pnpm drizzle-kit migrate    # lo aplica a la base
pnpm drizzle-kit studio     # abre un visor de tablas en el navegador
```

Lee siempre el archivo de migración antes de aplicarlo.

## 7. Carpetas

Estructura sugerida dentro de `src/`:

```text
src/
  app/
    (publico)/        landing, iniciar sesión, registro
    (arrendador)/     panel, edificio, residentes, cobros...
    (residente)/      inicio, mi cuarto, pagos, pensión...
  components/
    ui/               los componentes de shadcn
    edificio-3d/      escena, cámara, pisos, unidades
    edificio-simple/  acordeones y formularios
  db/
    schema.ts         las tablas
    index.ts          la conexión
  server/             reglas de negocio (garantía, solapes, pagos)
  lib/                utilidades
  styles/
    tokens.css        colores, radios, tipografía
```

Para crearlas de una vez:

```bash
mkdir -p src/db src/server src/lib src/styles src/components/edificio-3d src/components/edificio-simple
```

## 8. Tokens de diseño

Crea `src/styles/tokens.css`. Los valores son del concepto actual y pueden cambiar; por eso viven en un solo lugar:

```css
:root {
  --color-bg: #f8fafc;
  --color-surface: #ffffff;
  --color-primary: #2563eb;
  --color-accent: #f97316;
  --color-text: #0f172a;
  --color-text-2: #64748b;
  --color-border: #e2e8f0;

  --color-ok: #16a34a;
  --color-busy: #dc2626;
  --color-warn: #ca8a04;

  --radius-s: 10px;
  --radius-m: 14px;
  --shadow: 0 4px 16px rgba(15, 23, 42, 0.07);
  --transition: 0.2s;
}
```

Impórtalo al principio de `src/app/globals.css`:

```css
@import "../styles/tokens.css";
```

## 9. Calidad y pruebas

Formato del código:

```bash
pnpm add -D prettier prettier-plugin-tailwindcss
```

Pruebas de lógica y de componentes:

```bash
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

Pruebas del navegador (flujos completos):

```bash
pnpm create playwright
```

Agrega estos comandos a `package.json`, dentro de `"scripts"`:

```json
"typecheck": "tsc --noEmit",
"test": "vitest"
```

## 10. Publicarlo en internet (Vercel)

La forma más simple es desde la web: en vercel.com elige **Add New → Project**, conecta tu repositorio de GitHub y copia ahí las variables de `.env.local`.

Si prefieres la terminal:

```bash
pnpm dlx vercel
```

Cada vez que subas cambios a `main`, Vercel publica solo.

## 11. Comandos del día a día

| Para qué | Comando |
| --- | --- |
| Abrir el proyecto en el navegador | `pnpm dev` |
| Revisar errores de tipos | `pnpm typecheck` |
| Revisar el estilo del código | `pnpm lint` |
| Correr las pruebas | `pnpm test` |
| Probar la versión final | `pnpm build` y luego `pnpm start` |
| Crear y aplicar una migración | `pnpm drizzle-kit generate` y `pnpm drizzle-kit migrate` |
| Ver las tablas | `pnpm drizzle-kit studio` |
| Ver qué cambió | `git status` |
| Guardar un avance | `git add .` y `git commit -m "mensaje"` |
| Subirlo a GitHub | `git push` |
| Empezar una fase nueva | `git switch -c nombre-de-la-fase` |

## 12. Si algo falla

- **Un paquete no se instala o se queja de versiones:** borra y reinstala.

```bash
rm -rf node_modules .next
pnpm install
```

- **El puerto 3000 está ocupado:** `pnpm dev -p 3001`.
- **"command not found":** cierra y vuelve a abrir la terminal, y repite `node -v` y `pnpm -v`.
- **Un error con React 19 o con React Three Fiber:** revisa que la versión de `@react-three/fiber` sea compatible con la de React.
- **Supabase no conecta:** revisa que `DATABASE_URL` tenga la contraseña correcta y que el archivo se llame `.env.local`.

## 13. Monorepo (más adelante)

El stack menciona Turborepo para compartir código con Foráneos. **No lo uses todavía.** Empieza con un solo proyecto, como en esta guía. Cuando Foráneos exista de verdad, se mueve a un monorepo; el comando para crear uno es `pnpm dlx create-turbo@latest`.

## Checklist del primer día

- [ ] `node -v` y `pnpm -v` muestran versiones.
- [ ] `pnpm dev` abre la página en `localhost:3000`.
- [ ] El repositorio está en GitHub y tiene un primer commit.
- [ ] Un `Button` de shadcn se ve en la página.
- [ ] `tokens.css` existe y la página usa tu color primario.
- [ ] Tienes un proyecto en Supabase y `.env.local` con sus datos.
- [ ] `git status` **no** muestra `.env.local`.
